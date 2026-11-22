import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { runSerializable } from '../../../shared/database/serializable.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import { NetworkReader } from '../../hub/application/network-reader.port.js';
import type { Snapshot } from '../domain/simulation-engine.js';

@Injectable()
export class PrismaSimulationStore {
  constructor(private readonly prisma: PrismaService, private readonly network: NetworkReader) {}

  write<T>(work: (tx: Transaction) => Promise<T>) {
    return runSerializable(this.prisma, work);
  }

  read<T>(work: (tx: Transaction) => Promise<T>) {
    return this.prisma.$transaction(work, { isolationLevel: 'RepeatableRead' });
  }

  async capture(tx: Transaction, ids: string[], now: Date): Promise<Snapshot> {
    const hubs = await this.network.read(tx, ids, false);
    const fleetHolds = await tx.vehicleReservation.findMany({
      where: {
        status: 'CONFIRMED', expiresAt: { gt: now }, hubId: { in: ids },
        vehicle: { fault: false, serviceStatus: 'ACTIVE', status: 'RESERVED', batteryPercent: { gte: 30 } },
      },
      select: { hubId: true, vehicleId: true, expiresAt: true, vehicle: { select: { batteryPercent: true } } },
    });
    const parking = await tx.parkingReservation.findMany({
      where: { status: 'CONFIRMED', expiresAt: { gt: now }, space: { hubId: { in: ids }, fault: false, occupied: false, serviceStatus: 'ACTIVE' } },
      include: { space: { select: { hubId: true } } },
    });
    const charging = await tx.chargingSession.findMany({
      where: { status: 'CHARGING', endAt: { gt: now }, point: { hubId: { in: ids }, fault: false, serviceStatus: 'ACTIVE' } },
      include: { point: { select: { hubId: true } } },
    });
    const minute = (date: Date) => Math.ceil((date.getTime() - now.getTime()) / 60_000);
    return {
      hubs, releases: [
        ...fleetHolds.map(row => ({
          hubId: row.hubId, resourceId: row.vehicleId, kind: 'VEHICLE' as const,
          minute: minute(row.expiresAt), batteryPercent: row.vehicle.batteryPercent,
        })),
        ...parking.map(row => ({ hubId: row.space.hubId, resourceId: row.spaceId, kind: 'PARKING' as const, minute: minute(row.expiresAt) })),
        ...charging.map(row => ({ hubId: row.point.hubId, resourceId: row.pointId, kind: 'CHARGING' as const, minute: minute(row.endAt) })),
      ],
    };
  }

  scenarios(tx: Transaction) {
    return tx.simulationScenario.findMany({ orderBy: { updatedAt: 'desc' } });
  }

  scenario(tx: Transaction, id: string) {
    return tx.simulationScenario.findUnique({ where: { id } });
  }

  create(tx: Transaction, data: Prisma.SimulationScenarioUncheckedCreateInput) {
    return tx.simulationScenario.create({ data });
  }

  update(tx: Transaction, id: string, data: Prisma.SimulationScenarioUncheckedUpdateInput) {
    return tx.simulationScenario.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
  }

  createRun(tx: Transaction, data: Prisma.SimulationRunUncheckedCreateInput) {
    return tx.simulationRun.create({ data });
  }

  run(tx: Transaction, id: string) {
    return tx.simulationRun.findUnique({ where: { id } });
  }

  runs(tx: Transaction, operatorHubIds: string[] | null | undefined) {
    return tx.simulationRun.findMany({
      where: operatorHubIds === null ? {} : { hubIds: { hasSome: operatorHubIds ?? [] } },
      orderBy: { capturedAt: 'desc' }, take: 100,
    });
  }

  updateRun(id: string, data: Prisma.SimulationRunUncheckedUpdateInput) {
    return this.prisma.simulationRun.update({ where: { id }, data });
  }

  async failInterruptedRuns() {
    await this.prisma.simulationRun.updateMany({
      where: { status: 'RUNNING' }, data: { status: 'FAILED', error: 'Máy chủ đã khởi động lại trong lúc mô phỏng.' },
    });
  }
}
