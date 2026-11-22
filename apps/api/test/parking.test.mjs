import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../dist/create-app.js';
import { ParkingService } from '../dist/modules/park/application/parking.service.js';
import { PrismaService } from '../dist/shared/database/prisma.service.js';

const { APP_ORIGIN: origin, IOT_SOURCE_KEY: key, IOT_SOURCE_ID: sourceId } = process.env;
const password = 'parking-test-only';
let app;
let server;
let prisma;
let passwordHash;

beforeAll(async () => {
  if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== '/semh_test') {
    throw new Error('Run parking integration tests on the standalone semh_test database');
  }
  app = await createApp();
  await app.init();
  server = app.getHttpServer();
  prisma = app.get(PrismaService);
  passwordHash = await hash(password);
});

afterAll(async () => {
  await app?.close();
});

async function student() {
  const username = 'park-' + randomUUID();
  const account = await prisma.account.create({
    data: { username, displayName: 'Parking test', passwordHash, assignments: { create: { role: 'STU' } } },
  });
  const user = await request(server).post('/api/auth/login').set('Origin', origin).send({ username, password }).expect(200);
  const vehicle = await prisma.privateVehicle.create({ data: { ownerId: account.id, plate: randomUUID() } });
  return { cookie: user.headers['set-cookie'][0].split(';')[0], csrf: user.body.csrfToken, vehicle };
}

async function location() {
  const hub = await prisma.mobilityHub.create({
    data: { code: 'PARK-' + randomUUID(), name: 'Parking test Hub', latitude: 10, longitude: 106, serviceStatus: 'ACTIVE' },
  });
  const space = await prisma.parkingSpace.create({
    data: {
      code: 'PARK-' + randomUUID(), hubId: hub.id, serviceStatus: 'ACTIVE', status: 'AVAILABLE',
      occupied: false, sourceId, lastObservedAt: new Date(),
    },
  });
  return { hub, space };
}

function write(user, path, data) {
  return request(server).post('/api/parking/reservations' + path)
    .set('Origin', origin).set('Cookie', user.cookie).set('X-CSRF-Token', user.csrf).send(data);
}

function reserve(user, hubId, privateVehicleId = user.vehicle.id, requestId = randomUUID()) {
  return write(user, '', { hubId, privateVehicleId, requestId });
}

async function book() {
  const user = await student();
  const { hub, space } = await location();
  const { body: reservation } = await reserve(user, hub.id).expect(201);
  return { user, hub, space, reservation };
}

function send(spaceId, data, sourceKey = key) {
  return request(server).post('/api/state-events').set('X-IoT-Source-Key', sourceKey).send({
    type: 'parking.state', eventId: randomUUID(), sourceId, spaceId, observedAt: new Date().toISOString(),
    verificationId: null, privateVehicleId: null, fault: false, ...data,
  });
}

function readSpace(id) {
  return prisma.parkingSpace.findUniqueOrThrow({ where: { id } });
}

async function queue(reservation, kind) {
  const response = await request(server).get('/api/state-events/parking-verifications').set('X-IoT-Source-Key', key).expect(200);
  return response.body.find(item => item.kind === kind &&
    item.spaceId === reservation.space.id && item.privateVehicleId === reservation.vehicle.id);
}

test('allocates one space under concurrent requests and replays the winning receipt', async () => {
  const { hub, space } = await location();
  const first = await student();
  const second = await student();
  await reserve(second, hub.id, first.vehicle.id).expect(404);
  const requestIds = [randomUUID(), randomUUID()];
  const results = await Promise.all([first, second].map((user, i) => reserve(user, hub.id, user.vehicle.id, requestIds[i])));
  expect(results.map(result => result.status).sort()).toEqual([201, 409]);
  const winner = results.findIndex(result => result.status === 201);
  const user = [first, second][winner];
  const res = results[winner].body;
  expect(new Date(res.expiresAt) - new Date(res.confirmedAt)).toBe(20 * 60_000);
  expect((await reserve(user, hub.id, user.vehicle.id, requestIds[winner]).expect(201)).body.id).toBe(res.id);
  expect(await readSpace(space.id)).toMatchObject({ status: 'RESERVED' });
  expect(await prisma.parkingReservation.count({ where: { spaceId: space.id } })).toBe(1);
});

test('requires source-bound check-in and verifies a safe checkout exactly once', async () => {
  const { user, space, reservation } = await book();
  const stranger = await student();
  await write(stranger, '/' + reservation.id + '/check-in', { requestId: randomUUID() }).expect(404);
  const checkIn = '/' + reservation.id + '/check-in';
  await write(user, checkIn, { requestId: randomUUID() }).expect(200);
  const initial = await queue(reservation, 'CHECK_IN');
  expect(initial).toBeDefined();
  await send(space.id, { verificationId: initial.id, occupied: true, privateVehicleId: user.vehicle.id }, 'invalid').expect(401);
  await send(space.id, { verificationId: initial.id, occupied: true, privateVehicleId: stranger.vehicle.id })
    .expect(200, { result: 'rejected' });
  expect((await prisma.parkingReservation.findUniqueOrThrow({ where: { id: reservation.id } })).status).toBe('CONFIRMED');

  await write(user, checkIn, { requestId: randomUUID() }).expect(200);
  const incoming = await queue(reservation, 'CHECK_IN');
  const arrival = { verificationId: incoming.id, occupied: true, privateVehicleId: user.vehicle.id };
  await send(space.id, arrival).expect(200, { result: 'applied' });
  await send(space.id, arrival).expect(200, { result: 'duplicate' });
  expect(await readSpace(space.id)).toMatchObject({ status: 'OCCUPIED' });
  await write(user, '/' + reservation.id + '/cancel', {}).expect(409);

  const checkOut = '/' + reservation.id + '/check-out';
  await write(user, checkOut, { requestId: randomUUID() }).expect(200);
  const leaving = await queue(reservation, 'CHECK_OUT');
  await send(space.id, { verificationId: leaving.id, occupied: false }).expect(200, { result: 'applied' });
  expect(await readSpace(space.id)).toMatchObject({ status: 'AVAILABLE', occupied: false });
  const record = await prisma.parkingReservation.findUniqueOrThrow({ where: { id: reservation.id } });
  expect(record).toMatchObject({ status: 'COMPLETED', checkInAt: expect.any(Date), checkOutAt: expect.any(Date) });
});

test('finishes safe checkout while keeping a faulty space out of service', async () => {
  const { user, space, reservation } = await book();
  const path = '/' + reservation.id;
  await write(user, path + '/check-in', { requestId: randomUUID() }).expect(200);
  const incoming = await queue(reservation, 'CHECK_IN');
  await send(space.id, { verificationId: incoming.id, occupied: true, privateVehicleId: user.vehicle.id }).expect(200);
  await write(user, path + '/check-out', { requestId: randomUUID() }).expect(200);
  const leaving = await queue(reservation, 'CHECK_OUT');
  await send(space.id, { verificationId: leaving.id, occupied: false, fault: true }).expect(200, { result: 'applied' });
  expect(await readSpace(space.id)).toMatchObject({ status: 'OUT_OF_SERVICE', fault: true });
  expect((await prisma.parkingReservation.findUniqueOrThrow({ where: { id: reservation.id } })).status).toBe('COMPLETED');
  expect(await prisma.auditEntry.count({ where: { targetId: space.id, action: 'PARKING_SPACE_FAULT' } })).toBe(1);
});

test('expiry and cancellation release only spaces confirmed empty and fault-free', async () => {
  const normal = await book();
  const unknown = await book();
  const faulted = await book();
  await send(unknown.space.id, { occupied: null }).expect(200, { result: 'applied' });
  await send(faulted.space.id, { occupied: false, fault: true }).expect(200, { result: 'applied' });
  const ids = [normal.reservation.id, unknown.reservation.id];
  await prisma.parkingReservation.updateMany({ where: { id: { in: ids } }, data: { expiresAt: new Date(0) } });
  const parking = app.get(ParkingService);
  await parking.expireDueReservations();
  await parking.expireDueReservations();
  expect(await prisma.parkingReservation.count({ where: { id: { in: ids }, status: 'EXPIRED' } })).toBe(2);
  expect(await readSpace(normal.space.id)).toMatchObject({ status: 'AVAILABLE' });
  expect(await readSpace(unknown.space.id)).toMatchObject({ status: 'OUT_OF_SERVICE', occupied: null });
  const { body } = await write(faulted.user, '/' + faulted.reservation.id + '/cancel', {}).expect(200);
  expect(body.status).toBe('CANCELLED');
  expect(await readSpace(faulted.space.id)).toMatchObject({ status: 'OUT_OF_SERVICE', fault: true });
});
