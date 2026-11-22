import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../dist/create-app.js';
import { PrismaService } from '../dist/shared/database/prisma.service.js';

let app;
let server;
let db;
let student;
let operator;
let admin;
let technician;
let source;
let target;
const origin = process.env.APP_ORIGIN;
const key = process.env.IOT_SOURCE_KEY;
const sourceId = process.env.IOT_SOURCE_ID;

beforeAll(async () => {
  if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== '/semh_test') {
    throw new Error('Use the isolated semh_test database');
  }
  app = await createApp();
  await app.init();
  server = app.getHttpServer();
  db = app.get(PrismaService);
  student = await login('student', process.env.DEMO_STU_PASSWORD);
  operator = await login('operator', process.env.DEMO_OPR_PASSWORD);
  admin = await login('admin', process.env.DEMO_ADM_PASSWORD);
  technician = await login('maintenance', process.env.DEMO_MNT_PASSWORD);
  source = await fixtureHub('A');
  target = await fixtureHub('B');
});

afterAll(async () => { await app?.close(); });

async function fixtureHub(name) {
  const code = 'QA-' + randomUUID().slice(0, 8);
  const now = new Date();
  return db.mobilityHub.create({
    data: {
      code, name: 'Final flow ' + name, latitude: 10.87, longitude: 106.8, serviceStatus: 'ACTIVE', lastObservedAt: now,
      vehicles: { create: [1, 2].map(i => ({
        code: code + '-V' + i, sourceId, status: 'AVAILABLE', serviceStatus: 'ACTIVE', batteryPercent: 70, lastObservedAt: now,
      })) },
      chargingPoints: { create: [1, 2].map(i => ({
        code: code + '-C' + i, sourceId, connector: 'AC', powerKw: 0.5,
        status: 'AVAILABLE', serviceStatus: 'ACTIVE', lastObservedAt: now,
      })) },
    },
  });
}

async function login(username, password) {
  const response = await request(server).post('/api/auth/login').set('Origin', origin).send({ username, password }).expect(200);
  return { id: response.body.accountId, cookie: response.headers['set-cookie'][0].split(';')[0], csrf: response.body.csrfToken };
}

function read(user, path) {
  const operation = request(server).get('/api' + path);
  return user ? operation.set('Cookie', user.cookie) : operation;
}

function write(user, path, body, method = 'post') {
  return request(server)[method]('/api' + path).set('Cookie', user.cookie).set('Origin', origin)
    .set('X-CSRF-Token', user.csrf).send({ requestId: randomUUID(), ...body });
}

function ingest(type, input) {
  return request(server).post('/api/state-events').set('X-IoT-Source-Key', key).send({
    type, eventId: randomUUID(), sourceId, observedAt: new Date().toISOString(), ...input,
  });
}

test('admin grants scoped operator access, revokes sessions on lock and protects the last active admin', async () => {
  const username = 'final-' + randomUUID().slice(0, 12);
  const password = 'final-test-password';
  const created = await write(admin, '/admin/accounts', { username, displayName: 'Scoped account', password }).expect(201);
  expect(created.body).not.toHaveProperty('passwordHash');
  await read(student, '/admin/accounts').expect(403);
  const assignment = await write(admin, '/admin/accounts/' + created.body.id + '/roles', {
    role: 'OPR', grant: true, hubIds: [source.id], version: created.body.version, reason: 'Kiểm thử quyền Hub',
  }).expect(201);
  const session = await login(username, password);
  const dashboard = await read(session, '/operations').expect(200);
  expect(dashboard.body.hubs.map(hub => hub.id)).toEqual([source.id]);
  await write(session, '/operations/resources', {
    kind: 'PARKING_SPACE', hubId: target.id, code: 'ASSIGN-TEST', reason: 'Sai phạm vi',
  }).expect(403);
  const locked = await write(admin, '/admin/accounts/' + created.body.id, {
    status: 'LOCKED', version: assignment.body.version, reason: 'Kiểm thử khóa',
  }, 'patch').expect(200);
  await read(session, '/auth/me').expect(401);
  await write(admin, '/admin/accounts/' + created.body.id, {
    status: 'ACTIVE', version: locked.body.version, reason: 'Mở lại',
  }, 'patch').expect(200);
  await read(session, '/auth/me').expect(401);
  const list = await read(admin, '/admin/accounts').expect(200);
  const owner = list.body.find(account => account.id === admin.id);
  await write(admin, '/admin/accounts/' + admin.id, { status: 'LOCKED', version: owner.version, reason: 'Kiểm thử guard' }, 'patch').expect(409);
});

test('creates a Draft resource and requires authenticated observations to activate it', async () => {
  const code = 'QA-P-' + randomUUID().slice(0, 8);
  const created = await write(admin, '/operations/catalog', {
    kind: 'PARKING_SPACE', code, hubId: source.id,
  }).expect(201);
  expect(created.body).toMatchObject({ serviceStatus: 'DRAFT', status: 'OUT_OF_SERVICE' });
  const path = '/operations/resources/PARKING_SPACE/' + created.body.id;
  await write(operator, path, { serviceStatus: 'ACTIVE', version: created.body.version, reason: 'Chưa có tín hiệu' }, 'patch').expect(409);
  await ingest('parking.state', { spaceId: created.body.id, verificationId: null, privateVehicleId: null, occupied: false, fault: false }).expect(200);
  const enabled = await write(operator, path, { serviceStatus: 'ACTIVE', version: created.body.version, reason: 'Cảm biến đã báo trống' }, 'patch').expect(200);
  expect(enabled.body).toMatchObject({ serviceStatus: 'ACTIVE', status: 'AVAILABLE' });
  await write(operator, path, { hubId: target.id, description: 'cấm', version: enabled.body.version, reason: 'Không đổi Hub' }, 'patch').expect(400);
  await write(operator, path, { serviceStatus: 'INACTIVE', version: enabled.body.version, reason: 'Dừng bảo trì' }, 'patch').expect(200);
});

test('schedules, adjusts, starts and releases charging only after matching device evidence', async () => {
  const vehicle = await db.privateVehicle.create({
    data: { ownerId: student.id, plate: 'Charge-' + randomUUID(), batteryPercent: 15, lastObservedAt: new Date() },
  });
  const input = { kind: 'PRIVATE', hubId: source.id, vehicleId: vehicle.id };
  const preview = await write(student, '/charging/preview', input).expect(201);
  expect(preview.body.pointId).toBeTruthy();
  expect(await db.chargingRequest.count({ where: { vehicleId: vehicle.id } })).toBe(0);
  const scheduled = await write(student, '/charging/requests', input).expect(201);
  expect(scheduled.body).toMatchObject({ status: 'SCHEDULED', priority: 1 });
  const points = await db.chargingPoint.findMany({ where: { hubId: source.id } });
  const other = points.find(point => point.id !== scheduled.body.session.pointId);
  const adjusted = await write(operator, '/charging/requests/' + scheduled.body.id, {
    pointId: other.id, rank: 1, reason: 'Đổi cổng trước khi sạc', version: scheduled.body.version,
  }, 'patch').expect(200);
  const session = adjusted.body.session;
  expect(session.pointId).toBe(other.id);
  const evidence = { pointId: session.pointId, sessionId: session.id };
  await ingest('charging.state', { ...evidence, phase: 'STARTED', batteryPercent: 15 }).expect(200, { result: 'applied' });
  await ingest('charging.state', { ...evidence, phase: 'RELEASED', batteryPercent: 15 }).expect(200, { result: 'rejected' });
  await ingest('charging.state', { ...evidence, phase: 'COMPLETED', batteryPercent: 100 }).expect(200, { result: 'applied' });
  expect((await db.chargingPoint.findUniqueOrThrow({ where: { id: other.id } })).status).toBe('OCCUPIED');
  await ingest('charging.state', { ...evidence, phase: 'RELEASED', batteryPercent: 100 }).expect(200, { result: 'applied' });
  expect((await db.chargingPoint.findUniqueOrThrow({ where: { id: other.id } })).status).toBe('AVAILABLE');
});

test('deduplicates device incidents, restricts technicians and restores only a verified repair', async () => {
  const space = await db.parkingSpace.create({
    data: { code: 'Fault-' + randomUUID(), hubId: target.id, serviceStatus: 'ACTIVE', status: 'AVAILABLE',
      occupied: false, sourceId, lastObservedAt: new Date() },
  });
  const evidence = { spaceId: space.id, verificationId: null, privateVehicleId: null, occupied: false, fault: true };
  await ingest('parking.state', evidence).expect(200);
  await ingest('parking.state', evidence).expect(200);
  const rows = await db.incident.findMany({ where: { resourceId: space.id } });
  expect(rows).toHaveLength(1);
  const path = '/operations/incidents/' + rows[0].id;
  const update = (user, version, action, extra = {}) => write(user, path, {
    version, action, reason: 'Kiểm tra và ghi nhận', ...extra,
  }, 'patch');
  await update(technician, rows[0].version, 'START').expect(403);
  const seen = await update(operator, rows[0].version, 'ACKNOWLEDGE').expect(200);
  const assigned = await update(operator, seen.body.version, 'ASSIGN', { assigneeId: technician.id }).expect(200);
  const active = await update(technician, assigned.body.version, 'START').expect(200);
  const failed = await update(technician, active.body.version, 'RESOLVE', { safetyPassed: false }).expect(200);
  expect(failed.body.status).toBe('IN_PROGRESS');
  expect((await db.parkingSpace.findUniqueOrThrow({ where: { id: space.id } })).status).toBe('OUT_OF_SERVICE');
  const safe = await update(technician, failed.body.version, 'RESOLVE', { safetyPassed: true }).expect(200);
  expect(safe.body.status).toBe('RESOLVED');
  await update(operator, safe.body.version, 'CLOSE').expect(200);
  expect((await db.parkingSpace.findUniqueOrThrow({ where: { id: space.id } })).status).toBe('AVAILABLE');
});

test('runs What-if on an isolated snapshot and transfers a real vehicle only after approved progress', async () => {
  const hubs = [source.id, target.id];
  const before = await db.sharedVehicle.findMany({ where: { hubId: { in: hubs } }, orderBy: { id: 'asc' } });
  const scenario = await write(operator, '/simulations/scenarios', {
    name: 'Cao điểm kiểm thử', objective: 'So sánh nhu cầu xe', hubIds: hubs,
    parameters: {
      durationMinutes: 48, demandMultiplier: 2, demandProfile: 'PEAK', chargingReduction: 75, closedHubId: null,
      override: { hubId: source.id, fleetCapacity: 1, chargeKw: 0.5 },
      pausedResourceIds: [before.find(vehicle => vehicle.hubId === target.id).id],
    },
  }).expect(201);
  const result = await write(operator, '/simulations/scenarios/' + scenario.body.id + '/runs', { version: scenario.body.version }).expect(202);
  const path = '/simulations/runs/' + result.body.id;
  let completed;
  for (let attempt = 0; attempt < 20; attempt++) {
    completed = (await read(operator, path).expect(200)).body;
    if (completed.analysisReady) break;
    await delay(50);
  }
  expect(completed).toMatchObject({ status: 'COMPLETED', analysisReady: true, progress: 100 });
  expect(completed.result.warnings).toContain('Final flow A vượt sức chứa xe ở mốc cơ sở.');
  const rerun = await write(operator, '/simulations/scenarios/' + scenario.body.id + '/runs', {
    version: scenario.body.version, sourceRunId: result.body.id,
  }).expect(202);
  expect(rerun.body.baseTime).toBe(completed.baseTime);
  expect(await db.sharedVehicle.findMany({ where: { hubId: { in: hubs } }, orderBy: { id: 'asc' } })).toEqual(before);
  const rec = completed.result.recommendations.find(item => item.kind === 'TRANSFER');
  expect(rec).toBeTruthy();
  const prepared = await read(operator, path + '/recommendations/' + rec.id + '/draft').expect(200);
  expect(await db.redistributionPlan.count({ where: { recommendationId: rec.id } })).toBe(0);
  const input = { ...prepared.body, vehicleIds: prepared.body.vehicleIds.slice(0, 1), scheduledAt: new Date().toISOString() };
  const saved = await write(operator, '/operations/plans', input).expect(201);
  const vehicleId = input.vehicleIds[0];
  const planPath = '/operations/plans/' + saved.body.id + '/actions';
  const change = (row, action, actualHubId) => write(operator, planPath, {
    version: row.version, action, actualHubId, vehicleId, reason: 'Đối chiếu thực tế',
  });
  const approved = await change(saved.body, 'APPROVE').expect(201);
  expect((await db.sharedVehicle.findUniqueOrThrow({ where: { id: vehicleId } })).hubId).toBe(input.sourceHubId);
  const departed = await change(approved.body, 'DEPART', input.sourceHubId).expect(201);
  expect((await db.sharedVehicle.findUniqueOrThrow({ where: { id: vehicleId } })).hubId).toBeNull();
  await change(departed.body, 'ARRIVE', input.sourceHubId).expect(409);
  const arrived = await change(departed.body, 'ARRIVE', input.targetHubId).expect(201);
  const done = await change(arrived.body, 'COMPLETE').expect(201);
  expect(done.body.status).toBe('COMPLETED');
  expect(await db.sharedVehicle.findUniqueOrThrow({ where: { id: vehicleId } })).toMatchObject({ hubId: input.targetHubId, transferPlanId: null });
});

test('routes a student trip report to operations and accepts a safe return without reopening the faulty vehicle', async () => {
  const vehicle = await db.sharedVehicle.create({
    data: {
      hubId: source.id, code: 'TRIP-FAULT-' + randomUUID(), batteryPercent: 60, status: 'AVAILABLE',
      serviceStatus: 'ACTIVE', sourceId, lastObservedAt: new Date(),
    },
  });
  const held = await write(student, '/reservations', { vehicleId: vehicle.id, hubId: source.id }).expect(201);
  const pickup = await write(student, '/trips/pickups', { reservationId: held.body.id, vehicleCode: vehicle.code }).expect(202);
  const handoff = data => ingest('vehicle.handoff', { vehicleId: vehicle.id, batteryPercent: 60, confirmed: true, fault: false, ...data });
  await handoff({ commandId: pickup.body.id, hubId: source.id }).expect(200, { result: 'applied' });
  const trips = await read(student, '/trips').expect(200);
  const trip = trips.body.find(item => item.reservationId === held.body.id);
  const reported = await write(student, '/operations/trip-faults/' + trip.id, { description: 'Phanh bị kẹt gần cổng' }).expect(201);
  const incident = await db.incident.findUniqueOrThrow({ where: { id: reported.body.id } });
  expect(incident).toMatchObject({ resourceId: vehicle.id, tripId: trip.id, hubId: source.id, status: 'OPEN' });
  const returning = await write(student, '/trips/' + trip.id + '/return', { hubId: target.id }).expect(202);
  await handoff({ commandId: returning.body.id, hubId: target.id }).expect(200, { result: 'applied' });
  expect(await db.sharedVehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).toMatchObject({
    status: 'OUT_OF_SERVICE', fault: true, hubId: target.id,
  });
});

test('interrupts a session and opens one incident on a verified charger fault', async () => {
  const vehicle = await db.privateVehicle.create({
    data: { ownerId: student.id, plate: 'Charge-fault-' + randomUUID(), batteryPercent: 25, lastObservedAt: new Date() },
  });
  const created = await write(student, '/charging/requests', {
    kind: 'PRIVATE', hubId: target.id, vehicleId: vehicle.id,
  }).expect(201);
  expect(created.body.status).toBe('SCHEDULED');
  const { id: sessionId, pointId } = created.body.session;
  await ingest('charging.state', { pointId, sessionId, phase: 'STARTED', batteryPercent: 25 }).expect(200, { result: 'applied' });
  await ingest('charging.state', { pointId, sessionId, phase: 'FAULT', batteryPercent: null }).expect(200, { result: 'applied' });
  const interrupted = await db.chargingSession.findUniqueOrThrow({ where: { id: sessionId } });
  expect(interrupted).toMatchObject({ status: 'INTERRUPTED', releasedAt: null });
  expect(await db.incident.count({ where: { resourceId: pointId, status: 'OPEN' } })).toBe(1);
  await ingest('charging.state', { pointId, sessionId, phase: 'RELEASED', batteryPercent: 25 }).expect(200, { result: 'applied' });
  expect(await db.chargingPoint.findUniqueOrThrow({ where: { id: pointId } })).toMatchObject({ status: 'OUT_OF_SERVICE' });
});

test('updates account information idempotently and revokes operator scope from an existing session', async () => {
  const username = 'access-' + randomUUID().slice(0, 8);
  const password = 'access-test-password';
  const body = { username, displayName: 'Initial', password, requestId: randomUUID() };
  const first = await write(admin, '/admin/accounts', body).expect(201);
  const retry = await write(admin, '/admin/accounts', body).expect(201);
  expect(first.body).toEqual(retry.body);
  await write(admin, '/admin/accounts', { ...body, password: 'different-test-password' }).expect(409);
  const path = '/admin/accounts/' + first.body.id;
  await write(admin, path, { version: 42, displayName: 'Stale' }, 'patch').expect(409);
  const updated = await write(admin, path, { version: first.body.version, displayName: 'Updated' }, 'patch').expect(200);
  const granted = await write(admin, path + '/roles', {
    version: updated.body.version, role: 'OPR', allHubs: true, grant: true, reason: 'Cấp quyền toàn mạng',
  }).expect(201);
  const loggedIn = await login(username, password);
  await read(loggedIn, '/operations').expect(200);
  await write(admin, path + '/roles', {
    version: granted.body.version, role: 'OPR', grant: false, reason: 'Kết thúc quyền vận hành',
  }).expect(201);
  await read(loggedIn, '/operations').expect(403);
  await read(loggedIn, '/auth/me').expect(200);
});

test('starts maintenance on a vehicle at its service threshold, preserves safe metadata edits and verifies recovery', async () => {
  const draft = await write(operator, '/operations/resources', {
    kind: 'VEHICLE', code: 'MAINT-' + randomUUID().slice(0, 8), hubId: source.id, reason: 'Thêm xe',
  }).expect(201);
  const id = draft.body.id;
  const path = '/operations/resources/VEHICLE/' + id;
  const sent = { resourceKind: 'VEHICLE', resourceId: id, fault: false, batteryPercent: 68 };
  await ingest('resource.state', sent).expect(200, { result: 'applied' });
  await ingest('resource.state', { ...sent, observedAt: new Date(0).toISOString() }).expect(200, { result: 'stale' });
  const observed = await db.sharedVehicle.findUniqueOrThrow({ where: { id } });
  const active = await write(operator, path, { serviceStatus: 'ACTIVE', version: observed.version, reason: 'Xác nhận có xe' }, 'patch').expect(200);
  const edited = await write(operator, path, {
    description: 'Xe gần cổng chính', version: active.body.version, reason: 'Bổ sung hướng dẫn',
  }, 'patch').expect(200);
  expect(edited.body).toMatchObject({ code: draft.body.code, status: 'AVAILABLE', batteryPercent: 68 });
  await ingest('resource.state', { ...sent, sinceMaintenanceKm: 1000 }).expect(200, { result: 'applied' });
  const issue = await db.incident.findFirstOrThrow({ where: { resourceId: id } });
  const change = (user, version, action, more = {}) => write(user, '/operations/incidents/' + issue.id, {
    version, action, reason: 'Bảo trì theo quãng đường', ...more,
  }, 'patch');
  const received = await change(operator, issue.version, 'ACKNOWLEDGE').expect(200);
  const assigned = await change(operator, received.body.version, 'ASSIGN', { assigneeId: technician.id }).expect(200);
  const started = await change(technician, assigned.body.version, 'START').expect(200);
  const fixed = await change(technician, started.body.version, 'RESOLVE', { safetyPassed: true }).expect(200);
  expect(fixed.body.status).toBe('RESOLVED');
  expect(await db.sharedVehicle.findUniqueOrThrow({ where: { id } })).toMatchObject({
    status: 'AVAILABLE', fault: false, sinceMaintenanceKm: 0, description: edited.body.description,
  });
});

test('keeps incomplete charging requests pending and rejects incompatible or unauthorized requests', async () => {
  const missing = await db.privateVehicle.create({
    data: { ownerId: student.id, plate: 'No-battery-' + randomUUID() },
  });
  const input = { hubId: source.id, vehicleId: missing.id, kind: 'PRIVATE' };
  await write(operator, '/charging/requests', input).expect(403);
  const pending = await write(student, '/charging/requests', input).expect(201);
  expect(pending.body).toMatchObject({ status: 'PENDING', session: null });
  expect(pending.body.reason).toContain('Chờ dữ liệu');
  await write(student, '/charging/requests', input).expect(409);
  await db.privateVehicle.update({ where: { id: missing.id }, data: { batteryPercent: 100, lastObservedAt: new Date() } });
  await write(student, '/charging/preview', input).expect(409);
  await db.privateVehicle.update({ where: { id: missing.id }, data: { batteryPercent: 80, connector: 'INCOMPATIBLE' } });
  const incompatible = await write(student, '/charging/preview', input).expect(201);
  expect(incompatible.body.pointId).toBeNull();
  expect(incompatible.body.reason).toContain('Không có cổng tương thích');
});

test('interrupted-trip handover requires an assigned technician and an operator confirmation', async () => {
  const vehicle = await db.sharedVehicle.create({
    data: {
      hubId: source.id, code: 'HANDOVER-' + randomUUID(), batteryPercent: 70, status: 'AVAILABLE',
      serviceStatus: 'ACTIVE', sourceId, lastObservedAt: new Date(),
    },
  });
  const reserved = await write(student, '/reservations', { vehicleId: vehicle.id, hubId: source.id }).expect(201);
  const pickup = await write(student, '/trips/pickups', { reservationId: reserved.body.id, vehicleCode: vehicle.code }).expect(202);
  await ingest('vehicle.handoff', {
    vehicleId: vehicle.id, batteryPercent: 70, confirmed: true, fault: false, commandId: pickup.body.id, hubId: source.id,
  }).expect(200);
  const trip = await db.trip.findUniqueOrThrow({ where: { reservationId: reserved.body.id } });
  const reported = await write(student, '/operations/trip-faults/' + trip.id, { description: 'Xe dừng giữa đường' }).expect(201);
  const issue = '/operations/incidents/' + reported.body.id;
  const act = (actor, version, action, more = {}) => write(actor, issue, {
    version, action, reason: 'Biên nhận thực tế', ...more,
  }, 'patch');
  const seen = await act(operator, 0, 'ACKNOWLEDGE').expect(200);
  const assigned = await act(operator, seen.body.version, 'ASSIGN', { assigneeId: technician.id }).expect(200);
  const started = await act(technician, assigned.body.version, 'START').expect(200);
  await act(operator, started.body.version, 'CONFIRM_HANDOVER').expect(409);
  const evidence = await act(technician, started.body.version, 'HANDOVER', { location: 'Cổng gần trạm xe buýt' }).expect(200);
  const handed = await act(operator, evidence.body.version, 'CONFIRM_HANDOVER').expect(200);
  expect((await db.trip.findUniqueOrThrow({ where: { id: trip.id } })).status).toBe('INTERRUPTED');
  await act(technician, handed.body.version, 'RESOLVE', { safetyPassed: true }).expect(409);
  const fixed = await act(technician, handed.body.version, 'RESOLVE', { safetyPassed: true, actualHubId: target.id }).expect(200);
  expect(fixed.body.status).toBe('RESOLVED');
  expect((await db.sharedVehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).hubId).toBe(target.id);
});
