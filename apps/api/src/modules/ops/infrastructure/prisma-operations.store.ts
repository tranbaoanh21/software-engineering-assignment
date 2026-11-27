import { Injectable } from '@nestjs/common';
import type { ResourceKind } from '@semh/contracts';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { runSerializable } from '../../../shared/database/serializable.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import { markLiveChange } from '../../../shared/live/committed-changes.js';

const planInclude = {
  items: { orderBy: { vehicleId: 'asc' } },
  assignee: { select: { displayName: true } },
} as const;
export type StoredPlan = Prisma.RedistributionPlanGetPayload<{ include: typeof planInclude }>;

@Injectable()
export class PrismaOperationsStore {
  constructor(private readonly prisma: PrismaService) {}

  write<T>(work: (tx: Transaction) => Promise<T>) {
    return runSerializable(this.prisma, work);
  }

  read<T>(work: (tx: Transaction) => Promise<T>) {
    return this.prisma.$transaction(work, { isolationLevel: 'RepeatableRead' });
  }

  async recordEvent(tx: Transaction, sourceId: string, eventId: string) {
    return !!(await tx.stateEventRecord.createMany({ data: { sourceId, eventId }, skipDuplicates: true })).count;
  }

  openIncident(tx: Transaction, resourceKind: ResourceKind, resourceId: string) {
    return tx.incident.findFirst({ where: { resourceKind, resourceId, status: { not: 'CLOSED' } } });
  }

  incidents(tx: Transaction, where: Prisma.IncidentWhereInput) {
    return tx.incident.findMany({ where, orderBy: { updatedAt: 'desc' } });
  }

  incident(tx: Transaction, id: string) {
    return tx.incident.findUnique({ where: { id } });
  }

  async createIncident(tx: Transaction, data: Prisma.IncidentUncheckedCreateInput) {
    const incident = await tx.incident.create({ data });
    markLiveChange(tx, 'incident', incident.hubId);
    return incident;
  }

  async updateIncident(tx: Transaction, id: string, data: Prisma.IncidentUncheckedUpdateInput) {
    const incident = await tx.incident.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
    markLiveChange(tx, 'incident', incident.hubId);
    return incident;
  }

  technicians(tx: Transaction) {
    return tx.account.findMany({
      where: { status: 'ACTIVE', assignments: { some: { role: 'MNT' } } },
      select: { id: true, displayName: true }, orderBy: { displayName: 'asc' },
    });
  }

  activeTechnician(tx: Transaction, accountId: string) {
    return tx.account.count({ where: { id: accountId, status: 'ACTIVE', assignments: { some: { role: 'MNT' } } } });
  }

  openTrip(tx: Transaction, vehicleId: string) {
    return tx.trip.findFirst({ where: { vehicleId, status: 'IN_PROGRESS' } });
  }

  activeIncidentTrips(tx: Transaction, ids: string[]) {
    return tx.trip.findMany({ where: { id: { in: ids }, status: 'IN_PROGRESS' }, select: { id: true } });
  }

  vehiclesByIds(tx: Transaction, ids: string[]) {
    return tx.sharedVehicle.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, hubId: true } });
  }

  studentTrip(tx: Transaction, id: string, studentId: string) {
    return tx.trip.findFirst({ where: { id, studentId, status: 'IN_PROGRESS' } });
  }

  plan(tx: Transaction, id: string) {
    return tx.redistributionPlan.findUnique({ where: { id }, include: planInclude });
  }

  plans(tx: Transaction, where: Prisma.RedistributionPlanWhereInput) {
    return tx.redistributionPlan.findMany({ where, orderBy: { createdAt: 'desc' }, include: planInclude });
  }

  createPlan(tx: Transaction, data: Prisma.RedistributionPlanUncheckedCreateInput) {
    return tx.redistributionPlan.create({ data, include: planInclude });
  }

  updatePlan(tx: Transaction, id: string, data: Prisma.RedistributionPlanUncheckedUpdateInput) {
    return tx.redistributionPlan.update({ where: { id }, data: { ...data, version: { increment: 1 } }, include: planInclude });
  }

  async moveItem(tx: Transaction, planId: string, vehicleId: string, data: Prisma.TransferItemUncheckedUpdateInput) {
    await tx.transferItem.update({ where: { planId_vehicleId: { planId, vehicleId } }, data });
  }

  async readVehicle(tx: Transaction, id: string) {
    return tx.sharedVehicle.findUnique({ where: { id } });
  }

  updateVehicleTelemetry(tx: Transaction, id: string, data: Prisma.SharedVehicleUncheckedUpdateInput) {
    return tx.sharedVehicle.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
  }

  hubNames(tx: Transaction, ids: string[]) {
    return tx.mobilityHub.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  }

  hub(tx: Transaction, id: string) {
    return tx.mobilityHub.findUnique({ where: { id } });
  }

  updateHubTelemetry(tx: Transaction, id: string, observedAt: Date) {
    return tx.mobilityHub.update({ where: { id }, data: { lastObservedAt: observedAt } });
  }
}
