import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../dist/create-app.js';
import { AuditService } from '../dist/shared/audit/audit.service.js';
import { PrismaService } from '../dist/shared/database/prisma.service.js';
import { ReservationService } from '../dist/modules/res/application/reservation.service.js';

const origin = process.env.APP_ORIGIN;
const password = 'reservation-test-only';
let app;
let server;
let prisma;
let passwordHash;

beforeAll(async () => {
  if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== '/semh_test') {
    throw new Error('Run integration tests on the standalone semh_test database');
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

async function account(role = 'STU') {
  const username = 'res-test-' + randomUUID();
  const record = await prisma.account.create({
    data: { username, displayName: 'Reservation test', passwordHash, assignments: { create: { role } } },
  });
  const auth = await request(server).post('/api/auth/login').set('Origin', origin).send({ username, password }).expect(200);
  return { id: record.id, cookie: auth.headers['set-cookie'][0].split(';')[0], csrf: auth.body.csrfToken };
}

async function vehicle(batteryPercent = 60, hubStatus = 'ACTIVE') {
  const hub = await prisma.mobilityHub.create({
    data: { code: 'res-test-' + randomUUID(), name: 'Reservation test Hub', latitude: 10, longitude: 106, serviceStatus: hubStatus },
  });
  return prisma.sharedVehicle.create({
    data: {
      code: 'res-test-' + randomUUID(), hubId: hub.id, batteryPercent,
      serviceStatus: 'ACTIVE', status: 'AVAILABLE', sourceId: 'reservation-test',
    },
  });
}

function input(resource) {
  return { requestId: randomUUID(), hubId: resource.hubId, vehicleId: resource.id };
}

function reserve(user, body) {
  return request(server).post('/api/reservations')
    .set('Origin', origin).set('Cookie', user.cookie).set('X-CSRF-Token', user.csrf)
    .send(body);
}

function active(user) {
  return request(server).get('/api/reservations/active').set('Cookie', user.cookie);
}

describe('UC-RES-01', () => {
  test('holds an eligible vehicle for ten minutes, persists the receipt and prevents a second active booking', async () => {
    const [student, first, second] = await Promise.all([account(), vehicle(30), vehicle()]);
    const body = input(first);
    const confirmed = await reserve(student, body).expect(201);

    expect(confirmed.body).toMatchObject({ status: 'CONFIRMED', vehicle: { id: first.id }, hub: { id: first.hubId } });
    expect(Date.parse(confirmed.body.expiresAt) - Date.parse(confirmed.body.confirmedAt)).toBe(10 * 60_000);
    expect(await prisma.sharedVehicle.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      status: 'RESERVED', reservationHoldId: confirmed.body.id,
    });

    const repeat = await reserve(student, body).expect(201);
    expect(repeat.body.id).toBe(confirmed.body.id);

    const replay = await request(server).get('/api/reservations/requests/' + body.requestId)
      .set('Cookie', student.cookie).expect(200);
    expect(replay.body.id).toBe(confirmed.body.id);
    const unrelated = await account();
    await request(server).get('/api/reservations/requests/' + body.requestId).set('Cookie', unrelated.cookie).expect(404);

    await reserve(student, { ...input(second), requestId: body.requestId }).expect(409);
    const conflict = await reserve(student, input(second)).expect(409);
    expect(conflict.body).toMatchObject({
      code: 'ACTIVE_RESERVATION_EXISTS', reservation: { id: confirmed.body.id },
    });
    expect(await prisma.auditEntry.count({ where: { targetId: confirmed.body.id, action: 'RESERVATION_CONFIRMED' } })).toBe(1);
  });

  test('allows exactly one of two students to reserve the same vehicle concurrently', async () => {
    const [first, second, resource] = await Promise.all([account(), account(), vehicle()]);
    const outcomes = await Promise.all([reserve(first, input(resource)), reserve(second, input(resource))]);

    expect(outcomes.map(item => item.status).sort()).toEqual([201, 409]);
    const reservations = await prisma.vehicleReservation.findMany({ where: { vehicleId: resource.id } });
    expect(reservations).toHaveLength(1);
    expect(reservations[0].status).toBe('CONFIRMED');
    expect(await prisma.sharedVehicle.findUniqueOrThrow({ where: { id: resource.id } })).toMatchObject({
      status: 'RESERVED', reservationHoldId: reservations[0].id,
    });
  });

  test('rejects low battery, an inactive pickup Hub and non-student accounts', async () => {
    const [student, operator, lowBattery, atInactiveHub] = await Promise.all([
      account(), account('OPR'), vehicle(29), vehicle(60, 'INACTIVE'),
    ]);
    await reserve(student, input(lowBattery)).expect(409);
    await reserve(student, input(atInactiveHub)).expect(409);
    await reserve(operator, input(lowBattery)).expect(403);
    await active(student).expect(200, { reservation: null });
  });

  test('reuses an expired hold slot safely and retains OutOfService vehicles during expiry', async () => {
    const [student, nextStudent, resource, broken] = await Promise.all([account(), account(), vehicle(), vehicle()]);
    const first = await reserve(student, input(resource)).expect(201);
    const expiredAt = new Date(Date.now() - 5000);
    await prisma.vehicleReservation.update({
      where: { id: first.body.id }, data: { expiresAt: expiredAt },
    });

    const next = await reserve(nextStudent, input(resource)).expect(201);
    expect(await prisma.vehicleReservation.findUniqueOrThrow({ where: { id: first.body.id } })).toMatchObject({ status: 'EXPIRED' });
    expect(await prisma.sharedVehicle.findUniqueOrThrow({ where: { id: resource.id } })).toMatchObject({ reservationHoldId: next.body.id });

    const second = await reserve(student, input(broken)).expect(201);
    await prisma.$transaction([
      prisma.vehicleReservation.update({ where: { id: second.body.id }, data: { expiresAt: expiredAt } }),
      prisma.sharedVehicle.update({ where: { id: broken.id }, data: { status: 'OUT_OF_SERVICE' } }),
    ]);
    await app.get(ReservationService).expireDueReservations();
    await active(student).expect(200, { reservation: null });
    expect(await prisma.sharedVehicle.findUniqueOrThrow({ where: { id: broken.id } })).toMatchObject({
      status: 'OUT_OF_SERVICE', reservationHoldId: null,
    });
  });

  test('rolls back both the held vehicle and the reservation when the audit write fails', async () => {
    const [student, resource] = await Promise.all([account(), vehicle()]);
    const audit = jest.spyOn(app.get(AuditService), 'append').mockRejectedValueOnce(new Error('Test audit failure'));
    try {
      await reserve(student, input(resource)).expect(500);
      expect(await prisma.vehicleReservation.count({ where: { vehicleId: resource.id } })).toBe(0);
      expect(await prisma.sharedVehicle.findUniqueOrThrow({ where: { id: resource.id } })).toMatchObject({
        status: 'AVAILABLE', reservationHoldId: null,
      });
    } finally {
      audit.mockRestore();
    }
  });
});
