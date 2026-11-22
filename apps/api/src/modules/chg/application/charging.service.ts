import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ChangeInput, ChargingRequestView, ChargingStateEvent, ChargingVehicle, PendingChargeStep, SessionView, StateEventReceipt,
} from '@semh/contracts';
import { AuditService } from '../../../shared/audit/audit.service.js';
import { withChange } from '../../../shared/database/change-receipt.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import { assertVersion } from '../../../shared/http/input.js';
import { AccessService } from '../../gen/application/access.service.js';
import { assertOperatorHubs, canOperateAt } from '../../gen/application/operator-scope.js';
import { chargingPriority, chargingWindowMs, findChargingSlot, type Slot } from '../domain/charging.policy.js';
import { OwnerChargingContextAdapter } from '../infrastructure/owner-charging-context.adapter.js';
import { PrismaChargingStore, type StoredCharge } from '../infrastructure/prisma-charging.store.js';

export interface ChargeInput {
  kind: ChargingVehicle['kind'];
  vehicleId: string;
  hubId: string;
  desiredBy: Date | null;
  neededAt: Date | null;
}

interface Candidate {
  id: string;
  vehicleKind: string;
  vehicleId: string;
  createdAt: Date;
  desiredBy: Date | null;
  neededAt: Date | null;
  preferredPointId: string | null;
  overrideRank: number | null;
}

function view(row: StoredCharge): ChargingRequestView {
  const { session } = row;
  return {
    id: row.id, vehicleKind: row.vehicleKind as ChargingVehicle['kind'], vehicleId: row.vehicleId, vehicleCode: row.vehicleCode,
    hubId: row.hubId, status: row.status, reason: row.reason, priority: row.priority, version: row.version,
    session: session ? {
      id: session.id, pointId: session.pointId, pointCode: session.point.code, status: session.status,
      startAt: session.startAt.toISOString(), endAt: session.endAt.toISOString(), batteryPercent: session.batteryPercent,
      releasedAt: session.releasedAt?.toISOString() ?? null, observedAt: session.lastObservedAt?.toISOString() ?? null,
    } : null,
  };
}

@Injectable()
export class ChargingService {
  constructor(
    private readonly access: AccessService,
    private readonly store: PrismaChargingStore,
    private readonly context: OwnerChargingContextAdapter,
    private readonly audit: AuditService,
  ) {}

  overview(session: SessionView, mode: 'STU' | 'OPR') {
    return this.store.read(async tx => {
      const hubs = (await this.store.activeHubs(tx)).filter(hub => mode === 'STU' || canOperateAt(session, hub.id));
      const requests = await this.store.allRequests(tx, mode === 'OPR'
        ? { hubId: session.operatorHubIds === null ? undefined : { in: session.operatorHubIds ?? [] } }
        : { authorId: session.accountId, vehicleKind: 'PRIVATE' });
      return { hubs, requests: requests.map(view), vehicles: mode === 'OPR' ? [] : await this.context.personalVehicles(tx, session.accountId) };
    });
  }

  preview(session: SessionView, input: ChargeInput) {
    return this.store.read(async tx => {
      await this.authorizeVehicle(tx, session, input);
      const now = new Date();
      const candidate: Candidate = {
        ...input, id: 'preview', createdAt: now, vehicleKind: input.kind, preferredPointId: null, overrideRank: null,
      };
      const evaluations = await this.plan(tx, input.hubId, now, candidate);
      const item = evaluations.find(result => result.candidate.id === candidate.id);
      return {
        reason: item?.reason ?? null,
        pointId: item?.slot?.pointId ?? null,
        startsAt: item?.slot ? new Date(item.slot.start).toISOString() : null,
        endsAt: item?.slot ? new Date(item.slot.end).toISOString() : null,
      };
    });
  }

  create(token: string, input: ChargeInput, change: ChangeInput) {
    return this.store.write(async tx => {
      const actor = await this.access.verifyAccess(token, ['STU', 'OPR'], tx);
      const vehicle = await this.authorizeVehicle(tx, actor, input, false);
      return withChange(tx, actor.accountId, 'CHARGING_REQUEST_CREATED', change, input, async () => {
        if (vehicle.batteryPercent === 100) throw new ConflictException('Pin đã đạt mức mục tiêu.');
        const active = await this.store.allRequests(tx, {
          vehicleId: vehicle.id,
          OR: [
            { status: { in: ['PENDING', 'SCHEDULED', 'CHARGING'] } },
            { session: { startedAt: { not: null }, releasedAt: null } },
          ],
        });
        if (active.length) throw new ConflictException('Xe đã có yêu cầu hoặc phiên sạc chưa giải phóng.');
        const created = await this.store.create(tx, {
          authorId: actor.accountId, requestId: change.requestId, vehicleKind: input.kind, vehicleId: vehicle.id,
          vehicleCode: vehicle.code, hubId: input.hubId, desiredBy: input.desiredBy, neededAt: input.neededAt,
        });
        await this.reschedule(tx, input.hubId, new Date());
        const result = (await this.store.request(tx, created.id)) ?? created;
        await this.audit.append(tx, {
          actorId: actor.accountId, action: 'CHARGING_REQUEST_CREATED', targetType: 'charging-request', targetId: created.id,
          requestId: change.requestId, occurredAt: new Date(), details: { status: result.status, hubId: input.hubId, vehicleId: vehicle.id },
        });
        return view(result);
      });
    });
  }

  adjust(token: string, id: string, rank: number | null, pointId: string | null, change: ChangeInput) {
    return this.store.write(async tx => {
      const actor = await this.access.verifyAccess(token, ['OPR'], tx);
      const record = await this.store.request(tx, id);
      if (!record) throw new NotFoundException('Không tìm thấy yêu cầu sạc.');
      assertOperatorHubs(actor, record.hubId);
      return withChange(tx, actor.accountId, 'CHARGING_ADJUSTED', change, { id, rank, pointId }, async () => {
        assertVersion(record.version, change.version);
        if (!['PENDING', 'SCHEDULED'].includes(record.status)) throw new ConflictException('Chỉ điều chỉnh phiên chưa bắt đầu.');
        if (pointId) {
          const point = await this.store.point(tx, pointId);
          if (!point || point.hubId !== record.hubId) throw new ConflictException('Cổng không thuộc Hub của yêu cầu.');
        }
        await this.store.update(tx, id, { overrideRank: rank, preferredPointId: pointId });
        await this.reschedule(tx, record.hubId, new Date());
        const result = (await this.store.request(tx, id))!;
        if (result.status !== 'SCHEDULED') throw new ConflictException(result.reason ?? 'Không tìm được lịch khả thi.');
        await this.audit.append(tx, {
          actorId: actor.accountId, action: 'CHARGING_ADJUSTED', targetType: 'charging-request', targetId: id,
          requestId: change.requestId, occurredAt: new Date(),
          details: { reason: change.reason ?? null, rank, pointId, previousPointId: record.session?.pointId ?? null },
        });
        return view(result);
      });
    });
  }

  async refresh() {
    for (const { hubId } of await this.store.hubsWithQueue()) {
      await this.store.write(tx => this.reschedule(tx, hubId, new Date()));
    }
  }

  async pendingSteps(sourceId: string): Promise<PendingChargeStep[]> {
    const now = new Date();
    const rows = await this.store.pendingSteps(sourceId, now);
    const points = new Set<string>();
    const commands: PendingChargeStep[] = [];
    for (const row of rows.sort((a, b) => Number(a.status === 'READY') - Number(b.status === 'READY'))) {
      if (points.has(row.pointId)) continue;
      points.add(row.pointId);
      if (row.status === 'CHARGING') {
        if (row.endAt <= now || (process.env.IOT_DEMO_ACCELERATED === 'true' && now.getTime() - row.startedAt!.getTime() >= 6000)) {
          commands.push({ pointId: row.pointId, sessionId: row.id, phase: 'COMPLETED', batteryPercent: 100 });
        }
      } else {
        commands.push({
          pointId: row.pointId, sessionId: row.id,
          phase: row.status === 'READY' ? 'STARTED' : 'RELEASED', batteryPercent: row.batteryPercent,
        });
      }
    }
    return commands;
  }

  applyEvent(event: ChargingStateEvent, reportFault: (tx: Transaction, hubId: string) => Promise<unknown>): Promise<StateEventReceipt> {
    return this.store.write(async tx => {
      const point = await this.store.point(tx, event.pointId);
      if (!point || point.sourceId !== event.sourceId) throw new NotFoundException('Cổng sạc không thuộc nguồn này.');
      const observedAt = new Date(event.observedAt);
      const now = new Date();
      if (point.lastObservedAt && observedAt < point.lastObservedAt) return { result: 'stale' };
      if (!await this.store.recordEvent(tx, event.sourceId, event.eventId)) return { result: 'duplicate' };
      const bound = await this.store.physicalSessions(tx, point.hubId);
      const existing = bound.find(item => item.pointId === point.id);
      const session = event.sessionId ? await this.store.session(tx, event.sessionId) : null;
      if (event.sessionId && (!session || session.pointId !== point.id)) {
        throw new ConflictException('Bản tin không khớp cổng và phiên sạc.');
      }

      if (event.phase === 'READY' && !existing && !point.fault) {
        await this.store.setPoint(tx, point.id, { status: 'AVAILABLE', lastObservedAt: observedAt });
      } else if (event.phase === 'FAULT') {
        await this.store.setPoint(tx, point.id, { lastObservedAt: observedAt });
        await reportFault(tx, point.hubId);
      } else if (event.phase === 'STARTED' && session?.status === 'READY' && event.batteryPercent !== null) {
        const hub = await this.store.hub(tx, point.hubId);
        const load = bound.filter(item => item.status === 'CHARGING').reduce((sum, item) => sum + item.powerKw, 0);
        if (existing || point.status !== 'AVAILABLE' || point.serviceStatus !== 'ACTIVE' || point.fault ||
          hub?.serviceStatus !== 'ACTIVE' || hub.fault || load + session.powerKw > hub.chargeKw + 1e-8 || session.startAt > now) {
          return { result: 'rejected' };
        }
        const vehicle = await this.context.vehicle(tx, session.request.vehicleKind, session.request.vehicleId);
        if (!vehicle || !vehicle.ready || event.batteryPercent >= 100 ||
          (vehicle.kind === 'SHARED' && vehicle.hubId !== point.hubId)) {
          return { result: 'rejected' };
        }
        await this.context.updateVehicle(tx, vehicle, point.hubId, 'STARTED', event.batteryPercent, observedAt);
        await this.store.setSession(tx, session.id, {
          startedAt: observedAt, lastObservedAt: observedAt, batteryPercent: event.batteryPercent, status: 'CHARGING',
        });
        await this.store.setPoint(tx, point.id, { status: 'CHARGING', lastObservedAt: observedAt });
        await this.store.updateStatus(tx, session.requestId, 'CHARGING');
      } else if (session && existing?.id === session.id && !session.releasedAt && event.batteryPercent !== null) {
        const result = await this.applyProgress(tx, session, event, observedAt, point.fault);
        if (!result) return { result: 'rejected' };
      } else {
        return { result: 'rejected' };
      }

      if (session && ['STARTED', 'COMPLETED', 'RELEASED'].includes(event.phase)) {
        await this.audit.append(tx, {
          action: 'CHARGING_SESSION_' + event.phase, targetType: 'charging-session', targetId: session.id, occurredAt: now,
          details: { sourceId: event.sourceId, eventId: event.eventId, previousStatus: session.status, pointId: point.id },
        });
      }
      await this.reschedule(tx, point.hubId, now);
      return { result: 'applied' };
    });
  }

  async interruptPointInTx(tx: Transaction, pointId: string, hubId: string, now: Date, observedAt = now) {
    await this.store.setPoint(tx, pointId, { status: 'OUT_OF_SERVICE', fault: true, lastObservedAt: observedAt });
    const existing = (await this.store.physicalSessions(tx, hubId)).find(item => item.pointId === pointId);
    if (existing?.status === 'CHARGING') {
      await this.store.setSession(tx, existing.id, { status: 'INTERRUPTED', completedAt: now, lastObservedAt: observedAt });
      await this.store.updateStatus(tx, existing.requestId, 'INTERRUPTED');
      await this.audit.append(tx, {
        action: 'CHARGING_SESSION_INTERRUPTED', targetType: 'charging-session', targetId: existing.id, occurredAt: now,
        details: { pointId, previousStatus: 'CHARGING', status: 'INTERRUPTED' },
      });
    }
    await this.reschedule(tx, hubId, now);
  }

  private async applyProgress(
    tx: Transaction, session: NonNullable<Awaited<ReturnType<PrismaChargingStore['session']>>>,
    event: ChargingStateEvent, observedAt: Date, fault: boolean,
  ) {
    const battery = event.batteryPercent!;
    const vehicle = { kind: session.request.vehicleKind as ChargingVehicle['kind'], id: session.request.vehicleId };
    if (event.phase === 'RELEASED' && ['INTERRUPTED', 'COMPLETED'].includes(session.status)) {
      await this.context.updateVehicle(tx, vehicle, session.request.hubId, fault && battery < 30 ? 'FAULT' : 'RELEASED', battery, observedAt);
      await this.store.setSession(tx, session.id, { releasedAt: observedAt, lastObservedAt: observedAt, batteryPercent: battery });
      await this.store.setPoint(tx, session.pointId, { status: fault ? 'OUT_OF_SERVICE' : 'AVAILABLE', lastObservedAt: observedAt });
      return true;
    }
    if (session.status !== 'CHARGING' || battery < session.batteryPercent) return false;
    if (event.phase !== 'PROGRESS' && (event.phase !== 'COMPLETED' || battery !== 100)) return false;
    await this.context.updateVehicle(tx, vehicle, session.request.hubId, 'PROGRESS', battery, observedAt);
    if (event.phase === 'COMPLETED') {
      await this.store.setSession(tx, session.id, { status: 'COMPLETED', completedAt: observedAt, batteryPercent: battery, lastObservedAt: observedAt });
      await this.store.setPoint(tx, session.pointId, { status: 'OCCUPIED', lastObservedAt: observedAt });
      await this.store.updateStatus(tx, session.requestId, 'COMPLETED');
    } else {
      await this.store.setSession(tx, session.id, { batteryPercent: battery, lastObservedAt: observedAt });
      await this.store.setPoint(tx, session.pointId, { lastObservedAt: observedAt });
    }
    return true;
  }

  private async authorizeVehicle(tx: Transaction, actor: SessionView, input: ChargeInput, checkBattery = true) {
    const vehicle = await this.context.vehicle(tx, input.kind, input.vehicleId);
    if (input.kind === 'SHARED') {
      assertOperatorHubs(actor, input.hubId);
      if (!vehicle || vehicle.hubId !== input.hubId) throw new NotFoundException('Không tìm thấy xe dùng chung trong Hub này.');
    } else if (!actor.roles.includes('STU') || !vehicle || vehicle.ownerId !== actor.accountId) {
      throw new ForbiddenException('Bạn chỉ có thể đăng ký sạc xe cá nhân thuộc quyền của mình.');
    }
    const hub = await this.store.hub(tx, input.hubId);
    if (hub?.serviceStatus !== 'ACTIVE' || hub.fault) throw new ConflictException('Hub không phục vụ.');
    if (checkBattery && vehicle.batteryPercent === 100) throw new ConflictException('Pin đã đạt mức mục tiêu.');
    return vehicle;
  }

  private async plan(tx: Transaction, hubId: string, now: Date, extra?: Candidate) {
    const hub = await this.store.hub(tx, hubId);
    const requests = await this.store.allRequests(tx, { hubId, status: { in: ['PENDING', 'SCHEDULED'] } });
    const points = await this.store.availablePoints(tx, hubId);
    const physical = await this.store.physicalSessions(tx, hubId);
    const base = Math.floor(now.getTime() / 60_000) * 60_000;
    const horizon = base + chargingWindowMs;
    const timetable: Slot[] = physical.map(item => ({
      pointId: item.pointId, start: base,
      end: item.status === 'CHARGING' ? Math.max(base + 60_000, item.endAt.getTime()) : horizon,
      powerKw: item.status === 'CHARGING' ? item.powerKw : 0,
    }));

    const candidates = [];
    for (const candidate of extra ? [...requests, extra] : requests) {
      const vehicle = await this.context.vehicle(tx, candidate.vehicleKind, candidate.vehicleId);
      const priority = chargingPriority(vehicle?.batteryPercent ?? null, candidate.neededAt, now);
      candidates.push({ candidate, vehicle, priority });
    }
    candidates.sort((a, b) => (a.candidate.overrideRank ?? 1000) - (b.candidate.overrideRank ?? 1000) ||
      b.priority - a.priority || a.candidate.createdAt.getTime() - b.candidate.createdAt.getTime() ||
      a.candidate.id.localeCompare(b.candidate.id));
    return candidates.map(({ candidate, vehicle, priority }) => {
      let reason: string | null = null;
      let slot: Slot | null = null;
      if (hub?.serviceStatus !== 'ACTIVE' || hub.fault) reason = 'Hub chưa phục vụ.';
      else if (!vehicle?.ready) reason = 'Xe chưa sẵn sàng hoặc đang có ràng buộc.';
      else if (vehicle.kind === 'SHARED' && vehicle.hubId !== hubId) reason = 'Xe đã rời Hub.';
      else if (vehicle.batteryPercent === 100) reason = 'Pin đã đạt mức mục tiêu.';
      else if (vehicle.batteryPercent === null || !vehicle.batteryKwh || !vehicle.maxChargeKw || !vehicle.connector) {
        reason = 'Chờ dữ liệu pin, công suất hoặc đầu nối của xe.';
      } else {
        const deadline = Math.min(horizon, candidate.desiredBy?.getTime() ?? Infinity, candidate.neededAt?.getTime() ?? Infinity);
        slot = findChargingSlot(vehicle, points.filter(point => !candidate.preferredPointId || candidate.preferredPointId === point.id),
          timetable, base, deadline, hub.chargeKw);
        if (slot) timetable.push(slot);
        else reason = 'Không có cổng tương thích hoặc khung giờ khả thi trong giới hạn công suất.';
      }
      return { candidate, priority, battery: vehicle?.batteryPercent, reason, slot };
    });
  }

  private async reschedule(tx: Transaction, hubId: string, now: Date) {
    const evaluations = await this.plan(tx, hubId, now);
    for (const item of evaluations) {
      const record = item.candidate as StoredCharge;
      if (item.slot && item.battery != null) {
        const { pointId, start, end, powerKw } = item.slot;
        const session = record.session;
        if (session?.pointId !== pointId || session.startAt.getTime() !== start ||
            session.endAt.getTime() !== end || session.batteryPercent !== item.battery) {
          await this.store.setAllocation(tx, record.id, {
            pointId, startAt: new Date(start), endAt: new Date(end), powerKw, batteryPercent: item.battery,
          });
        }
      } else if (record.session) {
        await this.store.removeAllocation(tx, record.id);
      }
      const status = item.slot ? 'SCHEDULED' : 'PENDING';
      if (record.status !== status || record.reason !== item.reason || record.priority !== item.priority ||
        (item.slot && (record.session?.pointId !== item.slot.pointId || record.session.startAt.getTime() !== item.slot.start))) {
        await this.store.update(tx, record.id, { status, reason: item.reason, priority: item.priority });
      }
    }
  }
}
