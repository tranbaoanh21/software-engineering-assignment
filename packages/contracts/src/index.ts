export const roles = ['STU', 'OPR', 'MNT', 'ADM'] as const;
export type Role = (typeof roles)[number];

export interface SessionView {
  accountId: string;
  displayName: string;
  roles: Role[];
  csrfToken: string;
  operatorHubIds?: string[] | null;
}

export interface SharedVehicleView {
  id: string;
  code: string;
  batteryPercent: number;
  status: string;
}

export interface HubView {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  vehicles: SharedVehicleView[];
}

export interface BatteryStateEvent {
  eventId: string;
  sourceId: string;
  type: 'vehicle.battery';
  vehicleId: string;
  sequence: number;
  batteryPercent: number;
  observedAt: string;
}

export interface StateEventReceipt {
  result: 'applied' | 'duplicate' | 'stale' | 'rejected';
}

export const reservationHoldMinutes = 10;
export const reservationMinimumBatteryPercent = 30;

export type VehicleReservationStatus = 'PENDING' | 'CONFIRMED' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED' | 'REJECTED';

export interface CreateReservationInput {
  requestId: string;
  vehicleId: string;
  hubId: string;
}

export interface ReservationView {
  id: string;
  status: VehicleReservationStatus;
  vehicle: { id: string; code: string };
  hub: { id: string; name: string };
  confirmedAt: string;
  expiresAt: string;
  serverTime: string;
  version: number;
}

export interface PickupInput {
  reservationId: string;
  vehicleCode: string;
  requestId: string;
}

export interface ReturnTripInput {
  hubId: string;
  requestId: string;
}

export interface TripView {
  id: string;
  reservationId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'INTERRUPTED';
  vehicle: { id: string; code: string };
  startHub: { id: string; name: string };
  endHub: { id: string; name: string } | null;
  startedAt: string;
  endedAt: string | null;
  startBattery: number;
  endBattery: number | null;
  endVehicleStatus: string | null;
  durationSeconds: number | null;
}

export interface TripHandoffView {
  id: string;
  status: 'PENDING' | 'APPLIED' | 'REJECTED' | 'EXPIRED';
  expiresAt: string;
  reason: string | null;
}

export interface PendingTripHandoff {
  id: string;
  kind: 'PICKUP' | 'RETURN';
  vehicleId: string;
  hubId: string;
  batteryPercent: number;
}

export interface VehicleHandoffEvent {
  type: 'vehicle.handoff';
  eventId: string;
  sourceId: string;
  commandId: string;
  vehicleId: string;
  hubId: string;
  observedAt: string;
  batteryPercent: number;
  confirmed: boolean;
  fault: boolean;
}

export const parkingHoldMinutes = 20;

export type ParkingReservationStatus = 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
export type ParkingVerificationKind = 'CHECK_IN' | 'CHECK_OUT';

export interface CreateParkingReservationInput {
  requestId: string;
  hubId: string;
  privateVehicleId: string;
}

export interface PrivateVehicleView {
  id: string;
  plate: string;
}

export interface RegisterPrivateVehicleInput {
  plate: string;
  batteryPercent: number | null;
}

export interface PrivateChargingVehicleView extends PrivateVehicleView {
  batteryPercent: number | null;
}

export interface ParkingReservationView {
  id: string;
  status: ParkingReservationStatus;
  vehicle: PrivateVehicleView;
  space: { id: string; code: string };
  hub: { id: string; name: string };
  confirmedAt: string;
  expiresAt: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  verification: {
    kind: ParkingVerificationKind;
    status: 'PENDING' | 'APPLIED' | 'REJECTED' | 'EXPIRED';
    reason: string | null;
  } | null;
}

export interface ParkingOverview {
  vehicles: PrivateVehicleView[];
  hubs: { id: string; name: string; availableSpaces: number }[];
  reservations: ParkingReservationView[];
}

export interface PendingParkingVerification {
  id: string;
  kind: ParkingVerificationKind;
  spaceId: string;
  privateVehicleId: string;
}

export interface ParkingStateEvent {
  type: 'parking.state';
  eventId: string;
  sourceId: string;
  spaceId: string;
  verificationId: string | null;
  privateVehicleId: string | null;
  occupied: boolean | null;
  fault: boolean;
  observedAt: string;
}

export * from './network.js';
