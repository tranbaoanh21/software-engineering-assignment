import { Injectable, NotFoundException } from '@nestjs/common';
import type { BatteryStateEvent, StateEventReceipt } from '@semh/contracts';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { FleetTelemetryStore } from '../application/fleet-telemetry.port.js';

@Injectable()
export class PrismaFleetTelemetryStore extends FleetTelemetryStore {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  applyBatteryEvent(event: BatteryStateEvent): Promise<StateEventReceipt> {
    return this.prisma.$transaction(async tx => {
      const receipt = await tx.stateEventRecord.createMany({
        data: [{ sourceId: event.sourceId, eventId: event.eventId }],
        skipDuplicates: true,
      });
      if (!receipt.count) return { result: 'duplicate' };

      const vehicle = await tx.sharedVehicle.updateMany({
        where: {
          id: event.vehicleId,
          sourceId: event.sourceId,
          ...(event.tripId ? {
            status: 'IN_USE', trips: { some: { id: event.tripId, status: 'IN_PROGRESS' } },
            batteryPercent: { gt: event.batteryPercent },
          } : { status: { in: ['AVAILABLE', 'IN_USE', 'RESERVED'] } }),
          telemetrySequence: { lt: event.sequence },
          OR: [{ lastObservedAt: null }, { lastObservedAt: { lte: new Date(event.observedAt) } }],
        },
        data: {
          batteryPercent: event.batteryPercent,
          telemetrySequence: event.sequence,
          lastObservedAt: new Date(event.observedAt),
        },
      });
      if (vehicle.count) return { result: 'applied' };

      const resource = await tx.sharedVehicle.findFirst({
        where: { id: event.vehicleId, sourceId: event.sourceId },
        select: { id: true },
      });
      if (!resource) throw new NotFoundException('Phương tiện không thuộc nguồn dữ liệu này');
      return { result: 'stale' };
    });
  }
}
