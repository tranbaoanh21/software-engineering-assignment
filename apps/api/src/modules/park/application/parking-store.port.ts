import type { ParkingVerificationKind, PendingParkingVerification, PrivateVehicleView } from '@semh/contracts';
import type { ParkingReservationStatus, ParkingSpaceStatus, ParkingVerificationStatus } from '../../../generated/prisma/client.js';
import type { Transaction } from '../../../shared/database/transaction.js';

export interface ParkingSpaceRecord {
  id: string;
  code: string;
  hubId: string;
  status: ParkingSpaceStatus;
  serviceStatus: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  sourceId: string;
  occupied: boolean | null;
  fault: boolean;
  lastObservedAt: Date | null;
  hub: { id: string; name: string };
}

export interface ParkingVerificationRecord {
  id: string;
  requestId: string;
  reservationId: string;
  kind: ParkingVerificationKind;
  status: ParkingVerificationStatus;
  createdAt: Date;
  expiresAt: Date;
  reason: string | null;
}

export interface ParkingReservationRecord {
  id: string;
  requestId: string;
  studentId: string;
  status: ParkingReservationStatus;
  privateVehicle: PrivateVehicleView;
  space: ParkingSpaceRecord;
  confirmedAt: Date;
  expiresAt: Date;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  verifications: ParkingVerificationRecord[];
}

export interface NewParkingReservation {
  studentId: string;
  spaceId: string;
  privateVehicleId: string;
  requestId: string;
  confirmedAt: Date;
  expiresAt: Date;
}

export interface ParkingReading {
  occupied: boolean | null;
  fault: boolean;
  lastObservedAt: Date;
}

export interface PrivateVehicleReading {
  batteryPercent: number | null;
  lastObservedAt: Date | null;
}

export interface RegisteredPrivateVehicle extends PrivateVehicleView, PrivateVehicleReading {
  ownerId: string;
}

export abstract class ParkingStore {
  abstract serializable<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  abstract listVehicles(studentId: string): Promise<PrivateVehicleView[]>;
  abstract findVehiclesByPlate(tx: Transaction, plate: string): Promise<RegisteredPrivateVehicle[]>;
  abstract createVehicle(tx: Transaction, data: Omit<RegisteredPrivateVehicle, 'id'>): Promise<PrivateVehicleView>;
  abstract setInitialVehicleReading(tx: Transaction, id: string, reading: PrivateVehicleReading): Promise<PrivateVehicleView>;
  abstract availableSpacesByHub(): Promise<{ hubId: string; count: number }[]>;
  abstract listReservations(studentId: string): Promise<ParkingReservationRecord[]>;
  abstract findOwnedVehicle(tx: Transaction, studentId: string, vehicleId: string, includeRemoved?: boolean):
    Promise<(PrivateVehicleView & { removedAt: Date | null }) | null>;
  abstract hasActiveCharge(tx: Transaction, vehicleId: string): Promise<boolean>;
  abstract removeVehicle(tx: Transaction, vehicleId: string, removedAt: Date): Promise<void>;
  abstract findByRequest(tx: Transaction, studentId: string, requestId: string): Promise<ParkingReservationRecord | null>;
  abstract findReservation(tx: Transaction, id: string): Promise<ParkingReservationRecord | null>;
  abstract findAvailableSpace(tx: Transaction, hubId: string): Promise<ParkingSpaceRecord | null>;
  abstract findSpace(tx: Transaction, spaceId: string): Promise<ParkingSpaceRecord | null>;
  abstract activeForVehicle(tx: Transaction, vehicleId: string): Promise<ParkingReservationRecord | null>;
  abstract activeForSpace(tx: Transaction, spaceId: string): Promise<ParkingReservationRecord | null>;
  abstract findDue(now: Date, options?: { tx: Transaction; hubId: string }): Promise<string[]>;
  abstract createReservation(tx: Transaction, data: NewParkingReservation): Promise<ParkingReservationRecord>;
  abstract updateReservation(tx: Transaction, change: {
    id: string; status: ParkingReservationStatus; checkInAt?: Date; checkOutAt?: Date;
  }): Promise<ParkingReservationRecord>;
  abstract updateSpace(tx: Transaction, spaceId: string, status: ParkingSpaceStatus, reading?: ParkingReading): Promise<void>;
  abstract findVerification(tx: Transaction, id: string): Promise<ParkingVerificationRecord | null>;
  abstract findVerificationByRequest(tx: Transaction, reservationId: string, requestId: string): Promise<ParkingVerificationRecord | null>;
  abstract createVerification(tx: Transaction, data: {
    reservationId: string; requestId: string; kind: ParkingVerificationKind; createdAt: Date; expiresAt: Date;
  }): Promise<ParkingVerificationRecord>;
  abstract settleVerification(tx: Transaction, id: string, reason?: string): Promise<ParkingVerificationRecord>;
  abstract listPending(sourceId: string, now: Date): Promise<PendingParkingVerification[]>;
  abstract recordEvent(tx: Transaction, sourceId: string, eventId: string): Promise<boolean>;
}
