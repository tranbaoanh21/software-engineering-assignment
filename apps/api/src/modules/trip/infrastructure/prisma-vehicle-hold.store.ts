import { Injectable } from '@nestjs/common';
import { reservationMinimumBatteryPercent } from '@semh/contracts';
import type { Transaction } from '../../../shared/database/transaction.js';
import { VehicleHoldStore } from '../application/vehicle-hold.port.js';

@Injectable()
export class PrismaVehicleHoldStore extends VehicleHoldStore {
  find(tx: Transaction, vehicleId: string) {
    return tx.sharedVehicle.findUnique({
      where: { id: vehicleId },
      select: {
        hubId: true,
        serviceStatus: true,
        status: true,
        reservationHoldId: true,
        transferPlanId: true,
        batteryPercent: true,
        hub: { select: { serviceStatus: true, fault: true } },
      },
    });
  }

  async reserve(tx: Transaction, reservationId: string, vehicleId: string, hubId: string) {
    const written = await tx.sharedVehicle.updateMany({
      where: {
        id: vehicleId,
        hubId,
        serviceStatus: 'ACTIVE',
        status: 'AVAILABLE',
        reservationHoldId: null,
        transferPlanId: null,
        batteryPercent: { gte: reservationMinimumBatteryPercent },
        hub: { serviceStatus: 'ACTIVE', fault: false },
      },
      data: { status: 'RESERVED', reservationHoldId: reservationId },
    });
    return written.count === 1;
  }

  async release(tx: Transaction, reservationId: string, vehicleId: string) {
    const vehicle = await this.find(tx, vehicleId);
    if (!vehicle || vehicle.reservationHoldId !== reservationId) return;

    let status: 'AVAILABLE' | 'AWAITING_CHARGE' | 'OUT_OF_SERVICE' | undefined;
    if (vehicle.status === 'RESERVED') {
      const active = vehicle.serviceStatus === 'ACTIVE' && vehicle.hub?.serviceStatus === 'ACTIVE' && !vehicle.hub.fault;
      if (!active) status = 'OUT_OF_SERVICE';
      else status = vehicle.batteryPercent >= reservationMinimumBatteryPercent ? 'AVAILABLE' : 'AWAITING_CHARGE';
    }

    await tx.sharedVehicle.updateMany({
      where: { id: vehicleId, reservationHoldId: reservationId },
      data: { status, reservationHoldId: null },
    });
  }
}
