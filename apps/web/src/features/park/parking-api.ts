import type { CreateParkingReservationInput, ParkingOverview, ParkingReservationView } from '@semh/contracts';
import { api } from '../../shared/api/http';

export type ParkingAction = 'check-in' | 'check-out' | 'cancel';

function post(path: string, token: string, body?: object) {
  return api<ParkingReservationView>('/parking/reservations' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
}

export const parkingApi = {
  overview: (signal: AbortSignal) => api<ParkingOverview>('/parking', { signal }),
  reserve: (input: CreateParkingReservationInput, token: string) => post('', token, input),
  update: (id: string, action: ParkingAction, requestId: string, token: string) =>
    post('/' + id + '/' + action, token, { requestId }),
};
