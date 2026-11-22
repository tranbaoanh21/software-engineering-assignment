import { reservationHoldMinutes, reservationMinimumBatteryPercent } from '@semh/contracts';
import type { VehicleForReservation } from '../../trip/application/vehicle-hold.port.js';

export function reservationExpiry(confirmedAt: Date) {
  return new Date(confirmedAt.getTime() + reservationHoldMinutes * 60_000);
}

export function vehicleBookingIssue(vehicle: VehicleForReservation, hubId: string) {
  if (vehicle.hubId !== hubId) return 'Xe hiện không ở Hub đã chọn.';
  if (vehicle.serviceStatus !== 'ACTIVE' || (vehicle.hub?.serviceStatus !== 'ACTIVE' || vehicle.hub.fault)) {
    return 'Xe hoặc Hub đã ngừng phục vụ.';
  }
  if (vehicle.status !== 'AVAILABLE' || vehicle.reservationHoldId || vehicle.transferPlanId) return 'Xe vừa được giữ hoặc hiện không khả dụng.';
  if (vehicle.batteryPercent < reservationMinimumBatteryPercent) {
    return 'Xe cần ít nhất ' + reservationMinimumBatteryPercent + '% pin để đặt.';
  }
  return null;
}
