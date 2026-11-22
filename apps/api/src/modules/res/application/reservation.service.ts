import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateReservationInput, ReservationView } from '@semh/contracts';
import { AccessService } from '../../gen/application/access.service.js';
import { TripService } from '../../trip/application/trip.service.js';
import { AuditService } from '../../../shared/audit/audit.service.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import { reservationExpiry, vehicleBookingIssue } from '../domain/reservation.policy.js';
import { ReservationStore, type ExpiringReservation, type ReservationRecord } from './reservation-store.port.js';

function reservationView(record: ReservationRecord): ReservationView {
  return {
    ...record,
    confirmedAt: record.confirmedAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    serverTime: new Date().toISOString(),
  };
}

@Injectable()
export class ReservationService {
  constructor(
    private readonly store: ReservationStore,
    private readonly access: AccessService,
    private readonly trips: TripService,
    private readonly audit: AuditService,
  ) {}

  async createReservation(token: string, input: CreateReservationInput): Promise<ReservationView> {
    const reservation = await this.store.runSerializable(async tx => {
      const { accountId } = await this.access.verifyAccess(token, ['STU'], tx);
      const now = new Date();
      const previous = await this.store.findByRequest(accountId, input.requestId, tx);
      if (previous) {
        if (previous.vehicle.id !== input.vehicleId || previous.hub.id !== input.hubId) {
          throw new ConflictException({
            code: 'REQUEST_ID_REUSED',
            message: 'Mã yêu cầu đã được dùng cho một xe hoặc Hub khác.',
          });
        }
        if (previous.status === 'CONFIRMED' && previous.expiresAt <= now) {
          await this.expireInTx(tx, { id: previous.id, vehicleId: previous.vehicle.id }, now);
          return (await this.store.findByRequest(accountId, input.requestId, tx)) ?? previous;
        }
        return previous;
      }

      for (const due of await this.store.findDue(tx, now, accountId, input.vehicleId)) {
        await this.expireInTx(tx, due, now);
      }

      const active = await this.store.findActive(accountId, now, tx);
      if (active) {
        throw new ConflictException({
          code: 'ACTIVE_RESERVATION_EXISTS',
          message: 'Bạn đã có một lượt đặt đang hiệu lực.',
          reservation: reservationView(active),
        });
      }

      const vehicle = await this.trips.readReservationVehicleInTx(tx, input.vehicleId);
      if (!vehicle) throw new NotFoundException({ code: 'VEHICLE_NOT_FOUND', message: 'Không tìm thấy xe này.' });
      const issue = vehicleBookingIssue(vehicle, input.hubId);
      if (issue) throw new ConflictException({ code: 'VEHICLE_NOT_BOOKABLE', message: issue });

      const result = await this.store.createConfirmed(tx, accountId, input, now, reservationExpiry(now));
      const held = await this.trips.reserveVehicleInTx(tx, result.id, input.vehicleId, input.hubId);
      if (!held) {
        throw new ConflictException({ code: 'RESERVATION_CONFLICT', message: 'Xe vừa được giữ. Vui lòng chọn xe khác.' });
      }

      await this.audit.append(tx, {
        actorId: accountId,
        action: 'RESERVATION_CONFIRMED',
        targetType: 'vehicle-reservation',
        targetId: result.id,
        requestId: input.requestId,
        occurredAt: now,
        details: {
          vehicleId: input.vehicleId, hubId: input.hubId,
          vehicleStatusBefore: 'AVAILABLE', vehicleStatusAfter: 'RESERVED',
          reservationStatus: 'CONFIRMED',
        },
      });
      return result;
    });
    return reservationView(reservation);
  }

  async cancelReservation(token: string, reservationId: string): Promise<ReservationView> {
    return this.store.runSerializable(async tx => {
      const { accountId } = await this.access.verifyAccess(token, ['STU'], tx);
      const record = await this.readOwned(accountId, reservationId, tx);
      if (record.status === 'CANCELLED' || record.status === 'EXPIRED') return reservationView(record);

      const now = new Date();
      if (record.status === 'CONFIRMED' && record.expiresAt <= now) {
        await this.expireInTx(tx, { id: record.id, vehicleId: record.vehicle.id }, now);
      } else {
        if (record.status !== 'CONFIRMED' && record.status !== 'PENDING') {
          throw new ConflictException('Lượt đặt không còn ở trạng thái có thể hủy.');
        }
        if (!await this.store.changeStatus(tx, record.id, record.status, 'CANCELLED', now)) {
          throw new ConflictException('Lượt đặt vừa thay đổi. Vui lòng mở lại.');
        }
        await this.trips.releaseVehicleInTx(tx, record.id, record.vehicle.id);
        await this.audit.append(tx, {
          actorId: accountId, action: 'RESERVATION_CANCELLED', targetType: 'vehicle-reservation',
          targetId: record.id, occurredAt: now,
          details: { vehicleId: record.vehicle.id, statusBefore: record.status, statusAfter: 'CANCELLED' },
        });
      }

      return reservationView(await this.readOwned(accountId, reservationId, tx));
    });
  }

  async getReservation(studentId: string, reservationId: string) {
    return reservationView(await this.readOwned(studentId, reservationId));
  }

  async readOwned(studentId: string, reservationId: string, tx?: Transaction) {
    const record = await this.store.findOwned(studentId, reservationId, tx);
    if (!record) throw new NotFoundException('Không tìm thấy lượt đặt.');
    return record;
  }

  async fulfillReservation(
    tx: Transaction, reservationId: string, studentId: string, vehicleId: string, hubId: string, at: Date,
  ) {
    const record = await this.readOwned(studentId, reservationId, tx);
    if (
      record.status !== 'CONFIRMED' || record.expiresAt <= at ||
      record.vehicle.id !== vehicleId || record.hub.id !== hubId ||
      !await this.store.changeStatus(tx, reservationId, 'CONFIRMED', 'FULFILLED', at)
    ) {
      throw new ConflictException('Lượt đặt đã hết hiệu lực hoặc không khớp xe và Hub.');
    }
  }

  async getActiveReservation(studentId: string) {
    const record = await this.store.findActive(studentId, new Date());
    return record ? reservationView(record) : null;
  }

  async getChangeResult(studentId: string, requestId: string) {
    const record = await this.store.findByRequest(studentId, requestId);
    if (!record) throw new NotFoundException('Chưa tìm thấy kết quả của yêu cầu này.');
    return reservationView(record);
  }

  async expireDueReservations() {
    const now = new Date();
    for (const due of await this.store.findDueBatch(now)) {
      await this.store.runSerializable(tx => this.expireInTx(tx, due, now));
    }
  }

  private async expireInTx(tx: Transaction, reservation: ExpiringReservation, now: Date) {
    if (!await this.store.expire(tx, reservation.id, now)) return;
    await this.trips.releaseVehicleInTx(tx, reservation.id, reservation.vehicleId);
    await this.audit.append(tx, {
      action: 'RESERVATION_EXPIRED',
      targetType: 'vehicle-reservation',
      targetId: reservation.id,
      occurredAt: now,
      details: { vehicleId: reservation.vehicleId, statusBefore: 'CONFIRMED', statusAfter: 'EXPIRED' },
    });
  }
}
