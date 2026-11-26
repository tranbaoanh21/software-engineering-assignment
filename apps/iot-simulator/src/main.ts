import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type {
  ActiveTripBattery, BatteryStateEvent, ChargingStateEvent, ParkingStateEvent, PendingChargeStep, PendingParkingVerification,
  PendingTripHandoff, ResourceStateEvent, VehicleHandoffEvent,
} from '@semh/contracts';

const origin = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const sourceId = process.env.IOT_SOURCE_ID;
const sourceKey = process.env.IOT_SOURCE_KEY;
if (!sourceId || !sourceKey) throw new Error('IOT_SOURCE_ID and IOT_SOURCE_KEY are required');
const headers = { 'content-type': 'application/json', 'x-iot-source-key': sourceKey };

function battery(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 100) throw new Error('Battery must be an integer from 0 to 100');
  return value;
}

async function send(event: BatteryStateEvent | VehicleHandoffEvent | ParkingStateEvent | ChargingStateEvent | ResourceStateEvent) {
  const response = await fetch(new URL('/api/state-events', origin), {
    method: 'POST',
    headers,
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('IoT event failed with HTTP ' + response.status);
  console.log(event.type, await response.json());
}

async function pending<T>(path: string): Promise<T[]> {
  const response = await fetch(new URL('/api/state-events/' + path, origin), {
    headers,
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('IoT queue returned HTTP ' + response.status);
  return response.json() as Promise<T[]>;
}

async function pollTripCommands(deviceSource: string) {
  const commands = await pending<PendingTripHandoff>('handoffs');
  for (const command of commands) {
    const chosenBattery = command.kind === 'RETURN' && process.env.SIM_RETURN_BATTERY_PERCENT !== undefined
      ? battery(Number(process.env.SIM_RETURN_BATTERY_PERCENT))
      : command.batteryPercent;
    await send({
      eventId: randomUUID(), sourceId: deviceSource, type: 'vehicle.handoff', commandId: command.id,
      vehicleId: command.vehicleId, hubId: command.hubId, observedAt: new Date().toISOString(),
      batteryPercent: chosenBattery, confirmed: process.env.SIM_HANDOFF_CONFIRMED !== 'false',
      fault: command.kind === 'RETURN' && process.env.SIM_RETURN_FAULT === 'true',
    });
  }
}

async function pollParkingCommands(deviceSource: string) {
  const commands = await pending<PendingParkingVerification>('parking-verifications');
  for (const command of commands) {
    const occupied = command.kind === 'CHECK_IN';
    await send({
      type: 'parking.state', eventId: randomUUID(), sourceId: deviceSource, observedAt: new Date().toISOString(),
      verificationId: command.id, spaceId: command.spaceId,
      privateVehicleId: occupied ? command.privateVehicleId : null,
      occupied, fault: process.env.SIM_PARKING_FAULT === 'true',
    });
  }
}

async function pollChargingCommands(deviceSource: string) {
  const commands = await pending<PendingChargeStep>('charging-steps');
  for (const step of commands) {
    await send({ ...step, type: 'charging.state', sourceId: deviceSource, eventId: randomUUID(), observedAt: new Date().toISOString() });
  }
}

async function pollTripBattery(deviceSource: string) {
  const trips = await pending<ActiveTripBattery>('active-trip-batteries');
  const observedAt = new Date();
  for (const trip of trips) {
    const elapsed = Math.max(0, observedAt.getTime() - Date.parse(trip.startedAt));
    const batteryPercent = Math.max(0, trip.startBattery - Math.floor(elapsed / 5_000));
    if (batteryPercent >= trip.batteryPercent || trip.sequence >= 2147483647) continue;
    await send({
      type: 'vehicle.battery', sourceId: deviceSource, eventId: randomUUID(), tripId: trip.tripId,
      vehicleId: trip.vehicleId, sequence: trip.sequence + 1, batteryPercent, observedAt: observedAt.toISOString(),
    });
  }
}

if (process.env.SIM_MODE === 'handoff') {
  console.log('IoT simulator is waiting for vehicle, parking and charging commands.');
  let nextTelemetry = 0;
  const drainTrips = process.env.IOT_DEMO_BATTERY === 'true';
  const demoVehicle = !drainTrips && process.env.SIM_DEMO_STREAM === 'true' ? process.env.SIM_VEHICLE_ID : undefined;
  let sequence = Math.floor(Date.now() / 1000);
  for (;;) {
    if (drainTrips) {
      try {
        await pollTripBattery(sourceId);
      } catch (error) {
        console.error(error instanceof Error ? error.message : 'IoT battery update failed');
      }
    }
    const jobs = [pollTripCommands(sourceId), pollParkingCommands(sourceId), pollChargingCommands(sourceId)];
    if (demoVehicle && Date.now() >= nextTelemetry) {
      nextTelemetry = Date.now() + 15_000;
      jobs.push(send({
        type: 'vehicle.battery', sourceId, eventId: randomUUID(), vehicleId: demoVehicle, sequence: sequence++,
        batteryPercent: battery(Number(process.env.SIM_BATTERY_PERCENT ?? 72)), observedAt: new Date().toISOString(),
      }));
    }
    const results = await Promise.allSettled(jobs);
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error(result.reason instanceof Error ? result.reason.message : 'IoT verification failed');
      }
    }
    await delay(1500);
  }
} else if (process.env.SIM_MODE === 'resource-state') {
  const resourceId = process.env.SIM_RESOURCE_ID;
  const kind = process.env.SIM_RESOURCE_KIND;
  if (!resourceId || (kind !== 'HUB' && kind !== 'VEHICLE')) throw new Error('Set SIM_RESOURCE_ID and SIM_RESOURCE_KIND');
  await send({
    type: 'resource.state', sourceId, eventId: randomUUID(), observedAt: new Date().toISOString(), resourceId, resourceKind: kind,
    batteryPercent: kind === 'VEHICLE' ? battery(Number(process.env.SIM_BATTERY_PERCENT ?? 72)) : null,
    fault: process.env.SIM_RESOURCE_FAULT === 'true',
    sinceMaintenanceKm: process.env.SIM_MAINTENANCE_KM ? Number(process.env.SIM_MAINTENANCE_KM) : undefined,
  });
} else if (process.env.SIM_MODE === 'charging-state') {
  const pointId = process.env.SIM_POINT_ID;
  if (!pointId) throw new Error('Set SIM_POINT_ID');
  await send({
    type: 'charging.state', sourceId, eventId: randomUUID(), observedAt: new Date().toISOString(), pointId,
    sessionId: null, batteryPercent: null, phase: process.env.SIM_POINT_FAULT === 'true' ? 'FAULT' : 'READY',
  });
} else if (process.env.SIM_MODE === 'parking-state') {
  const spaceId = process.env.SIM_PARKING_SPACE_ID;
  const occupied = process.env.SIM_PARKING_OCCUPIED;
  if (!spaceId || !occupied || !['true', 'false', 'unknown'].includes(occupied)) {
    throw new Error('Set SIM_PARKING_SPACE_ID and SIM_PARKING_OCCUPIED (true, false or unknown)');
  }
  await send({
    type: 'parking.state', eventId: randomUUID(), sourceId, observedAt: new Date().toISOString(),
    spaceId, verificationId: null, privateVehicleId: null,
    occupied: occupied === 'unknown' ? null : occupied === 'true', fault: process.env.SIM_PARKING_FAULT === 'true',
  });
} else {
  const vehicleId = process.env.SIM_VEHICLE_ID;
  const sequence = Number(process.env.SIM_SEQUENCE ?? Math.floor(Date.now() / 1000));
  if (!vehicleId) throw new Error('SIM_VEHICLE_ID is required');
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 2147483647) {
    throw new Error('SIM_SEQUENCE must be a positive 32-bit integer');
  }
  await send({
    eventId: randomUUID(), sourceId, type: 'vehicle.battery', vehicleId, sequence,
    batteryPercent: battery(Number(process.env.SIM_BATTERY_PERCENT ?? 72)),
    observedAt: new Date().toISOString(),
  });
}
