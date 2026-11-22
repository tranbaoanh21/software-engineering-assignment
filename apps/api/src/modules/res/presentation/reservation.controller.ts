import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { CreateReservationInput } from '@semh/contracts';
import { AccessGuard, Roles, type SessionRequest } from '../../gen/presentation/access.guard.js';
import { ReservationService } from '../application/reservation.service.js';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function parseInput(body: unknown): CreateReservationInput {
  if (body && typeof body === 'object') {
    const { requestId, vehicleId, hubId } = body as Record<string, unknown>;
    if (
      typeof requestId === 'string' && uuid.test(requestId) &&
      typeof vehicleId === 'string' && uuid.test(vehicleId) &&
      typeof hubId === 'string' && uuid.test(hubId)
    ) {
      return { requestId: requestId.toLowerCase(), vehicleId: vehicleId.toLowerCase(), hubId: hubId.toLowerCase() };
    }
  }
  throw new BadRequestException('Thông tin đặt xe không hợp lệ.');
}

@Controller('reservations')
@UseGuards(AccessGuard)
@Roles('STU')
export class ReservationController {
  constructor(private readonly reservations: ReservationService) {}

  @Post()
  create(@Req() request: SessionRequest, @Body() body: unknown) {
    return this.reservations.createReservation(request.sessionToken, parseInput(body));
  }

  @Get('active')
  async active(@Req() request: SessionRequest) {
    return { reservation: await this.reservations.getActiveReservation(request.sessionView.accountId) };
  }

  @Post(':reservationId/cancel')
  @HttpCode(200)
  cancel(@Req() request: SessionRequest, @Param('reservationId', ParseUUIDPipe) reservationId: string) {
    return this.reservations.cancelReservation(request.sessionToken, reservationId);
  }

  @Get(':reservationId')
  get(@Req() request: SessionRequest, @Param('reservationId', ParseUUIDPipe) reservationId: string) {
    return this.reservations.getReservation(request.sessionView.accountId, reservationId);
  }

  @Get('requests/:requestId')
  result(@Req() request: SessionRequest, @Param('requestId', ParseUUIDPipe) requestId: string) {
    return this.reservations.getChangeResult(request.sessionView.accountId, requestId);
  }
}
