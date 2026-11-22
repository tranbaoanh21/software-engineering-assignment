import { ConflictException, Injectable } from '@nestjs/common';
import type { NetworkResource, ResourceKind, ResourceServiceStatus } from '@semh/contracts';
import type { Transaction } from '../../../shared/database/transaction.js';
import { ChargingService } from '../../chg/application/charging.service.js';

export interface ResourceDraft {
  kind: ResourceKind;
  code: string;
  hubId: string | null;
  description: string;
  name?: string;
  latitude?: number;
  longitude?: number;
  capacity?: number;
  chargeKw?: number;
  connector?: string;
  powerKw?: number;
}

function summarize(
  kind: ResourceKind,
  row: {
    id: string; hubId?: string | null; code: string; description: string; serviceStatus: ResourceServiceStatus;
    status?: string; version: number; lastObservedAt: Date | null; fault?: boolean; batteryPercent?: number;
  },
): NetworkResource {
  return {
    kind, id: row.id, code: row.code, hubId: kind === 'HUB' ? row.id : row.hubId ?? null, description: row.description,
    serviceStatus: row.serviceStatus, status: row.status ?? (row.fault ? 'OUT_OF_SERVICE' : 'AVAILABLE'),
    observedAt: row.lastObservedAt?.toISOString() ?? null, version: row.version, batteryPercent: row.batteryPercent,
  };
}

@Injectable()
export class PrismaResourceOwnerAdapter {
  constructor(private readonly charging: ChargingService) {}

  async get(tx: Transaction, kind: ResourceKind, id: string) {
    const where = { id };
    const resource = await (kind === 'HUB' ? tx.mobilityHub.findUnique({ where })
      : kind === 'VEHICLE' ? tx.sharedVehicle.findUnique({ where })
      : kind === 'PARKING_SPACE' ? tx.parkingSpace.findUnique({ where })
      : tx.chargingPoint.findUnique({ where }));
    if (!resource) return null;
    return summarize(kind, resource);
  }

  async create(tx: Transaction, input: ResourceDraft, sourceId: string) {
    const { kind, code, description, hubId } = input;
    const data = { code, description };
    if (kind === 'HUB') {
      const row = await tx.mobilityHub.create({
        data: { ...data, name: input.name!, latitude: input.latitude!, longitude: input.longitude!,
          vehicleCapacity: input.capacity!, chargeKw: input.chargeKw! },
      });
      return summarize(kind, row);
    }
    const child = { ...data, hubId: hubId!, sourceId };
    if (kind === 'VEHICLE') {
      const row = await tx.sharedVehicle.create({ data: { ...child, batteryPercent: 0, connector: input.connector ?? 'AC' } });
      return summarize(kind, row);
    }
    if (kind === 'PARKING_SPACE') return summarize(kind, await tx.parkingSpace.create({ data: child }));
    return summarize(kind, await tx.chargingPoint.create({ data: { ...child, connector: input.connector!, powerKw: input.powerKw! } }));
  }

  async updateMetadata(tx: Transaction, resource: NetworkResource, description: string) {
    return this.updateCommon(tx, resource, { description });
  }

  async constrained(tx: Transaction, resource: NetworkResource): Promise<boolean> {
    const { kind, id } = resource;
    const now = new Date();
    if (kind === 'VEHICLE') {
      const row = await tx.sharedVehicle.findUnique({ where: { id } });
      if (!row) return true;
      if (row.reservationHoldId || row.transferPlanId || ['IN_USE', 'CHARGING'].includes(row.status)) return true;
      return await tx.chargingRequest.count({
        where: { vehicleId: id, OR: [{ status: 'SCHEDULED' }, { session: { startedAt: { not: null }, releasedAt: null } }] },
      }) > 0;
    }
    if (kind === 'PARKING_SPACE') {
      const row = await tx.parkingSpace.findUnique({ where: { id } });
      if (!row || row.occupied === true) return true;
      return await tx.parkingReservation.count({
        where: { spaceId: id, OR: [{ status: 'CHECKED_IN' }, { status: 'CONFIRMED', expiresAt: { gt: now } }] },
      }) > 0;
    }
    if (kind === 'CHARGING_POINT') {
      return await tx.chargingSession.count({
        where: { pointId: id, OR: [{ status: 'READY' }, { startedAt: { not: null }, releasedAt: null }] },
      }) > 0;
    }
    const [vehicle, parking, charging, trip, transfer] = await this.hubConstraints(tx, id, now);
    return !!(vehicle || parking || charging || trip || transfer);
  }

  private async hubConstraints(tx: Transaction, hubId: string, now: Date) {
    const vehicle = await tx.sharedVehicle.count({
      where: { hubId, OR: [{ reservationHoldId: { not: null } }, { transferPlanId: { not: null } }] },
    });
    const parking = await tx.parkingSpace.count({
      where: { hubId, OR: [
        { occupied: true },
        { reservations: { some: { OR: [{ status: 'CHECKED_IN' }, { status: 'CONFIRMED', expiresAt: { gt: now } }] } } },
      ] },
    });
    const charging = await tx.chargingRequest.count({
      where: { hubId, OR: [{ status: 'SCHEDULED' }, { session: { startedAt: { not: null }, releasedAt: null } }] },
    });
    const trip = await tx.trip.count({ where: { startHubId: hubId, status: 'IN_PROGRESS' } });
    const transfer = await tx.redistributionPlan.count({
      where: { status: { in: ['APPROVED', 'IN_PROGRESS'] }, OR: [{ sourceHubId: hubId }, { targetHubId: hubId }] },
    });
    return [vehicle, parking, charging, trip, transfer];
  }

  async setService(tx: Transaction, resource: NetworkResource, serviceStatus: 'ACTIVE' | 'INACTIVE') {
    return this.updateCommon(tx, resource, { serviceStatus });
  }

  private async updateCommon(tx: Transaction, resource: NetworkResource, patch: { serviceStatus?: ResourceServiceStatus; description?: string }) {
    const { kind, id } = resource;
    const data = { ...patch, version: { increment: 1 } };
    const args = { where: { id }, data };
    const row = await (kind === 'HUB' ? tx.mobilityHub.update(args) : kind === 'VEHICLE' ? tx.sharedVehicle.update(args)
      : kind === 'PARKING_SPACE' ? tx.parkingSpace.update(args) : tx.chargingPoint.update(args));
    return summarize(kind, row);
  }

  async markFault(tx: Transaction, resource: NetworkResource) {
    const { kind, id } = resource;
    const where = { id };
    const version = { increment: 1 };
    if (kind === 'HUB') await tx.mobilityHub.update({ where, data: { fault: true, version } });
    else if (kind === 'VEHICLE') {
      const row = await tx.sharedVehicle.findUniqueOrThrow({ where });
      const keep = row.status === 'IN_USE' || row.status === 'CHARGING';
      await tx.sharedVehicle.update({ where, data: { fault: true, status: keep ? row.status : 'OUT_OF_SERVICE', version } });
    } else if (kind === 'PARKING_SPACE') {
      await tx.parkingSpace.update({ where, data: { status: 'OUT_OF_SERVICE', fault: true, version } });
    } else {
      await this.charging.interruptPointInTx(tx, id, resource.hubId!, new Date());
    }
  }

  async restore(tx: Transaction, resource: NetworkResource, actualHubId?: string) {
    const { kind, id } = resource;
    if (await this.constrained(tx, resource)) throw new ConflictException('Tài nguyên vẫn có ràng buộc, chưa thể khôi phục.');
    const where = { id };
    const version = { increment: 1 };
    if (kind === 'HUB') {
      await tx.mobilityHub.update({ where, data: { fault: false, version } });
    } else if (kind === 'VEHICLE') {
      const row = await tx.sharedVehicle.findUniqueOrThrow({ where });
      const hubId = row.hubId ?? actualHubId;
      if (!hubId || !row.lastObservedAt) throw new ConflictException('Cần biết vị trí an toàn và mức pin của xe.');
      await tx.sharedVehicle.update({
        where, data: { fault: false, sinceMaintenanceKm: 0, hubId,
          status: row.batteryPercent >= 30 ? 'AVAILABLE' : 'AWAITING_CHARGE', version },
      });
    } else if (kind === 'PARKING_SPACE') {
      const row = await tx.parkingSpace.findUniqueOrThrow({ where });
      if (row.occupied !== false || !row.lastObservedAt) throw new ConflictException('Chưa xác nhận chỗ đỗ trống.');
      await tx.parkingSpace.update({ where, data: { status: 'AVAILABLE', fault: false, version } });
    } else {
      const row = await tx.chargingPoint.findUniqueOrThrow({ where });
      if (!row.lastObservedAt) throw new ConflictException('Chưa xác nhận dữ liệu cổng sạc.');
      await tx.chargingPoint.update({ where, data: { status: 'AVAILABLE', fault: false, version } });
    }
  }
}
