import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { ResourceKind } from '@semh/contracts';
import { change, date, member, number, object, text, uuid, uuidList } from '../../../shared/http/input.js';
import { AccessGuard, Roles, type SessionRequest } from '../../gen/presentation/access.guard.js';
import { OperationsService } from '../application/operations.service.js';
import type { ResourceDraft } from '../infrastructure/prisma-resource-owner.adapter.js';

const kinds: ResourceKind[] = ['HUB', 'VEHICLE', 'PARKING_SPACE', 'CHARGING_POINT'];

function resource(body: Record<string, unknown>): ResourceDraft {
  const kind = member(body.kind, kinds, 'loại tài nguyên');
  const code = text(body.code, 'mã tài nguyên', 32).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]+$/.test(code)) throw new BadRequestException('Mã chỉ gồm chữ, số, dấu gạch ngang hoặc gạch dưới.');
  const base = {
    kind, code, hubId: kind === 'HUB' ? null : uuid(body.hubId, 'Hub'),
    description: body.description == null ? '' : text(body.description, 'mô tả', 400, 0),
  };
  if (kind === 'HUB') return {
    ...base, name: text(body.name, 'tên Hub', 120), latitude: number(body.latitude, 'vĩ độ', -90, 90),
    longitude: number(body.longitude, 'kinh độ', -180, 180), capacity: number(body.capacity, 'sức chứa', 1, 500, true),
    chargeKw: number(body.chargeKw, 'công suất Hub', 0.1, 1500),
  };
  if (kind === 'CHARGING_POINT') return { ...base, connector: text(body.connector, 'đầu nối', 20).toUpperCase(),
    powerKw: number(body.powerKw, 'công suất cổng', 0.05, 200) };
  if (kind === 'VEHICLE') return { ...base, connector: body.connector ? text(body.connector, 'đầu nối', 20).toUpperCase() : 'AC' };
  return base;
}

function plan(body: Record<string, unknown>) {
  const vehicleIds = uuidList(body.vehicleIds, 'xe', 25);
  if (!vehicleIds.length) throw new BadRequestException('Chọn ít nhất một xe.');
  return {
    sourceHubId: uuid(body.sourceHubId, 'Hub nguồn'), targetHubId: uuid(body.targetHubId, 'Hub đích'),
    vehicleIds, scheduledAt: date(body.scheduledAt, 'lịch điều chuyển'),
    recommendationId: body.recommendationId ? uuid(body.recommendationId, 'đề xuất') : null,
  };
}

@Controller('operations')
@UseGuards(AccessGuard)
export class OperationsController {
  constructor(private readonly operations: OperationsService) {}

  @Get()
  @Roles('OPR')
  overview(@Req() req: SessionRequest) {
    return this.operations.dashboard(req.sessionView, 'OPR');
  }

  @Get('maintenance')
  @Roles('MNT')
  maintenance(@Req() req: SessionRequest) {
    return this.operations.dashboard(req.sessionView, 'MNT');
  }

  @Get('catalog')
  @Roles('ADM')
  catalog(@Req() req: SessionRequest) {
    return this.operations.dashboard(req.sessionView, 'ADM');
  }

  @Post('catalog')
  @Roles('ADM')
  createCatalog(@Req() req: SessionRequest, @Body() value: unknown) {
    const body = object(value);
    return this.operations.createResource(req.sessionToken, resource(body), change(body), 'ADM');
  }

  @Post('resources')
  @Roles('OPR')
  createResource(@Req() req: SessionRequest, @Body() value: unknown) {
    const body = object(value);
    return this.operations.createResource(req.sessionToken, resource(body), change(body, true), 'OPR');
  }

  @Patch('resources/:kind/:id')
  @Roles('OPR')
  updateResource(@Req() req: SessionRequest, @Param('kind') kind: string, @Param('id') id: string, @Body() value: unknown) {
    const body = object(value);
    const keys = ['requestId', 'reason', 'version', 'description', 'serviceStatus'];
    if (Object.keys(body).some(key => !keys.includes(key)) || (body.description === undefined) === (body.serviceStatus === undefined)) {
      throw new BadRequestException('Chọn cập nhật mô tả hoặc quyền phục vụ. Không thể đổi Hub, mã hoặc dữ liệu cảm biến.');
    }
    return this.operations.updateResource(req.sessionToken, member(kind, kinds, 'loại tài nguyên'), uuid(id), {
      description: body.description === undefined ? undefined : text(body.description, 'mô tả', 400, 0),
      serviceStatus: body.serviceStatus === undefined ? undefined : member(body.serviceStatus, ['ACTIVE', 'INACTIVE'] as const, 'quyền phục vụ'),
    }, change(body, true, true));
  }

  @Post('incidents')
  @Roles('OPR')
  report(@Req() req: SessionRequest, @Body() value: unknown) {
    const body = object(value);
    return this.operations.reportIncident(req.sessionToken, {
      kind: member(body.kind, kinds, 'loại tài nguyên'), id: uuid(body.resourceId),
      title: text(body.title, 'tiêu đề', 140), description: text(body.description, 'mô tả', 1000),
    }, change(body));
  }

  @Post('trip-faults/:id')
  @Roles('STU')
  tripFault(@Req() req: SessionRequest, @Param('id') id: string, @Body() value: unknown) {
    const body = object(value);
    return this.operations.reportTripFault(req.sessionToken, uuid(id), text(body.description, 'mô tả', 1000), change(body));
  }

  @Patch('incidents/:id')
  @Roles('OPR', 'MNT')
  changeIncident(@Req() req: SessionRequest, @Param('id') id: string, @Body() value: unknown) {
    const body = object(value);
    return this.operations.changeIncident(req.sessionToken, uuid(id), {
      action: member(body.action, ['ACKNOWLEDGE', 'ASSIGN', 'START', 'HANDOVER', 'CONFIRM_HANDOVER', 'RESOLVE', 'CLOSE'], 'thao tác'),
      assigneeId: body.assigneeId ? uuid(body.assigneeId, 'người xử lý') : undefined,
      safetyPassed: typeof body.safetyPassed === 'boolean' ? body.safetyPassed : undefined,
      location: body.location ? text(body.location, 'vị trí bàn giao', 240) : undefined,
      actualHubId: body.actualHubId ? uuid(body.actualHubId, 'Hub tiếp nhận') : undefined,
      severity: body.severity ? member(body.severity, ['LOW', 'MEDIUM', 'HIGH'], 'mức độ') : undefined,
      dueAt: body.dueAt ? date(body.dueAt, 'hạn xử lý') : undefined,
    }, change(body, true, true));
  }

  @Post('plans')
  @Roles('OPR')
  createPlan(@Req() req: SessionRequest, @Body() value: unknown) {
    const body = object(value);
    return this.operations.savePlan(req.sessionToken, plan(body), change(body, true));
  }

  @Patch('plans/:id')
  @Roles('OPR')
  updatePlan(@Req() req: SessionRequest, @Param('id') id: string, @Body() value: unknown) {
    const body = object(value);
    return this.operations.savePlan(req.sessionToken, plan(body), change(body, true, true), uuid(id));
  }

  @Post('plans/:id/actions')
  @Roles('OPR')
  planAction(@Req() req: SessionRequest, @Param('id') id: string, @Body() value: unknown) {
    const body = object(value);
    return this.operations.changePlan(req.sessionToken, uuid(id), {
      action: member(body.action, ['APPROVE', 'DEPART', 'ARRIVE', 'COMPLETE', 'CANCEL'], 'thao tác'),
      vehicleId: body.vehicleId ? uuid(body.vehicleId, 'xe') : undefined,
      actualHubId: body.actualHubId ? uuid(body.actualHubId, 'Hub thực tế') : undefined,
    }, change(body, true, true));
  }
}
