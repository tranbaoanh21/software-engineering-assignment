import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateParkingReservationInput, ParkingOverview, ParkingReservationView, ParkingStateEvent,
  ParkingVerificationKind, RegisterPrivateVehicleInput, StateEventReceipt,
} from '@semh/contracts';
import { AuditService } from '../../../shared/audit/audit.service.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import { AccessService } from '../../gen/application/access.service.js';
import { HubService } from '../../hub/application/hub.service.js';
import { parkingExpiry, parkingSpaceStatus, parkingVerificationTimeoutMs, requiredStatus } from '../domain/parking.policy.js';
import { ParkingStore, type ParkingReading, type ParkingReservationRecord, type ParkingVerificationRecord } from './parking-store.port.js';

function reservationView(record: ParkingReservationRecord, latest = record.verifications[0]): ParkingReservationView {
  const now = Date.now();
  const status = record.status === 'CONFIRMED' && record.expiresAt.getTime() <= now ? 'EXPIRED' : record.status;
  return {
    id: record.id,
    status,
    vehicle: record.privateVehicle,
    space: { id: record.space.id, code: record.space.code },
    hub: record.space.hub,
    confirmedAt: record.confirmedAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    checkInAt: record.checkInAt?.toISOString() ?? null,
    checkOutAt: record.checkOutAt?.toISOString() ?? null,
    verification: latest ? {
      kind: latest.kind,
      status: latest.status === 'PENDING' && (latest.expiresAt.getTime() <= now || status !== requiredStatus(latest.kind))
        ? 'EXPIRED'
        : latest.status,
      reason: latest.reason,
    } : null,
  };
}

@Injectable()
export class ParkingService {
  constructor(
    private readonly store: ParkingStore,
    private readonly access: AccessService,
    private readonly hubs: HubService,
    private readonly audit: AuditService,
  ) {}

  async overview(studentId: string): Promise<ParkingOverview> {
    const [vehicles, hubs, spaces, reservations] = await Promise.all([
      this.store.listVehicles(studentId), this.hubs.list(), this.store.availableSpacesByHub(),
      this.store.listReservations(studentId),
    ]);
    const counts = new Map(spaces.map(({ hubId, count }) => [hubId, count]));
    return {
      vehicles,
      hubs: hubs.map(({ id, name }) => ({ id, name, availableSpaces: counts.get(id) ?? 0 })),
      reservations: reservations.map(record => reservationView(record)),
    };
  }

  registerVehicle(token: string, { plate, batteryPercent }: RegisterPrivateVehicleInput) {
    return this.store.serializable(async tx => {
      const { accountId } = await this.access.verifyAccess(token, ['STU'], tx);
      const matches = await this.store.findVehiclesByPlate(tx, plate);
      const [existing] = matches;
      if (matches.length > 1 || (existing && existing.ownerId !== accountId)) {
        throw new ConflictException('Biển số này đã được đăng ký.');
      }
      if (existing && (batteryPercent === null || (existing.lastObservedAt && existing.batteryPercent !== null))) {
        return { id: existing.id, plate: existing.plate };
      }

      const occurredAt = new Date();
      const reading = { batteryPercent, lastObservedAt: batteryPercent === null ? null : occurredAt };
      const vehicle = existing
        ? await this.store.setInitialVehicleReading(tx, existing.id, reading)
        : await this.store.createVehicle(tx, { ownerId: accountId, plate, ...reading });
      await this.audit.append(tx, {
        actorId: accountId, action: existing ? 'PRIVATE_VEHICLE_BATTERY_INITIALIZED' : 'PRIVATE_VEHICLE_REGISTERED',
        targetType: 'private-vehicle', targetId: vehicle.id, occurredAt, details: { batteryPercent },
      });
      return vehicle;
    });
  }

  createReservation(token: string, input: CreateParkingReservationInput) {
    return this.store.serializable(async tx => {
      const { accountId } = await this.access.verifyAccess(token, ['STU'], tx);
      const now = new Date();
      const previous = await this.store.findByRequest(tx, accountId, input.requestId);
      if (previous) {
        if (previous.space.hubId !== input.hubId || previous.privateVehicle.id !== input.privateVehicleId) {
          throw new ConflictException('Mã yêu cầu đã được dùng cho xe hoặc Hub khác.');
        }
        return reservationView(previous);
      }

      const vehicle = await this.store.findOwnedVehicle(tx, accountId, input.privateVehicleId);
      if (!vehicle) throw new NotFoundException('Không tìm thấy xe cá nhân của bạn.');
      if (!await this.hubs.isHubActiveInTx(tx, input.hubId)) {
        throw new ConflictException('Hub đã chọn hiện không phục vụ.');
      }

      const active = await this.store.activeForVehicle(tx, vehicle.id);
      if (active && (!await this.expireInTx(tx, active, now))) {
        throw new ConflictException('Xe cá nhân này đang có lượt đặt chỗ đỗ.');
      }
      for (const id of await this.store.findDue(now, { tx, hubId: input.hubId })) {
        const due = await this.store.findReservation(tx, id);
        if (due) await this.expireInTx(tx, due, now);
      }

      const space = await this.store.findAvailableSpace(tx, input.hubId);
      if (!space) throw new ConflictException('Hub này không còn chỗ có thể đặt. Vui lòng chọn Hub khác.');
      const record = await this.store.createReservation(tx, {
        studentId: accountId, requestId: input.requestId, privateVehicleId: vehicle.id,
        spaceId: space.id, confirmedAt: now, expiresAt: parkingExpiry(now),
      });
      await this.store.updateSpace(tx, space.id, 'RESERVED');
      await this.audit.append(tx, {
        actorId: accountId, action: 'PARKING_RESERVED', targetType: 'parking-reservation',
        targetId: record.id, requestId: input.requestId, occurredAt: now,
        details: { spaceId: space.id, vehicleId: vehicle.id, hubId: space.hubId },
      });
      return reservationView(record);
    });
  }

  cancelReservation(token: string, id: string) {
    return this.store.serializable(async tx => {
      const { accountId } = await this.access.verifyAccess(token, ['STU'], tx);
      const record = await this.readOwned(tx, accountId, id);
      if (record.status === 'CANCELLED' || record.status === 'EXPIRED') return reservationView(record);
      if (record.status !== 'CONFIRMED') throw new ConflictException('Chỉ có thể hủy trước khi check-in.');
      const now = new Date();
      if (await this.expireInTx(tx, record, now)) return reservationView({ ...record, status: 'EXPIRED' });
      return reservationView(await this.release(tx, record, 'CANCELLED', now, accountId));
    });
  }

  requestVerification(token: string, id: string, kind: ParkingVerificationKind, requestId: string) {
    return this.store.serializable(async tx => {
      const { accountId } = await this.access.verifyAccess(token, ['STU'], tx);
      const record = await this.readOwned(tx, accountId, id);
      const previous = await this.store.findVerificationByRequest(tx, id, requestId);
      if (previous) {
        if (previous.kind !== kind) throw new ConflictException('Mã yêu cầu đã được dùng cho thao tác khác.');
        return reservationView(record, previous);
      }
      const now = new Date();
      if (await this.expireInTx(tx, record, now)) return reservationView({ ...record, status: 'EXPIRED' });
      if (record.status !== requiredStatus(kind)) throw new ConflictException('Lượt đặt hiện không thể thực hiện thao tác này.');
      if (kind === 'CHECK_IN' && (
        record.space.status !== 'RESERVED' || record.space.serviceStatus !== 'ACTIVE' ||
        !await this.hubs.isHubActiveInTx(tx, record.space.hubId)
      )) {
        throw new ConflictException('Chỗ đỗ chưa sẵn sàng để check-in.');
      }
      const pending = record.verifications[0];
      if (pending?.kind === kind && pending.status === 'PENDING' && pending.expiresAt > now) return reservationView(record);
      const deadline = now.getTime() + parkingVerificationTimeoutMs;
      const expiresAt = new Date(kind === 'CHECK_IN' ? Math.min(deadline, record.expiresAt.getTime()) : deadline);
      return reservationView(record, await this.store.createVerification(tx, {
        reservationId: id, requestId, kind, createdAt: now, expiresAt,
      }));
    });
  }

  pendingVerifications(sourceId: string) {
    return this.store.listPending(sourceId, new Date());
  }

  applyParkingStateEvent(event: ParkingStateEvent, onFault?: (tx: Transaction) => Promise<unknown>): Promise<StateEventReceipt> {
    return this.store.serializable(async tx => {
      const space = await this.store.findSpace(tx, event.spaceId);
      if (!space || space.sourceId !== event.sourceId) throw new NotFoundException('Không tìm thấy chỗ đỗ của nguồn này.');
      const now = new Date();
      const observedAt = new Date(event.observedAt);
      const hold = await this.store.activeForSpace(tx, space.id);
      const command = event.verificationId ? await this.store.findVerification(tx, event.verificationId) : null;
      if (event.verificationId) {
        if (!command) throw new NotFoundException('Không tìm thấy yêu cầu xác minh chỗ đỗ.');
        const reservation = await this.store.findReservation(tx, command.reservationId);
        if (reservation?.space.id !== event.spaceId) throw new ConflictException('Bản tin không khớp chỗ đỗ cần xác minh.');
        if (command.status !== 'PENDING') return { result: 'duplicate' };
        if (command.expiresAt <= now || observedAt < command.createdAt || hold?.id !== command.reservationId) {
          return { result: 'stale' };
        }
      }

      if (
        observedAt.getTime() < now.getTime() - parkingVerificationTimeoutMs ||
        observedAt.getTime() > now.getTime() + 5000 ||
        (space.lastObservedAt && observedAt < space.lastObservedAt)
      ) {
        return { result: 'stale' };
      }
      if (!await this.store.recordEvent(tx, event.sourceId, event.eventId)) return { result: 'duplicate' };

      const reading = { occupied: event.occupied, fault: space.fault || event.fault, lastObservedAt: observedAt };
      if (!space.fault && event.fault) {
        await this.audit.append(tx, {
          action: 'PARKING_SPACE_FAULT', targetType: 'parking-space', targetId: space.id, occurredAt: now,
          details: { hubId: space.hubId, sourceId: event.sourceId, eventId: event.eventId },
        });
      }
      let receipt: StateEventReceipt = { result: 'applied' };
      if (command && hold) receipt = await this.applyVerification(tx, hold, command, reading, event, now);
      else await this.store.updateSpace(tx, space.id, parkingSpaceStatus(reading, hold?.status), reading);
      if (event.fault && onFault) await onFault(tx);
      return receipt;
    });
  }

  async expireDueReservations() {
    const now = new Date();
    for (const id of await this.store.findDue(now)) {
      await this.store.serializable(async tx => {
        const record = await this.store.findReservation(tx, id);
        if (record) await this.expireInTx(tx, record, now);
      });
    }
  }

  private async applyVerification(
    tx: Transaction, hold: ParkingReservationRecord, command: ParkingVerificationRecord,
    reading: ParkingReading, event: ParkingStateEvent, now: Date,
  ): Promise<StateEventReceipt> {
    const checkIn = command.kind === 'CHECK_IN';
    let reason: string | undefined;
    if (hold.status !== requiredStatus(command.kind) || (checkIn && hold.expiresAt <= now)) {
      reason = 'Lượt đặt đã đổi trạng thái hoặc hết hạn.';
    } else if (checkIn && (
      reading.fault || hold.space.serviceStatus !== 'ACTIVE' || hold.space.status === 'OUT_OF_SERVICE' ||
      !await this.hubs.isHubActiveInTx(tx, hold.space.hubId)
    )) {
      reason = 'Chỗ đỗ chưa sẵn sàng để check-in.';
    } else if (checkIn && (reading.occupied !== true || event.privateVehicleId !== hold.privateVehicle.id)) {
      reason = 'Cảm biến chưa xác nhận đúng xe ở chỗ đã đặt.';
    } else if (!checkIn && reading.occupied !== false) {
      reason = 'Cảm biến chưa xác nhận chỗ đỗ đã trống.';
    }
    if (reason) {
      await this.store.updateSpace(tx, hold.space.id, parkingSpaceStatus(reading, hold.status), reading);
      await this.store.settleVerification(tx, command.id, reason);
      return { result: 'rejected' };
    }

    const status = checkIn ? 'CHECKED_IN' : 'COMPLETED';
    const spaceStatus = parkingSpaceStatus(reading, status);
    await this.store.updateReservation(tx, { id: hold.id, status, ...(checkIn ? { checkInAt: now } : { checkOutAt: now }) });
    await this.store.updateSpace(tx, hold.space.id, spaceStatus, reading);
    await this.store.settleVerification(tx, command.id);
    await this.audit.append(tx, {
      actorId: hold.studentId, action: checkIn ? 'PARKING_CHECKED_IN' : 'PARKING_COMPLETED',
      targetType: 'parking-reservation', targetId: hold.id, requestId: command.requestId, occurredAt: now,
      details: { spaceId: hold.space.id, spaceStatus, eventId: event.eventId },
    });
    return { result: 'applied' };
  }

  private async readOwned(tx: Transaction, studentId: string, id: string) {
    const record = await this.store.findReservation(tx, id);
    if (!record || record.studentId !== studentId) throw new NotFoundException('Không tìm thấy lượt đặt chỗ đỗ.');
    return record;
  }

  private expireInTx(tx: Transaction, record: ParkingReservationRecord, now: Date) {
    if (record.status !== 'CONFIRMED' || record.expiresAt > now) return null;
    return this.release(tx, record, 'EXPIRED', now);
  }

  private async release(
    tx: Transaction, record: ParkingReservationRecord, status: 'EXPIRED' | 'CANCELLED', now: Date, actorId?: string,
  ) {
    const spaceStatus = parkingSpaceStatus(record.space);
    const changed = await this.store.updateReservation(tx, { id: record.id, status });
    await this.store.updateSpace(tx, record.space.id, spaceStatus);
    await this.audit.append(tx, {
      actorId, action: status === 'EXPIRED' ? 'PARKING_EXPIRED' : 'PARKING_CANCELLED',
      targetType: 'parking-reservation', targetId: record.id, occurredAt: now,
      details: { spaceId: record.space.id, spaceStatus },
    });
    return changed;
  }
}
