type MetricIconName =
  | 'vehicle' | 'parking' | 'charging' | 'alert'
  | 'reservation' | 'trip' | 'scheduled' | 'pending' | 'interrupted'
  | 'served' | 'shortage' | 'hub' | 'recommendation' | 'battery' | 'capacity';

export function MetricIcon({ name }: { name: MetricIconName }) {
  return <svg className="metric-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <use href={'/design/metrics.svg#' + name} />
  </svg>;
}
