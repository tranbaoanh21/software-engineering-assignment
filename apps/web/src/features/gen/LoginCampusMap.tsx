import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { NetworkHub } from '@semh/contracts';
import { api } from '../../shared/api/http';
import { createCampusMap } from '../hub/campus-map';

type HubPoint = Pick<NetworkHub, 'name' | 'latitude' | 'longitude'>;

async function showHubs(map: L.Map, signal: AbortSignal) {
  let hubs: HubPoint[];
  try {
    hubs = await api<HubPoint[]>('/network/hubs', { signal });
  } catch {
    // The basemap stays usable when the public Hub feed is unavailable.
    return;
  }

  if (signal.aborted || !hubs.length) return;

  const positions = hubs.map((hub): L.LatLngTuple => {
    const position: L.LatLngTuple = [hub.latitude, hub.longitude];
    const label = document.createElement('span');
    label.textContent = hub.name;
    L.circleMarker(position, {
      radius: 7,
      color: '#fff',
      weight: 2,
      fillColor: '#0f766e',
      fillOpacity: 1,
    }).bindTooltip(label).addTo(map);
    return position;
  });
  map.fitBounds(L.latLngBounds(positions), { padding: [24, 24], maxZoom: 15, animate: false });
}

export default function LoginCampusMap() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    const controller = new AbortController();
    let campus: ReturnType<typeof createCampusMap> | undefined;
    const visibility = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || controller.signal.aborted) return;
      visibility.disconnect();
      campus = createCampusMap(element, { scrollWheelZoom: false });
      void showHubs(campus.map, AbortSignal.any([controller.signal, AbortSignal.timeout(7000)]));
    });
    visibility.observe(element);

    return () => {
      controller.abort();
      visibility.disconnect();
      campus?.destroy();
    };
  }, []);

  return <div className="login-campus-map" ref={container} role="region"
    aria-label="Bản đồ Đại học Quốc gia TP.HCM và các Mobility Hub" />;
}
