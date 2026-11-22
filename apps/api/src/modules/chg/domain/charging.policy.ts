import type { ChargingVehicle } from '@semh/contracts';

const minute = 60_000;
export const chargingWindowMs = 24 * 60 * minute;

interface Point {
  id: string;
  connector: string;
  powerKw: number;
}

export interface Slot {
  pointId: string;
  start: number;
  end: number;
  powerKw: number;
}

export function chargingPriority(battery: number | null, neededAt: Date | null, now: Date) {
  return (battery !== null && battery < 20) || (neededAt !== null && neededAt.getTime() <= now.getTime() + 60 * minute) ? 1 : 0;
}

function canFit(pointId: string, start: number, end: number, power: number, cap: number, schedule: Slot[]) {
  const overlaps = schedule.filter(slot => slot.start < end && slot.end > start);
  if (overlaps.some(slot => slot.pointId === pointId)) return false;
  const boundaries = [start, ...overlaps.filter(slot => slot.start > start).map(slot => slot.start)];
  return boundaries.every(at => {
    const sum = overlaps.filter(slot => slot.start <= at && at < slot.end).reduce((acc, slot) => acc + slot.powerKw, power);
    return sum <= cap + 1e-8;
  });
}

export function findChargingSlot(
  vehicle: ChargingVehicle, points: Point[], schedule: Slot[], now: number, deadline: number, cap: number,
): Slot | null {
  const { batteryPercent, batteryKwh, maxChargeKw, connector } = vehicle;
  if (batteryPercent === null || batteryPercent >= 100 || !batteryKwh || !maxChargeKw || !connector || !cap) return null;
  const starts = [...new Set([now, ...schedule.map(slot => slot.end).filter(end => end > now && end < deadline)])]
    .sort((a, b) => a - b);
  for (const start of starts) {
    for (const point of points) {
      const powerKw = Math.min(point.powerKw, maxChargeKw);
      if (connector !== point.connector || powerKw <= 0 || powerKw > cap) continue;
      const duration = Math.ceil(60 * batteryKwh * (1 - batteryPercent / 100) / (0.9 * powerKw)) * minute;
      const end = start + duration;
      if (end <= deadline && canFit(point.id, start, end, powerKw, cap, schedule)) {
        return { pointId: point.id, start, end, powerKw };
      }
    }
  }
  return null;
}
