import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../dist/create-app.js';
import { PrismaService } from '../dist/shared/database/prisma.service.js';

const origin = process.env.APP_ORIGIN;
const key = process.env.IOT_SOURCE_KEY;
const sourceId = process.env.IOT_SOURCE_ID;
const password = 'journey-test-only';
let app;
let server;
let prisma;
let passwordHash;

beforeAll(async () => {
  if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== '/semh_test') {
    throw new Error('Run trip integration tests on the standalone semh_test database');
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

async function account() {
  const username = 'trip-' + randomUUID();
  const record = await prisma.account.create({
    data: { username, displayName: 'Journey test', passwordHash, assignments: { create: { role: 'STU' } } },
  });
  const auth = await request(server).post('/api/auth/login').set('Origin', origin).send({ username, password }).expect(200);
  return { id: record.id, cookie: auth.headers['set-cookie'][0].split(';')[0], csrf: auth.body.csrfToken };
}

function post(user, url, body) {
  return request(server).post(url).set('Origin', origin).set('Cookie', user.cookie).set('X-CSRF-Token', user.csrf).send(body);
}

function get(user, url) {
  return request(server).get(url).set('Cookie', user.cookie);
}

function hub(capacity) {
  return prisma.mobilityHub.create({
    data: {
      name: 'Journey test Hub', code: 'trip-' + randomUUID(), latitude: 10, longitude: 106,
      vehicleCapacity: capacity, serviceStatus: 'ACTIVE',
    },
  });
}

function vehicle(hubId) {
  return prisma.sharedVehicle.create({
    data: {
      code: 'TRIP-' + randomUUID().slice(0, 8).toUpperCase(), hubId, sourceId, batteryPercent: 65,
      serviceStatus: 'ACTIVE', status: 'AVAILABLE',
    },
  });
}

async function booking() {
  const [student, start] = await Promise.all([account(), hub(3)]);
  const resource = await vehicle(start.id);
  const result = await post(student, '/api/reservations', {
    requestId: randomUUID(), vehicleId: resource.id, hubId: start.id,
  }).expect(201);
  return { student, start, resource, reservation: result.body };
}

function receive(booked, vehicleCode = booked.resource.code, requestId = randomUUID()) {
  return post(booked.student, '/api/trips/pickups', { requestId, reservationId: booked.reservation.id, vehicleCode });
}

function evidence(commandId, vehicleId, hubId, batteryPercent = 65, other = {}) {
  return {
    eventId: randomUUID(), sourceId, type: 'vehicle.handoff', commandId, vehicleId, hubId,
    batteryPercent, confirmed: true, fault: false, observedAt: new Date().toISOString(), ...other,
  };
}

function send(body) {
  return request(server).post('/api/state-events').set('X-IoT-Source-Key', key).send(body);
}

async function activeJourney() {
  const booked = await booking();
  const pending = await receive(booked).expect(202);
  await send(evidence(pending.body.id, booked.resource.id, booked.start.id)).expect(200, { result: 'applied' });
  const trips = await get(booked.student, '/api/trips').expect(200);
  return { ...booked, trip: trips.body[0] };
}

describe('UC-RES-02 and TRIP', () => {
  test('only the reservation owner can cancel and repeated cancellation releases the vehicle once', async () => {
    const booked = await booking();
    const stranger = await account();
    const endpoint = '/api/reservations/' + booked.reservation.id + '/cancel';
    await post(stranger, endpoint, {}).expect(404);
    expect(await prisma.sharedVehicle.findUniqueOrThrow({ where: { id: booked.resource.id } })).toMatchObject({ status: 'RESERVED' });
    const cancelled = await post(booked.student, endpoint, {}).expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
    const repeat = await post(booked.student, endpoint, {}).expect(200);
    expect(repeat.body.version).toBe(cancelled.body.version);
    expect(await prisma.sharedVehicle.findUniqueOrThrow({ where: { id: booked.resource.id } })).toMatchObject({
      status: 'AVAILABLE', reservationHoldId: null,
    });
    expect(await prisma.auditEntry.count({ where: { targetId: booked.reservation.id, action: 'RESERVATION_CANCELLED' } })).toBe(1);
  });

  test('waits for matching device evidence, then fulfills a reservation and starts exactly one trip', async () => {
    const booked = await booking();
    const stranger = await account();
    await receive(booked, 'WRONG-CODE').expect(409);
    const requestId = randomUUID();
    const first = await receive(booked, booked.resource.code, requestId).expect(202);
    const repeat = await receive(booked, booked.resource.code, requestId).expect(202);
    expect(first.body).toMatchObject({ status: 'PENDING' });
    expect(repeat.body.id).toBe(first.body.id);
    const endpoint = '/api/trips/handoffs/' + first.body.id;
    await get(stranger, endpoint).expect(404);
    await get(booked.student, '/api/trips').expect(200, []);
    await request(server).get('/api/state-events/handoffs').expect(401);
    const deviceQueue = await request(server).get('/api/state-events/handoffs').set('X-IoT-Source-Key', key).expect(200);
    expect(deviceQueue.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: first.body.id, vehicleId: booked.resource.id, hubId: booked.start.id }),
    ]));

    const wrongHub = await hub(1);
    await send(evidence(first.body.id, booked.resource.id, wrongHub.id)).expect(409);
    const physical = evidence(first.body.id, booked.resource.id, booked.start.id);
    const replies = await Promise.all([send(physical), send(physical)]);
    expect(replies.map(item => item.body.result).sort()).toEqual(['applied', 'duplicate']);
    expect(await prisma.vehicleReservation.findUniqueOrThrow({ where: { id: booked.reservation.id } })).toMatchObject({ status: 'FULFILLED' });
    expect(await prisma.sharedVehicle.findUniqueOrThrow({ where: { id: booked.resource.id } })).toMatchObject({
      status: 'IN_USE', reservationHoldId: null, hubId: null,
    });
    const trips = await get(booked.student, '/api/trips').expect(200);
    expect(trips.body).toHaveLength(1);
    expect(trips.body[0]).toMatchObject({ status: 'IN_PROGRESS', startBattery: 65 });
    await post(booked.student, '/api/reservations/' + booked.reservation.id + '/cancel', {}).expect(409);
  });

  test('checks destination occupancy again after the device replies and routes low-battery vehicles to charge', async () => {
    const journey = await activeJourney();
    const [full, arrival] = await Promise.all([hub(1), hub(1)]);
    const endpoint = '/api/trips/' + journey.trip.id + '/return';
    const pending = await post(journey.student, endpoint, { hubId: full.id, requestId: randomUUID() }).expect(202);
    await vehicle(full.id);
    await send(evidence(pending.body.id, journey.resource.id, full.id, 20)).expect(200, { result: 'rejected' });
    const open = await get(journey.student, '/api/trips').expect(200);
    expect(open.body[0].status).toBe('IN_PROGRESS');

    const accepted = await post(journey.student, endpoint, { hubId: arrival.id, requestId: randomUUID() }).expect(202);
    await send(evidence(accepted.body.id, journey.resource.id, arrival.id, 20)).expect(200, { result: 'applied' });
    const trips = await get(journey.student, '/api/trips').expect(200);
    expect(trips.body[0]).toMatchObject({
      status: 'COMPLETED', startBattery: 65, endBattery: 20, endHub: { id: arrival.id }, endVehicleStatus: 'AWAITING_CHARGE',
    });
    expect(trips.body[0].durationSeconds).toBeGreaterThanOrEqual(0);
    expect(await prisma.sharedVehicle.findUniqueOrThrow({ where: { id: journey.resource.id } })).toMatchObject({
      status: 'AWAITING_CHARGE', hubId: arrival.id, batteryPercent: 20,
    });
  });

  test('keeps the journey open if the device cannot certify return, and marks a safely returned faulty vehicle out of service', async () => {
    const journey = await activeJourney();
    const arrival = await hub(3);
    const endpoint = '/api/trips/' + journey.trip.id + '/return';
    const create = () => post(journey.student, endpoint, { hubId: arrival.id, requestId: randomUUID() }).expect(202);

    const pending = await create();
    await send(evidence(pending.body.id, journey.resource.id, arrival.id, 60, { confirmed: false }))
      .expect(200, { result: 'rejected' });
    expect(await prisma.trip.findUniqueOrThrow({ where: { id: journey.trip.id } })).toMatchObject({ status: 'IN_PROGRESS' });

    const next = await create();
    await send(evidence(next.body.id, journey.resource.id, arrival.id, 60, { fault: true }))
      .expect(200, { result: 'applied' });
    expect(await prisma.trip.findUniqueOrThrow({ where: { id: journey.trip.id } })).toMatchObject({
      status: 'COMPLETED', endVehicleStatus: 'OUT_OF_SERVICE',
    });
    expect(await prisma.sharedVehicle.findUniqueOrThrow({ where: { id: journey.resource.id } })).toMatchObject({
      status: 'OUT_OF_SERVICE', hubId: arrival.id,
    });
  });
});
