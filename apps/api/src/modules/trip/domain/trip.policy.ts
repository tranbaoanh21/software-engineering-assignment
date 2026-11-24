import { reservationMinimumBatteryPercent } from '@semh/contracts';

export function returnedVehicleStatus(battery: number, needsInspection: boolean): 'OUT_OF_SERVICE' | 'AWAITING_CHARGE' | 'AVAILABLE' {
  if (needsInspection) return 'OUT_OF_SERVICE';
  return battery < reservationMinimumBatteryPercent ? 'AWAITING_CHARGE' : 'AVAILABLE';
}
