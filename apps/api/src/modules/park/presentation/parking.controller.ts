import {
  BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, UseGuards,
} from '@nestjs/common';
import { number, object, text } from '../../../shared/http/input.js';
import { AccessGuard, Roles, type SessionRequest } from '../../gen/presentation/access.guard.js';
import { ParkingService } from '../application/parking.service.js';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
function id(value: unknown) {
  if (typeof value !== 'string' || !uuid.test(value)) throw new BadRequestException('Thông tin đặt chỗ đỗ không hợp lệ.');
  return value.toLowerCase();
}

@Controller('parking')
@UseGuards(AccessGuard)
@Roles('STU')
export class ParkingController {
  constructor(private readonly parking: ParkingService) {}

  @Get()
  overview(@Req() request: SessionRequest) {
    return this.parking.overview(request.sessionView.accountId);
  }

  @Post('vehicles')
  registerVehicle(@Req() request: SessionRequest, @Body() body: unknown) {
    const input = object(body);
    const plate = text(input.plate, 'biển số', 24).toUpperCase().replace(/[\s.-]/g, '');
    if (!/^[A-Z0-9]{5,12}$/.test(plate) || !/\d/.test(plate)) {
      throw new BadRequestException('Biển số phải có 5–12 chữ cái hoặc chữ số, gồm ít nhất một chữ số.');
    }
    const batteryPercent = input.batteryPercent == null ? null : number(input.batteryPercent, 'mức pin', 0, 100, true);
    return this.parking.registerVehicle(request.sessionToken, { plate, batteryPercent });
  }

  @Post('reservations')
  create(@Req() request: SessionRequest, @Body() body: unknown) {
    const input = body as Record<string, unknown> | null | undefined;
    return this.parking.createReservation(request.sessionToken, {
      requestId: id(input?.requestId), hubId: id(input?.hubId), privateVehicleId: id(input?.privateVehicleId),
    });
  }

  @Post('reservations/:reservationId/cancel')
  @HttpCode(200)
  cancel(@Req() request: SessionRequest, @Param('reservationId', ParseUUIDPipe) reservationId: string) {
    return this.parking.cancelReservation(request.sessionToken, reservationId.toLowerCase());
  }

  @Post('reservations/:reservationId/check-in')
  @HttpCode(200)
  checkIn(
    @Req() request: SessionRequest, @Param('reservationId', ParseUUIDPipe) reservationId: string, @Body('requestId') requestId: unknown,
  ) {
    return this.parking.requestVerification(request.sessionToken, reservationId.toLowerCase(), 'CHECK_IN', id(requestId));
  }

  @Post('reservations/:reservationId/check-out')
  @HttpCode(200)
  checkOut(
    @Req() request: SessionRequest, @Param('reservationId', ParseUUIDPipe) reservationId: string, @Body('requestId') requestId: unknown,
  ) {
    return this.parking.requestVerification(request.sessionToken, reservationId.toLowerCase(), 'CHECK_OUT', id(requestId));
  }
}
