import { timingSafeEqual } from 'node:crypto';
import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { SETTINGS, type Settings } from '../../config/settings.js';
import { ChargingService } from '../../modules/chg/application/charging.service.js';
import { OperationsService } from '../../modules/ops/application/operations.service.js';
import { member, number as validNumber, uuid as validUuid } from '../../shared/http/input.js';
import { ParkingService } from '../../modules/park/application/parking.service.js';
import { TripJourneyService } from '../../modules/trip/application/trip-journey.service.js';
import { TripService } from '../../modules/trip/application/trip.service.js';

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && uuid.test(value);

@Injectable()
export class StateDataAdapter {
  constructor(
    private readonly trips: TripService,
    private readonly journey: TripJourneyService,
    private readonly parking: ParkingService,
    private readonly charging: ChargingService,
    private readonly operations: OperationsService,
    @Inject(SETTINGS) private readonly settings: Settings,
  ) {}

  listHandoffs(key: string | undefined) {
    this.authorize(key);
    return this.journey.pendingHandoffs(this.settings.iotSourceId);
  }

  listParkingVerifications(key: string | undefined) {
    this.authorize(key);
    return this.parking.pendingVerifications(this.settings.iotSourceId);
  }

  pendingChargingSteps(key: string | undefined) {
    this.authorize(key);
    return this.charging.pendingSteps(this.settings.iotSourceId);
  }

  ingest(key: string | undefined, body: unknown) {
    this.authorize(key);
    if (!body || typeof body !== 'object') throw new BadRequestException('Bản tin không hợp lệ');
    const record = body as Record<string, unknown>;
    const { eventId, sourceId, type, observedAt, fault } = record;
    if (
      sourceId !== this.settings.iotSourceId ||
      typeof eventId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(eventId) ||
      typeof observedAt !== 'string' || !observedAt.endsWith('Z') || !Number.isFinite(Date.parse(observedAt)) || Date.parse(observedAt) > Date.now() + 5000
    ) {
      throw new BadRequestException('Nguồn, mã hoặc thời điểm bản tin không hợp lệ');
    }

    if (type === 'parking.state') {
      const { spaceId, verificationId, occupied, privateVehicleId } = record;
      if (
        !isUuid(spaceId) || (verificationId !== null && !isUuid(verificationId)) ||
        (privateVehicleId !== null && !isUuid(privateVehicleId)) ||
        (occupied !== null && typeof occupied !== 'boolean') || typeof fault !== 'boolean' ||
        (occupied !== true && privateVehicleId !== null)
      ) {
        throw new BadRequestException('Bản tin trạng thái chỗ đỗ không hợp lệ');
      }
      return this.parking.applyParkingStateEvent({
        type, eventId, sourceId, observedAt, fault, occupied, spaceId: spaceId.toLowerCase(),
        verificationId: verificationId?.toLowerCase() ?? null, privateVehicleId: privateVehicleId?.toLowerCase() ?? null,
      }, tx => this.operations.reportVerifiedFaultInTx(tx, 'PARKING_SPACE', spaceId.toLowerCase(), sourceId, eventId));
    }

    if (type === 'charging.state') {
      const pointId = validUuid(record.pointId, 'cổng sạc');
      const phase = member(record.phase, ['READY', 'STARTED', 'PROGRESS', 'COMPLETED', 'RELEASED', 'FAULT'] as const, 'mốc sạc');
      return this.charging.applyEvent({
        type, eventId, sourceId, observedAt, phase, pointId,
        sessionId: record.sessionId === null ? null : validUuid(record.sessionId, 'phiên sạc'),
        batteryPercent: record.batteryPercent === null ? null : validNumber(record.batteryPercent, 'pin', 0, 100, true),
      }, tx => this.operations.reportVerifiedFaultInTx(tx, 'CHARGING_POINT', pointId, sourceId, eventId));
    }

    if (type === 'resource.state') {
      if (typeof fault !== 'boolean') throw new BadRequestException('Trạng thái lỗi không hợp lệ.');
      return this.operations.applyResourceEvent({
        type, eventId, sourceId, observedAt, fault,
        resourceKind: member(record.resourceKind, ['HUB', 'VEHICLE'], 'loại tài nguyên'),
        resourceId: validUuid(record.resourceId),
        batteryPercent: record.batteryPercent === null ? null : validNumber(record.batteryPercent, 'pin', 0, 100, true),
        sinceMaintenanceKm: record.sinceMaintenanceKm === undefined ? undefined
          : validNumber(record.sinceMaintenanceKm, 'quãng đường bảo dưỡng', 0, 1000000),
      });
    }

    const { vehicleId, sequence, batteryPercent, commandId, hubId, confirmed } = record;
    if (!isUuid(vehicleId) || typeof batteryPercent !== 'number' ||
      !Number.isInteger(batteryPercent) || batteryPercent < 0 || batteryPercent > 100) {
      throw new BadRequestException('Bản tin trạng thái xe không hợp lệ');
    }
    if (type === 'vehicle.handoff') {
      if (!isUuid(commandId) || !isUuid(hubId) || typeof confirmed !== 'boolean' || typeof fault !== 'boolean') {
        throw new BadRequestException('Bằng chứng bàn giao không hợp lệ');
      }
      return this.journey.applyHandoff({
        eventId, sourceId, type, vehicleId: vehicleId.toLowerCase(), commandId: commandId.toLowerCase(),
        hubId: hubId.toLowerCase(), batteryPercent, observedAt, confirmed, fault,
      }, tx => this.operations.reportVerifiedFaultInTx(tx, 'VEHICLE', vehicleId.toLowerCase(), sourceId, eventId));
    }

    if (type !== 'vehicle.battery' || typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence < 1 || sequence > 2147483647) {
      throw new BadRequestException('Bản tin trạng thái pin không hợp lệ');
    }
    return this.trips.applyVehicleStateEvent({ eventId, sourceId, type, vehicleId, sequence, batteryPercent, observedAt });
  }

  private authorize(key: string | undefined) {
    const expected = Buffer.from(this.settings.iotSourceKey);
    const candidate = Buffer.from(key ?? '');
    if (expected.length !== candidate.length || !timingSafeEqual(expected, candidate)) {
      throw new UnauthorizedException('Khóa nguồn IoT không hợp lệ');
    }
  }
}
