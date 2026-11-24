import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export function createCampusMap(element: HTMLDivElement, options?: L.MapOptions) {
  const map = L.map(element, options).setView([10.885, 106.796], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  const resize = new ResizeObserver(() => map.invalidateSize({ animate: false }));
  resize.observe(element);

  return {
    map,
    destroy() {
      resize.disconnect();
      map.remove();
    },
  };
}
