export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, { ...options, credentials: 'same-origin' });
  if (!response.ok) {
    const body: { message?: unknown } = await response.json().catch(() => ({}));
    throw new ApiError(response.status, typeof body.message === 'string' ? body.message : 'Yêu cầu thất bại');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
