import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { runSerializable } from '../../../shared/database/serializable.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import { markLiveChange } from '../../../shared/live/committed-changes.js';
import type { ChargingPointStatus, ChargingRequestStatus, Prisma } from '../../../generated/prisma/client.js';

export const chargeInclude = { session: { include: { point: true } } } as const;
export type StoredCharge = Prisma.ChargingRequestGetPayload<{ include: typeof chargeInclude }>;

@Injectable()
export class PrismaChargingStore {
  constructor(private readonly prisma: PrismaService) {}

  write<T>(work: (tx: Transaction) => Promise<T>) {
    return runSerializable(this.prisma, work);
  }

  read<T>(work: (tx: Transaction) => Promise<T>) {
    return this.prisma.$transaction(work, { isolationLevel: 'RepeatableRead' });
  }

  activeHubs(tx: Transaction) {
    return tx.mobilityHub.findMany({
      where: { serviceStatus: 'ACTIVE', fault: false }, select: { id: true, name: true, chargeKw: true }, orderBy: { name: 'asc' },
    });
  }

  hubsWithQueue() {
    return this.prisma.chargingRequest.findMany({
      where: { status: { in: ['PENDING', 'SCHEDULED'] } }, distinct: ['hubId'], select: { hubId: true },
    });
  }

  point(tx: Transaction, id: string) {
    return tx.chargingPoint.findUnique({ where: { id } });
  }

  hub(tx: Transaction, id: string) {
    return tx.mobilityHub.findUnique({ where: { id }, select: { serviceStatus: true, chargeKw: true, fault: true } });
  }

  availablePoints(tx: Transaction, hubId: string) {
    return tx.chargingPoint.findMany({
      where: { hubId, serviceStatus: 'ACTIVE', fault: false, lastObservedAt: { not: null }, status: { not: 'OUT_OF_SERVICE' } },
      orderBy: { code: 'asc' },
    });
  }

  request(tx: Transaction, id: string) {
    return tx.chargingRequest.findUnique({ where: { id }, include: chargeInclude });
  }

  allRequests(tx: Transaction, where: Prisma.ChargingRequestWhereInput) {
    return tx.chargingRequest.findMany({ where, include: chargeInclude, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] });
  }

  async create(tx: Transaction, data: Prisma.ChargingRequestUncheckedCreateInput) {
    const request = await tx.chargingRequest.create({ data, include: chargeInclude });
    markLiveChange(tx, 'charging', request.hubId);
    return request;
  }

  async update(tx: Transaction, id: string, data: Prisma.ChargingRequestUncheckedUpdateInput) {
    const request = await tx.chargingRequest.update({ where: { id }, data: { ...data, version: { increment: 1 } }, include: chargeInclude });
    markLiveChange(tx, 'charging', request.hubId);
    return request;
  }

  async setAllocation(tx: Transaction, id: string, data: {
    pointId: string; startAt: Date; endAt: Date; powerKw: number; batteryPercent: number;
  }) {
    const { request } = await tx.chargingSession.upsert({
      where: { requestId: id }, create: { ...data, requestId: id }, update: data,
      select: { request: { select: { hubId: true } } },
    });
    markLiveChange(tx, 'charging', request.hubId);
  }

  async removeAllocation(tx: Transaction, requestId: string) {
    await tx.chargingSession.deleteMany({ where: { requestId, status: 'READY' } });
  }

  session(tx: Transaction, id: string) {
    return tx.chargingSession.findUnique({ where: { id }, include: { request: true } });
  }

  physicalSessions(tx: Transaction, hubId: string) {
    return tx.chargingSession.findMany({
      where: { point: { hubId }, startedAt: { not: null }, releasedAt: null },
    });
  }

  async setSession(tx: Transaction, id: string, data: Prisma.ChargingSessionUpdateInput) {
    const result = await tx.chargingSession.update({ where: { id }, data, include: { request: { select: { hubId: true } } } });
    const { request, ...session } = result;
    markLiveChange(tx, 'charging', request.hubId);
    return session;
  }

  async setPoint(tx: Transaction, id: string, data: { status?: ChargingPointStatus; fault?: boolean; lastObservedAt?: Date }) {
    const point = await tx.chargingPoint.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
    if (data.status !== undefined || data.fault !== undefined) markLiveChange(tx, 'charging', point.hubId);
    return point;
  }

  async updateStatus(tx: Transaction, id: string, status: ChargingRequestStatus) {
    await this.update(tx, id, { status, reason: null });
  }

  async recordEvent(tx: Transaction, sourceId: string, eventId: string) {
    const event = await tx.stateEventRecord.createMany({ data: { sourceId, eventId }, skipDuplicates: true });
    return event.count > 0;
  }

  pendingSteps(sourceId: string, now: Date) {
    return this.prisma.chargingSession.findMany({
      where: {
        point: { sourceId }, releasedAt: null,
        OR: [
          { status: 'READY', startAt: { lte: now }, point: { serviceStatus: 'ACTIVE', fault: false, status: 'AVAILABLE' } },
          { status: { in: ['CHARGING', 'COMPLETED', 'INTERRUPTED'] }, startedAt: { not: null } },
        ],
      },
      orderBy: { startAt: 'asc' }, take: 60, include: { point: true },
    });
  }
}
