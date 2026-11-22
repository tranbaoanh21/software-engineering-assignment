import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AccessGuard, Roles, type SessionRequest } from '../../gen/presentation/access.guard.js';
import { TripJourneyService } from '../application/trip-journey.service.js';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function readUuid(body: unknown, name: string) {
  const value = body && typeof body === 'object' ? (body as Record<string, unknown>)[name] : null;
  if (typeof value !== 'string' || !uuid.test(value)) throw new BadRequestException('Thông tin chuyến đi không hợp lệ.');
  return value.toLowerCase();
}

@Controller('trips')
@UseGuards(AccessGuard)
@Roles('STU')
export class TripController {
  constructor(private readonly trips: TripJourneyService) {}

  @Get()
  list(@Req() request: SessionRequest) {
    return this.trips.listTrips(request.sessionView.accountId);
  }

  @Post('pickups')
  @HttpCode(202)
  pickup(@Req() request: SessionRequest, @Body() body: unknown) {
    const code = body && typeof body === 'object' && 'vehicleCode' in body && typeof body.vehicleCode === 'string'
      ? body.vehicleCode.trim().toUpperCase() : '';
    if (!/^[A-Z0-9_-]{1,80}$/.test(code)) throw new BadRequestException('Vui lòng nhập đúng mã xe.');
    return this.trips.requestPickup(request.sessionToken, {
      reservationId: readUuid(body, 'reservationId'), requestId: readUuid(body, 'requestId'), vehicleCode: code,
    });
  }

  @Post(':tripId/return')
  @HttpCode(202)
  returnVehicle(@Req() request: SessionRequest, @Param('tripId', ParseUUIDPipe) tripId: string, @Body() body: unknown) {
    return this.trips.requestReturn(request.sessionToken, tripId, {
      hubId: readUuid(body, 'hubId'), requestId: readUuid(body, 'requestId'),
    });
  }

  @Get('handoffs/:id')
  handoff(@Req() request: SessionRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.trips.getHandoff(request.sessionView.accountId, id);
  }
}
