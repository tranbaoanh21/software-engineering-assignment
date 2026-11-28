import { reservationMinimumBatteryPercent, type NetworkResource } from '@semh/contracts';

export function canChargeLowBattery(vehicle: NetworkResource) {
  return vehicle.kind === 'VEHICLE' && vehicle.serviceStatus === 'ACTIVE' && !!vehicle.observedAt &&
    (vehicle.status === 'AWAITING_CHARGE' || vehicle.status === 'AVAILABLE') &&
    vehicle.batteryPercent !== undefined && vehicle.batteryPercent < reservationMinimumBatteryPercent;
}

export function lowBatteryChargePath(vehicleId: string) {
  return '/charging/shared-vehicles/' + vehicleId + '/charge';
}
