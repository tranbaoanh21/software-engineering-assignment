import { BadRequestException, Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { change, member, number, object, text, uuid, uuidList } from '../../../shared/http/input.js';
import { AccessGuard, Roles, type SessionRequest } from '../../gen/presentation/access.guard.js';
import { SimulationService, type ScenarioInput } from '../application/simulation.service.js';

function scenario(body: Record<string, unknown>): ScenarioInput {
  const p = object(body.parameters);
  const hubIds = uuidList(body.hubIds, 'Hub', 25);
  if (!hubIds.length) throw new BadRequestException('Chọn ít nhất một Hub.');
  const closedHubId = p.closedHubId ? uuid(p.closedHubId) : null;
  if (closedHubId && !hubIds.includes(closedHubId)) throw new BadRequestException('Hub tạm ngừng phải nằm trong phạm vi mô phỏng.');
  const raw = p.override == null ? null : object(p.override);
  const override = raw ? {
    hubId: uuid(raw.hubId, 'Hub điều chỉnh'),
    fleetCapacity: raw.fleetCapacity == null ? undefined : number(raw.fleetCapacity, 'sức chứa xe', 0, 500, true),
    parkingCapacity: raw.parkingCapacity == null ? undefined : number(raw.parkingCapacity, 'sức chứa chỗ đỗ', 0, 500, true),
    chargingCapacity: raw.chargingCapacity == null ? undefined : number(raw.chargingCapacity, 'số cổng', 0, 500, true),
    chargeKw: raw.chargeKw == null ? undefined : number(raw.chargeKw, 'công suất sạc', 0, 1500),
  } : undefined;
  if (override && !hubIds.includes(override.hubId)) throw new BadRequestException('Hub điều chỉnh phải nằm trong phạm vi.');
  return {
    name: text(body.name, 'tên kịch bản', 120), hubIds,
    objective: body.objective === undefined ? '' : text(body.objective, 'mục tiêu', 400, 0),
    parameters: {
      durationMinutes: number(p.durationMinutes, 'thời lượng', 1, 240, true),
      demandMultiplier: number(p.demandMultiplier, 'hệ số nhu cầu', 0, 3),
      demandProfile: member(p.demandProfile, ['REGULAR', 'PEAK'], 'mẫu nhu cầu'),
      snapshotRunId: p.snapshotRunId == null ? undefined : uuid(p.snapshotRunId, 'mốc dữ liệu'),
      chargingReduction: number(p.chargingReduction, 'mức giảm công suất sạc', 0, 100, true), closedHubId,
      override, pausedResourceIds: p.pausedResourceIds === undefined ? [] : uuidList(p.pausedResourceIds, 'tài nguyên', 150),
    },
  };
}

@Controller('simulations')
@UseGuards(AccessGuard)
@Roles('OPR')
export class SimulationController {
  constructor(private readonly simulation: SimulationService) {}

  @Get()
  overview(@Req() req: SessionRequest) {
    return this.simulation.overview(req.sessionView);
  }

  @Post('scenarios')
  create(@Req() req: SessionRequest, @Body() data: unknown) {
    const body = object(data);
    return this.simulation.save(req.sessionToken, scenario(body), change(body));
  }

  @Patch('scenarios/:id')
  update(@Req() req: SessionRequest, @Param('id') id: string, @Body() data: unknown) {
    const body = object(data);
    return this.simulation.save(req.sessionToken, scenario(body), change(body, false, true), uuid(id));
  }

  @Post('scenarios/:id/runs')
  @HttpCode(202)
  start(@Req() req: SessionRequest, @Param('id') id: string, @Body() data: unknown) {
    const body = object(data);
    const sourceRunId = body.sourceRunId === undefined ? undefined : body.sourceRunId ? uuid(body.sourceRunId) : null;
    return this.simulation.start(req.sessionToken, uuid(id), sourceRunId, change(body, false, true));
  }

  @Get('runs/:id')
  result(@Req() req: SessionRequest, @Param('id') id: string) {
    return this.simulation.result(req.sessionView, uuid(id));
  }

  @Post('runs/:id/recommendations/:recommendationId/approve')
  approveTransfer(@Req() req: SessionRequest, @Param('id') id: string, @Param('recommendationId') recommendationId: string, @Body() data: unknown) {
    const body = object(data);
    return this.simulation.approveTransfer(
      req.sessionToken, uuid(id), uuid(recommendationId), uuid(body.assigneeId, 'kỹ thuật viên'), change(body),
    );
  }

  @Get('runs/:id/recommendations/:recommendationId/draft')
  prepare(@Req() req: SessionRequest, @Param('id') id: string, @Param('recommendationId') recommendationId: string) {
    return this.simulation.prepare(req.sessionView, uuid(id), uuid(recommendationId));
  }
}
