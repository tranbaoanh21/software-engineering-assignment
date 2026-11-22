import type { Transaction } from '../../../shared/database/transaction.js';

export interface VehicleForReservation {
  hubId: string | null;
  serviceStatus: string;
  status: string;
  reservationHoldId: string | null;
  transferPlanId: string | null;
  batteryPercent: number;
  hub: { serviceStatus: string; fault: boolean } | null;
}

export abstract class VehicleHoldStore {
  abstract find(tx: Transaction, vehicleId: string): Promise<VehicleForReservation | null>;
  abstract reserve(tx: Transaction, reservationId: string, vehicleId: string, hubId: string): Promise<boolean>;
  abstract release(tx: Transaction, reservationId: string, vehicleId: string): Promise<void>;
}
