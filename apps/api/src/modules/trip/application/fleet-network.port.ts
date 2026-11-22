import type { ChargingVehicle } from '@semh/contracts';
import type { Transaction } from '../../../shared/database/transaction.js';

export abstract class FleetNetwork {
  abstract chargingVehicle(tx: Transaction, id: string): Promise<ChargingVehicle | null>;
  abstract applyCharge(tx: Transaction, id: string, hubId: string, phase: 'STARTED' | 'PROGRESS' | 'RELEASED' | 'FAULT', battery: number): Promise<void>;
  abstract bindTransfer(tx: Transaction, id: string, planId: string, hubId: string): Promise<void>;
  abstract transfer(tx: Transaction, id: string, planId: string, movement: 'DEPART' | 'ARRIVE' | 'CANCEL', hubId: string): Promise<void>;
  abstract closeFaultedTrip(tx: Transaction, tripId: string, vehicleId: string): Promise<void>;
}
