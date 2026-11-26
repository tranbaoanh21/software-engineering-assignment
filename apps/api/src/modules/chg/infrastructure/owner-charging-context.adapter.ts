import { Injectable } from '@nestjs/common';
import type { ChargingVehicle } from '@semh/contracts';
import type { Transaction } from '../../../shared/database/transaction.js';
import { PrivateCharging } from '../../park/application/private-charging.port.js';
import { FleetNetwork } from '../../trip/application/fleet-network.port.js';

@Injectable()
export class OwnerChargingContextAdapter {
  constructor(private readonly parking: PrivateCharging, private readonly fleet: FleetNetwork) {}

  vehicle(tx: Transaction, kind: string, id: string) {
    return kind === 'PRIVATE' ? this.parking.chargingVehicle(tx, id) : this.fleet.chargingVehicle(tx, id);
  }

  personalVehicles(tx: Transaction, ownerId: string) {
    return this.parking.listChargingVehicles(tx, ownerId);
  }

  recordPrivateBattery(tx: Transaction, id: string, batteryPercent: number, observedAt: Date) {
    return this.parking.recordBattery(tx, id, batteryPercent, observedAt);
  }

  updateVehicle(
    tx: Transaction, vehicle: Pick<ChargingVehicle, 'kind' | 'id'>,
    hubId: string, phase: 'STARTED' | 'PROGRESS' | 'RELEASED' | 'FAULT', battery: number, observedAt: Date,
  ) {
    return vehicle.kind === 'PRIVATE'
      ? this.parking.recordBattery(tx, vehicle.id, battery, observedAt)
      : this.fleet.applyCharge(tx, vehicle.id, hubId, phase, battery);
  }
}
