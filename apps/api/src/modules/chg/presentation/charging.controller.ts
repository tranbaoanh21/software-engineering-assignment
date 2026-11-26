import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { change, date, member, number, object, uuid } from '../../../shared/http/input.js';
import { AccessGuard, Roles, type SessionRequest } from '../../gen/presentation/access.guard.js';
import { ChargingService } from '../application/charging.service.js';

function input(body: Record<string, unknown>) {
  return {
    kind: member(body.kind, ['PRIVATE', 'SHARED'], 'loại xe'), vehicleId: uuid(body.vehicleId, 'mã xe'),
    hubId: uuid(body.hubId, 'mã Hub'), desiredBy: body.desiredBy ? date(body.desiredBy, 'giờ hoàn tất') : null,
    neededAt: body.neededAt ? date(body.neededAt, 'giờ cần xe') : null,
  };
}

@Controller('charging')
@UseGuards(AccessGuard)
export class ChargingController {
  constructor(private readonly charging: ChargingService) {}

  @Get()
  @Roles('STU', 'OPR')
  overview(@Req() req: SessionRequest, @Query('mode') mode?: string) {
    return this.charging.overview(req.sessionView, mode === 'OPR' && req.sessionView.roles.includes('OPR') ? 'OPR' : 'STU');
  }

  @Post('vehicles/:id/demo-low-battery')
  @Roles('STU')
  simulateLowBattery(@Req() req: SessionRequest, @Param('id') id: string, @Body() data: unknown) {
    return this.charging.simulateLowBattery(req.sessionToken, uuid(id, 'mã xe'), change(object(data)));
  }

  @Post('preview')
  @Roles('STU', 'OPR')
  preview(@Req() req: SessionRequest, @Body() data: unknown) {
    return this.charging.preview(req.sessionView, input(object(data)));
  }

  @Post('requests')
  @Roles('STU', 'OPR')
  create(@Req() req: SessionRequest, @Body() data: unknown) {
    const body = object(data);
    return this.charging.create(req.sessionToken, input(body), change(body));
  }

  @Patch('requests/:id')
  @Roles('OPR')
  adjust(@Req() req: SessionRequest, @Param('id') id: string, @Body() data: unknown) {
    const body = object(data);
    return this.charging.adjust(
      req.sessionToken, uuid(id), body.rank == null ? null : number(body.rank, 'thứ tự', 1, 999, true),
      body.pointId ? uuid(body.pointId, 'mã cổng') : null, change(body, true, true),
    );
  }
}
