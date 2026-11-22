import { Injectable } from '@nestjs/common';
import type { BatteryStateEvent } from '@semh/contracts';
import { FleetTelemetryStore } from './fleet-telemetry.port.js';
import { VehicleHoldStore } from './vehicle-hold.port.js';
import type { Transaction } from '../../../shared/database/transaction.js';

@Injectable()
export class TripService {
  constructor(
    private readonly fleetTelemetry: FleetTelemetryStore,
    private readonly holds: VehicleHoldStore,
  ) {}

  readReservationVehicleInTx(tx: Transaction, vehicleId: string) {
    return this.holds.find(tx, vehicleId);
  }

  reserveVehicleInTx(tx: Transaction, reservationId: string, vehicleId: string, hubId: string) {
    return this.holds.reserve(tx, reservationId, vehicleId, hubId);
  }

  releaseVehicleInTx(tx: Transaction, reservationId: string, vehicleId: string) {
    return this.holds.release(tx, reservationId, vehicleId);
  }

  applyVehicleStateEvent(event: BatteryStateEvent) {
    return this.fleetTelemetry.applyBatteryEvent(event);
  }
}
