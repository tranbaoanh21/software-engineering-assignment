import { Link } from 'react-router';
import type { ChargingRequestView, NetworkHub, ParkingOverview, ReservationView, TripView } from '@semh/contracts';
import { displayTime, useScreen } from '../../shared/api/use-screen';
import { MetricIcon } from '../../shared/ui/MetricIcon';
import { PageBanner } from '../../shared/ui/PageBanner';

export function StudentActivity() {
  const reservation = useScreen<{ reservation: ReservationView | null }>('/reservations/active', 10000);
  const trips = useScreen<TripView[]>('/trips', 4000);
  const parking = useScreen<ParkingOverview>('/parking', 10000);
  const charging = useScreen<{ requests: ChargingRequestView[] }>('/charging?mode=STU', 10000);
  const network = useScreen<NetworkHub[]>('/network/hubs');
  const current = reservation.data?.reservation;
  const counts = [
    { label: 'Lượt đặt xe', icon: 'reservation', count: reservation.data ? Number(!!current) : '—', path: 'reservations' },
    { label: 'Chuyến đi', icon: 'trip', count: trips.data?.filter(item => item.status === 'IN_PROGRESS').length ?? '—', path: 'trips' },
    { label: 'Chỗ đỗ', icon: 'parking', count: parking.data?.reservations.filter(item => ['CONFIRMED', 'CHECKED_IN'].includes(item.status)).length ?? '—', path: 'parking' },
    { label: 'Sạc', icon: 'charging', count: charging.data?.requests.filter(item => ['PENDING', 'SCHEDULED', 'CHARGING'].includes(item.status)).length ?? '—', path: 'charging' },
  ] as const;
  const hubNames = new Map(network.data?.map(hub => [hub.id, hub.name]));
  const history = [
    ...(trips.data ?? []).flatMap(item => item.endedAt ? [{
      key: item.id, label: 'Chuyến đi', resource: item.vehicle.code, hub: item.endHub?.name ?? item.startHub.name,
      time: item.endedAt, status: item.status === 'COMPLETED' ? 'Hoàn tất' : 'Gián đoạn', path: 'trips',
    }] : []),
    ...(parking.data?.reservations ?? []).flatMap(item => item.checkOutAt ? [{
      key: item.id, label: 'Đỗ xe cá nhân', resource: item.space.code, hub: item.hub.name,
      time: item.checkOutAt, status: 'Hoàn tất', path: 'parking',
    }] : []),
    ...(charging.data?.requests ?? []).flatMap(item => item.session?.releasedAt ? [{
      key: item.id, label: 'Sạc', resource: item.vehicleCode, hub: hubNames.get(item.hubId) ?? '—',
      time: item.session.releasedAt, status: item.status === 'COMPLETED' ? 'Hoàn tất' : 'Gián đoạn', path: 'charging',
    }] : []),
  ].sort((a, b) => Date.parse(b.time) - Date.parse(a.time)).slice(0, 6);
  const error = reservation.error || trips.error || parking.error || charging.error;
  const loading = !reservation.data || !trips.data || !parking.data || !charging.data;

  return <section className="student-activity">
    <PageBanner title="Hoạt động của tôi"><p>Lượt đặt xe, chuyến đi, chỗ đỗ và sạc</p></PageBanner>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="metric-grid activity-metrics">{counts.map(({ label, count, path, icon }) =>
      <Link key={path} to={'/student/' + path} className="work-card metric-card">
        <span className="metric-label">{label}</span><b className="metric-value">{count}</b>
        <MetricIcon name={icon} />
      </Link>)}</div>
    {current && <article className="work-card work-heading">
      <div><h2>Lượt đặt xe hiện tại</h2><p>{current.vehicle.code} · {current.hub.name}</p>
        <span>Nhận xe trước {displayTime(current.expiresAt)}</span></div>
      <Link className="primary" to="/student/reservations">Xem lượt đặt</Link>
    </article>}
    <section className="work-card data-card">
      <h2 className="data-card-heading">Lịch sử gần đây</h2>
      {!!history.length && <div className="scroll-table"><table>
        <thead><tr><th>Hoạt động</th><th>Tài nguyên</th><th>Hub</th><th>Trạng thái</th><th>Thời điểm</th></tr></thead>
        <tbody>{history.map(item => <tr key={item.key}>
          <td><Link className="table-link" to={'/student/' + item.path}>{item.label}</Link></td>
          <td>{item.resource}</td><td>{item.hub}</td>
          <td><span className="status-pill" data-tone={item.status === 'Hoàn tất' ? 'success' : 'warning'}>{item.status}</span></td>
          <td>{displayTime(item.time)}</td>
        </tr>)}</tbody>
      </table></div>}
      {!history.length && !error && <p className="data-empty" role="status">{loading ? 'Đang tải hoạt động…' : 'Chưa có hoạt động hoàn tất.'}</p>}
    </section>
  </section>;
}
