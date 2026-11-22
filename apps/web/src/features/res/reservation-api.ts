import type { CreateReservationInput, ReservationView } from '@semh/contracts';
import { api } from '../../shared/api/http';

export const reservationApi = {
  active: (signal?: AbortSignal) =>
    api<{ reservation: ReservationView | null }>('/reservations/active', { signal }),
  result: (requestId: string, signal?: AbortSignal) =>
    api<ReservationView>('/reservations/requests/' + requestId, { signal }),
  read: (id: string, signal?: AbortSignal) =>
    api<ReservationView>('/reservations/' + id, { signal }),
  cancel: (id: string, csrfToken: string) =>
    api<ReservationView>('/reservations/' + id + '/cancel', {
      method: 'POST',
      headers: { 'x-csrf-token': csrfToken },
      signal: AbortSignal.timeout(8000),
    }),
  create: (input: CreateReservationInput, csrfToken: string) =>
    api<ReservationView>('/reservations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(10_000),
    }),
};
