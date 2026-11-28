import 'reflect-metadata';
import { randomInt, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../dist/create-app.js';
import { PrismaService } from '../dist/shared/database/prisma.service.js';
import { ChargingService } from '../dist/modules/chg/application/charging.service.js';

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

async function fixtureHub(name, vehicleCount = 2) {
  const code = 'QA-' + randomUUID().slice(0, 8);
  const now = new Date();
  return db.mobilityHub.create({
    data: {
      code, name: 'Final flow ' + name, latitude: 10.87, longitude: 106.8, serviceStatus: 'ACTIVE', lastObservedAt: now,
      vehicleCapacity: Math.max(8, vehicleCount + 2),
      vehicles: { create: Array.from({ length: vehicleCount }, (_, index) => ({
        code: code + '-V' + (index + 1), sourceId, status: 'AVAILABLE', serviceStatus: 'ACTIVE', batteryPercent: 70, lastObservedAt: now,
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

test('student registers and removes a private vehicle shared by parking and charging without losing history', async () => {
  const username = String(randomInt(100000000, 999999999));
  const password = 'first-student-password';
  await request(server).post('/api/auth/register').set('Origin', origin).send({
    username, password, displayName: 'Sinh viên mới',
  }).expect(201);
  const fresh = await login(username, password);
  const suffix = String(randomInt(100000)).padStart(5, '0');
  const plate = '60Y2' + suffix;
  const formatted = '60-Y2 ' + suffix.slice(0, 3) + '.' + suffix.slice(3);
  const addVehicle = (actor, input) => write(actor, '/parking/vehicles', input);

  expect((await read(fresh, '/parking').expect(200)).body.vehicles).toEqual([]);
  await addVehicle(operator, { plate }).expect(403);
  await addVehicle(fresh, { plate: '??' }).expect(400);
  await addVehicle(fresh, { plate: '60YY12345' }).expect(400);
  await addVehicle(fresh, { plate, batteryPercent: 101 }).expect(400);
  await addVehicle(fresh, { plate: '59x112345' }).expect(409);
  const [added, repeated] = await Promise.all([
    addVehicle(fresh, { plate }).expect(201),
    addVehicle(fresh, { plate: formatted.toLowerCase() }).expect(201),
  ]);
  const vehicle = added.body;
  expect(vehicle.plate).toBe(formatted);
  expect(repeated.body).toEqual(vehicle);
  await addVehicle(student, { plate: formatted }).expect(409);

  const hub = await fixtureHub('Private vehicle onboarding');
  await db.parkingSpace.create({ data: {
    hubId: hub.id, code: hub.code + '-P', serviceStatus: 'ACTIVE', status: 'AVAILABLE',
    occupied: false, sourceId, lastObservedAt: new Date(),
  } });
  const parking = await write(fresh, '/parking/reservations', { hubId: hub.id, privateVehicleId: vehicle.id }).expect(201);
  expect(parking.body).toMatchObject({ status: 'CONFIRMED', vehicle });
  const removePath = '/parking/vehicles/' + vehicle.id;
  await write(student, removePath, {}, 'delete').expect(404);
  await write(fresh, removePath, {}, 'delete').expect(409);
  await write(fresh, '/parking/reservations/' + parking.body.id + '/cancel', {}).expect(200);

  const chargingPath = '/charging';
  const before = await read(fresh, chargingPath).expect(200);
  expect(before.body.vehicles).toEqual([{ ...vehicle, batteryPercent: null }]);
  await addVehicle(fresh, { plate: formatted, batteryPercent: 32 }).expect(201, vehicle);
  await addVehicle(fresh, { plate, batteryPercent: 90 }).expect(201, vehicle);
  const after = await read(fresh, chargingPath).expect(200);
  expect(after.body.vehicles).toEqual([{ ...vehicle, batteryPercent: 32 }]);
  const chargeInput = { kind: 'PRIVATE', hubId: hub.id, vehicleId: vehicle.id };
  const charge = await write(fresh, '/charging/requests', chargeInput).expect(201);
  expect(charge.body).toMatchObject({ status: 'SCHEDULED', session: { batteryPercent: 32 } });
  await write(fresh, removePath, {}, 'delete').expect(409);
  const { id: sessionId, pointId } = charge.body.session;
  const evidence = { sessionId, pointId };
  await ingest('charging.state', { ...evidence, phase: 'STARTED', batteryPercent: 32 }).expect(200, { result: 'applied' });
  await ingest('charging.state', { ...evidence, phase: 'COMPLETED', batteryPercent: 100 }).expect(200, { result: 'applied' });
  await write(fresh, removePath, {}, 'delete').expect(409);
  await ingest('charging.state', { ...evidence, phase: 'RELEASED', batteryPercent: 100 }).expect(200, { result: 'applied' });

  await write(fresh, removePath, {}, 'delete').expect(200, { id: vehicle.id });
  await write(fresh, removePath, {}, 'delete').expect(200, { id: vehicle.id });
  expect((await read(fresh, '/parking').expect(200)).body).toMatchObject({
    vehicles: [], reservations: [{ id: parking.body.id, status: 'CANCELLED', vehicle }],
  });
  expect((await read(fresh, chargingPath).expect(200)).body).toMatchObject({
    vehicles: [], requests: [{ id: charge.body.id, vehicleId: vehicle.id, vehicleCode: formatted, status: 'COMPLETED' }],
  });
  await write(fresh, '/parking/reservations', { hubId: hub.id, privateVehicleId: vehicle.id }).expect(404);
  await write(fresh, '/charging/requests', chargeInput).expect(403);

  const readded = await addVehicle(fresh, { plate }).expect(201);
  expect(readded.body.plate).toBe(formatted);
  expect(readded.body.id).not.toBe(vehicle.id);
  const short = await addVehicle(fresh, { plate: '61s20406' }).expect(201);
  expect(short.body.plate).toBe('61-S2 0406');
});

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
  expect(safe.body.status).toBe('AWAITING_APPROVAL');
  expect((await db.parkingSpace.findUniqueOrThrow({ where: { id: space.id } })).status).toBe('OUT_OF_SERVICE');
  await update(operator, safe.body.version, 'CLOSE').expect(200);
  expect((await db.parkingSpace.findUniqueOrThrow({ where: { id: space.id } })).status).toBe('AVAILABLE');
});

test('runs What-if on an isolated snapshot and updates the target only after technician handoff and operator approval', async () => {
  const hubs = [source.id, target.id];
  const outside = await fixtureHub('Nguồn ngoài kịch bản', 12);
  const before = await db.sharedVehicle.findMany({ where: { hubId: { in: hubs } }, orderBy: { id: 'asc' } });
  const scenario = await write(operator, '/simulations/scenarios', {
    name: 'Cao điểm kiểm thử', hubIds: hubs,
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
  const snapshotInput = {
    name: 'Dùng lại mốc dữ liệu', hubIds: hubs,
    parameters: { ...scenario.body.parameters, snapshotRunId: completed.id },
  };
  const savedSnapshot = await write(operator, '/simulations/scenarios', snapshotInput).expect(201);
  expect(savedSnapshot.body.parameters.snapshotRunId).toBe(completed.id);
  const snapshotPath = '/simulations/scenarios/' + savedSnapshot.body.id + '/runs';
  const fromSaved = await write(operator, snapshotPath, { version: savedSnapshot.body.version }).expect(202);
  expect(fromSaved.body.baseTime).toBe(completed.baseTime);
  expect((await read(operator, '/simulations/runs/' + fromSaved.body.id).expect(200)).body.sourceRunId).toBe(completed.id);
  const fresh = await write(operator, snapshotPath, { version: savedSnapshot.body.version, sourceRunId: null }).expect(202);
  expect((await read(operator, '/simulations/runs/' + fresh.body.id).expect(200)).body.sourceRunId).toBeNull();
  expect(await db.sharedVehicle.findMany({ where: { hubId: { in: hubs } }, orderBy: { id: 'asc' } })).toEqual(before);
  const rec = completed.result.recommendations.find(item => item.kind === 'TRANSFER');
  expect(rec).toMatchObject({ sourceHubId: outside.id });
  const prepared = await read(operator, path + '/recommendations/' + rec.id + '/draft').expect(200);
  expect(await db.redistributionPlan.count({ where: { recommendationId: rec.id } })).toBe(0);
  const input = {
    sourceHubId: prepared.body.sourceHubId, targetHubId: prepared.body.targetHubId,
    recommendationId: prepared.body.recommendationId, vehicleIds: prepared.body.vehicleIds.slice(0, 1),
  };
  const vehicleId = input.vehicleIds[0];
  const saved = await write(operator, '/operations/plans', input).expect(201);
  expect(saved.body).toMatchObject({ status: 'DRAFT', reason: '', assigneeId: null });
  const planPath = '/operations/plans/' + saved.body.id + '/actions';
  const change = (actor, row, action, extra = {}) => write(actor, planPath, { version: row.version, action, ...extra });
  const getVehicle = () => db.sharedVehicle.findUniqueOrThrow({ where: { id: vehicleId } });
  const getTarget = async () => (await read(null, '/network/hubs').expect(200)).body.find(hub => hub.id === input.targetHubId);
  const targetBefore = await getTarget();
  const draftQueue = await read(technician, '/operations/maintenance').expect(200);
  expect(draftQueue.body.plans.some(plan => plan.id === saved.body.id)).toBe(false);
  await change(technician, saved.body, 'START').expect(403);
  const assigned = await change(operator, saved.body, 'ASSIGN', { assigneeId: technician.id }).expect(201);
  expect(assigned.body).toMatchObject({ status: 'APPROVED', assigneeId: technician.id });
  expect(await getVehicle()).toMatchObject({ hubId: input.sourceHubId, transferPlanId: saved.body.id });
  expect((await getTarget()).heldArrivals).toBe(targetBefore.heldArrivals + 1);
  const assignedQueue = await read(technician, '/operations/maintenance').expect(200);
  expect(assignedQueue.body.plans.find(plan => plan.id === saved.body.id)).toMatchObject({
    items: [{ vehicleId, vehicleCode: (await getVehicle()).code }], assigneeId: technician.id,
  });
  await change(operator, assigned.body, 'START').expect(403);
  await change(technician, assigned.body, 'REPORT_ARRIVAL').expect(409);
  const departed = await change(technician, assigned.body, 'START').expect(201);
  expect(await getVehicle()).toMatchObject({ hubId: null, status: 'OUT_OF_SERVICE', transferPlanId: saved.body.id });
  await change(operator, departed.body, 'COMPLETE').expect(409);
  await change(operator, departed.body, 'CANCEL').expect(409);
  const reportId = randomUUID();
  const arrived = await change(technician, departed.body, 'REPORT_ARRIVAL', { requestId: reportId }).expect(201);
  const duplicate = await change(technician, departed.body, 'REPORT_ARRIVAL', { requestId: reportId }).expect(201);
  expect(duplicate.body.version).toBe(arrived.body.version);
  expect(arrived.body.status).toBe('AWAITING_APPROVAL');
  expect(await getVehicle()).toMatchObject({ hubId: null, status: 'OUT_OF_SERVICE', transferPlanId: saved.body.id });
  const awaitingTarget = await getTarget();
  expect(awaitingTarget.heldArrivals).toBe(targetBefore.heldArrivals + 1);
  expect(awaitingTarget.resources.some(resource => resource.id === vehicleId)).toBe(false);
  await change(technician, arrived.body, 'COMPLETE').expect(403);
  const done = await change(operator, arrived.body, 'COMPLETE').expect(201);
  expect(done.body.status).toBe('COMPLETED');
  expect(await getVehicle()).toMatchObject({ hubId: input.targetHubId, transferPlanId: null });
  expect((await getTarget()).heldArrivals).toBe(targetBefore.heldArrivals);
});

test('approves a simulation transfer once and completes it when the assigned technician arrives', async () => {
  const selected = await fixtureHub('Hub tăng nhu cầu');
  const available = await fixtureHub('Hub cho xe', 15);
  const receiving = await db.mobilityHub.create({ data: {
    code: 'QA-' + randomUUID().slice(0, 8), name: 'Hub thiếu xe', latitude: 10.87, longitude: 106.8,
    serviceStatus: 'ACTIVE', lastObservedAt: new Date(),
  } });
  const scenario = (await write(operator, '/simulations/scenarios', {
    name: 'Điều phối sáng', hubIds: [selected.id, receiving.id],
    parameters: { durationMinutes: 15, demandMultiplier: 2, demandProfile: 'PEAK', chargingReduction: 0, closedHubId: null },
  }).expect(201)).body;
  const run = (await write(operator, '/simulations/scenarios/' + scenario.id + '/runs', { version: scenario.version }).expect(202)).body;
  const path = '/simulations/runs/' + run.id;
  let result;
  for (let attempt = 0; attempt < 20; attempt++) {
    result = (await read(operator, path).expect(200)).body;
    if (result.analysisReady) break;
    await delay(50);
  }
  const rec = result.result?.recommendations.find(item => item.kind === 'TRANSFER' && item.hubId === receiving.id);
  expect(result.result.hubs.map(hub => hub.hubId).sort()).toEqual([selected.id, receiving.id].sort());
  expect(rec).toMatchObject({ sourceHubId: available.id });
  const username = 'sim-scope-' + randomUUID().slice(0, 8);
  const password = 'test-sim-scope-password';
  const account = (await write(admin, '/admin/accounts', { username, displayName: 'Scoped SIM operator', password }).expect(201)).body;
  await write(admin, '/admin/accounts/' + account.id + '/roles', {
    role: 'OPR', allHubs: false, grant: true, hubIds: [selected.id, receiving.id], version: account.version, reason: 'Kiểm tra phạm vi',
  }).expect(201);
  const restricted = await login(username, password);
  const restrictedResult = (await read(restricted, path).expect(200)).body;
  expect(restrictedResult.result.recommendations.some(item => item.kind === 'TRANSFER')).toBe(false);
  await read(restricted, path + '/recommendations/' + rec.id + '/draft').expect(403);

  const approve = path + '/recommendations/' + rec.id + '/approve';
  const approval = { assigneeId: technician.id };
  await write(technician, approve, approval).expect(403);
  await write(operator, approve, { assigneeId: student.id }).expect(409);
  const usable = await db.sharedVehicle.findFirstOrThrow({ where: { hubId: available.id } });
  const remaining = { hubId: available.id, id: { not: usable.id } };
  await db.sharedVehicle.updateMany({ where: remaining, data: { status: 'AWAITING_CHARGE' } });
  await write(operator, approve, approval).expect(409);
  await db.sharedVehicle.updateMany({ where: remaining, data: { status: 'AVAILABLE' } });
  const [first, duplicate] = await Promise.all([
    write(operator, approve, approval).expect(201), write(operator, approve, approval).expect(201),
  ]);
  const plan = first.body;
  expect(duplicate.body.id).toBe(plan.id);
  expect(plan).toMatchObject({ status: 'APPROVED', assigneeId: technician.id, completeOnArrival: true, recommendationId: rec.id });
  expect(await db.redistributionPlan.count({ where: { recommendationId: rec.id } })).toBe(1);
  expect((await read(technician, '/operations/maintenance').expect(200)).body.plans.some(item => item.id === plan.id)).toBe(true);

  const change = (actor, version, action, extra = {}) => write(actor, '/operations/plans/' + plan.id + '/actions', {
    version, action, ...extra,
  });
  await change(technician, plan.version, 'REPORT_ARRIVAL').expect(409);
  const started = (await change(technician, plan.version, 'START').expect(201)).body;
  expect(started.status).toBe('IN_PROGRESS');
  await change(operator, started.version, 'REPORT_ARRIVAL').expect(403);
  const requestId = randomUUID();
  const completed = (await change(technician, started.version, 'REPORT_ARRIVAL', { requestId }).expect(201)).body;
  expect(completed).toMatchObject({
    status: 'COMPLETED', items: plan.items.map(({ vehicleId }) => ({
      vehicleId, status: 'ARRIVED', departedAt: expect.any(String), arrivedAt: expect.any(String),
    })),
  });
  await change(technician, started.version, 'REPORT_ARRIVAL', { requestId }).expect(201, completed);
  const vehicles = await db.sharedVehicle.findMany({ where: { id: { in: plan.items.map(item => item.vehicleId) } } });
  expect(vehicles).toHaveLength(plan.items.length);
  for (const vehicle of vehicles) {
    expect(vehicle).toMatchObject({ hubId: receiving.id, transferPlanId: null, status: 'AVAILABLE' });
  }
});

test('rejects a pending normal return when the student reports a fault, and retains the trip until technician pickup', async () => {
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
  const returning = await write(student, '/trips/' + trip.id + '/return', { hubId: target.id }).expect(202);
  const faultPath = '/operations/trip-faults/' + trip.id;
  await write(student, faultPath, { description: 'Phanh bị kẹt' }).expect(400);
  const reported = await write(student, faultPath, { location: 'Gần cổng KTX B' }).expect(201);
  const incident = await db.incident.findUniqueOrThrow({ where: { id: reported.body.id } });
  expect(incident).toMatchObject({
    resourceId: vehicle.id, tripId: trip.id, hubId: source.id, status: 'OPEN', reportedLocation: 'Gần cổng KTX B',
  });
  await handoff({ commandId: returning.body.id, hubId: target.id }).expect(200, { result: 'rejected' });
  await write(student, '/trips/' + trip.id + '/return', { hubId: target.id }).expect(409);
  expect((await db.trip.findUniqueOrThrow({ where: { id: trip.id } })).status).toBe('IN_PROGRESS');
  expect(await db.sharedVehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).toMatchObject({ fault: true, hubId: null });
  const issue = '/operations/incidents/' + incident.id;
  const assigned = await write(operator, issue, {
    version: incident.version, action: 'ASSIGN', assigneeId: technician.id, location: 'Gần cổng KTX B',
  }, 'patch').expect(200);
  await write(technician, issue, { version: assigned.body.version, action: 'START' }, 'patch').expect(200);
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
  expect(fixed.body.status).toBe('AWAITING_APPROVAL');
  await change(operator, fixed.body.version, 'CLOSE').expect(200);
  expect(await db.sharedVehicle.findUniqueOrThrow({ where: { id } })).toMatchObject({
    status: 'AVAILABLE', fault: false, sinceMaintenanceKm: 0, description: edited.body.description,
  });
});

test('queues a low-battery return and requires MNT, IoT and OPR to put the vehicle back in service', async () => {
  const hub = await fixtureHub('Sạc xe dùng chung');
  const [vehicle, fullEnough] = await db.sharedVehicle.findMany({ where: { hubId: hub.id } });
  const current = () => db.sharedVehicle.findUniqueOrThrow({ where: { id: vehicle.id } });
  const reserve = () => write(student, '/reservations', { vehicleId: vehicle.id, hubId: hub.id });
  const path = id => '/charging/shared-vehicles/' + id + '/charge';
  const refresh = () => app.get(ChargingService).refresh();
  await db.sharedVehicle.update({
    where: { id: vehicle.id }, data: { status: 'OUT_OF_SERVICE', batteryPercent: 24, fault: true },
  });
  await write(student, path(vehicle.id), { hubId: hub.id }).expect(403);
  await write(operator, path(vehicle.id), { hubId: hub.id }).expect(409);
  await write(operator, path(fullEnough.id), { hubId: hub.id }).expect(409);
  await refresh();
  expect(await db.chargingRequest.count({ where: { vehicleId: vehicle.id } })).toBe(0);

  await db.sharedVehicle.update({
    where: { id: vehicle.id }, data: { status: 'AVAILABLE', batteryPercent: 70, fault: false },
  });
  const reservation = await reserve().expect(201);
  const pickup = await write(student, '/trips/pickups', {
    reservationId: reservation.body.id, vehicleCode: vehicle.code,
  }).expect(202);
  const handoff = (commandId, batteryPercent) => ingest('vehicle.handoff', {
    commandId, vehicleId: vehicle.id, hubId: hub.id, batteryPercent, confirmed: true, fault: false,
  });
  await handoff(pickup.body.id, 70).expect(200, { result: 'applied' });
  const trip = await db.trip.findUniqueOrThrow({ where: { reservationId: reservation.body.id } });
  const returning = await write(student, '/trips/' + trip.id + '/return', { hubId: hub.id }).expect(202);
  await handoff(returning.body.id, 24).expect(200, { result: 'applied' });
  expect(await current()).toMatchObject({ status: 'AWAITING_CHARGE', batteryPercent: 24 });

  await refresh();
  await refresh();
  const rows = await db.chargingRequest.findMany({ where: { vehicleId: vehicle.id } });
  expect(rows).toEqual([expect.objectContaining({
    authorId: null, vehicleKind: 'SHARED', status: 'SCHEDULED', requiresFleetHandoff: true,
  })]);
  const [charge] = rows;
  const maintenance = (await read(technician, '/charging?mode=MNT').expect(200)).body;
  const created = maintenance.requests.find(item => item.id === charge.id);
  expect(created).toMatchObject({ session: { batteryPercent: 24, plugConfirmedAt: null } });
  const existing = await write(operator, path(vehicle.id), { hubId: hub.id }).expect(201);
  expect(existing.body.id).toBe(charge.id);
  const { id: sessionId, pointId } = created.session;
  const evidence = { sessionId, pointId };
  const readySteps = async () => (await request(server).get('/api/state-events/charging-steps')
    .set('X-IoT-Source-Key', key).expect(200)).body;
  const step = phase => (readySteps()).then(steps => steps.some(item => item.sessionId === sessionId && item.phase === phase));
  const plug = '/charging/requests/' + charge.id + '/confirm-plug';
  const approve = '/charging/requests/' + charge.id + '/approve-service';

  expect(await step('STARTED')).toBe(false);
  await write(operator, approve, {}).expect(409);
  await ingest('charging.state', { ...evidence, phase: 'STARTED', batteryPercent: 24 }).expect(200, { result: 'rejected' });
  await write(operator, plug, { pointId }).expect(403);
  await write(technician, plug, { pointId: randomUUID() }).expect(409);
  const plugInput = { pointId, requestId: randomUUID() };
  const confirmed = await write(technician, plug, plugInput).expect(201);
  expect(confirmed.body.session.plugConfirmedAt).toBeTruthy();
  await write(technician, plug, plugInput).expect(201, confirmed.body);
  await refresh();
  expect(await step('STARTED')).toBe(true);
  await ingest('charging.state', { ...evidence, phase: 'STARTED', batteryPercent: 24 }).expect(200, { result: 'applied' });
  expect(await current()).toMatchObject({ status: 'CHARGING', batteryPercent: 24 });
  await ingest('charging.state', { ...evidence, phase: 'COMPLETED', batteryPercent: 100 }).expect(200, { result: 'applied' });
  expect(await current()).toMatchObject({ status: 'CHARGING', batteryPercent: 100 });
  await write(operator, approve, {}).expect(409);
  await ingest('charging.state', { ...evidence, phase: 'RELEASED', batteryPercent: 100 }).expect(200, { result: 'applied' });
  expect(await db.chargingPoint.findUniqueOrThrow({ where: { id: pointId } })).toMatchObject({ status: 'AVAILABLE' });
  expect(await current()).toMatchObject({ status: 'AWAITING_CHARGE_APPROVAL', batteryPercent: 100 });
  expect(await db.chargingRequest.findUniqueOrThrow({ where: { id: charge.id } })).toMatchObject({ status: 'AWAITING_APPROVAL' });
  await reserve().expect(409);
  await write(technician, approve, {}).expect(403);
  const approval = { requestId: randomUUID() };
  const accepted = await write(operator, approve, approval).expect(201);
  expect(accepted.body).toMatchObject({ status: 'COMPLETED', session: { releasedAt: expect.any(String) } });
  await write(operator, approve, approval).expect(201, accepted.body);
  expect(await current()).toMatchObject({ status: 'AVAILABLE', batteryPercent: 100 });
  const bookedAgain = await reserve().expect(201);
  await write(student, '/reservations/' + bookedAgain.body.id + '/cancel', {}).expect(200);
});

test('allows operations to queue shared charging before the automatic scan picks it up', async () => {
  const hub = await fixtureHub('Sạc nhanh xe dùng chung');
  const vehicle = await db.sharedVehicle.findFirstOrThrow({ where: { hubId: hub.id } });
  await db.sharedVehicle.update({
    where: { id: vehicle.id }, data: { status: 'AWAITING_CHARGE', batteryPercent: 24 },
  });
  const path = '/charging/shared-vehicles/' + vehicle.id + '/charge';
  const input = { hubId: hub.id, requestId: randomUUID() };
  const first = await write(operator, path, input).expect(201);
  expect(first.body).toMatchObject({ requiresFleetHandoff: true, status: 'SCHEDULED', session: { batteryPercent: 24 } });
  await write(operator, path, input).expect(201, first.body);
  await write(operator, path, { hubId: hub.id }).expect(409);
  await app.get(ChargingService).refresh();
  expect(await db.chargingRequest.count({ where: { vehicleId: vehicle.id } })).toBe(1);
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

test('ends the trip at technician pickup and restores the vehicle only when operations accepts it', async () => {
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
  await ingest('vehicle.battery', { tripId: trip.id, vehicleId: vehicle.id, sequence: 10, batteryPercent: 67 }).expect(200, { result: 'applied' });
  const reported = await write(student, '/operations/trip-faults/' + trip.id, {
    location: 'Trạm xe buýt trước KTX B', description: 'Xe dừng giữa đường',
  }).expect(201);
  const issue = '/operations/incidents/' + reported.body.id;
  const act = (actor, version, action, more = {}) => write(actor, issue, { version, action, ...more }, 'patch');
  await act(technician, 0, 'START').expect(403);
  await act(operator, 0, 'ASSIGN', { assigneeId: technician.id }).expect(409);
  const assigned = await act(operator, 0, 'ASSIGN', {
    assigneeId: technician.id, location: 'Trạm xe buýt đối diện cổng KTX B',
  }).expect(200);
  expect(assigned.body).toMatchObject({
    status: 'ASSIGNED', tripInProgress: true, reportedLocation: 'Trạm xe buýt trước KTX B',
    confirmedLocation: 'Trạm xe buýt đối diện cổng KTX B', vehicle: { code: vehicle.code, hubId: null },
  });
  await act(operator, assigned.body.version, 'START').expect(403);
  await act(operator, assigned.body.version, 'CLOSE').expect(409);
  const pickupReceipt = { requestId: randomUUID() };
  const started = await act(technician, assigned.body.version, 'START', pickupReceipt).expect(200);
  const replay = await act(technician, assigned.body.version, 'START', pickupReceipt).expect(200);
  expect(replay.body.version).toBe(started.body.version);
  expect(started.body).toMatchObject({ status: 'IN_PROGRESS', tripInProgress: false });
  const stopped = await db.trip.findUniqueOrThrow({ where: { id: trip.id } });
  expect(stopped).toMatchObject({
    status: 'INTERRUPTED', endedAt: expect.any(Date), endBattery: 67,
    endVehicleStatus: 'OUT_OF_SERVICE', durationSeconds: expect.any(Number),
  });
  await act(operator, started.body.version, 'CLOSE').expect(409);
  await act(technician, started.body.version, 'RESOLVE', { safetyPassed: true }).expect(409);
  const fullHub = await fixtureHub('Hub hết chỗ');
  await db.mobilityHub.update({ where: { id: fullHub.id }, data: { vehicleCapacity: 2 } });
  await act(technician, started.body.version, 'RESOLVE', { safetyPassed: true, actualHubId: fullHub.id }).expect(409);

  // Pending incidents from before the receiving-Hub update are handed back to the assigned technician.
  await db.incident.update({ where: { id: reported.body.id }, data: { status: 'AWAITING_APPROVAL', safe: true } });
  await act(operator, started.body.version, 'CLOSE').expect(409);
  const delivery = { safetyPassed: true, actualHubId: target.id, requestId: randomUUID() };
  const fixed = await act(technician, started.body.version, 'RESOLVE', delivery).expect(200);
  expect(fixed.body).toMatchObject({
    status: 'AWAITING_APPROVAL', safe: true, resolution: null,
    receivingHub: { id: target.id, name: target.name }, vehicle: { hubId: target.id },
  });
  expect((await act(technician, started.body.version, 'RESOLVE', delivery).expect(200)).body.version).toBe(fixed.body.version);
  expect(await db.sharedVehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).toMatchObject({
    status: 'OUT_OF_SERVICE', fault: true, hubId: target.id,
  });
  const visibleForStudent = async () => (await read(student, '/hubs').expect(200)).body
    .find(hub => hub.id === target.id).vehicles.some(item => item.id === vehicle.id);
  expect(await visibleForStudent()).toBe(false);

  const scopedOperator = async hubId => {
    const username = 'repair-' + randomUUID().slice(0, 8);
    const password = 'repair-test-password';
    const account = await write(admin, '/admin/accounts', { username, displayName: 'Repair operator', password }).expect(201);
    await write(admin, '/admin/accounts/' + account.body.id + '/roles', {
      version: account.body.version, role: 'OPR', allHubs: false, hubIds: [hubId], grant: true, reason: 'Phụ trách Hub',
    }).expect(201);
    return login(username, password);
  };
  const sourceOnly = await scopedOperator(source.id);
  const receivingOperator = await scopedOperator(target.id);
  const incidentsFor = async actor => (await read(actor, '/operations').expect(200)).body.incidents;
  expect((await incidentsFor(sourceOnly)).some(item => item.id === reported.body.id)).toBe(false);
  expect((await incidentsFor(receivingOperator)).find(item => item.id === reported.body.id).receivingHub.id).toBe(target.id);
  await act(technician, fixed.body.version, 'CLOSE').expect(403);
  await act(sourceOnly, fixed.body.version, 'CLOSE').expect(403);
  await act(receivingOperator, fixed.body.version, 'CLOSE', { actualHubId: source.id }).expect(409);
  const accepted = await act(receivingOperator, fixed.body.version, 'CLOSE').expect(200);
  expect(accepted.body).toMatchObject({ status: 'CLOSED', receivingHub: { id: target.id, name: target.name } });
  expect(await visibleForStudent()).toBe(true);
  expect(await db.sharedVehicle.findUniqueOrThrow({ where: { id: vehicle.id } })).toMatchObject({
    status: 'AVAILABLE', fault: false, hubId: target.id,
  });
});
