import { hubMinimumFleetRatio, reservationMinimumBatteryPercent } from '@semh/contracts';
import type {
  NetworkHub, SimulationMetrics, SimulationParameters, SimulationRecommendation, SimulationResult,
} from '@semh/contracts';

export const modelVersion = 'semh-minute-2';

type DonorStock = Pick<NetworkHub, 'id' | 'code' | 'capacity' | 'availableVehicles'>;

export function hubIsOperating(hub: NetworkHub): boolean {
  return hub.serviceStatus === 'ACTIVE' && !hub.resources.some(resource => resource.kind === 'HUB' && resource.status === 'OUT_OF_SERVICE');
}

export function donorStock(hub: NetworkHub): DonorStock {
  const { id, code, capacity } = hub;
  const observed = hub.resources.filter(resource => resource.kind === 'VEHICLE' && resource.status === 'AVAILABLE' &&
    resource.serviceStatus === 'ACTIVE' && (resource.batteryPercent ?? 0) >= reservationMinimumBatteryPercent && resource.observedAt);
  return { id, code, capacity, availableVehicles: hubIsOperating(hub) ? Math.min(hub.availableVehicles, observed.length) : 0 };
}

export function transferableVehicles({ capacity, availableVehicles }: DonorStock): number {
  return Math.max(0, availableVehicles - Math.max(1, Math.ceil(capacity * hubMinimumFleetRatio)));
}

export interface Snapshot {
  hubs: NetworkHub[];
  donors?: DonorStock[];
  releases: { hubId: string; kind: 'VEHICLE' | 'PARKING' | 'CHARGING'; minute: number; resourceId?: string; batteryPercent?: number }[];
}

type DemandKind = 'VEHICLE' | 'PARKING' | 'CHARGING';
interface Demand {
  minute: number;
  hubId: string;
  kind: DemandKind;
  duration: number;
  targetId: string | null;
  batteryUse: number;
}

interface WorkingHub {
  hub: NetworkHub;
  closed: boolean;
  occupiedFleet: number;
  fleetCapacity: number;
  battery: number[];
  parkingFree: number;
  parkingLimit: number;
  chargeFree: number;
  chargeLimit: number;
  metrics: SimulationMetrics;
  timeline: number[];
}

export function campusDemand(hubIds: string[], parameters: SimulationParameters): Demand[] {
  const result: Demand[] = [];
  for (const [i, hubId] of hubIds.entries()) {
    const targetId = hubIds.length > 1 ? hubIds[(i + 1) % hubIds.length] ?? hubId : hubId;
    const step = parameters.demandProfile === 'PEAK' ? 5 : 12;
    for (let minute = i % step; minute < parameters.durationMinutes; minute += step) {
      result.push({ minute, hubId, targetId, kind: 'VEHICLE', duration: 8 + (i % 5), batteryUse: 9 });
      if (minute % 3 !== 0) result.push({ minute, hubId, targetId: null, kind: 'PARKING', duration: 22, batteryUse: 0 });
      if (minute % 2 === 0) result.push({ minute, hubId, targetId: null, kind: 'CHARGING', duration: 32, batteryUse: 0 });
    }
  }
  return result.sort((a, b) => a.minute - b.minute || a.hubId.localeCompare(b.hubId) || a.kind.localeCompare(b.kind));
}

function fleetPool(hub: NetworkHub, paused: Set<string>) {
  return hub.resources.filter(resource => resource.kind === 'VEHICLE' && !paused.has(resource.id) && resource.status === 'AVAILABLE' &&
    resource.serviceStatus === 'ACTIVE' && (resource.batteryPercent ?? 0) >= 30 && resource.observedAt)
    .map(resource => resource.batteryPercent!).sort((a, b) => b - a);
}

function workingHub(hub: NetworkHub, p: SimulationParameters, scenario: boolean): WorkingHub {
  const closed = !hubIsOperating(hub) || (scenario && hub.id === p.closedHubId);
  const override = scenario && p.override?.hubId === hub.id ? p.override : undefined;
  const paused = new Set(scenario ? p.pausedResourceIds ?? [] : []);
  const available = (kind: 'PARKING_SPACE' | 'CHARGING_POINT') => hub.resources.filter(resource =>
    resource.kind === kind && resource.serviceStatus === 'ACTIVE' && resource.status === 'AVAILABLE' &&
    resource.observedAt && paused.has(resource.id)).length;
  const occupiedParking = hub.parkingCount - hub.availableParking;
  const parkingLimit = Math.max(0, (override?.parkingCapacity ?? hub.parkingCount) - available('PARKING_SPACE'));
  const chargingCount = Math.max(0, (override?.chargingCapacity ?? hub.chargingCount) - available('CHARGING_POINT'));
  const chargeKw = (override?.chargeKw ?? hub.chargeKw) * (scenario ? 1 - p.chargingReduction / 100 : 1);
  const chargeLimit = Math.max(0, Math.min(chargingCount, Math.floor(chargeKw / 0.5)));
  const chargeFree = Math.max(0, chargeLimit - (hub.chargingCount - hub.availableCharging));
  return {
    hub, closed, occupiedFleet: hub.vehicleCount + hub.heldArrivals, fleetCapacity: override?.fleetCapacity ?? hub.capacity,
    battery: closed ? [] : fleetPool(hub, paused),
    parkingFree: Math.max(0, parkingLimit - occupiedParking), parkingLimit, chargeFree, chargeLimit,
    metrics: { tripsServed: 0, tripsMissed: 0, parkingMissed: 0, chargingMissed: 0, vehiclesAtEnd: 0 },
    timeline: [],
  };
}

function run(snapshot: Snapshot, profile: Demand[], p: SimulationParameters, scenario: boolean) {
  const hubs = new Map(snapshot.hubs.map(hub => [hub.id, workingHub(hub, p, scenario)]));
  const timedEvents = new Map<number, (() => void)[]>();
  const demands = new Map<number, Demand[]>();
  for (const demand of profile) {
    const batch = demands.get(demand.minute) ?? [];
    batch.push(demand);
    demands.set(demand.minute, batch);
  }
  const accumulators = new Map<string, number>();
  const warnings = new Set<string>();

  function at(minute: number, callback: () => void) {
    const prior = timedEvents.get(minute) ?? [];
    prior.push(callback);
    timedEvents.set(minute, prior);
  }
  for (const hub of hubs.values()) {
    if (hub.fleetCapacity < hub.occupiedFleet) warnings.add(hub.hub.name + ' vượt sức chứa xe ở mốc cơ sở.');
  }
  const paused = new Set(scenario ? p.pausedResourceIds ?? [] : []);
  for (const item of snapshot.releases) {
    const hub = hubs.get(item.hubId);
    if (!hub || item.minute < 0 || (item.resourceId && paused.has(item.resourceId))) continue;
    at(item.minute, () => {
      if (item.kind === 'PARKING') hub.parkingFree = Math.min(hub.parkingLimit, hub.parkingFree + 1);
      else if (item.kind === 'CHARGING') hub.chargeFree = Math.min(hub.chargeLimit, hub.chargeFree + 1);
      else if (!hub.closed && item.batteryPercent !== undefined) hub.battery.push(item.batteryPercent);
    });
  }

  function arrive(hub: WorkingHub, minute: number, battery: number) {
    if (hub.closed || hub.occupiedFleet >= hub.fleetCapacity) {
      warnings.add('Xe đến ' + hub.hub.name + ' cần chờ tiếp nhận.');
      if (!hub.closed && minute < p.durationMinutes) at(minute + 1, () => arrive(hub, minute + 1, battery));
      return;
    }
    hub.occupiedFleet++;
    if (battery >= 30) hub.battery.push(battery);
  }

  function serve(demand: Demand, hub: WorkingHub, minute: number) {
    if (demand.kind === 'VEHICLE') {
      const battery = hub.closed ? undefined : hub.battery.shift();
      if (battery === undefined) hub.metrics.tripsMissed++;
      else {
        hub.metrics.tripsServed++;
        hub.occupiedFleet--;
        const target = hubs.get(demand.targetId ?? hub.hub.id)!;
        at(minute + demand.duration, () => arrive(target, minute + demand.duration, battery - demand.batteryUse));
      }
    } else if (demand.kind === 'PARKING') {
      if (hub.closed || hub.parkingFree <= 0) hub.metrics.parkingMissed++;
      else {
        hub.parkingFree--;
        at(minute + demand.duration, () => { hub.parkingFree++; });
      }
    } else {
      if (hub.closed || hub.chargeFree <= 0) hub.metrics.chargingMissed++;
      else {
        hub.chargeFree--;
        at(minute + demand.duration, () => { hub.chargeFree++; });
      }
    }
  }

  for (let minute = 0; minute < p.durationMinutes; minute++) {
    for (const release of timedEvents.get(minute) ?? []) release();
    for (const demand of demands.get(minute) ?? []) {
      const key = demand.hubId + ':' + demand.kind;
      const n = accumulators.get(key) ?? 0;
      accumulators.set(key, n + 1);
      const multiplier = scenario ? p.demandMultiplier : 1;
      const repetitions = Math.floor((n + 1) * multiplier + 1e-9) - Math.floor(n * multiplier + 1e-9);
      const hub = hubs.get(demand.hubId)!;
      for (let i = 0; i < repetitions; i++) serve(demand, hub, minute);
    }
    for (const hub of hubs.values()) hub.timeline.push(hub.battery.length);
  }
  for (const hub of hubs.values()) hub.metrics.vehiclesAtEnd = hub.battery.length;
  return { hubs, warnings: Array.from(warnings) };
}

export function executeSimulation(snapshot: Snapshot, input: SimulationParameters, profile: Demand[]): SimulationResult {
  const baseline = run(snapshot, profile, input, false);
  const scenario = run(snapshot, profile, input, true);
  return {
    hubs: snapshot.hubs.map(hub => {
      const base = baseline.hubs.get(hub.id)!;
      const alternate = scenario.hubs.get(hub.id)!;
      return {
        hubId: hub.id, name: hub.name, baseline: base.metrics, scenario: alternate.metrics,
        timeline: alternate.timeline.map((value, minute) => ({ minute, baseline: base.timeline[minute] ?? 0, scenario: value })),
      };
    }),
    warnings: [...new Set([...baseline.warnings, ...scenario.warnings])],
    recommendations: [],
  };
}

export function analyzeSimulation(
  snapshot: Snapshot, result: SimulationResult, closedHubId: string | null, makeId: () => string,
): SimulationRecommendation[] {
  const recommendations: SimulationRecommendation[] = [];
  const donors = (snapshot.donors ?? []).map(hub => ({ hub, remaining: transferableVehicles(hub) }));
  for (const row of result.hubs) {
    const target = snapshot.hubs.find(hub => hub.id === row.hubId)!;
    if (row.hubId === closedHubId || !hubIsOperating(target)) continue;
    const spare = Math.max(0, target.capacity - target.vehicleCount - target.heldArrivals);
    if (row.scenario.tripsMissed > 0 && spare > 0) {
      const source = donors.sort((a, b) => b.remaining - a.remaining || a.hub.code.localeCompare(b.hub.code))[0];
      if (source && source.remaining > 0) {
        const count = Math.min(spare, row.scenario.tripsMissed, source.remaining);
        source.remaining -= count;
        recommendations.push({
          id: makeId(), kind: 'TRANSFER', hubId: row.hubId, sourceHubId: source.hub.id, count,
          evidence: row.scenario.tripsMissed + ' yêu cầu chuyến đi không được phục vụ trong kịch bản.',
        });
      }
    }
    if (row.scenario.parkingMissed > 0) {
      recommendations.push({ id: makeId(), kind: 'PARKING', hubId: row.hubId, count: row.scenario.parkingMissed,
        evidence: row.scenario.parkingMissed + ' yêu cầu đỗ không được phục vụ trong kịch bản.' });
    }
    if (row.scenario.chargingMissed > 0) {
      recommendations.push({ id: makeId(), kind: 'CHARGING', hubId: row.hubId, count: row.scenario.chargingMissed,
        evidence: row.scenario.chargingMissed + ' yêu cầu sạc vượt năng lực trong kịch bản.' });
    }
  }
  return recommendations;
}
