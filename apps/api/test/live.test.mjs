import 'reflect-metadata';
import { randomInt, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';
import { WebSocket } from 'ws';
import { createApp } from '../dist/create-app.js';
import { PrismaService } from '../dist/shared/database/prisma.service.js';

const origin = process.env.APP_ORIGIN;
let app;
let server;
let db;
let wsOrigin;
const sockets = new Set();

beforeAll(async () => {
  if (new URL(process.env.DATABASE_URL).pathname !== '/semh_test') throw new Error('Use the isolated semh_test database');
  app = await createApp();
  await app.listen(0, '127.0.0.1');
  server = app.getHttpServer();
  wsOrigin = 'ws://127.0.0.1:' + server.address().port;
  db = app.get(PrismaService);
});

afterAll(async () => {
  for (const socket of sockets) socket.terminate();
  await app?.close();
});

async function login(username, password) {
  const result = await request(server).post('/api/auth/login').set('Origin', origin).send({ username, password }).expect(200);
  return { cookie: result.headers['set-cookie'][0].split(';')[0], csrf: result.body.csrfToken };
}

async function newStudent() {
  const username = String(randomInt(100000000, 999999999));
  const password = randomUUID();
  await request(server).post('/api/auth/register').set('Origin', origin).send({
    username, password, displayName: 'WebSocket tester',
  }).expect(201);
  return login(username, password);
}

function change(actor, path, data, method = 'post') {
  return request(server)[method]('/api' + path).set('Cookie', actor.cookie).set('Origin', origin)
    .set('X-CSRF-Token', actor.csrf).send({ requestId: randomUUID(), ...data });
}

function dial(actor, topics, options = {}) {
  const query = new URLSearchParams({ topics, ...(options.hub ? { hub: options.hub } : {}) });
  const socket = new WebSocket(wsOrigin + '/api/live?' + query, {
    origin: options.origin ?? origin,
    headers: actor ? { Cookie: actor.cookie } : undefined,
  });
  sockets.add(socket);
  socket.on('error', () => {});
  socket.once('close', () => sockets.delete(socket));
  return socket;
}

async function connect(actor, topics, options) {
  const socket = dial(actor, topics, options);
  await once(socket, 'open', { signal: AbortSignal.timeout(1500) });
  return socket;
}

async function refused(actor, topics, options) {
  const socket = dial(actor, topics, options);
  const [, response] = await once(socket, 'unexpected-response', { signal: AbortSignal.timeout(1500) });
  response.resume();
  socket.terminate();
  return response.statusCode;
}

const nextMessage = async socket => {
  const [value] = await once(socket, 'message', { signal: AbortSignal.timeout(2000) });
  expect(JSON.parse(value.toString())).toEqual({ type: 'changed' });
};
const demoRole = actor => login(actor, process.env['DEMO_' + { operator: 'OPR', admin: 'ADM' }[actor] + '_PASSWORD']);

test('authorizes socket upgrades and sends committed changes for bookings, parking, charging and incidents', async () => {
  const [student, observer, operator, admin] = await Promise.all([
    newStudent(), newStudent(), demoRole('operator'), demoRole('admin'),
  ]);
  const sourceId = process.env.IOT_SOURCE_ID;
  const code = 'LIVE-' + randomUUID().slice(0, 8);
  const hub = await db.mobilityHub.create({
    data: {
      code, name: code, latitude: 10.87, longitude: 106.80, serviceStatus: 'ACTIVE',
      vehicles: { create: { code: code + '-V', sourceId, status: 'AVAILABLE', serviceStatus: 'ACTIVE', batteryPercent: 80, lastObservedAt: new Date() } },
      parkingSpaces: { create: { code: code + '-P', sourceId, status: 'AVAILABLE', serviceStatus: 'ACTIVE', occupied: false, lastObservedAt: new Date() } },
      chargingPoints: { create: { code: code + '-C', sourceId, connector: 'AC', powerKw: 0.5, status: 'AVAILABLE', serviceStatus: 'ACTIVE', lastObservedAt: new Date() } },
    },
    include: { vehicles: true, parkingSpaces: true },
  });
  const anotherHub = await db.mobilityHub.findFirstOrThrow({ where: { id: { not: hub.id } } });
  const username = 'scoped-live-' + randomUUID().slice(0, 8);
  const password = randomUUID();
  const account = (await change(admin, '/admin/accounts', { username, displayName: 'Scoped operator', password }).expect(201)).body;
  await change(admin, '/admin/accounts/' + account.id + '/roles', {
    role: 'OPR', grant: true, hubIds: [anotherHub.id], reason: 'Live test scope', version: account.version,
  }).expect(201);
  const scoped = await login(username, password);
  expect(await refused(null, 'vehicle')).toBe(401);
  expect(await refused(student, 'incident')).toBe(403);
  expect(await refused(operator, 'incident', { origin: 'https://invalid.example' })).toBe(403);
  expect(await refused(student, 'anything')).toBe(400);

  const cars = await connect(observer, 'vehicle', { hub: hub.id });
  const otherCars = await connect(observer, 'vehicle', { hub: anotherHub.id });
  const parking = await connect(observer, 'parking');
  const charging = await connect(observer, 'charging');
  const incidents = await connect(operator, 'incident');
  const otherIncidents = await connect(scoped, 'incident');
  const outOfScope = [];
  otherCars.on('message', message => outOfScope.push(message));
  otherIncidents.on('message', message => outOfScope.push(message));

  const input = { hubId: hub.id, vehicleId: hub.vehicles[0].id };
  const held = await Promise.all([nextMessage(cars), change(student, '/reservations', input).expect(201)]);
  expect((await db.sharedVehicle.findUniqueOrThrow({ where: { id: input.vehicleId } })).status).toBe('RESERVED');
  const rejected = [];
  cars.on('message', message => rejected.push(message));
  await change(observer, '/reservations', input).expect(409);
  await delay(100);
  expect(rejected).toHaveLength(0);
  await Promise.all([nextMessage(cars), change(student, '/reservations/' + held[1].body.id + '/cancel', {}).expect(200)]);

  const privateVehicle = (await change(student, '/parking/vehicles', {
    plate: '67U2' + String(randomInt(100000)).padStart(5, '0'), batteryPercent: 35,
  }).expect(201)).body;
  const [, parked] = await Promise.all([
    nextMessage(parking), change(student, '/parking/reservations', { hubId: hub.id, privateVehicleId: privateVehicle.id }).expect(201),
  ]);
  await Promise.all([nextMessage(parking), change(student, '/parking/reservations/' + parked.body.id + '/cancel', {}).expect(200)]);

  await Promise.all([
    nextMessage(charging), change(student, '/charging/requests', { hubId: hub.id, kind: 'PRIVATE', vehicleId: privateVehicle.id }).expect(201),
  ]);
  await Promise.all([
    nextMessage(incidents), change(operator, '/operations/incidents', {
      kind: 'PARKING_SPACE', resourceId: hub.parkingSpaces[0].id, title: code, description: 'Live incident',
    }).expect(201),
  ]);
  expect(outOfScope).toHaveLength(0);
}, 20000);
