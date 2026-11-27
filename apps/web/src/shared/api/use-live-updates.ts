import { useEffect, useEffectEvent, useState } from 'react';
import type { LiveTopic } from '@semh/contracts';

export function useLiveUpdates(
  topics: readonly LiveTopic[] | undefined, refresh: () => void, hubId?: string,
) {
  const notify = useEffectEvent(refresh);
  const [connectedTo, setConnectedTo] = useState('');
  const query = topics?.length ? new URLSearchParams({ topics: topics.join(','), ...(hubId ? { hub: hubId } : {}) }).toString() : '';

  useEffect(() => {
    if (!query) return;
    let socket: WebSocket | undefined;
    let reconnect: number | undefined;
    let update: number | undefined;
    let delay = 1000;
    let stopped = false;

    function scheduleRefresh() {
      if (update !== undefined) return;
      update = window.setTimeout(() => {
        update = undefined;
        if (!stopped) notify();
      }, 150);
    }

    function connect() {
      const url = new URL('/api/live?' + query, window.location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      socket = new WebSocket(url);
      socket.onopen = () => {
        if (stopped) return;
        delay = 1000;
        setConnectedTo(query);
        scheduleRefresh();
      };
      socket.onmessage = event => {
        if (event.data === '{"type":"changed"}') scheduleRefresh();
      };
      socket.onclose = () => {
        if (stopped) return;
        setConnectedTo('');
        reconnect = window.setTimeout(connect, delay);
        delay = Math.min(delay * 2, 15000);
      };
    }

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(update);
      window.clearTimeout(reconnect);
      socket?.close();
    };
  }, [query]);

  return !!query && connectedTo === query;
}
