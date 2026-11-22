import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router';
import type { NetworkHub } from '@semh/contracts';
import { PageBanner } from '../../shared/ui/PageBanner';
import { stateLabel } from './ResourceCatalog';
import './operations.css';

const NetworkMap = lazy(async () => ({ default: (await import('../hub/HubMap')).HubMap }));

type Alert = NetworkHub['alerts'][number];
const alertLabels: Record<Alert, string> = { LOW_FLEET: 'Thiếu xe', NEAR_CAPACITY: 'Gần đầy' };

export function OperationsOverview({ hubs, refresh }: { hubs: NetworkHub[]; refresh: () => void }) {
  const [filter, setFilter] = useState<Alert | 'flagged' | 'all'>('all');
  const [selectedHub, setSelectedHub] = useState<string>();
  const vehicles = hubs.reduce((total, hub) => total + hub.availableVehicles, 0);
  const parking = hubs.reduce((total, hub) => total + hub.availableParking, 0);
  const chargingPoints = hubs.flatMap(hub => hub.resources.filter(resource => resource.kind === 'CHARGING_POINT'));
  const charging = chargingPoints.filter(point => point.status === 'CHARGING').length;
  const flaggedHubs = hubs.filter(hub => hub.alerts.length > 0);
  const chartMaximum = Math.max(1, ...hubs.map(hub => hub.availableVehicles));
  const visible = hubs.filter(hub => filter === 'all' ||
    (filter === 'flagged' ? hub.alerts.length > 0 : hub.alerts.includes(filter)));

  return <div className="operations-overview">
    <PageBanner title="Mạng lưới Mobility Hub" actions={<>
      <Link className="outline" to="?tab=resources">Quản lý tài nguyên</Link>
      <Link className="outline" to="/operations/simulation">Chạy mô phỏng</Link>
    </>} />
    <dl className="operations-metrics">
      <div className="work-card operations-metric tinted-panel" data-tone="info">
        <dt>Xe sẵn sàng</dt><dd>{vehicles}<small>trên {hubs.reduce((total, hub) => total + hub.vehicleCount, 0)} xe tại các Hub</small></dd>
      </div>
      <div className="work-card operations-metric tinted-panel" data-tone="success">
        <dt>Chỗ đỗ cá nhân trống</dt><dd>{parking}<small>trên {hubs.reduce((total, hub) => total + hub.parkingCount, 0)} chỗ đỗ</small></dd>
      </div>
      <div className="work-card operations-metric tinted-panel" data-tone="aqua">
        <dt>Cổng đang sạc</dt><dd>{charging}<small>trên {chargingPoints.length} cổng sạc</small></dd>
      </div>
      <div className="work-card operations-metric tinted-panel" data-tone="warning">
        <dt>Hub cần chú ý</dt><dd>{flaggedHubs.length}
          {flaggedHubs.length > 0 && <button className="operations-text-action" type="button" onClick={() => {
            setFilter('flagged');
            document.getElementById('network-status-title')?.focus();
          }}>Lọc Hub có cảnh báo</button>}
        </dd>
      </div>
    </dl>
    <div className="operations-distribution">
      <section className="work-card work-stack">
        <div className="work-heading"><h2>Phân bố tài nguyên</h2><span className="status-pill" data-tone="info">{hubs.length} Hub</span></div>
        <Suspense fallback={<p role="status">Đang tải bản đồ…</p>}>
          <NetworkMap hubs={hubs} selected={selectedHub} onSelect={setSelectedHub} need="vehicle" searchKey="" />
        </Suspense>
        {selectedHub && <p className="operations-map-selection">{hubs.find(hub => hub.id === selectedHub)?.name}</p>}
      </section>
      <section className="work-card work-stack">
        <div className="operations-attention-heading"><img src="/design/alert.svg" alt="" width={18} height={18} /><h2>Cần ưu tiên xử lý</h2></div>
        {flaggedHubs.length ? <div className="operations-attention">
          {flaggedHubs.flatMap(hub => hub.alerts.map(alert => <button key={hub.id + alert} type="button"
            className="tinted-panel" data-tone={alert === 'LOW_FLEET' ? 'warning' : 'danger'}
            aria-pressed={selectedHub === hub.id} onClick={() => setSelectedHub(hub.id)}>
            <strong>{hub.code} · {alertLabels[alert]}</strong>
            <span>{hub.name} · {alert === 'LOW_FLEET' ? hub.availableVehicles : hub.vehicleCount}/{hub.capacity} xe</span>
          </button>))}
        </div> : <p>Chưa có Hub cần ưu tiên.</p>}
        <Link className="outline" to="?tab=plans">Xem phương án điều phối</Link>
      </section>
    </div>
    <div className="operations-status-grid">
      <section className="work-card">
        <h2>Xe sẵn sàng theo Hub</h2>
        <ul className="operations-chart" aria-label="Xe sẵn sàng tại từng Hub">
          {hubs.map(hub => <li key={hub.id}>
            <b aria-label={hub.name + ': ' + hub.availableVehicles + ' xe'}>{hub.availableVehicles}</b>
            <span className="operations-chart-track" aria-hidden="true">
              <span data-warning={hub.alerts.includes('LOW_FLEET')} style={{ height: 100 * hub.availableVehicles / chartMaximum + '%' }} />
            </span>
            <span>{hub.code}</span>
          </li>)}
        </ul>
      </section>
    <section className="work-card operations-network" aria-labelledby="network-status-title">
      <header className="operations-network-toolbar">
        <div>
          <h2 id="network-status-title" tabIndex={-1}>Trạng thái các Hub</h2>
          <p>{visible.length} / {hubs.length} Hub</p>
        </div>
        <div className="work-actions">
          <label className="operations-filter">Cảnh báo
            <select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}>
              <option value="all">Tất cả Hub</option>
              <option value="flagged">Có cảnh báo</option>
              <option value="LOW_FLEET">Thiếu xe</option>
              <option value="NEAR_CAPACITY">Gần đầy</option>
            </select>
          </label>
          <button className="outline" type="button" onClick={refresh}>Làm mới</button>
        </div>
      </header>
      {visible.length > 0 ? <div className="scroll-table" tabIndex={0} role="region" aria-label="Bảng trạng thái các Hub">
        <table>
          <thead><tr>
            <th scope="col">Hub</th>
            <th scope="col">Xe</th>
            <th scope="col">Chỗ đỗ trống</th>
            <th scope="col">Cổng sạc trống</th>
            <th scope="col">Cảnh báo</th>
          </tr></thead>
          <tbody>{visible.map(hub => <tr key={hub.id}>
            <th scope="row">
              <strong>{hub.name}</strong>
              <span className="operations-status" data-active={hub.serviceStatus === 'ACTIVE'}>{stateLabel(hub.serviceStatus)}</span>
            </th>
            <td><strong>{hub.availableVehicles}</strong> khả dụng<span className="operations-table-subtext">{hub.vehicleCount}/{hub.capacity} hiện diện</span></td>
            <td><strong>{hub.availableParking}</strong><span className="operations-ratio"> / {hub.parkingCount}</span></td>
            <td><strong>{hub.availableCharging}</strong><span className="operations-ratio"> / {hub.chargingCount}</span></td>
            <td>{hub.alerts.length ? <div className="operations-alerts">
              {hub.alerts.map(alert => <span className="operations-alert" key={alert}>{alertLabels[alert]}</span>)}
            </div> : <span className="operations-no-alert">—</span>}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="operations-empty">{hubs.length ? 'Không có Hub phù hợp với bộ lọc.' : 'Chưa có Hub trong phạm vi quản lý.'}</p>}
    </section>
    </div>
  </div>;
}
