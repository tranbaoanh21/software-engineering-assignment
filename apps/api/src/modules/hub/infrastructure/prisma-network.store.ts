import { NetworkReader } from '../application/network-reader.port.js';
import { Injectable } from '@nestjs/common';
import { reservationMinimumBatteryPercent, type NetworkHub, type NetworkResource } from '@semh/contracts';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type { Transaction } from '../../../shared/database/transaction.js';

@Injectable()
export class PrismaNetworkStore implements NetworkReader {
  constructor(private readonly prisma: PrismaService) {}

  snapshot(hubIds?: string[], activeOnly = true) {
    return this.prisma.$transaction(tx => this.read(tx, hubIds, activeOnly), { isolationLevel: 'RepeatableRead' });
  }

  async read(tx: Transaction, hubIds?: string[], activeOnly = true): Promise<NetworkHub[]> {
    const hubs = await tx.mobilityHub.findMany({
      where: { id: hubIds ? { in: hubIds } : undefined, serviceStatus: activeOnly ? 'ACTIVE' : undefined },
      include: {
        vehicles: { orderBy: { code: 'asc' } },
        parkingSpaces: { orderBy: { code: 'asc' } },
        chargingPoints: {
          orderBy: { code: 'asc' },
          include: { sessions: { where: { status: 'READY', startAt: { lte: new Date() } }, select: { id: true }, take: 1 } },
        },
      },
      orderBy: { code: 'asc' },
    });
    const inbound = await tx.transferItem.groupBy({
      by: ['planId'], where: {
        plan: { targetHubId: { in: hubs.map(hub => hub.id) }, status: { in: ['APPROVED', 'IN_PROGRESS'] } },
        status: { in: ['PLANNED', 'DEPARTED'] },
      }, _count: { _all: true },
    });
    const plans = await tx.redistributionPlan.findMany({
      where: { id: { in: inbound.map(row => row.planId) } }, select: { id: true, targetHubId: true },
    });
    const destinations = new Map(plans.map(row => [row.id, row.targetHubId]));
    const heldByHub = new Map<string, number>();
    for (const row of inbound) {
      const destination = destinations.get(row.planId)!;
      heldByHub.set(destination, (heldByHub.get(destination) ?? 0) + row._count._all);
    }
    return hubs.map(hub => {
      const enabled = hub.serviceStatus === 'ACTIVE' && !hub.fault;
      const vehicleResources = hub.vehicles.filter(vehicle => !activeOnly || vehicle.serviceStatus === 'ACTIVE');
      const parkingResources = hub.parkingSpaces.filter(space => !activeOnly || space.serviceStatus === 'ACTIVE');
      const chargingResources = hub.chargingPoints.filter(point => !activeOnly || point.serviceStatus === 'ACTIVE');
      const resources: NetworkResource[] = [
        ...(!activeOnly ? [{
          id: hub.id, kind: 'HUB' as const, hubId: hub.id, code: hub.code, description: hub.description,
          status: hub.fault ? 'OUT_OF_SERVICE' : 'AVAILABLE', serviceStatus: hub.serviceStatus,
          observedAt: hub.lastObservedAt?.toISOString() ?? null, version: hub.version,
        }] : []),
        ...vehicleResources.map(vehicle => ({
          id: vehicle.id, kind: 'VEHICLE' as const, hubId: hub.id, code: vehicle.code, description: vehicle.description,
          status: vehicle.transferPlanId ? 'TRANSFER_HELD' : vehicle.status, serviceStatus: vehicle.serviceStatus,
          observedAt: vehicle.lastObservedAt?.toISOString() ?? null, version: vehicle.version, batteryPercent: vehicle.batteryPercent,
        })),
        ...parkingResources.map(space => ({
          id: space.id, kind: 'PARKING_SPACE' as const, hubId: hub.id, code: space.code, description: space.description,
          status: space.status, serviceStatus: space.serviceStatus, observedAt: space.lastObservedAt?.toISOString() ?? null,
          version: space.version,
        })),
        ...chargingResources.map(point => ({
          id: point.id, kind: 'CHARGING_POINT' as const, hubId: hub.id, code: point.code, description: point.description,
          status: point.status === 'AVAILABLE' && point.sessions.length > 0 ? 'RESERVED' : point.status,
          serviceStatus: point.serviceStatus, observedAt: point.lastObservedAt?.toISOString() ?? null, version: point.version,
        })),
      ];
      const availableVehicles = enabled ? vehicleResources.filter(vehicle =>
        vehicle.serviceStatus === 'ACTIVE' && vehicle.status === 'AVAILABLE' && vehicle.batteryPercent >= reservationMinimumBatteryPercent &&
        !vehicle.fault && !vehicle.reservationHoldId && !vehicle.transferPlanId).length : 0;
      const vehicleCount = hub.vehicles.filter(vehicle => vehicle.serviceStatus !== 'DRAFT' || vehicle.lastObservedAt).length;
      const alerts: NetworkHub['alerts'] = [];
      if (enabled && hub.vehicleCapacity > 0 && availableVehicles < hub.vehicleCapacity * 0.15) alerts.push('LOW_FLEET');
      if (enabled && hub.vehicleCapacity > 0 && vehicleCount > hub.vehicleCapacity * 0.9) alerts.push('NEAR_CAPACITY');
      return {
        id: hub.id, code: hub.code, name: hub.name, latitude: hub.latitude, longitude: hub.longitude,
        serviceStatus: hub.serviceStatus, capacity: hub.vehicleCapacity, chargeKw: hub.chargeKw,
        availableVehicles, vehicleCount, heldArrivals: heldByHub.get(hub.id) ?? 0, alerts, resources,
        parkingCount: parkingResources.length, chargingCount: chargingResources.length,
        availableParking: enabled ? parkingResources.filter(space => space.serviceStatus === 'ACTIVE' && space.status === 'AVAILABLE' &&
          !space.fault && space.occupied === false && space.lastObservedAt).length : 0,
        availableCharging: enabled ? chargingResources.filter(point => point.serviceStatus === 'ACTIVE' && point.status === 'AVAILABLE' &&
          !point.fault && point.lastObservedAt && point.sessions.length === 0).length : 0,
      };
    });
  }
}
