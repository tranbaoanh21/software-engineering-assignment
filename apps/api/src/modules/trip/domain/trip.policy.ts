import { reservationMinimumBatteryPercent } from '@semh/contracts';

export function returnedVehicleStatus(battery: number, needsInspection: boolean) {
  if (needsInspection) return 'OUT_OF_SERVICE';
  return battery < reservationMinimumBatteryPercent ? 'AWAITING_CHARGE' : 'AVAILABLE';
}
