import type { ChargingVehicle } from '@semh/contracts';
import type { Transaction } from '../../../shared/database/transaction.js';

export abstract class PrivateCharging {
  abstract listChargingVehicles(tx: Transaction, ownerId: string): Promise<{ id: string; plate: string }[]>;
  abstract chargingVehicle(tx: Transaction, id: string): Promise<ChargingVehicle | null>;
  abstract recordBattery(tx: Transaction, id: string, batteryPercent: number, lastObservedAt: Date): Promise<void>;
}
