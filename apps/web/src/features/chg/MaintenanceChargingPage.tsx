import type { ChargingRequestView } from '@semh/contracts';
import { PageBanner } from '../../shared/ui/PageBanner';
import { displayTime, useCommand, useScreen } from '../../shared/api/use-screen';

interface MaintenanceOverview {
  hubs: { id: string; name: string }[];
  requests: ChargingRequestView[];
}

function statusLabel(request: ChargingRequestView) {
  if (request.status === 'AWAITING_APPROVAL') return 'Chờ Vận hành xác nhận';
  if (request.status === 'CHARGING') return 'Đang sạc';
  if (request.session?.plugConfirmedAt) return 'Chờ cổng ghi nhận';
  return request.session ? 'Chờ cắm sạc' : 'Chờ xếp cổng';
}

export function MaintenanceChargingPage() {
  const screen = useScreen<MaintenanceOverview>('/charging?mode=MNT', 4000);
  const action = useCommand(screen.refresh);
  const hubs = new Map(screen.data?.hubs.map(hub => [hub.id, hub.name]));
  const requests = screen.data?.requests;
  const now = Date.now();

  return <section className="work-stack">
    <PageBanner title="Việc sạc xe" />
    {(action.error || screen.error) && <p className="error" role="alert">{action.error || screen.error}</p>}
    {!requests && !screen.error && <p role="status">Đang tải việc sạc…</p>}
    {requests && <section className="work-card">
      <h2>Xe dùng chung</h2>
      {requests.length === 0 ? <p>Hiện chưa có xe cần sạc.</p> : <ul className="work-list">
        {requests.map(request => {
          const session = request.session;
          const canPlug = request.status === 'SCHEDULED' && session?.status === 'READY' &&
            !session.plugConfirmedAt && Date.parse(session.startAt) <= now;
          return <li key={request.id}>
            <div className="work-stack">
              <strong>{request.vehicleCode} · {hubs.get(request.hubId)}</strong>
              {session && <small>{session.pointCode} · Pin {session.batteryPercent}%</small>}
              {request.status === 'SCHEDULED' && session && Date.parse(session.startAt) > now &&
                <small>Cắm sạc từ {displayTime(session.startAt)}</small>}
              <span className="status-pill">{statusLabel(request)}</span>
            </div>
            {canPlug && <button type="button" className="primary" disabled={action.pending}
              aria-label={'Đã cắm sạc ' + request.vehicleCode}
              onClick={() => void action.send('/charging/requests/' + request.id + '/confirm-plug', { pointId: session.pointId })}>
              Đã cắm sạc
            </button>}
          </li>;
        })}
      </ul>}
    </section>}
  </section>;
}
