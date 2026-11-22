import type { SessionView } from '@semh/contracts';
import { api } from '../../shared/api/http';

export const authApi = {
  me: (signal?: AbortSignal) => api<SessionView>('/auth/me', { signal }),
  login: (username: string, password: string) => api<SessionView>('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }),
  register: (input: { username: string; displayName: string; password: string }) => api<{ username: string }>('/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(10000),
  }),
  logout: (csrfToken: string) => api<void>('/auth/logout', {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken },
  }),
};
