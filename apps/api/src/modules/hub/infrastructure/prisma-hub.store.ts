import { Injectable } from '@nestjs/common';
import type { HubView } from '@semh/contracts';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import { HubStore } from '../application/hub-store.port.js';

@Injectable()
export class PrismaHubStore extends HubStore {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHubActiveInTx(tx: Transaction, hubId: string) {
    const hub = await tx.mobilityHub.findUnique({ where: { id: hubId }, select: { serviceStatus: true, fault: true } });
    return hub?.serviceStatus === 'ACTIVE' && !hub.fault;
  }

  async readArrivalCapacity(tx: Transaction, hubId: string) {
    const hub = await tx.mobilityHub.findUnique({
      where: { id: hubId },
      select: { serviceStatus: true, fault: true, vehicleCapacity: true, _count: { select: { vehicles: { where: { OR: [{ serviceStatus: { not: 'DRAFT' } }, { lastObservedAt: { not: null } }] } } } } },
    });
    if (!hub) return null;
    const held = await tx.transferItem.count({
      where: { plan: { targetHubId: hubId, status: { in: ['APPROVED', 'IN_PROGRESS'] } }, status: { in: ['PLANNED', 'DEPARTED'] } },
    });
    const physicalSpaces = Math.max(0, hub.vehicleCapacity - hub._count.vehicles);
    return { active: hub.serviceStatus === 'ACTIVE' && !hub.fault, spaces: Math.max(0, physicalSpaces - held), physicalSpaces };
  }

  listActiveHubs(): Promise<HubView[]> {
    return this.prisma.mobilityHub.findMany({
      where: { serviceStatus: 'ACTIVE', fault: false },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        vehicles: {
          where: { serviceStatus: 'ACTIVE', fault: false },
          orderBy: { code: 'asc' },
          select: { id: true, code: true, status: true, batteryPercent: true },
        },
      },
    });
  }
}
