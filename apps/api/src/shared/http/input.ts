import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ChangeInput } from '@semh/contracts';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Dữ liệu không hợp lệ.');
  return value as Record<string, unknown>;
}

export function text(value: unknown, field: string, max = 240, min = 1) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new BadRequestException('Thông tin ' + field + ' không hợp lệ.');
  }
  return value.trim();
}

export function uuid(value: unknown, label = 'mã định danh') {
  if (typeof value !== 'string' || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)) {
    throw new BadRequestException('Sai ' + label + '.');
  }
  return value.toLowerCase();
}

export function number(value: unknown, field: string, min: number, max: number, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new BadRequestException('Giá trị ' + field + ' không hợp lệ.');
  }
  return value;
}

export function date(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.endsWith('Z') || !Number.isFinite(Date.parse(value))) {
    throw new BadRequestException('Thời điểm ' + field + ' không hợp lệ.');
  }
  return new Date(value);
}

export function member<T extends string>(value: unknown, options: readonly T[], field: string): T {
  if (typeof value !== 'string' || !options.includes(value as T)) throw new BadRequestException('Sai ' + field + '.');
  return value as T;
}

export function uuidList(value: unknown, label: string, max = 50) {
  if (!Array.isArray(value) || value.length > max) throw new BadRequestException('Danh sách ' + label + ' không hợp lệ.');
  const ids = Array.from(new Set(value.map(item => uuid(item, label))));
  return ids;
}

export function change(body: Record<string, unknown>, reason = false, version = false): ChangeInput {
  return {
    requestId: uuid(body.requestId, 'mã yêu cầu'),
    reason: reason || body.reason !== undefined ? text(body.reason, 'lý do', 500) : undefined,
    version: version ? number(body.version, 'phiên bản', 0, 2147483647, true) : undefined,
  };
}

export function assertVersion(current: number, version: number | undefined) {
  if (current !== version) throw new ConflictException('Dữ liệu đã thay đổi. Vui lòng tải lại trước khi xác nhận.');
}
