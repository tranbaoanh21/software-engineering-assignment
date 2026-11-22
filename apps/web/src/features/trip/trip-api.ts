import type { PickupInput, ReturnTripInput, TripHandoffView, TripView } from '@semh/contracts';
import { api } from '../../shared/api/http';

function submit(path: string, body: PickupInput | ReturnTripInput, csrf: string) {
  return api<TripHandoffView>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
}

export const tripApi = {
  list: (signal?: AbortSignal) => api<TripView[]>('/trips', { signal }),
  pickup: (input: PickupInput, csrf: string) => submit('/trips/pickups', input, csrf),
  returnVehicle: (tripId: string, input: ReturnTripInput, csrf: string) =>
    submit('/trips/' + tripId + '/return', input, csrf),
  handoff: (id: string, signal: AbortSignal) => api<TripHandoffView>('/trips/handoffs/' + id, { signal }),
};
