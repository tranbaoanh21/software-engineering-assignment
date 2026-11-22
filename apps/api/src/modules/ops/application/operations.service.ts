import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ChangeInput, IncidentView, PlanView, ResourceKind, ResourceStateEvent, SessionView, StateEventReceipt } from '@semh/contracts';
import { SETTINGS, type Settings } from '../../../config/settings.js';
import type { Incident } from '../../../generated/prisma/client.js';
import { AuditService } from '../../../shared/audit/audit.service.js';
import { withChange } from '../../../shared/database/change-receipt.js';
import type { Transaction } from '../../../shared/database/transaction.js';
import { assertVersion } from '../../../shared/http/input.js';
import { AccessService } from '../../gen/application/access.service.js';
import { assertOperatorHubs } from '../../gen/application/operator-scope.js';
import { HubService } from '../../hub/application/hub.service.js';
import { NetworkReader } from '../../hub/application/network-reader.port.js';
import { FleetNetwork } from '../../trip/application/fleet-network.port.js';
import { returnedVehicleStatus } from '../../trip/domain/trip.policy.js';
import { PrismaOperationsStore, type StoredPlan } from '../infrastructure/prisma-operations.store.js';
import { PrismaResourceOwnerAdapter, type ResourceDraft } from '../infrastructure/prisma-resource-owner.adapter.js';

export interface PlanInput {
  sourceHubId: string;
  targetHubId: string;
  vehicleIds: string[];
  scheduledAt: Date;
  recommendationId: string | null;
}

export interface IncidentAction {
  action: 'ACKNOWLEDGE' | 'ASSIGN' | 'START' | 'HANDOVER' | 'CONFIRM_HANDOVER' | 'RESOLVE' | 'CLOSE';
  assigneeId?: string;
  safetyPassed?: boolean;
  location?: string;
  actualHubId?: string;
  severity?: string;
  dueAt?: Date;
}

export interface PlanAction {
  action: 'APPROVE' | 'DEPART' | 'ARRIVE' | 'COMPLETE' | 'CANCEL';
  vehicleId?: string;
  actualHubId?: string;
}

function incidentView(row: Incident): IncidentView {
  return {
    ...row, handover: row.handover as IncidentView['handover'], createdAt: row.createdAt.toISOString(),
    dueAt: row.dueAt?.toISOString() ?? null,
  };
}

function planView(row: StoredPlan): PlanView {
  return { ...row, scheduledAt: row.scheduledAt.toISOString() };
}

@Injectable()
export class OperationsService {
  constructor(
    private readonly access: AccessService,
    private readonly store: PrismaOperationsStore,
    private readonly resources: PrismaResourceOwnerAdapter,
    private readonly hubs: HubService,
    private readonly network: NetworkReader,
    private readonly fleet: FleetNetwork,
    private readonly audit: AuditService,
    @Inject(SETTINGS) private readonly settings: Settings,
  ) {}

  dashboard(actor: SessionView, mode: 'OPR' | 'MNT' | 'ADM') {
    return this.store.read(async tx => {
      const scope = actor.operatorHubIds === null ? undefined : actor.operatorHubIds ?? [];
      const hubs = mode === 'MNT' ? [] : await this.network.read(tx, mode === 'ADM' ? undefined : scope, false);
      const where = mode === 'MNT' ? { assigneeId: actor.accountId } : { hubId: scope ? { in: scope } : undefined };
      return {
        hubs,
        incidents: mode === 'ADM' ? [] : (await this.store.incidents(tx, where)).map(incidentView),
        plans: mode === 'OPR' ? (await this.store.plans(tx, scope)).map(planView) : [],
        technicians: mode === 'OPR' ? await this.store.technicians(tx) : [],
      };
    });
  }

  createResource(token: string, input: ResourceDraft, change: ChangeInput, mode: 'ADM' | 'OPR') {
    return this.store.write(async tx => {
      const actor = await this.access.verifyAccess(token, [mode], tx);
      if (mode === 'OPR') {
        if (input.kind === 'HUB') throw new ForbiddenException('Chỉ quản trị viên được khai báo Hub mới.');
        assertOperatorHubs(actor, input.hubId);
      }
      return withChange(tx, actor.accountId, 'RESOURCE_CREATED', change, input, async () => {
        if (input.hubId && !await this.store.hub(tx, input.hubId)) throw new NotFoundException('Không tìm thấy Hub cha.');
        const resource = await this.resources.create(tx, input, this.settings.iotSourceId);
        await this.log(tx, actor.accountId, 'RESOURCE_CREATED', resource.kind, resource.id, change,
          { code: resource.code, hubId: resource.hubId, after: 'DRAFT' });
        return resource;
      });
    });
  }

  updateResource(
    token: string, kind: ResourceKind, id: string, patch: { description?: string; serviceStatus?: 'ACTIVE' | 'INACTIVE' }, change: ChangeInput,
  ) {
    return this.store.write(async tx => {
      const actor = await this.access.verifyAccess(token, ['OPR'], tx);
      const resource = await this.requireResource(tx, kind, id);
      assertOperatorHubs(actor, resource.hubId);
      return withChange(tx, actor.accountId, 'RESOURCE_UPDATED', change, { kind, id, patch }, async () => {
        assertVersion(resource.version, change.version);
        if (patch.serviceStatus) {
          if (patch.serviceStatus === 'ACTIVE') {
            if (!resource.observedAt || resource.status === 'OUT_OF_SERVICE' ||
                await this.store.openIncident(tx, kind, id) ||
                (kind !== 'HUB' && (!resource.hubId || !await this.hubs.isHubActiveInTx(tx, resource.hubId)))) {
              throw new ConflictException('Thiếu xác nhận trạng thái an toàn hoặc Hub cha chưa hoạt động.');
            }
          } else if (await this.resources.constrained(tx, resource)) {
            throw new ConflictException('Tài nguyên còn lượt giữ, đang được sử dụng hoặc có lịch điều phối.');
          }
        }
        const result = patch.serviceStatus
          ? await this.resources.setService(tx, resource, patch.serviceStatus)
          : await this.resources.updateMetadata(tx, resource, patch.description!);
        await this.log(tx, actor.accountId, 'RESOURCE_UPDATED', kind, id, change,
          { before: { serviceStatus: resource.serviceStatus, description: resource.description },
            after: { serviceStatus: result.serviceStatus, description: result.description } });
        return result;
      });
    });
  }

  reportIncident(
    token: string, input: { kind: ResourceKind; id: string; title: string; description: string }, change: ChangeInput,
  ) {
    return this.store.write(async tx => {
      const actor = await this.access.verifyAccess(token, ['OPR'], tx);
      const resource = await this.requireResource(tx, input.kind, input.id);
      const trip = input.kind === 'VEHICLE' ? await this.store.openTrip(tx, resource.id) : null;
      assertOperatorHubs(actor, resource.hubId ?? trip?.startHubId ?? null);
      return withChange(tx, actor.accountId, 'INCIDENT_REPORTED', change, input, () =>
        this.openFault(tx, resource, input.title, input.description, { actorId: actor.accountId, requestId: change.requestId }));
    });
  }

  reportTripFault(token: string, tripId: string, description: string, change: ChangeInput) {
    return this.store.write(async tx => {
      const actor = await this.access.verifyAccess(token, ['STU'], tx);
      return withChange(tx, actor.accountId, 'TRIP_FAULT_REPORTED', change, { tripId, description }, async () => {
        const trip = await this.store.studentTrip(tx, tripId, actor.accountId);
        if (!trip) throw new NotFoundException('Không tìm thấy chuyến đang đi của bạn.');
        const resource = await this.requireResource(tx, 'VEHICLE', trip.vehicleId);
        const incident = await this.openFault(tx, resource, 'Xe gặp sự cố trong chuyến', description,
          { actorId: actor.accountId, requestId: change.requestId });
        return { id: incident.id, status: incident.status };
      });
    });
  }

  async reportVerifiedFaultInTx(tx: Transaction, kind: ResourceKind, id: string, sourceId: string, eventId: string) {
    const resource = await this.requireResource(tx, kind, id);
    return this.openFault(tx, resource, 'Sự cố thiết bị ' + resource.code, 'Thiết bị gửi trạng thái lỗi.', { sourceId, eventId });
  }

  applyResourceEvent(event: ResourceStateEvent): Promise<StateEventReceipt> {
    return this.store.write(async tx => {
      const observed = new Date(event.observedAt);
      if (event.resourceKind === 'HUB') {
        const hub = await this.store.hub(tx, event.resourceId);
        if (!hub) throw new NotFoundException('Không tìm thấy Hub.');
        if (hub.lastObservedAt && hub.lastObservedAt > observed) return { result: 'stale' };
        if (!await this.store.recordEvent(tx, event.sourceId, event.eventId)) return { result: 'duplicate' };
        await this.store.updateHubTelemetry(tx, hub.id, observed);
        if (event.fault) await this.reportVerifiedFaultInTx(tx, 'HUB', hub.id, event.sourceId, event.eventId);
      } else {
        const vehicle = await this.store.readVehicle(tx, event.resourceId);
        if (!vehicle || vehicle.sourceId !== event.sourceId) throw new NotFoundException('Xe không thuộc nguồn này.');
        if (vehicle.lastObservedAt && vehicle.lastObservedAt > observed) return { result: 'stale' };
        if (!await this.store.recordEvent(tx, event.sourceId, event.eventId)) return { result: 'duplicate' };
        const bootstrapped = !vehicle.lastObservedAt && !vehicle.fault && vehicle.hubId &&
          event.batteryPercent !== null && !event.fault && (event.sinceMaintenanceKm ?? 0) < 1000;
        await this.store.updateVehicleTelemetry(tx, vehicle.id, {
          lastObservedAt: observed, sinceMaintenanceKm: event.sinceMaintenanceKm,
          batteryPercent: event.batteryPercent ?? undefined,
          status: bootstrapped ? returnedVehicleStatus(event.batteryPercent!, false) : undefined,
        });
        if (event.fault || (event.sinceMaintenanceKm ?? 0) >= 1000) {
          await this.reportVerifiedFaultInTx(tx, 'VEHICLE', vehicle.id, event.sourceId, event.eventId);
        }
      }
      return { result: 'applied' };
    });
  }

  changeIncident(token: string, id: string, input: IncidentAction, change: ChangeInput) {
    return this.store.write(async tx => {
      const isTech = ['START', 'HANDOVER', 'RESOLVE'].includes(input.action);
      const actor = await this.access.verifyAccess(token, isTech ? ['MNT'] : ['OPR'], tx);
      const row = await this.store.incident(tx, id);
      if (!row) throw new NotFoundException('Không tìm thấy sự cố.');
      if (isTech) {
        if (row.assigneeId !== actor.accountId) throw new ForbiddenException('Sự cố này chưa được giao cho bạn.');
      } else assertOperatorHubs(actor, row.hubId);

      return withChange(tx, actor.accountId, 'INCIDENT_CHANGED', change, { id, input }, async () => {
        assertVersion(row.version, change.version);
        const updated = await this.applyIncidentAction(tx, row, actor.accountId, input, change.reason!);
        await this.log(tx, actor.accountId, 'INCIDENT_' + input.action, 'incident', id, change,
          { from: row.status, to: updated.status, assigneeId: updated.assigneeId, safe: updated.safe });
        return incidentView(updated);
      });
    });
  }

  private async applyIncidentAction(tx: Transaction, row: Incident, actorId: string, input: IncidentAction, reason: string) {
    const { action } = input;
    const { id, status } = row;
    if (action === 'ACKNOWLEDGE' && status === 'OPEN') {
      return this.store.updateIncident(tx, id, { status: 'ACKNOWLEDGED', severity: input.severity ?? 'MEDIUM' });
    }
    if (action === 'ASSIGN' && ['ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS'].includes(status) &&
        input.assigneeId && await this.store.activeTechnician(tx, input.assigneeId)) {
      return this.store.updateIncident(tx, id, { status: 'ASSIGNED', assigneeId: input.assigneeId, dueAt: input.dueAt });
    }
    if (action === 'START' && status === 'ASSIGNED') {
      return this.store.updateIncident(tx, id, { status: 'IN_PROGRESS' });
    }
    if (action === 'HANDOVER' && status === 'IN_PROGRESS' && row.tripId && input.location) {
      return this.store.updateIncident(tx, id, { handover: { location: input.location, at: new Date().toISOString(), by: actorId } });
    }
    if (action === 'CONFIRM_HANDOVER' && status === 'IN_PROGRESS' && row.tripId && row.handover &&
        (row.handover as IncidentView['handover'])?.by === row.assigneeId) {
      await this.fleet.closeFaultedTrip(tx, row.tripId, row.resourceId);
      return this.store.updateIncident(tx, id, { resolution: reason });
    }
    if (action === 'RESOLVE' && status === 'IN_PROGRESS' && typeof input.safetyPassed === 'boolean') {
      if (input.safetyPassed) {
        const resource = await this.requireResource(tx, row.resourceKind, row.resourceId);
        if (!resource.hubId && resource.kind === 'VEHICLE') {
          if (!input.actualHubId) throw new ConflictException('Chọn Hub đã xác nhận tiếp nhận xe.');
          const destination = await this.hubs.readArrivalCapacityInTx(tx, input.actualHubId);
          if (!destination?.active || destination.spaces < 1) throw new ConflictException('Hub chưa thể tiếp nhận xe.');
        }
        await this.resources.restore(tx, resource, input.actualHubId);
      }
      return this.store.updateIncident(tx, id, {
        status: input.safetyPassed ? 'RESOLVED' : 'IN_PROGRESS', resolution: reason, safe: input.safetyPassed,
      });
    }
    if (action === 'CLOSE' && status === 'RESOLVED' && row.safe) {
      return this.store.updateIncident(tx, id, { status: 'CLOSED' });
    }
    throw new ConflictException('Không thể thực hiện thao tác ở trạng thái sự cố hiện tại.');
  }

  savePlan(token: string, input: PlanInput, change: ChangeInput, id?: string) {
    return this.store.write(async tx => {
      const actor = await this.access.verifyAccess(token, ['OPR'], tx);
      assertOperatorHubs(actor, input.sourceHubId, input.targetHubId);
      if (id) {
        const previous = await this.store.plan(tx, id);
        if (!previous) throw new NotFoundException('Không tìm thấy kế hoạch.');
        assertOperatorHubs(actor, previous.sourceHubId, previous.targetHubId);
      }
      return withChange(tx, actor.accountId, 'PLAN_SAVED', change, { id, input }, async () => {
        if (id) {
          const previous = (await this.store.plan(tx, id))!;
          assertVersion(previous.version, change.version);
          if (previous.status !== 'DRAFT') throw new ConflictException('Chỉ có thể sửa kế hoạch nháp.');
        }
        await this.checkTransfer(tx, input);
        const data = {
          authorId: actor.accountId, sourceHubId: input.sourceHubId, targetHubId: input.targetHubId,
          scheduledAt: input.scheduledAt, reason: change.reason!, recommendationId: input.recommendationId,
        };
        const vehicles = input.vehicleIds.map(vehicleId => ({ vehicleId }));
        const row = id
          ? await this.store.updatePlan(tx, id, { ...data, items: { deleteMany: {}, create: vehicles } })
          : await this.store.createPlan(tx, { ...data, items: { create: vehicles } });
        await this.log(tx, actor.accountId, 'PLAN_SAVED', 'plan', row.id, change, { vehicleIds: input.vehicleIds });
        return planView(row);
      });
    });
  }

  changePlan(token: string, id: string, input: PlanAction, change: ChangeInput) {
    return this.store.write(async tx => {
      const actor = await this.access.verifyAccess(token, ['OPR'], tx);
      const row = await this.store.plan(tx, id);
      if (!row) throw new NotFoundException('Không tìm thấy kế hoạch.');
      assertOperatorHubs(actor, row.sourceHubId, row.targetHubId);
      return withChange(tx, actor.accountId, 'PLAN_CHANGED', change, { id, input }, async () => {
        assertVersion(row.version, change.version);
        const updated = await this.applyPlanAction(tx, row, input);
        await this.log(tx, actor.accountId, 'PLAN_' + input.action, 'plan', id, change,
          { from: row.status, to: updated.status, vehicleId: input.vehicleId ?? null, actualHubId: input.actualHubId ?? null });
        return planView(updated);
      });
    });
  }

  private async applyPlanAction(tx: Transaction, row: StoredPlan, input: PlanAction) {
    const { id, status, items, sourceHubId, targetHubId } = row;
    const { action } = input;
    if (action === 'APPROVE' && status === 'DRAFT') {
      await this.checkTransfer(tx, { sourceHubId, targetHubId, vehicleIds: items.map(item => item.vehicleId) });
      for (const item of items) await this.fleet.bindTransfer(tx, item.vehicleId, id, sourceHubId);
      return this.store.updatePlan(tx, id, { status: 'APPROVED' });
    }
    if (action === 'CANCEL' && ['DRAFT', 'APPROVED', 'IN_PROGRESS'].includes(status)) {
      if (items.some(item => item.status === 'DEPARTED')) throw new ConflictException('Có xe đang vận chuyển. Xác nhận nơi xe đến trước khi hủy.');
      for (const item of items.filter(item => item.status === 'PLANNED')) {
        if (status !== 'DRAFT') await this.fleet.transfer(tx, item.vehicleId, id, 'CANCEL', sourceHubId);
        await this.store.moveItem(tx, id, item.vehicleId, { status: 'CANCELLED' });
      }
      return this.store.updatePlan(tx, id, { status: 'CANCELLED' });
    }
    if (action === 'COMPLETE' && status === 'IN_PROGRESS' && items.every(item => item.status === 'ARRIVED')) {
      return this.store.updatePlan(tx, id, { status: 'COMPLETED' });
    }
    if (status === 'APPROVED' || status === 'IN_PROGRESS') {
      const item = items.find(item => item.vehicleId === input.vehicleId);
      if (item && action === 'DEPART' && item.status === 'PLANNED' && input.actualHubId === sourceHubId) {
        await this.fleet.transfer(tx, item.vehicleId, id, 'DEPART', sourceHubId);
        await this.store.moveItem(tx, id, item.vehicleId, { status: 'DEPARTED', departedAt: new Date() });
        return this.store.updatePlan(tx, id, { status: 'IN_PROGRESS' });
      }
      if (item && action === 'ARRIVE' && item.status === 'DEPARTED' && input.actualHubId === targetHubId) {
        const destination = await this.hubs.readArrivalCapacityInTx(tx, targetHubId);
        if (!destination?.active || destination.physicalSpaces < 1) throw new ConflictException('Hub đích chưa thể nhận xe.');
        await this.fleet.transfer(tx, item.vehicleId, id, 'ARRIVE', targetHubId);
        await this.store.moveItem(tx, id, item.vehicleId, { status: 'ARRIVED', arrivedAt: new Date() });
        return this.store.updatePlan(tx, id, {});
      }
    }
    throw new ConflictException('Bằng chứng hoặc trạng thái điều chuyển không hợp lệ.');
  }

  private async checkTransfer(tx: Transaction, input: Pick<PlanInput, 'sourceHubId' | 'targetHubId' | 'vehicleIds'>) {
    if (input.sourceHubId === input.targetHubId) throw new ConflictException('Hub nguồn và đích phải khác nhau.');
    if (!await this.hubs.isHubActiveInTx(tx, input.sourceHubId)) throw new ConflictException('Hub nguồn không phục vụ.');
    const destination = await this.hubs.readArrivalCapacityInTx(tx, input.targetHubId);
    if (!destination?.active || destination.spaces < input.vehicleIds.length) throw new ConflictException('Hub đích không đủ sức chứa.');
    for (const id of input.vehicleIds) {
      const resource = await this.requireResource(tx, 'VEHICLE', id);
      if (resource.hubId !== input.sourceHubId || resource.status !== 'AVAILABLE' || !resource.observedAt ||
          (resource.batteryPercent ?? 0) < 30 || resource.serviceStatus !== 'ACTIVE' || await this.resources.constrained(tx, resource)) {
        throw new ConflictException('Có xe không đủ điều kiện điều chuyển.');
      }
    }
  }

  private async openFault(
    tx: Transaction, resource: Awaited<ReturnType<OperationsService['requireResource']>>, title: string, description: string,
    source: { actorId?: string; requestId?: string; sourceId?: string; eventId?: string },
  ) {
    const existing = await this.store.openIncident(tx, resource.kind, resource.id);
    const trip = resource.kind === 'VEHICLE' ? await this.store.openTrip(tx, resource.id) : null;
    await this.resources.markFault(tx, resource);
    const incident = existing
      ? await this.store.updateIncident(tx, existing.id, existing.status === 'RESOLVED' ? { status: 'IN_PROGRESS', safe: false } : {})
      : await this.store.createIncident(tx, {
        resourceKind: resource.kind, resourceId: resource.id, hubId: resource.hubId ?? trip?.startHubId,
        tripId: trip?.id, reporterId: source.actorId, title, description,
      });
    await this.audit.append(tx, {
      actorId: source.actorId, action: existing ? 'INCIDENT_EVIDENCE_ADDED' : 'INCIDENT_OPENED', targetType: 'incident',
      targetId: incident.id, occurredAt: new Date(), requestId: source.requestId,
      details: { description, sourceId: source.sourceId ?? null, eventId: source.eventId ?? null, resourceId: resource.id },
    });
    return incidentView(incident);
  }

  private async requireResource(tx: Transaction, kind: ResourceKind, id: string) {
    const resource = await this.resources.get(tx, kind, id);
    if (!resource) throw new NotFoundException('Không tìm thấy tài nguyên.');
    return resource;
  }

  private log(
    tx: Transaction, actorId: string, action: string, targetType: string, targetId: string,
    change: ChangeInput, details: Parameters<AuditService['append']>[1]['details'],
  ) {
    return this.audit.append(tx, {
      actorId, action, targetType, targetId, requestId: change.requestId, occurredAt: new Date(),
      details: { ...(details as Record<string, unknown>), reason: change.reason ?? null } as Parameters<AuditService['append']>[1]['details'],
    });
  }
}
