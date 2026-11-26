import { OperationsPage } from './OperationsPage';

export const opsRoutes = {
  operations: { path: 'dashboard', label: 'Vận hành', element: <OperationsPage key="operator" /> },
  maintenance: { path: 'incidents', label: 'Công việc của tôi', element: <OperationsPage key="maintenance" /> },
  maintenanceTransfers: { path: 'transfers', label: 'Điều chuyển được giao', element: <OperationsPage key="maintenance-transfers" /> },
};
