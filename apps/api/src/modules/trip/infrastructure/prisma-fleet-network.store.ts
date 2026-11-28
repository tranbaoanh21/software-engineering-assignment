import type { FleetChargingPhase, FleetNetwork } from '../application/fleet-network.port.js';
import { ConflictException, Injectable } from '@nestjs/common';
import { reservationMinimumBatteryPercent, type ChargingVehicle } from '@semh/contracts';
import type { Transaction } from '../../../shared/database/transaction.js';
import { markLiveChange } from '../../../shared/live/committed-changes.js';
import { returnedVehicleStatus } from '../domain/trip.policy.js';

@Injectable()
export class PrismaFleetNetworkStore implements FleetNetwork {
  lowBatteryVehicles(tx: Transaction) {
    return tx.sharedVehicle.findMany({
      where: {
        hub: { serviceStatus: 'ACTIVE', fault: false }, serviceStatus: 'ACTIVE', fault: false,
        status: { in: ['AVAILABLE', 'AWAITING_CHARGE'] }, batteryPercent: { lt: reservationMinimumBatteryPercent },
        lastObservedAt: { not: null }, reservationHoldId: null, transferPlanId: null,
      },
      select: { id: true, code: true, hubId: true },
    });
  }

  async approveChargedVehicle(tx: Transaction, id: string, hubId: string) {
    const result = await tx.sharedVehicle.updateMany({
      where: {
        id, hubId, status: 'AWAITING_CHARGE_APPROVAL', serviceStatus: 'ACTIVE', fault: false,
        batteryPercent: { gte: reservationMinimumBatteryPercent }, reservationHoldId: null, transferPlanId: null,
      },
      data: { status: 'AVAILABLE', version: { increment: 1 } },
    });
    if (!result.count) throw new ConflictException('Xe chưa đủ điều kiện trở lại phục vụ tại Hub.');
    markLiveChange(tx, 'vehicle', hubId);
  }

  async chargingVehicle(tx: Transaction, id: string): Promise<ChargingVehicle | null> {
    const vehicle = await tx.sharedVehicle.findUnique({ where: { id } });
    if (!vehicle) return null;
    return {
      id, code: vehicle.code, kind: 'SHARED', ownerId: null, hubId: vehicle.hubId,
      batteryPercent: vehicle.lastObservedAt ? vehicle.batteryPercent : null,
      batteryKwh: vehicle.batteryKwh, maxChargeKw: vehicle.maxChargeKw, connector: vehicle.connector,
      ready: vehicle.serviceStatus === 'ACTIVE' && !vehicle.fault && !!vehicle.hubId && !vehicle.transferPlanId &&
        !vehicle.reservationHoldId && ['AVAILABLE', 'AWAITING_CHARGE'].includes(vehicle.status),
    };
  }

  async applyCharge(tx: Transaction, id: string, hubId: string, phase: FleetChargingPhase, battery: number) {
    const vehicle = await tx.sharedVehicle.findUnique({ where: { id } });
    if (!vehicle || vehicle.hubId !== hubId || vehicle.reservationHoldId || vehicle.transferPlanId) {
      throw new ConflictException('Xe dùng chung không ở trạng thái phù hợp để sạc.');
    }
    if (phase === 'STARTED' && (
      vehicle.serviceStatus !== 'ACTIVE' || vehicle.fault || !['AVAILABLE', 'AWAITING_CHARGE'].includes(vehicle.status)
    )) throw new ConflictException('Xe dùng chung đang có ràng buộc hoặc không thể phục vụ.');
    if (phase === 'PROGRESS' && vehicle.status !== 'CHARGING') return;
    const afterRelease = returnedVehicleStatus(battery, vehicle.fault || vehicle.status === 'OUT_OF_SERVICE');
    const status = phase === 'RELEASED_FOR_APPROVAL' && afterRelease === 'AVAILABLE'
      ? 'AWAITING_CHARGE_APPROVAL'
      : phase === 'STARTED' || phase === 'PROGRESS' ? 'CHARGING' : afterRelease;
    await tx.sharedVehicle.update({
      where: { id }, data: { status, batteryPercent: battery, lastObservedAt: new Date(), version: { increment: 1 } },
    });
    if (status !== vehicle.status) markLiveChange(tx, 'vehicle', hubId);
    return status;
  }

  async bindTransfer(tx: Transaction, id: string, planId: string, hubId: string) {
    const result = await tx.sharedVehicle.updateMany({
      where: {
        id, hubId, serviceStatus: 'ACTIVE', status: { in: ['AVAILABLE', 'AWAITING_CHARGE'] },
        lastObservedAt: { not: null }, reservationHoldId: null, transferPlanId: null,
      },
      data: { transferPlanId: planId, version: { increment: 1 } },
    });
    if (!result.count) throw new ConflictException('Xe nguồn đã đổi trạng thái hoặc đang được giữ.');
    markLiveChange(tx, 'vehicle', hubId);
  }

  async transfer(tx: Transaction, id: string, planId: string, movement: 'DEPART' | 'ARRIVE' | 'CANCEL', hubId: string) {
    const vehicle = await tx.sharedVehicle.findUnique({ where: { id } });
    if (!vehicle || vehicle.transferPlanId !== planId ||
        (movement === 'DEPART' && (vehicle.hubId !== hubId || vehicle.status === 'OUT_OF_SERVICE')) ||
        (movement === 'ARRIVE' && vehicle.hubId !== null) ||
        (movement === 'CANCEL' && vehicle.hubId !== hubId)) {
      throw new ConflictException('Xe không khớp trạng thái bàn giao của kế hoạch.');
    }
    await tx.sharedVehicle.update({
      where: { id },
      data: movement === 'DEPART'
        ? { hubId: null, status: 'OUT_OF_SERVICE', version: { increment: 1 } }
        : movement === 'CANCEL'
          ? { transferPlanId: null, version: { increment: 1 } }
          : {
            hubId, transferPlanId: null, lastObservedAt: new Date(),
            status: returnedVehicleStatus(vehicle.batteryPercent, vehicle.fault), version: { increment: 1 },
          },
    });
    markLiveChange(tx, 'vehicle', hubId);
  }

  async closeFaultedTrip(tx: Transaction, tripId: string, vehicleId: string) {
    const trip = await tx.trip.findFirst({
      where: { id: tripId, vehicleId, status: 'IN_PROGRESS' },
      select: { startedAt: true, vehicle: { select: { batteryPercent: true } } },
    });
    if (!trip) throw new ConflictException('Chuyến đi đã kết thúc hoặc không khớp xe.');
    const endedAt = new Date();
    await tx.trip.update({
      where: { id: tripId },
      data: {
        status: 'INTERRUPTED', endedAt, endBattery: trip.vehicle.batteryPercent, endVehicleStatus: 'OUT_OF_SERVICE',
        durationSeconds: Math.max(0, Math.floor((endedAt.getTime() - trip.startedAt.getTime()) / 1000)),
      },
    });
    await tx.sharedVehicle.update({
      where: { id: vehicleId }, data: { status: 'OUT_OF_SERVICE', fault: true, version: { increment: 1 } },
    });
    await tx.tripHandoffCommand.updateMany({
      where: { kind: 'RETURN', subjectId: tripId, status: 'PENDING' },
      data: { status: 'REJECTED', reason: 'Chuyến đi kết thúc khi kỹ thuật tiếp nhận xe.' },
    });
  }
}
