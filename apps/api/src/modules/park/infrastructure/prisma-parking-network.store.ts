import { PrivateCharging } from '../application/private-charging.port.js';
import { Injectable } from '@nestjs/common';
import type { ChargingVehicle } from '@semh/contracts';
import type { Transaction } from '../../../shared/database/transaction.js';

@Injectable()
export class PrismaParkingNetworkStore implements PrivateCharging {
  async listChargingVehicles(tx: Transaction, ownerId: string) {
    const vehicles = await tx.privateVehicle.findMany({
      where: { ownerId }, select: { id: true, plate: true, batteryPercent: true, lastObservedAt: true }, orderBy: { plate: 'asc' },
    });
    return vehicles.map(({ id, plate, batteryPercent, lastObservedAt }) => ({
      id, plate, batteryPercent: lastObservedAt ? batteryPercent : null,
    }));
  }

  async chargingVehicle(tx: Transaction, id: string): Promise<ChargingVehicle | null> {
    const vehicle = await tx.privateVehicle.findUnique({ where: { id } });
    if (!vehicle) return null;
    return {
      id, code: vehicle.plate, kind: 'PRIVATE', ownerId: vehicle.ownerId, hubId: null, ready: true,
      batteryPercent: vehicle.lastObservedAt ? vehicle.batteryPercent : null,
      batteryKwh: vehicle.batteryKwh, maxChargeKw: vehicle.maxChargeKw, connector: vehicle.connector,
    };
  }

  async recordBattery(tx: Transaction, id: string, batteryPercent: number, lastObservedAt: Date) {
    await tx.privateVehicle.update({ where: { id }, data: { batteryPercent, lastObservedAt } });
  }
}
