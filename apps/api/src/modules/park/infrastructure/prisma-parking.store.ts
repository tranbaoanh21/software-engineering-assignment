import { Injectable } from '@nestjs/common';
import type { PendingParkingVerification } from '@semh/contracts';
import type { ParkingReservationStatus, ParkingSpaceStatus, Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../shared/database/prisma.service.js';
import { runSerializable } from '../../../shared/database/serializable.js';
import { markLiveChange } from '../../../shared/live/committed-changes.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import {
  ParkingStore, type NewParkingReservation, type ParkingReading, type PrivateVehicleReading, type RegisteredPrivateVehicle,
} from '../application/parking-store.port.js';

const hubName = { hub: { select: { id: true, name: true } } } as const;
const vehicleSummary = { id: true, plate: true } as const;
const reservationDetails = {
  privateVehicle: { select: vehicleSummary },
  space: { include: hubName },
  verifications: { orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.ParkingReservationInclude;
const activeStatuses: ParkingReservationStatus[] = ['CONFIRMED', 'CHECKED_IN'];
const availableSpace = {
  serviceStatus: 'ACTIVE', status: 'AVAILABLE', occupied: false, fault: false, lastObservedAt: { not: null },
} satisfies Prisma.ParkingSpaceWhereInput;

@Injectable()
export class PrismaParkingStore extends ParkingStore {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  serializable<T>(work: (tx: Transaction) => Promise<T>) {
    return runSerializable(this.prisma, work);
  }

  listVehicles(studentId: string) {
    return this.prisma.privateVehicle.findMany({
      where: { ownerId: studentId }, select: vehicleSummary, orderBy: { plate: 'asc' },
    });
  }

  findVehiclesByPlate(tx: Transaction, plate: string) {
    return tx.$queryRaw<RegisteredPrivateVehicle[]>`
      SELECT "id", "plate", "ownerId", "batteryPercent", "lastObservedAt"
      FROM "PrivateVehicle"
      WHERE regexp_replace(upper("plate"), '[[:space:].-]', '', 'g') = ${plate}
      LIMIT 2
    `;
  }

  createVehicle(tx: Transaction, data: Omit<RegisteredPrivateVehicle, 'id'>) {
    return tx.privateVehicle.create({ data, select: vehicleSummary });
  }

  setInitialVehicleReading(tx: Transaction, id: string, reading: PrivateVehicleReading) {
    return tx.privateVehicle.update({ where: { id }, data: reading, select: vehicleSummary });
  }

  async availableSpacesByHub() {
    const groups = await this.prisma.parkingSpace.groupBy({
      by: ['hubId'], where: availableSpace, _count: { _all: true },
    });
    return groups.map(group => ({ hubId: group.hubId, count: group._count._all }));
  }

  async listReservations(studentId: string) {
    const where = { studentId };
    const [active, recent] = await this.prisma.$transaction([
      this.prisma.parkingReservation.findMany({
        where: { ...where, status: { in: activeStatuses } },
        include: reservationDetails,
        orderBy: { confirmedAt: 'desc' },
      }),
      this.prisma.parkingReservation.findMany({
        where: { ...where, status: { notIn: activeStatuses } },
        include: reservationDetails,
        orderBy: { confirmedAt: 'desc' },
        take: 15,
      }),
    ], { isolationLevel: 'RepeatableRead' });
    return [...active, ...recent];
  }

  findOwnedVehicle(tx: Transaction, studentId: string, vehicleId: string) {
    return tx.privateVehicle.findFirst({ where: { id: vehicleId, ownerId: studentId }, select: vehicleSummary });
  }

  findByRequest(tx: Transaction, studentId: string, requestId: string) {
    return tx.parkingReservation.findUnique({
      where: { studentId_requestId: { studentId, requestId } }, include: reservationDetails,
    });
  }

  findReservation(tx: Transaction, id: string) {
    return tx.parkingReservation.findUnique({ where: { id }, include: reservationDetails });
  }

  findAvailableSpace(tx: Transaction, hubId: string) {
    return tx.parkingSpace.findFirst({
      where: { ...availableSpace, hubId, reservations: { none: { status: { in: activeStatuses } } } },
      orderBy: { code: 'asc' },
      include: hubName,
    });
  }

  findSpace(tx: Transaction, spaceId: string) {
    return tx.parkingSpace.findUnique({ where: { id: spaceId }, include: hubName });
  }

  activeForVehicle(tx: Transaction, vehicleId: string) {
    return tx.parkingReservation.findFirst({
      where: { privateVehicleId: vehicleId, status: { in: activeStatuses } }, include: reservationDetails,
    });
  }

  activeForSpace(tx: Transaction, spaceId: string) {
    return tx.parkingReservation.findFirst({
      where: { spaceId, status: { in: activeStatuses } }, include: reservationDetails,
    });
  }

  async findDue(now: Date, options?: { tx: Transaction; hubId: string }) {
    const rows = await (options?.tx ?? this.prisma).parkingReservation.findMany({
      where: { status: 'CONFIRMED', expiresAt: { lte: now }, space: options ? { hubId: options.hubId } : undefined },
      select: { id: true },
      orderBy: { expiresAt: 'asc' },
      take: 60,
    });
    return rows.map(row => row.id);
  }

  createReservation(tx: Transaction, data: NewParkingReservation) {
    return tx.parkingReservation.create({
      data: { ...data, status: 'CONFIRMED' }, include: reservationDetails,
    });
  }

  updateReservation(tx: Transaction, { id, ...data }: Parameters<ParkingStore['updateReservation']>[1]) {
    return tx.parkingReservation.update({ where: { id }, data, include: reservationDetails });
  }

  async updateSpace(tx: Transaction, id: string, status: ParkingSpaceStatus, reading?: ParkingReading) {
    const { hubId } = await tx.parkingSpace.update({ where: { id }, data: { ...reading, status }, select: { hubId: true } });
    markLiveChange(tx, 'parking', hubId);
  }

  findVerification(tx: Transaction, id: string) {
    return tx.parkingVerification.findUnique({ where: { id } });
  }

  findVerificationByRequest(tx: Transaction, reservationId: string, requestId: string) {
    return tx.parkingVerification.findUnique({ where: { reservationId_requestId: { reservationId, requestId } } });
  }

  async createVerification(tx: Transaction, data: Parameters<ParkingStore['createVerification']>[1]) {
    const result = await tx.parkingVerification.create({
      data, include: { reservation: { select: { space: { select: { hubId: true } } } } },
    });
    const { reservation, ...verification } = result;
    markLiveChange(tx, 'parking', reservation.space.hubId);
    return verification;
  }

  async settleVerification(tx: Transaction, id: string, reason?: string) {
    const result = await tx.parkingVerification.update({
      where: { id }, data: reason ? { status: 'REJECTED', reason } : { status: 'APPLIED' },
      include: { reservation: { select: { space: { select: { hubId: true } } } } },
    });
    const { reservation, ...verification } = result;
    markLiveChange(tx, 'parking', reservation.space.hubId);
    return verification;
  }

  async listPending(sourceId: string, now: Date): Promise<PendingParkingVerification[]> {
    const rows = await this.prisma.parkingVerification.findMany({
      where: {
        status: 'PENDING', expiresAt: { gt: now },
        reservation: { space: { sourceId } },
        OR: [
          { kind: 'CHECK_IN', reservation: { status: 'CONFIRMED', expiresAt: { gt: now } } },
          { kind: 'CHECK_OUT', reservation: { status: 'CHECKED_IN' } },
        ],
      },
      select: { id: true, kind: true, reservation: { select: { spaceId: true, privateVehicleId: true } } },
      orderBy: { createdAt: 'asc' },
      take: 30,
    });
    return rows.map(({ reservation, ...command }) => ({ ...command, ...reservation }));
  }

  async recordEvent(tx: Transaction, sourceId: string, eventId: string) {
    const result = await tx.stateEventRecord.createMany({ data: { sourceId, eventId }, skipDuplicates: true });
    return result.count === 1;
  }
}
