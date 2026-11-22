import 'reflect-metadata';
import { randomInt, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../dist/create-app.js';
import { PrismaService } from '../dist/shared/database/prisma.service.js';
import { AccessService } from '../dist/modules/gen/application/access.service.js';

let app;
let server;
let prisma;
const origin = process.env.APP_ORIGIN;
const vehicleId = '86e274aa-6305-4f51-92d5-b4b8eaf03e01';

function login(username, password) {
  return request(server).post('/api/auth/login').set('Origin', origin).send({ username, password });
}

function sessionCookie(response) {
  return response.headers['set-cookie'][0].split(';')[0];
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== '/semh_test') {
    throw new Error('Run integration tests on the standalone semh_test database');
  }
  app = await createApp();
  await app.init();
  server = app.getHttpServer();
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app?.close();
});

describe('GEN session and access', () => {
  test('validates a student password and maintains a revocable session', async () => {
    const result = await login(' STUDENT ', process.env.DEMO_STU_PASSWORD).expect(200);
    expect(result.body).toMatchObject({ displayName: 'Sinh viên demo', roles: ['STU'] });
    expect(result.body).not.toHaveProperty('passwordHash');
    expect(result.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(result.headers['set-cookie'][0]).toContain('SameSite=Lax');

    const cookie = sessionCookie(result);
    const view = await request(server).get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(view.body.roles).toEqual(['STU']);
    const token = cookie.slice('semh_session='.length);
    await expect(app.get(AccessService).verifyAccess(token, ['ADM'])).rejects.toMatchObject({ status: 403 });

    await request(server).post('/api/auth/logout').set('Cookie', cookie).set('Origin', origin).expect(403);
    await request(server).post('/api/auth/logout')
      .set('Cookie', cookie).set('Origin', origin).set('X-CSRF-Token', result.body.csrfToken).expect(204);
    await request(server).get('/api/auth/me').set('Cookie', cookie).expect(401);
  });

  test('rejects invalid credentials and unauthenticated requests', async () => {
    await login('student', 'wrong-password').expect(401);
    await request(server).get('/api/auth/me').expect(401);
    await request(server).post('/api/auth/login')
      .send({ username: 'student', password: process.env.DEMO_STU_PASSWORD }).expect(403);
  });

  test.each([
    ['operator', 'OPR'], ['maintenance', 'MNT'], ['admin', 'ADM'],
  ])('assigns the seeded role for %s', async (username, role) => {
    const result = await login(username, process.env['DEMO_' + role + '_PASSWORD']).expect(200);
    expect(result.body.roles).toEqual([role]);
  });
});

describe('student self-registration', () => {
  const register = (student, originHeader = origin) =>
    request(server).post('/api/auth/register').set('Origin', originHeader).send(student);

  test('creates a student account atomically and signs in with its student role', async () => {
    const username = String(randomInt(100000000, 999999999));
    const password = 'Example-Student-Password';
    try {
      await register({ username: ' ' + username + ' ', displayName: ' Sinh viên mới ', password, role: 'ADM' })
        .expect(201, { username });
      const result = await login(username, password).expect(200);
      expect(result.body).toMatchObject({ displayName: 'Sinh viên mới', roles: ['STU'] });
      const account = await prisma.account.findUniqueOrThrow({ where: { username } });
      expect(account.passwordHash).toMatch(/^\$argon2/);
      expect(account.passwordHash).not.toBe(password);
      await request(server).get('/api/admin/accounts').set('Cookie', sessionCookie(result)).expect(403);
    } finally {
      await prisma.account.deleteMany({ where: { username } });
    }
  });

  test('rejects bad registration data and keeps duplicate requests at one account', async () => {
    const username = String(randomInt(100000000, 999999999));
    const input = { username, displayName: 'Sinh viên test', password: 'Example-Student-Password' };
    await register(input, 'https://other.example').expect(403);
    await register({ ...input, username: 'admin' }).expect(400);
    await register({ ...input, password: 'short' }).expect(400);

    try {
      const attempts = await Promise.all([register(input), register(input)]);
      expect(attempts.map(item => item.status).sort()).toEqual([201, 409]);
      expect(await prisma.account.count({ where: { username } })).toBe(1);
    } finally {
      await prisma.account.deleteMany({ where: { username } });
    }
  });
});

describe('database and IoT', () => {
  test('reads hub data and applies a battery event once in source sequence order', async () => {
    await request(server).get('/api/health').expect(200, { status: 'ok' });
    const before = await prisma.sharedVehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    const event = {
      type: 'vehicle.battery',
      sourceId: process.env.IOT_SOURCE_ID,
      vehicleId,
      sequence: before.telemetrySequence + 2,
      eventId: randomUUID(),
      observedAt: new Date().toISOString(),
      batteryPercent: 74,
    };

    const send = body => request(server).post('/api/state-events')
      .set('X-IoT-Source-Key', process.env.IOT_SOURCE_KEY).send(body);
    await request(server).post('/api/state-events').send(event).expect(401);
    await send({ ...event, batteryPercent: 101 }).expect(400);
    await send(event).expect(200, { result: 'applied' });
    await send(event).expect(200, { result: 'duplicate' });
    await send({ ...event, eventId: randomUUID(), sequence: event.sequence - 1, batteryPercent: 5 })
      .expect(200, { result: 'stale' });

    const list = await request(server).get('/api/hubs').expect(200);
    const vehicles = list.body.flatMap(hub => hub.vehicles);
    expect(vehicles.find(vehicle => vehicle.id === vehicleId)).toMatchObject({ batteryPercent: 74 });
    const after = await prisma.sharedVehicle.findUniqueOrThrow({ where: { id: vehicleId } });
    expect(after.serviceStatus).toBe(before.serviceStatus);
    expect(after.status).toBe(before.status);
  });
});
