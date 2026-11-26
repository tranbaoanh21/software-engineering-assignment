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
  scheduledAt?: Date;
  assigneeId?: string;
  recommendationId: string | null;
}

export interface IncidentAction {
  action: 'ACKNOWLEDGE' | 'ASSIGN' | 'START' | 'RESOLVE' | 'CLOSE';
  assigneeId?: string;
  safetyPassed?: boolean;
  location?: string;
  actualHubId?: string;
  severity?: string;
  dueAt?: Date;
}

export interface PlanAction {
  action: 'ASSIGN' | 'START' | 'REPORT_ARRIVAL' | 'COMPLETE' | 'CANCEL';
  assigneeId?: string;
}

type IncidentDetails = Omit<IncidentView, 'tripInProgress' | 'vehicle' | 'receivingHub'> & {
  receivingHubId: string | null;
};

function incidentDetails(row: Incident): IncidentDetails {
  return {
    ...row, handover: row.handover as IncidentView['handover'], createdAt: row.createdAt.toISOString(),
    dueAt: row.dueAt?.toISOString() ?? null,
  };
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
      const where = mode === 'MNT' ? { assigneeId: actor.accountId } : scope ? { OR: [
        { receivingHubId: { in: scope } },
        { receivingHubId: null, hubId: { in: scope } },
      ] } : {};
      const plans = mode === 'ADM' ? [] : await this.store.plans(tx, mode === 'MNT' ? { assigneeId: actor.accountId }
        : scope ? { sourceHubId: { in: scope }, targetHubId: { in: scope } } : {});
      return {
        hubs,
        incidents: mode === 'ADM' ? [] : await this.incidentViews(tx, (await this.store.incidents(tx, where)).map(incidentDetails)),
        plans: await this.planViews(tx, plans),
        technicians: mode === 'OPR' ? await this.store.technicians(tx) : [],
      };
    });
  }

  private async incidentViews(tx: Transaction, incidents: IncidentDetails[]): Promise<IncidentView[]> {
    const tripIds = [...new Set(incidents.flatMap(incident => incident.tripId ? [incident.tripId] : []))];
    const vehicleIds = [...new Set(incidents.filter(incident => incident.resourceKind === 'VEHICLE').map(incident => incident.resourceId))];
    const receivingHubIds = [...new Set(incidents.flatMap(incident => incident.receivingHubId ? [incident.receivingHubId] : []))];
    const trips = tripIds.length ? await this.store.activeIncidentTrips(tx, tripIds) : [];
    const vehicles = vehicleIds.length ? await this.store.vehiclesByIds(tx, vehicleIds) : [];
    const receivingHubs = receivingHubIds.length ? await this.store.hubNames(tx, receivingHubIds) : [];
    const activeTrips = new Set(trips.map(trip => trip.id));
    const vehicleById = new Map(vehicles.map(({ id, code, hubId }) => [id, { code, hubId }]));
    const receivingHubById = new Map(receivingHubs.map(hub => [hub.id, hub]));
    return incidents.map(({ receivingHubId, ...incident }) => ({
      ...incident,
      receivingHub: receivingHubById.get(receivingHubId ?? '') ?? null,
      reportedLocation: incident.reportedLocation ?? null,
      confirmedLocation: incident.confirmedLocation ?? null,
      tripInProgress: incident.tripId !== null && activeTrips.has(incident.tripId),
      vehicle: vehicleById.get(incident.resourceId) ?? null,
    }));
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
      const incident = await withChange(tx, actor.accountId, 'INCIDENT_REPORTED', change, input, () =>
        this.openFault(tx, resource, input.title, input.description, { actorId: actor.accountId, requestId: change.requestId }));
      return (await this.incidentViews(tx, [incident]))[0];
    });
  }

  reportTripFault(token: string, tripId: string, input: { location: string; description: string }, change: ChangeInput) {
    return this.store.write(async tx => {
      const actor = await this.access.verifyAccess(token, ['STU'], tx);
      return withChange(tx, actor.accountId, 'TRIP_FAULT_REPORTED', change, { tripId, ...input }, async () => {
        const trip = await this.store.studentTrip(tx, tripId, actor.accountId);
        if (!trip) throw new NotFoundException('Không tìm thấy chuyến đang đi của bạn.');
        const resource = await this.requireResource(tx, 'VEHICLE', trip.vehicleId);
        const incident = await this.openFault(tx, resource, 'Xe gặp sự cố trong chuyến', input.description,
          { actorId: actor.accountId, requestId: change.requestId, reportedLocation: input.location });
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
      const isTech = input.action === 'START' || input.action === 'RESOLVE';
      const actor = await this.access.verifyAccess(token, isTech ? ['MNT'] : ['OPR'], tx);
      const row = await this.store.incident(tx, id);
      if (!row) throw new NotFoundException('Không tìm thấy sự cố.');
      if (isTech) {
        if (row.assigneeId !== actor.accountId) throw new ForbiddenException('Sự cố này chưa được giao cho bạn.');
      } else {
        assertOperatorHubs(actor, row.receivingHubId ?? row.hubId);
        if (input.action === 'CLOSE' && input.actualHubId && !row.tripId) assertOperatorHubs(actor, input.actualHubId);
      }

      const incident = await withChange(tx, actor.accountId, 'INCIDENT_CHANGED', change, { id, input }, async () => {
        assertVersion(row.version, change.version);
        const updated = await this.applyIncidentAction(tx, row, actor.accountId, input, change);
        await this.log(tx, actor.accountId, 'INCIDENT_' + input.action, 'incident', id, change,
          { from: row.status, to: updated.status, assigneeId: updated.assigneeId, safe: updated.safe,
            confirmedLocation: updated.confirmedLocation, acceptingHubId: updated.receivingHubId ?? input.actualHubId ?? null });
        return incidentDetails(updated);
      });
      return (await this.incidentViews(tx, [incident]))[0];
    });
  }

  private async applyIncidentAction(tx: Transaction, row: Incident, actorId: string, input: IncidentAction, change: ChangeInput) {
    const { action } = input;
    const { id, status, tripId } = row;
    const tripInProgress = tripId !== null && (action === 'START' || action === 'RESOLVE')
      && (await this.store.activeIncidentTrips(tx, [tripId])).length > 0;

    if (action === 'ACKNOWLEDGE' && status === 'OPEN') {
      return this.store.updateIncident(tx, id, { status: 'ACKNOWLEDGED', severity: input.severity ?? row.severity });
    }
    const canAssign = (status === 'OPEN' && tripId !== null) || ['ACKNOWLEDGED', 'ASSIGNED', 'IN_PROGRESS'].includes(status);
    if (action === 'ASSIGN' && canAssign && input.assigneeId && await this.store.activeTechnician(tx, input.assigneeId)) {
      const confirmedLocation = input.location ?? row.confirmedLocation;
      if (tripId && !confirmedLocation) throw new ConflictException('Xác nhận địa điểm xe bị hư trước khi giao kỹ thuật.');
      return this.store.updateIncident(tx, id, {
        status: 'ASSIGNED', assigneeId: input.assigneeId, dueAt: input.dueAt, confirmedLocation,
      });
    }
    if (action === 'START' && (status === 'ASSIGNED' || (status === 'IN_PROGRESS' && tripInProgress))) {
      if (tripId && tripInProgress) {
        await this.fleet.closeFaultedTrip(tx, tripId, row.resourceId);
        await this.audit.append(tx, {
          actorId, action: 'TRIP_INTERRUPTED', targetType: 'trip', targetId: tripId, occurredAt: new Date(),
          requestId: change.requestId, details: { incidentId: id, vehicleId: row.resourceId, location: row.confirmedLocation },
        });
      }
      return this.store.updateIncident(tx, id, { status: 'IN_PROGRESS' });
    }
    const needsTripDelivery = tripId && status === 'AWAITING_APPROVAL' && !row.receivingHubId && input.safetyPassed;
    if (action === 'RESOLVE' && (status === 'IN_PROGRESS' || needsTripDelivery) && typeof input.safetyPassed === 'boolean') {
      if (tripInProgress) throw new ConflictException('Tiếp nhận xe trước khi xác nhận đã sửa.');
      if (tripId && input.safetyPassed) {
        const hubId = input.actualHubId;
        if (!hubId) throw new ConflictException('Chọn Hub mà bạn đã đưa xe về.');
        const resource = await this.requireResource(tx, 'VEHICLE', row.resourceId);
        if (resource.hubId === hubId) {
          if (!await this.hubs.isHubActiveInTx(tx, hubId)) throw new ConflictException('Hub chưa thể tiếp nhận xe.');
        } else {
          const destination = await this.hubs.readArrivalCapacityInTx(tx, hubId);
          if (!destination?.active || destination.spaces < 1) throw new ConflictException('Hub chưa thể tiếp nhận xe.');
        }
        await this.resources.receiveFaultedVehicle(tx, resource.id, hubId);
      }
      return this.store.updateIncident(tx, id, {
        status: input.safetyPassed ? 'AWAITING_APPROVAL' : 'IN_PROGRESS',
        receivingHubId: tripId && input.safetyPassed ? input.actualHubId : undefined,
        resolution: change.reason ?? null, safe: input.safetyPassed,
      });
    }
    if (action === 'CLOSE' && row.safe && (status === 'AWAITING_APPROVAL' || status === 'RESOLVED')) {
      if (status === 'AWAITING_APPROVAL') {
        const resource = await this.requireResource(tx, row.resourceKind, row.resourceId);
        if (tripId) {
          if (input.actualHubId) throw new ConflictException('Hub tiếp nhận do kỹ thuật xác nhận.');
          if (!row.receivingHubId || resource.hubId !== row.receivingHubId) {
            throw new ConflictException('Kỹ thuật chưa xác nhận xe đã về Hub.');
          }
          if (!await this.hubs.isHubActiveInTx(tx, row.receivingHubId)) {
            throw new ConflictException('Hub tiếp nhận hiện chưa hoạt động.');
          }
        } else if (resource.kind === 'VEHICLE' && !resource.hubId) {
          if (!input.actualHubId) throw new ConflictException('Chọn Hub đã tiếp nhận xe sau sửa chữa.');
          const destination = await this.hubs.readArrivalCapacityInTx(tx, input.actualHubId);
          if (!destination?.active || destination.spaces < 1) throw new ConflictException('Hub chưa thể tiếp nhận xe.');
        }
        await this.resources.restore(tx, resource, input.actualHubId);
      }
      return this.store.updateIncident(tx, id, { status: 'CLOSED' });
    }
    throw new ConflictException('Không thể thực hiện thao tác ở trạng thái sự cố hiện tại.');
  }

  private async planViews(tx: Transaction, plans: StoredPlan[]): Promise<PlanView[]> {
    if (!plans.length) return [];
    const ids = [...new Set(plans.flatMap(plan => plan.items.map(item => item.vehicleId)))];
    const vehicles = await this.store.vehiclesByIds(tx, ids);
    const codes = new Map(vehicles.map(vehicle => [vehicle.id, vehicle.code]));
    return plans.map(({ assignee, items, ...plan }) => ({
      ...plan, scheduledAt: plan.scheduledAt.toISOString(), assigneeName: assignee?.displayName ?? null,
      items: items.map(item => ({ ...item, vehicleCode: codes.get(item.vehicleId) ?? item.vehicleId.slice(0, 8) })),
    }));
  }

  savePlan(token: string, input: PlanInput, change: ChangeInput, id?: string) {
    return this.store.write(async tx => {
      const actor = await this.access.verifyAccess(token, ['OPR'], tx);
      assertOperatorHubs(actor, input.sourceHubId, input.targetHubId);
      return withChange(tx, actor.accountId, 'PLAN_SAVED', change, { id, input }, async () => {
        const previous = id ? await this.store.plan(tx, id) : null;
        if (id && !previous) throw new NotFoundException('Không tìm thấy kế hoạch.');
        if (previous) {
          assertOperatorHubs(actor, previous.sourceHubId, previous.targetHubId);
          assertVersion(previous.version, change.version);
          if (previous.status !== 'DRAFT') throw new ConflictException('Chỉ có thể sửa kế hoạch nháp.');
        }
        await this.checkTransfer(tx, input);
        if (input.assigneeId) await this.requireTechnician(tx, input.assigneeId);

        const data = {
          authorId: actor.accountId, sourceHubId: input.sourceHubId, targetHubId: input.targetHubId,
          scheduledAt: input.scheduledAt ?? previous?.scheduledAt ?? new Date(), reason: change.reason ?? previous?.reason ?? '',
          recommendationId: input.recommendationId,
          assigneeId: input.assigneeId,
          status: input.assigneeId ? 'APPROVED' as const : 'DRAFT' as const,
        };
        const vehicles = input.vehicleIds.map(vehicleId => ({ vehicleId }));
        const row = previous
          ? await this.store.updatePlan(tx, previous.id, { ...data, items: { deleteMany: {}, create: vehicles } })
          : await this.store.createPlan(tx, { ...data, items: { create: vehicles } });
        await this.log(tx, actor.accountId, 'PLAN_SAVED', 'plan', row.id, change, { vehicleIds: input.vehicleIds });
        if (input.assigneeId) {
          for (const item of row.items) await this.fleet.bindTransfer(tx, item.vehicleId, row.id, row.sourceHubId);
          await this.log(tx, actor.accountId, 'PLAN_ASSIGN', 'plan', row.id, change, {
            from: previous?.status ?? null, to: row.status, assigneeId: input.assigneeId,
          });
        }
        return (await this.planViews(tx, [row]))[0]!;
      });
    });
  }

  changePlan(token: string, id: string, input: PlanAction, change: ChangeInput) {
    return this.store.write(async tx => {
      const technicianAction = input.action === 'START' || input.action === 'REPORT_ARRIVAL';
      const actor = await this.access.verifyAccess(token, technicianAction ? ['MNT'] : ['OPR'], tx);
      const row = await this.store.plan(tx, id);
      if (!row) throw new NotFoundException('Không tìm thấy kế hoạch.');
      if (technicianAction) {
        if (row.assigneeId !== actor.accountId) throw new ForbiddenException('Kế hoạch chưa được giao cho bạn.');
      } else {
        assertOperatorHubs(actor, row.sourceHubId, row.targetHubId);
      }
      return withChange(tx, actor.accountId, 'PLAN_CHANGED', change, { id, input }, async () => {
        assertVersion(row.version, change.version);
        const updated = await this.applyPlanAction(tx, row, input);
        await this.log(tx, actor.accountId, 'PLAN_' + input.action, 'plan', id, change, {
          from: row.status, to: updated.status, assigneeId: updated.assigneeId,
          sourceHubId: row.sourceHubId, targetHubId: row.targetHubId, vehicleIds: row.items.map(item => item.vehicleId),
        });
        return (await this.planViews(tx, [updated]))[0]!;
      });
    });
  }

  private async requireTechnician(tx: Transaction, id: string) {
    if (!await this.store.activeTechnician(tx, id)) throw new ConflictException('Chọn kỹ thuật viên đang hoạt động.');
  }

  private async applyPlanAction(tx: Transaction, row: StoredPlan, input: PlanAction) {
    const { id, status, items, sourceHubId, targetHubId } = row;
    const { action } = input;
    const planned = items.filter(item => item.status === 'PLANNED');
    const moving = items.filter(item => item.status === 'DEPARTED');

    if (action === 'ASSIGN' && ['DRAFT', 'APPROVED', 'IN_PROGRESS'].includes(status) && input.assigneeId) {
      await this.requireTechnician(tx, input.assigneeId);
      if (status === 'DRAFT') {
        await this.checkTransfer(tx, { sourceHubId, targetHubId, vehicleIds: items.map(item => item.vehicleId) });
        for (const item of items) await this.fleet.bindTransfer(tx, item.vehicleId, id, sourceHubId);
      } else if (!planned.length && !moving.length) {
        throw new ConflictException('Xe đã đến đích. Xác nhận để hoàn tất kế hoạch.');
      }
      return this.store.updatePlan(tx, id, { status: status === 'DRAFT' ? 'APPROVED' : status, assigneeId: input.assigneeId });
    }
    if (action === 'CANCEL' && ['DRAFT', 'APPROVED', 'IN_PROGRESS'].includes(status)) {
      if (moving.length) throw new ConflictException('Có xe đã rời Hub nguồn. Hãy hoàn tất bàn giao xe.');
      for (const item of planned) {
        if (status !== 'DRAFT') await this.fleet.transfer(tx, item.vehicleId, id, 'CANCEL', sourceHubId);
        await this.store.moveItem(tx, id, item.vehicleId, { status: 'CANCELLED' });
      }
      return this.store.updatePlan(tx, id, { status: 'CANCELLED' });
    }
    if (action === 'START' && ['APPROVED', 'IN_PROGRESS'].includes(status) && planned.length) {
      const departedAt = new Date();
      for (const item of planned) {
        await this.fleet.transfer(tx, item.vehicleId, id, 'DEPART', sourceHubId);
        await this.store.moveItem(tx, id, item.vehicleId, { status: 'DEPARTED', departedAt });
      }
      return this.store.updatePlan(tx, id, { status: 'IN_PROGRESS' });
    }
    if (action === 'REPORT_ARRIVAL' && status === 'IN_PROGRESS' && !planned.length && moving.length) {
      return this.store.updatePlan(tx, id, { status: 'AWAITING_APPROVAL' });
    }
    const alreadyArrived = status === 'IN_PROGRESS' && items.every(item => item.status === 'ARRIVED');
    if (action === 'COMPLETE' && (status === 'AWAITING_APPROVAL' || alreadyArrived)) {
      if (moving.length) {
        const destination = await this.hubs.readArrivalCapacityInTx(tx, targetHubId);
        if (!destination?.active || destination.physicalSpaces < moving.length) {
          throw new ConflictException('Hub đích hiện chưa thể tiếp nhận toàn bộ xe.');
        }
        const arrivedAt = new Date();
        for (const item of moving) {
          await this.fleet.transfer(tx, item.vehicleId, id, 'ARRIVE', targetHubId);
          await this.store.moveItem(tx, id, item.vehicleId, { status: 'ARRIVED', arrivedAt });
        }
      }
      return this.store.updatePlan(tx, id, { status: 'COMPLETED' });
    }
    throw new ConflictException('Thao tác chưa phù hợp với tiến độ điều chuyển hiện tại.');
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
    source: { actorId?: string; requestId?: string; sourceId?: string; eventId?: string; reportedLocation?: string },
  ) {
    const existing = await this.store.openIncident(tx, resource.kind, resource.id);
    const trip = resource.kind === 'VEHICLE' ? await this.store.openTrip(tx, resource.id) : null;
    await this.resources.markFault(tx, resource);
    const reopen = existing?.status === 'RESOLVED' || (existing?.status === 'AWAITING_APPROVAL' && source.sourceId !== undefined);
    const incident = existing
      ? await this.store.updateIncident(tx, existing.id, {
        ...(reopen ? { status: 'IN_PROGRESS', safe: false } : {}),
        description: source.reportedLocation && description ? description : undefined,
        reportedLocation: source.reportedLocation,
      })
      : await this.store.createIncident(tx, {
        resourceKind: resource.kind, resourceId: resource.id, hubId: resource.hubId ?? trip?.startHubId,
        tripId: trip?.id, reporterId: source.actorId, title, description, reportedLocation: source.reportedLocation,
      });
    await this.audit.append(tx, {
      actorId: source.actorId, action: existing ? 'INCIDENT_EVIDENCE_ADDED' : 'INCIDENT_OPENED', targetType: 'incident',
      targetId: incident.id, occurredAt: new Date(), requestId: source.requestId,
      details: { description, location: source.reportedLocation ?? null, sourceId: source.sourceId ?? null,
        eventId: source.eventId ?? null, resourceId: resource.id },
    });
    return incidentDetails(incident);
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
