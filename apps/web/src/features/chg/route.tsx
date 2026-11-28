import { ChargingPage } from './ChargingPage';
import { MaintenanceChargingPage } from './MaintenanceChargingPage';

export const chgRoute = { path: 'charging', label: 'Sạc', element: <ChargingPage /> };
export const maintenanceChgRoute = { path: 'charging', label: 'Việc sạc xe', element: <MaintenanceChargingPage /> };
