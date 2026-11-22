import { parkingHoldMinutes, type ParkingReservationStatus, type ParkingVerificationKind } from '@semh/contracts';

export const parkingVerificationTimeoutMs = 90_000;

export function parkingExpiry(now: Date) {
  return new Date(now.getTime() + parkingHoldMinutes * 60_000);
}

export function requiredStatus(kind: ParkingVerificationKind) {
  return kind === 'CHECK_IN' ? 'CONFIRMED' : 'CHECKED_IN';
}

export function parkingSpaceStatus(
  reading: { occupied: boolean | null; fault: boolean; lastObservedAt: Date | null },
  activeHold?: ParkingReservationStatus,
) {
  if (reading.fault || reading.occupied === null || !reading.lastObservedAt) return 'OUT_OF_SERVICE';
  if (activeHold === 'CHECKED_IN') return 'OCCUPIED';
  if (activeHold === 'CONFIRMED') return 'RESERVED';
  return reading.occupied ? 'OCCUPIED' : 'AVAILABLE';
}
