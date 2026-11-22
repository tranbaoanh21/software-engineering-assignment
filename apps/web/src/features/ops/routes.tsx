import { OperationsPage } from './OperationsPage';

export const opsRoutes = {
  operations: { path: 'dashboard', label: 'Vận hành', element: <OperationsPage key="operator" /> },
  maintenance: { path: 'incidents', label: 'Công việc kỹ thuật', element: <OperationsPage key="maintenance" /> },
};
