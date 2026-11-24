import { ParkingPage } from './ParkingPage';
import { PrivateVehiclesPage } from './PrivateVehiclesPage';

export const parkRoute = {
  path: 'parking', label: 'Chỗ đỗ', element: <ParkingPage />,
};

export const privateVehiclesRoute = {
  path: 'vehicles', label: 'Xe cá nhân', element: <PrivateVehiclesPage />,
};
