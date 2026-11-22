import type { CreateReservationInput, VehicleReservationStatus } from '@semh/contracts';
import type { Transaction } from '../../../shared/database/transaction.js';

export interface ReservationRecord {
  id: string;
  status: VehicleReservationStatus;
  vehicle: { id: string; code: string };
  hub: { id: string; name: string };
  confirmedAt: Date;
  expiresAt: Date;
  version: number;
}

export interface ExpiringReservation {
  id: string;
  vehicleId: string;
}

export abstract class ReservationStore {
  abstract runSerializable<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
  abstract findByRequest(studentId: string, requestId: string, tx?: Transaction): Promise<ReservationRecord | null>;
  abstract findOwned(studentId: string, reservationId: string, tx?: Transaction): Promise<ReservationRecord | null>;
  abstract changeStatus(
    tx: Transaction, reservationId: string, expected: VehicleReservationStatus,
    status: VehicleReservationStatus, now: Date
  ): Promise<boolean>;
  abstract findActive(studentId: string, now: Date, tx?: Transaction): Promise<ReservationRecord | null>;
  abstract findDue(tx: Transaction, now: Date, studentId: string, vehicleId: string): Promise<ExpiringReservation[]>;
  abstract findDueBatch(now: Date): Promise<ExpiringReservation[]>;
  abstract createConfirmed(
    tx: Transaction, studentId: string, input: CreateReservationInput, confirmedAt: Date, expiresAt: Date,
  ): Promise<ReservationRecord>;
  abstract expire(tx: Transaction, reservationId: string, now: Date): Promise<boolean>;
}
