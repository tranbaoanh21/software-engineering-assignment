import { ConflictException, Injectable } from '@nestjs/common';
import type { PendingTripHandoff } from '@semh/contracts';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { runSerializable } from '../../../shared/database/serializable.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import {
  TripJourneyStore, type HandoffInput, type HandoffKind, type HandoffRecord,
  type TripFinish, type TripRecord,
} from '../application/trip-journey.port.js';

const handoffVehicle = { vehicle: { select: { sourceId: true, fault: true, code: true, serviceStatus: true, status: true } } } as const;
const tripSummary = {
  id: true, reservationId: true, status: true,
  vehicle: { select: { id: true, code: true } },
  startHub: { select: { id: true, name: true } },
  endHub: { select: { id: true, name: true } },
  startedAt: true, endedAt: true, startBattery: true, endBattery: true, endVehicleStatus: true, durationSeconds: true,
} satisfies Prisma.TripSelect;

@Injectable()
export class PrismaTripJourneyStore extends TripJourneyStore {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  serializable<T>(work: (tx: Transaction) => Promise<T>) {
    return runSerializable(this.prisma, work);
  }

  byRequest(tx: Transaction, studentId: string, requestId: string) {
    return tx.tripHandoffCommand.findUnique({
      where: { studentId_requestId: { studentId, requestId } },
      include: handoffVehicle,
    });
  }

  pending(tx: Transaction, studentId: string, kind: HandoffKind, subjectId: string, now: Date) {
    return tx.tripHandoffCommand.findFirst({
      where: { studentId, kind, subjectId, status: 'PENDING', expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      include: handoffVehicle,
    });
  }

  createHandoff(tx: Transaction, data: HandoffInput) {
    return tx.tripHandoffCommand.create({ data, include: handoffVehicle });
  }

  handoff(id: string, tx: Transaction = this.prisma) {
    return tx.tripHandoffCommand.findUnique({ where: { id }, include: handoffVehicle });
  }

  async listPending(sourceId: string, now: Date): Promise<PendingTripHandoff[]> {
    const commands = await this.prisma.tripHandoffCommand.findMany({
      where: { status: 'PENDING', expiresAt: { gt: now }, vehicle: { sourceId } },
      select: { id: true, kind: true, vehicleId: true, hubId: true, vehicle: { select: { batteryPercent: true } } },
      orderBy: { createdAt: 'asc' },
      take: 30,
    });
    return commands.map(({ vehicle, ...command }) => ({ ...command, batteryPercent: vehicle.batteryPercent }));
  }

  async recordEvent(tx: Transaction, sourceId: string, eventId: string) {
    const result = await tx.stateEventRecord.createMany({ data: { sourceId, eventId }, skipDuplicates: true });
    return result.count === 1;
  }

  async recordOutcome(tx: Transaction, commandId: string, outcome: { tripId: string } | { reason: string }) {
    await tx.tripHandoffCommand.update({
      where: { id: commandId },
      data: 'tripId' in outcome
        ? { status: 'APPLIED', tripId: outcome.tripId }
        : { status: 'REJECTED', reason: outcome.reason },
    });
  }

  findTrip(studentId: string, tripId: string, tx: Transaction) {
    return tx.trip.findFirst({ where: { id: tripId, studentId }, select: tripSummary });
  }

  listTrips(studentId: string) {
    return this.prisma.trip.findMany({
      where: { studentId },
      select: tripSummary,
      orderBy: [{ status: 'asc' }, { startedAt: 'desc' }],
      take: 30,
    });
  }

  async start(tx: Transaction, command: HandoffRecord, at: Date, battery: number) {
    const vehicle = await tx.sharedVehicle.updateMany({
      where: {
        id: command.vehicleId,
        hubId: command.hubId,
        reservationHoldId: command.subjectId,
        status: 'RESERVED',
        serviceStatus: 'ACTIVE',
      },
      data: { hubId: null, reservationHoldId: null, status: 'IN_USE', batteryPercent: battery, lastObservedAt: at },
    });
    if (!vehicle.count) throw new ConflictException('Xe đã đổi trạng thái. Vui lòng kiểm tra lượt đặt.');
    const trip = await tx.trip.create({
      data: {
        reservationId: command.subjectId, studentId: command.studentId,
        vehicleId: command.vehicleId, status: 'IN_PROGRESS', startHubId: command.hubId,
        startedAt: at, startBattery: battery, startVehicleStatus: 'RESERVED',
      },
      select: { id: true },
    });
    return trip.id;
  }

  async finish(tx: Transaction, trip: TripRecord, end: TripFinish) {
    const tripChange = await tx.trip.updateMany({
      where: { id: trip.id, status: 'IN_PROGRESS' },
      data: {
        status: 'COMPLETED', endHubId: end.hubId, endedAt: end.at, endBattery: end.battery,
        endVehicleStatus: end.vehicleStatus, durationSeconds: Math.floor((end.at.getTime() - trip.startedAt.getTime()) / 1000),
      },
    });
    const vehicle = await tx.sharedVehicle.updateMany({
      where: { id: trip.vehicle.id, status: 'IN_USE', hubId: null },
      data: { hubId: end.hubId, status: end.vehicleStatus, batteryPercent: end.battery, lastObservedAt: end.at },
    });
    if (!tripChange.count || !vehicle.count) throw new ConflictException('Chuyến đi hoặc xe vừa đổi trạng thái.');
  }
}
