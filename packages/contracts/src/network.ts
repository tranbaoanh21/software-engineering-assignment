export type ResourceKind = 'HUB' | 'VEHICLE' | 'PARKING_SPACE' | 'CHARGING_POINT';
export type ResourceServiceStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

export interface NetworkResource {
  id: string;
  kind: ResourceKind;
  hubId: string | null;
  code: string;
  description: string;
  serviceStatus: ResourceServiceStatus;
  status: string;
  version: number;
  observedAt: string | null;
  batteryPercent?: number;
}

export interface NetworkHub {
  id: string;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  serviceStatus: ResourceServiceStatus;
  capacity: number;
  chargeKw: number;
  availableVehicles: number;
  vehicleCount: number;
  heldArrivals: number;
  availableParking: number;
  parkingCount: number;
  availableCharging: number;
  chargingCount: number;
  alerts: ('LOW_FLEET' | 'NEAR_CAPACITY')[];
  resources: NetworkResource[];
}

export interface ChangeInput {
  requestId: string;
  reason?: string;
  version?: number;
}

export interface AccountView {
  id: string;
  username: string;
  displayName: string;
  status: 'ACTIVE' | 'LOCKED';
  version: number;
  assignments: { role: 'STU' | 'OPR' | 'MNT' | 'ADM'; allHubs: boolean; hubIds: string[] }[];
}

export interface IncidentView {
  id: string;
  title: string;
  description: string;
  resourceKind: ResourceKind;
  resourceId: string;
  hubId: string | null;
  tripId: string | null;
  assigneeId: string | null;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  resolution: string | null;
  severity: string;
  dueAt: string | null;
  handover: { location: string; at: string; by: string } | null;
  safe: boolean | null;
  version: number;
  createdAt: string;
}

export interface PlanView {
  id: string;
  sourceHubId: string;
  targetHubId: string;
  scheduledAt: string;
  recommendationId: string | null;
  reason: string;
  status: 'DRAFT' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  version: number;
  items: { vehicleId: string; status: 'PLANNED' | 'DEPARTED' | 'ARRIVED' | 'CANCELLED' }[];
}

export interface ChargingVehicle {
  id: string;
  code: string;
  kind: 'PRIVATE' | 'SHARED';
  ownerId: string | null;
  hubId: string | null;
  batteryPercent: number | null;
  batteryKwh: number | null;
  maxChargeKw: number | null;
  connector: string | null;
  ready: boolean;
}

export interface ChargingRequestView {
  id: string;
  vehicleCode: string;
  vehicleKind: 'PRIVATE' | 'SHARED';
  vehicleId: string;
  hubId: string;
  status: 'PENDING' | 'SCHEDULED' | 'CHARGING' | 'COMPLETED' | 'INTERRUPTED';
  priority: number;
  reason: string | null;
  version: number;
  session: {
    id: string;
    pointId: string;
    pointCode: string;
    startAt: string;
    endAt: string;
    batteryPercent: number;
    status: 'READY' | 'CHARGING' | 'COMPLETED' | 'INTERRUPTED';
    releasedAt: string | null;
    observedAt: string | null;
  } | null;
}

export interface ChargingStateEvent {
  type: 'charging.state';
  eventId: string;
  sourceId: string;
  pointId: string;
  sessionId: string | null;
  observedAt: string;
  phase: 'READY' | 'STARTED' | 'PROGRESS' | 'COMPLETED' | 'RELEASED' | 'FAULT';
  batteryPercent: number | null;
}

export interface ResourceStateEvent {
  type: 'resource.state';
  eventId: string;
  sourceId: string;
  resourceKind: 'VEHICLE' | 'HUB';
  resourceId: string;
  observedAt: string;
  batteryPercent: number | null;
  fault: boolean;
  sinceMaintenanceKm?: number;
}

export interface PendingChargeStep {
  pointId: string;
  sessionId: string;
  phase: 'STARTED' | 'COMPLETED' | 'RELEASED';
  batteryPercent: number;
}

export interface SimulationParameters {
  durationMinutes: number;
  demandMultiplier: number;
  demandProfile: 'REGULAR' | 'PEAK';
  closedHubId: string | null;
  chargingReduction: number;
  override?: {
    hubId: string;
    fleetCapacity?: number;
    parkingCapacity?: number;
    chargingCapacity?: number;
    chargeKw?: number;
  };
  pausedResourceIds?: string[];
}

export interface ScenarioView {
  id: string;
  name: string;
  objective: string;
  hubIds: string[];
  parameters: SimulationParameters;
  version: number;
}

export interface SimulationMetrics {
  tripsServed: number;
  tripsMissed: number;
  parkingMissed: number;
  chargingMissed: number;
  vehiclesAtEnd: number;
}

export interface SimulationRecommendation {
  id: string;
  kind: 'TRANSFER' | 'CHARGING' | 'PARKING';
  hubId: string;
  sourceHubId?: string;
  count: number;
  evidence: string;
}

export interface SimulationResult {
  hubs: {
    hubId: string;
    name: string;
    baseline: SimulationMetrics;
    scenario: SimulationMetrics;
    timeline: { minute: number; baseline: number; scenario: number }[];
  }[];
  warnings: string[];
  recommendations: SimulationRecommendation[];
}

export interface SimulationRunView {
  id: string;
  scenarioId: string;
  scenarioVersion: number;
  name: string;
  hubIds: string[];
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress: number;
  analysisReady: boolean;
  modelVersion: string;
  baseTime: string;
  capturedAt: string;
  error: string | null;
  result: SimulationResult | null;
}
