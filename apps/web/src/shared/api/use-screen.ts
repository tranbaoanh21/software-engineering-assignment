import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SessionContext } from '../auth/session-context';
import { api, ApiError } from './http';

export function useScreen<T>(path: string, interval = 0) {
  const [response, setResponse] = useState<{ path: string; data: T }>();
  const [failure, setFailure] = useState<{ path: string; message: string }>();
  const reload = useRef<(() => void) | undefined>(undefined);
  const refresh = useCallback(() => reload.current?.(), []);

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    let timer: number | undefined;
    let fetching = false;
    let queued = false;
    async function read() {
      if (fetching) {
        queued = true;
        return;
      }
      window.clearTimeout(timer);
      fetching = true;
      try {
        const result = await api<T>(path, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(7000)]) });
        if (controller.signal.aborted) return;
        setResponse({ path, data: result });
        setFailure(undefined);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) window.location.assign('/login');
        else setFailure({ path, message: err instanceof ApiError ? err.message : 'Chưa tải được dữ liệu.' });
      } finally {
        fetching = false;
        if (!controller.signal.aborted) {
          if (queued) {
            queued = false;
            void read();
          } else if (interval) timer = window.setTimeout(read, interval);
        }
      }
    }
    reload.current = () => { void read(); };
    void read();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      reload.current = undefined;
    };
  }, [path, interval]);
  return {
    data: response?.path === path ? response.data : undefined,
    error: failure?.path === path ? failure.message : '',
    refresh,
  };
}

export function useCommand(refresh?: () => void) {
  const session = useContext(SessionContext);
  const busyRef = useRef(false);
  const attempt = useRef<{ key: string; id: string }>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function send<T>(path: string, body: object, method = 'POST', receipt = true): Promise<T | undefined> {
    if (!session || busyRef.current) return;
    setError('');
    busyRef.current = true;
    setPending(true);
    const key = method + path + JSON.stringify(body);
    if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID() };
    try {
      const result = await api<T>(path, {
        method, headers: { 'content-type': 'application/json', 'x-csrf-token': session.csrfToken },
        body: JSON.stringify(receipt ? { ...body, requestId: attempt.current.id } : body), signal: AbortSignal.timeout(10_000),
      });
      attempt.current = null;
      if (receipt) refresh?.();
      return result;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) window.location.assign('/login');
      if (err instanceof ApiError && err.status < 500) attempt.current = null;
      if (err instanceof ApiError && err.status === 409) refresh?.();
      setError(err instanceof ApiError ? err.message : 'Chưa có phản hồi. Thử lại để xem kết quả.');
    } finally {
      busyRef.current = false;
      setPending(false);
    }
  }

  return { send, pending, error };
}

export function field(form: FormData, name: string) {
  return String(form.get(name) ?? '').trim();
}

export const displayTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
