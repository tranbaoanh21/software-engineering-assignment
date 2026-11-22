import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PickupInput, ReturnTripInput, StateEventReceipt, TripHandoffView, TripView, VehicleHandoffEvent } from '@semh/contracts';
import { AccessService } from '../../gen/application/access.service.js';
import { HubService } from '../../hub/application/hub.service.js';
import { ReservationService } from '../../res/application/reservation.service.js';
import { AuditService } from '../../../shared/audit/audit.service.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import { returnedVehicleStatus } from '../domain/trip.policy.js';
import { TripService } from './trip.service.js';
import { TripJourneyStore, type HandoffRecord, type TripRecord } from './trip-journey.port.js';

const handoffTimeoutMs = 90_000;

function view(command: HandoffRecord): TripHandoffView {
  const expired = command.status === 'PENDING' && command.expiresAt.getTime() <= Date.now();
  return {
    id: command.id, status: expired ? 'EXPIRED' : command.status,
    expiresAt: command.expiresAt.toISOString(), reason: command.reason,
  };
}

function tripView(trip: TripRecord): TripView {
  return { ...trip, startedAt: trip.startedAt.toISOString(), endedAt: trip.endedAt?.toISOString() ?? null };
}

@Injectable()
export class TripJourneyService {
  constructor(
    private readonly store: TripJourneyStore,
    private readonly access: AccessService,
    private readonly reservations: ReservationService,
    private readonly fleet: TripService,
    private readonly hubs: HubService,
    private readonly audit: AuditService,
  ) {}

  async requestPickup(token: string, input: PickupInput) {
    const result = await this.store.serializable(async tx => {
      const { accountId } = await this.access.verifyAccess(token, ['STU'], tx);
      const now = new Date();
      const previous = await this.store.byRequest(tx, accountId, input.requestId);
      if (previous) {
        if (previous.kind !== 'PICKUP' || previous.subjectId !== input.reservationId || previous.vehicle.code.toUpperCase() !== input.vehicleCode) {
          throw new ConflictException('Mã yêu cầu đã được dùng cho thao tác khác.');
        }
        return previous;
      }

      const reservation = await this.reservations.readOwned(accountId, input.reservationId, tx);
      if (reservation.status !== 'CONFIRMED' || reservation.expiresAt <= now) {
        throw new ConflictException('Lượt đặt không còn hiệu lực để nhận xe.');
      }
      if (reservation.vehicle.code.toUpperCase() !== input.vehicleCode) throw new ConflictException('Mã xe không khớp với lượt đặt.');
      const vehicle = await this.fleet.readReservationVehicleInTx(tx, reservation.vehicle.id);
      if (!vehicle || vehicle.status !== 'RESERVED' || vehicle.reservationHoldId !== reservation.id ||
          vehicle.hubId !== reservation.hub.id || vehicle.serviceStatus !== 'ACTIVE' || vehicle.hub?.serviceStatus !== 'ACTIVE' || vehicle.hub.fault) {
        throw new ConflictException('Xe chưa sẵn sàng bàn giao tại Hub đã đặt.');
      }

      return await this.store.pending(tx, accountId, 'PICKUP', reservation.id, now) ??
        this.store.createHandoff(tx, {
          requestId: input.requestId, kind: 'PICKUP', studentId: accountId,
          subjectId: reservation.id, hubId: reservation.hub.id, vehicleId: reservation.vehicle.id,
          createdAt: now,
          expiresAt: new Date(Math.min(now.getTime() + handoffTimeoutMs, reservation.expiresAt.getTime())),
        });
    });
    return view(result);
  }

  async requestReturn(token: string, tripId: string, input: ReturnTripInput) {
    const result = await this.store.serializable(async tx => {
      const { accountId } = await this.access.verifyAccess(token, ['STU'], tx);
      const now = new Date();
      const previous = await this.store.byRequest(tx, accountId, input.requestId);
      if (previous) {
        if (previous.kind !== 'RETURN' || previous.subjectId !== tripId || previous.hubId !== input.hubId) {
          throw new ConflictException('Mã yêu cầu đã được dùng cho thao tác khác.');
        }
        return previous;
      }

      const trip = await this.store.findTrip(accountId, tripId, tx);
      if (!trip) throw new NotFoundException('Không tìm thấy chuyến đi.');
      if (trip.status !== 'IN_PROGRESS') throw new ConflictException('Chuyến đi đã kết thúc.');
      const hub = await this.hubs.readArrivalCapacityInTx(tx, input.hubId);
      if (!hub?.active || hub.spaces === 0) throw new ConflictException('Hub đã chọn hiện không thể nhận thêm xe.');

      const pending = await this.store.pending(tx, accountId, 'RETURN', trip.id, now);
      if (pending && pending.hubId !== input.hubId) throw new ConflictException('Chuyến đi đang chờ xác nhận trả tại Hub khác.');
      return pending ?? this.store.createHandoff(tx, {
        requestId: input.requestId, kind: 'RETURN', studentId: accountId,
        subjectId: trip.id, hubId: input.hubId, vehicleId: trip.vehicle.id,
        createdAt: now, expiresAt: new Date(now.getTime() + handoffTimeoutMs),
      });
    });
    return view(result);
  }

  async getHandoff(studentId: string, commandId: string) {
    const command = await this.store.handoff(commandId);
    if (!command || command.studentId !== studentId) throw new NotFoundException('Không tìm thấy yêu cầu bàn giao.');
    return view(command);
  }

  async listTrips(studentId: string) {
    return (await this.store.listTrips(studentId)).map(tripView);
  }

  pendingHandoffs(sourceId: string) {
    return this.store.listPending(sourceId, new Date());
  }

  applyHandoff(event: VehicleHandoffEvent, onFault?: (tx: Transaction) => Promise<unknown>): Promise<StateEventReceipt> {
    return this.store.serializable(async tx => {
      const command = await this.store.handoff(event.commandId, tx);
      if (!command || command.vehicle.sourceId !== event.sourceId) throw new NotFoundException('Không tìm thấy lệnh của nguồn này.');
      if (command.vehicleId !== event.vehicleId || command.hubId !== event.hubId) {
        throw new ConflictException('Xe hoặc Hub trong bản tin không khớp lệnh bàn giao.');
      }
      if (command.status !== 'PENDING') return { result: 'duplicate' };

      const now = new Date();
      const observedAt = new Date(event.observedAt);
      if (command.expiresAt <= now || observedAt < command.createdAt || observedAt.getTime() > now.getTime() + 5000) {
        return { result: 'stale' };
      }
      if (!await this.store.recordEvent(tx, event.sourceId, event.eventId)) return { result: 'duplicate' };

      if (!event.confirmed || (command.kind === 'PICKUP' && event.fault)) {
        if (event.fault && onFault) await onFault(tx);
        return this.reject(tx, command.id, 'Thiết bị chưa xác nhận bàn giao an toàn.');
      }

      const result = await (command.kind === 'PICKUP'
        ? this.confirmPickup(tx, command, event, now)
        : this.confirmReturn(tx, command, event, now));
      if (event.fault && onFault) await onFault(tx);
      return result;
    });
  }

  private async confirmPickup(tx: Transaction, command: HandoffRecord, event: VehicleHandoffEvent, now: Date): Promise<StateEventReceipt> {
    const reservation = await this.reservations.readOwned(command.studentId, command.subjectId, tx);
    const vehicle = await this.fleet.readReservationVehicleInTx(tx, command.vehicleId);
    if (
      reservation.status !== 'CONFIRMED' || reservation.expiresAt <= now ||
      !vehicle || vehicle.reservationHoldId !== reservation.id || vehicle.status !== 'RESERVED' ||
      vehicle.hubId !== command.hubId || vehicle.hub?.serviceStatus !== 'ACTIVE' || vehicle.hub.fault || vehicle.serviceStatus !== 'ACTIVE'
    ) {
      return this.reject(tx, command.id, 'Lượt đặt đã hết hiệu lực hoặc xe chưa sẵn sàng nhận.');
    }
    await this.reservations.fulfillReservation(tx, reservation.id, command.studentId, command.vehicleId, command.hubId, now);
    const tripId = await this.store.start(tx, command, now, event.batteryPercent);
    await this.store.recordOutcome(tx, command.id, { tripId });
    await this.audit.append(tx, {
      actorId: command.studentId, action: 'TRIP_STARTED', targetType: 'trip', targetId: tripId,
      occurredAt: now,
      details: {
        reservationId: reservation.id, vehicleId: command.vehicleId, hubId: command.hubId,
        eventId: event.eventId, reservationBefore: 'CONFIRMED', reservationAfter: 'FULFILLED',
        vehicleBefore: 'RESERVED', vehicleAfter: 'IN_USE',
      },
    });
    return { result: 'applied' };
  }

  private async confirmReturn(tx: Transaction, command: HandoffRecord, event: VehicleHandoffEvent, now: Date): Promise<StateEventReceipt> {
    const trip = await this.store.findTrip(command.studentId, command.subjectId, tx);
    const hub = await this.hubs.readArrivalCapacityInTx(tx, command.hubId);
    if (!trip || trip.status !== 'IN_PROGRESS' || command.vehicle.status !== 'IN_USE') {
      return this.reject(tx, command.id, 'Chuyến đi hoặc xe đã đổi trạng thái.');
    }
    if (!hub?.active || hub.spaces === 0) {
      return this.reject(tx, command.id, 'Hub hiện không còn chỗ tiếp nhận. Vui lòng chọn Hub khác.');
    }

    const vehicleStatus = returnedVehicleStatus(event.batteryPercent, event.fault || command.vehicle.fault || command.vehicle.serviceStatus !== 'ACTIVE');
    await this.store.finish(tx, trip, { hubId: command.hubId, at: now, battery: event.batteryPercent, vehicleStatus });
    await this.store.recordOutcome(tx, command.id, { tripId: trip.id });
    await this.audit.append(tx, {
      actorId: command.studentId, action: 'TRIP_COMPLETED', targetType: 'trip', targetId: trip.id,
      occurredAt: now,
      details: { vehicleId: command.vehicleId, hubId: command.hubId, eventId: event.eventId, vehicleStatus },
    });
    return { result: 'applied' };
  }

  private async reject(tx: Transaction, id: string, reason: string): Promise<StateEventReceipt> {
    await this.store.recordOutcome(tx, id, { reason });
    return { result: 'rejected' };
  }
}
