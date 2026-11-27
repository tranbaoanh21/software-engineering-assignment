import { Injectable } from '@nestjs/common';
import type { CreateReservationInput, VehicleReservationStatus } from '@semh/contracts';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import { runSerializable } from '../../../shared/database/serializable.js';
import { markLiveChange } from '../../../shared/live/committed-changes.js';
import { ReservationStore } from '../application/reservation-store.port.js';

const summary = {
  id: true,
  status: true,
  vehicle: { select: { id: true, code: true } },
  hub: { select: { id: true, name: true } },
  confirmedAt: true,
  expiresAt: true,
  version: true,
} satisfies Prisma.VehicleReservationSelect;

@Injectable()
export class PrismaReservationStore extends ReservationStore {
  private writes: Promise<void> = Promise.resolve();
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  runSerializable<T>(work: (tx: Transaction) => Promise<T>) {
    // Schedule booking writes in this process; the database still serializes across module boundaries.
    const operation = this.writes.then(() => runSerializable(this.prisma, work));
    this.writes = operation.then(() => undefined, () => undefined);
    return operation;
  }

  findOwned(studentId: string, reservationId: string, tx: Transaction = this.prisma) {
    return tx.vehicleReservation.findFirst({ where: { id: reservationId, studentId }, select: summary });
  }

  async changeStatus(
    tx: Transaction, reservationId: string, expected: VehicleReservationStatus,
    status: VehicleReservationStatus, now: Date,
  ) {
    const [changed] = await tx.vehicleReservation.updateManyAndReturn({
      where: { id: reservationId, status: expected },
      data: { status, endedAt: now, version: { increment: 1 } },
      select: { hubId: true },
    });
    if (changed) markLiveChange(tx, 'vehicle', changed.hubId);
    return !!changed;
  }

  findByRequest(studentId: string, requestId: string, tx: Transaction = this.prisma) {
    return tx.vehicleReservation.findUnique({
      where: { studentId_requestId: { studentId, requestId } },
      select: summary,
    });
  }

  findActive(studentId: string, now: Date, tx: Transaction = this.prisma) {
    return tx.vehicleReservation.findFirst({
      where: { studentId, status: { in: ['PENDING', 'CONFIRMED'] }, expiresAt: { gt: now } },
      select: summary,
    });
  }

  findDue(tx: Transaction, now: Date, studentId: string, vehicleId: string) {
    return tx.vehicleReservation.findMany({
      where: {
        status: 'CONFIRMED', expiresAt: { lte: now }, OR: [{ studentId }, { vehicleId }],
      },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      select: { id: true, vehicleId: true },
    });
  }

  findDueBatch(now: Date) {
    return this.prisma.vehicleReservation.findMany({
      where: { status: 'CONFIRMED', expiresAt: { lte: now } },
      orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      take: 100,
      select: { id: true, vehicleId: true },
    });
  }

  async createConfirmed(
    tx: Transaction, studentId: string, input: CreateReservationInput, confirmedAt: Date, expiresAt: Date,
  ) {
    const reservation = await tx.vehicleReservation.create({
      data: { ...input, studentId, status: 'CONFIRMED', confirmedAt, expiresAt },
      select: summary,
    });
    markLiveChange(tx, 'vehicle', input.hubId);
    return reservation;
  }

  async expire(tx: Transaction, reservationId: string, now: Date) {
    const [changed] = await tx.vehicleReservation.updateManyAndReturn({
      where: { id: reservationId, status: 'CONFIRMED', expiresAt: { lte: now } },
      data: { status: 'EXPIRED', endedAt: now, version: { increment: 1 } },
      select: { hubId: true },
    });
    if (changed) markLiveChange(tx, 'vehicle', changed.hubId);
    return !!changed;
  }
}
