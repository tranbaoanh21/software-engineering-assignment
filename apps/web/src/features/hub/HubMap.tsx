import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { NetworkHub } from '@semh/contracts';
import { createCampusMap } from './campus-map';
import './hub-map.css';

export type Need = 'vehicle' | 'parking' | 'charging';

export const availability = {
  vehicle: { field: 'availableVehicles', label: 'Xe khả dụng' },
  parking: { field: 'availableParking', label: 'Chỗ đỗ trống' },
  charging: { field: 'availableCharging', label: 'Cổng sạc trống' },
} as const;

export function HubMap({ hubs, selected, onSelect, need, searchKey }: {
  hubs: readonly NetworkHub[];
  selected?: string;
  onSelect: (id: string) => void;
  need: Need;
  searchKey: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const fittedSearch = useRef<string | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const campus = createCampusMap(container.current);
    map.current = campus.map;
    fittedSearch.current = null;
    const currentMarkers = markers.current;
    return () => {
      campus.destroy();
      currentMarkers.clear();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const currentMarkers = markers.current;
    const visible = new Set(hubs.map(hub => hub.id));
    for (const [id, marker] of currentMarkers) {
      if (!visible.has(id)) {
        marker.remove();
        currentMarkers.delete(id);
      }
    }
    const metric = availability[need];
    for (const hub of hubs) {
      const position: L.LatLngTuple = [hub.latitude, hub.longitude];
      const count = hub[metric.field];
      const isSelected = hub.id === selected;
      const icon = L.divIcon({
        className: 'hub-pin' + (isSelected ? ' hub-pin-active' : ''),
        html: String(count),
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      const existing = currentMarkers.get(hub.id);
      const marker = existing ?? L.marker(position, { icon }).on('click', () => onSelect(hub.id)).addTo(instance);
      if (existing) marker.setLatLng(position).setIcon(icon);
      marker.setZIndexOffset(isSelected ? 1000 : 0);
      const button = marker.getElement();
      if (button) {
        button.title = hub.name;
        button.setAttribute('aria-label', hub.name + ' · ' + metric.label + ' ' + count);
        button.setAttribute('aria-pressed', String(isSelected));
        button.onkeydown = event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          event.stopPropagation();
          onSelect(hub.id);
        };
      }
      currentMarkers.set(hub.id, marker);
    }
    if (hubs.length && fittedSearch.current !== searchKey) {
      const positions = hubs.map((hub): L.LatLngTuple => [hub.latitude, hub.longitude]);
      instance.fitBounds(L.latLngBounds(positions), { padding: [36, 36], maxZoom: 15 });
      fittedSearch.current = searchKey;
    }
  }, [hubs, selected, onSelect, need, searchKey]);

  useEffect(() => {
    const marker = selected ? markers.current.get(selected) : undefined;
    if (marker) map.current?.panInside(marker.getLatLng(), { padding: [34, 34] });
  }, [selected]);

  return (
    <div className="hub-map-card work-card">
      <div className="hub-map" ref={container} role="region" aria-label="Bản đồ các Hub" />
      <div className="hub-map-legend"><span aria-hidden="true" />{availability[need].label} tại mỗi Hub</div>
    </div>
  );
}

