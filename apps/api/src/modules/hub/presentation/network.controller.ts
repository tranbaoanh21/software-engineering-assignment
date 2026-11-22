import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { member, number, uuid } from '../../../shared/http/input.js';
import { NetworkReader } from '../application/network-reader.port.js';

function kilometers(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(Math.min(1, value)));
}

@Controller('network/hubs')
export class NetworkController {
  constructor(private readonly network: NetworkReader) {}

  @Get()
  async list(
    @Query('latitude') latitude?: string, @Query('longitude') longitude?: string, @Query('radiusKm') radiusKm?: string,
    @Query('need') need?: string, @Query('alternativeFor') alternativeFor?: string, @Query('q') q?: string,
  ) {
    const needs = need ? member(need, ['vehicle', 'parking', 'charging'], 'nhu cầu') : null;
    const snapshot = await this.network.snapshot();
    const origin = alternativeFor ? snapshot.find(hub => hub.id === uuid(alternativeFor, 'Hub ban đầu')) : undefined;
    if (alternativeFor && !origin) throw new BadRequestException('Không tìm thấy Hub ban đầu.');
    if ((latitude === undefined) !== (longitude === undefined)) throw new BadRequestException('Cần cả vĩ độ và kinh độ.');
    const reference = origin ?? (latitude === undefined ? null : {
      latitude: number(Number(latitude), 'vĩ độ', -90, 90),
      longitude: number(Number(longitude), 'kinh độ', -180, 180),
    });
    const radius = radiusKm === undefined ? Infinity : number(Number(radiusKm), 'bán kính', 0.1, 80);
    if (!reference && Number.isFinite(radius)) throw new BadRequestException('Cần vị trí để lọc theo bán kính.');
    const matches = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('vi');
    if (q !== undefined && typeof q !== 'string') throw new BadRequestException('Từ khóa không hợp lệ.');
    const query = matches(q?.trim() ?? '');
    const filtered = snapshot
      .filter(hub => hub.id !== origin?.id && (!query || matches(hub.name + ' ' + hub.code).includes(query)))
      .filter(hub => !needs || ({ vehicle: hub.availableVehicles, parking: hub.availableParking, charging: hub.availableCharging }[needs]) > 0)
      .map(hub => ({ ...hub, distanceKm: reference ? kilometers(reference, hub) : null }))
      .filter(hub => hub.distanceKm === null || hub.distanceKm <= radius);
    return reference ? filtered.sort((a, b) => a.distanceKm! - b.distanceKm!) : filtered;
  }
}
