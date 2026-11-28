import type { ChargingVehicle } from '@semh/contracts';
import type { Transaction } from '../../../shared/database/transaction.js';

export type FleetChargingPhase = 'STARTED' | 'PROGRESS' | 'RELEASED' | 'FAULT' | 'RELEASED_FOR_APPROVAL';

export abstract class FleetNetwork {
  abstract lowBatteryVehicles(tx: Transaction): Promise<{ id: string; code: string; hubId: string | null }[]>;
  abstract approveChargedVehicle(tx: Transaction, id: string, hubId: string): Promise<void>;
  abstract chargingVehicle(tx: Transaction, id: string): Promise<ChargingVehicle | null>;
  abstract applyCharge(tx: Transaction, id: string, hubId: string, phase: FleetChargingPhase, battery: number): Promise<string | undefined>;
  abstract bindTransfer(tx: Transaction, id: string, planId: string, hubId: string): Promise<void>;
  abstract transfer(tx: Transaction, id: string, planId: string, movement: 'DEPART' | 'ARRIVE' | 'CANCEL', hubId: string): Promise<void>;
  abstract closeFaultedTrip(tx: Transaction, tripId: string, vehicleId: string): Promise<void>;
}
