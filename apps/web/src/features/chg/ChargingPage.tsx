import { useState, type FormEvent } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import type { ChargingRequestView, NetworkHub, PrivateChargingVehicleView, PrivateVehicleView } from '@semh/contracts';
import { PageBanner } from '../../shared/ui/PageBanner';
import { displayTime, field, useCommand, useScreen } from '../../shared/api/use-screen';
import { PrivateVehicleForm } from '../park/PrivateVehicleForm';

interface ChargingOverview {
  hubs: { id: string; name: string }[];
  vehicles: PrivateChargingVehicleView[];
  requests: ChargingRequestView[];
}
interface Quote { reason: string | null; pointId: string | null; startsAt: string | null; endsAt: string | null }

const labels = {
  PENDING: 'Đang chờ', SCHEDULED: 'Đã xếp lịch', CHARGING: 'Đang sạc',
  COMPLETED: 'Đã hoàn tất', INTERRUPTED: 'Gián đoạn',
};

export function ChargingPage() {
  const operator = useLocation().pathname.startsWith('/operations');
  const [params] = useSearchParams();
  const screen = useScreen<ChargingOverview>('/charging?mode=' + (operator ? 'OPR' : 'STU'), 4000);
  const network = useScreen<NetworkHub[]>('/network/hubs', 12000);
  const action = useCommand(screen.refresh);
  const [hubId, setHubId] = useState(params.get('hubId') ?? '');
  const [formOpen, setFormOpen] = useState(!!params.get('hubId'));
  const [privateVehicleId, setPrivateVehicleId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [hubFilter, setHubFilter] = useState('');
  const [focusedRequest, setFocusedRequest] = useState('');
  const [preview, setPreview] = useState<{ quote: Quote; input: object } | null>(null);
  const [message, setMessage] = useState('');

  async function previewRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const timestamp = (key: string) => field(data, key) ? new Date(field(data, key)).toISOString() : null;
    const input = {
      kind: operator ? 'SHARED' : 'PRIVATE', hubId: field(data, 'hub'), vehicleId: field(data, 'vehicle'),
      neededAt: timestamp('neededAt'), desiredBy: timestamp('desiredBy'),
    };
    setMessage('');
    const quote = await action.send<Quote>('/charging/preview', input, 'POST', false);
    if (quote) setPreview({ quote, input });
  }

  async function submit() {
    if (!preview) return;
    const created = await action.send<ChargingRequestView>('/charging/requests', preview.input);
    if (created) {
      setPreview(null);
      setFocusedRequest(created.id);
      setFormOpen(false);
      setMessage(created.status === 'SCHEDULED' ? 'Yêu cầu đã được xếp lịch.' : 'Đã tiếp nhận yêu cầu vào hàng đợi.');
    }
  }

  async function adjust(request: ChargingRequestView, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.send('/charging/requests/' + request.id, {
      rank: field(form, 'rank') ? Number(field(form, 'rank')) : null,
      pointId: field(form, 'point') || null, reason: field(form, 'reason'), version: request.version,
    }, 'PATCH');
  }

  function vehicleSaved(vehicle: PrivateVehicleView, feedback: string) {
    setPrivateVehicleId(vehicle.id);
    setPreview(null);
    setMessage(feedback);
    screen.refresh();
  }

  const { data } = screen;
  const privateVehicle = data?.vehicles.find(vehicle => vehicle.id === privateVehicleId);
  const hubs = new Map(data?.hubs.map(hub => [hub.id, hub.name]));
  const fleet = network.data?.find(hub => hub.id === hubId)?.resources
    .filter(item => item.kind === 'VEHICLE' && ['AVAILABLE', 'AWAITING_CHARGE'].includes(item.status)) ?? [];
  const requests = data?.requests.filter(item => (!statusFilter || item.status === statusFilter) &&
    (!hubFilter || item.hubId === hubFilter)) ?? [];
  const request = requests.find(item => item.id === focusedRequest) ?? requests.find(item => item.status === 'CHARGING') ?? requests[0];
  const session = request?.session;
  const points = network.data?.find(hub => hub.id === request?.hubId)?.resources.filter(item => item.kind === 'CHARGING_POINT') ?? [];
  const statusTone = (status: ChargingRequestView['status']) => status === 'COMPLETED' ? 'success'
    : status === 'CHARGING' ? 'info' : status === 'INTERRUPTED' ? 'danger' : 'warning';

  return (
    <section className="charging-content">
      <PageBanner title={operator ? 'Quản lý sạc' : 'Sạc của tôi'} actions={
        <button type="button" className="outline" aria-expanded={formOpen} onClick={() => setFormOpen(!formOpen)}>
          {formOpen ? 'Đóng biểu mẫu' : 'Đăng ký nhu cầu sạc'}
        </button>
      } />
      {(screen.error || action.error) && <p className="error" role="alert">{action.error || screen.error}</p>}
      {message && <p className="handoff-notice" role="status">{message}</p>}
      {!data && !screen.error && <p role="status">Đang tải lịch sạc…</p>}
      {data && <div className="work-stack">
        {operator && <div className="metric-grid">
          {(['CHARGING', 'SCHEDULED', 'PENDING', 'INTERRUPTED'] as const).map(status => <div className="work-card tinted-panel"
            data-tone={status === 'CHARGING' ? 'aqua' : statusTone(status)} key={status}>
            <span>{labels[status]}</span><b>{data.requests.filter(item => item.status === status).length}</b>
          </div>)}
        </div>}
        {formOpen && <section className="work-card">
          <h2>Yêu cầu sạc mới</h2>
          {!operator && <details open={!data.vehicles.length}>
            <summary>Thêm xe cá nhân</summary>
            <PrivateVehicleForm onSaved={vehicle => vehicleSaved(vehicle, 'Đã lưu xe cá nhân.')} />
          </details>}
          <form className="work-form work-form-wide" onSubmit={previewRequest} onChange={() => setPreview(null)}>
            <label>Hub<select name="hub" required value={hubId} onChange={event => setHubId(event.target.value)}>
              <option value="">Chọn Hub</option>
              {data.hubs.map(hub => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
            </select></label>
            <label>{operator ? 'Xe dùng chung' : 'Xe cá nhân'}<select name="vehicle" required key={operator ? hubId : 'private'}
              value={operator ? undefined : privateVehicleId} onChange={operator ? undefined : event => setPrivateVehicleId(event.target.value)}>
              <option value="">Chọn xe</option>
              {operator ? fleet.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.code} · {vehicle.batteryPercent}%</option>)
                : data.vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate}</option>)}
            </select></label>
            <label>Cần xe lúc<input name="neededAt" type="datetime-local" /></label>
            <label>Hạn hoàn tất<input name="desiredBy" type="datetime-local" /></label>
            <button className="outline" disabled={action.pending}>Xem lịch dự kiến</button>
          </form>
          {!operator && privateVehicle?.batteryPercent === null && <details className="work-notice">
            <summary>Bổ sung mức pin để lên lịch</summary>
            <PrivateVehicleForm key={privateVehicle.id} vehicle={privateVehicle}
              onSaved={vehicle => vehicleSaved(vehicle, 'Đã lưu mức pin ban đầu.')} />
          </details>}
          {preview && <div className="work-notice">
            <p>{preview.quote.startsAt && preview.quote.endsAt
              ? displayTime(preview.quote.startsAt) + ' – ' + displayTime(preview.quote.endsAt)
              : preview.quote.reason ?? 'Đang chờ phân bổ.'}</p>
            <button className="primary" type="button" onClick={() => void submit()} disabled={action.pending}>Đăng ký sạc</button>
          </div>}
        </section>}
        <div className={'charging-layout' + (operator ? '' : ' charging-layout-student')}>
          <section className="work-card work-stack">
            <div className="work-heading"><h2>Lịch và phiên sạc</h2><button type="button" className="outline" onClick={screen.refresh}>Làm mới</button></div>
            <div className="filter-toolbar">
              <label>Hub<select value={hubFilter} onChange={event => setHubFilter(event.target.value)}>
                <option value="">Tất cả Hub</option>
                {data.hubs.map(hub => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
              </select></label>
              <label>Trạng thái<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <option value="">Tất cả trạng thái</option>
                {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></label>
            </div>
            {!requests.length ? <p>Chưa có yêu cầu sạc phù hợp.</p> : <div className="scroll-table" role="region" tabIndex={0} aria-label="Yêu cầu sạc">
              <table>
                <thead><tr><th>Phương tiện</th><th>Hub</th><th>Trạng thái</th></tr></thead>
                <tbody>{requests.map(item => <tr key={item.id} data-selected={request?.id === item.id}>
                  <td><button className="table-link" type="button" onClick={() => setFocusedRequest(item.id)}>{item.vehicleCode}</button></td>
                  <td>{hubs.get(item.hubId) ?? '—'}</td>
                  <td><span className="status-pill" data-tone={statusTone(item.status)}>{labels[item.status]}</span></td>
                </tr>)}</tbody>
              </table>
            </div>}
          </section>
          {request && <article className="work-card" key={request.id}>
              <div className="work-heading"><h2>{session ? 'Tiến độ phiên sạc' : 'Chi tiết yêu cầu'}</h2>
                <span className="status-pill" data-tone={statusTone(request.status)}>{labels[request.status]}</span></div>
              <p>{request.vehicleCode} · {hubs.get(request.hubId) ?? 'Hub đã ngừng phục vụ'}</p>
              {request.reason && <p>{request.reason}</p>}
              {session && <>
                <div className="charging-battery tinted-panel" data-tone="aqua">
                  <span>Mức pin hiện tại</span><strong>{session.batteryPercent}%</strong>
                  <progress value={session.batteryPercent} max={100} aria-label="Mức pin hiện tại" />
                </div>
                <dl className="reservation-details">
                  <div><dt>Cổng sạc</dt><dd>{session.pointCode}</dd></div>
                  <div><dt>Lịch dự kiến</dt><dd>{displayTime(session.startAt)} – {displayTime(session.endAt)}</dd></div>
                  {session.observedAt && <div><dt>Cập nhật</dt><dd>{displayTime(session.observedAt)}</dd></div>}
                  {request.status === 'COMPLETED' && <div><dt>Cổng</dt><dd>{session.releasedAt ? 'Đã giải phóng' : 'Chờ xác nhận xe đã rời'}</dd></div>}
                </dl>
              </>}
              {operator && ['PENDING', 'SCHEDULED'].includes(request.status) && <details>
                <summary>Điều chỉnh lịch</summary>
                <form className="work-form" onSubmit={event => void adjust(request, event)}>
                  <label>Thứ tự ưu tiên<input name="rank" type="number" min="1" max="999" /></label>
                  <label>Cổng<select name="point"><option value="">Tự chọn cổng</option>
                    {points.map(point => <option key={point.id} value={point.id}>{point.code}</option>)}
                  </select></label>
                  <label>Lý do<input name="reason" maxLength={500} required /></label>
                  <button className="primary" disabled={action.pending}>Lưu điều chỉnh</button>
                </form>
              </details>}
            </article>}
        </div>
      </div>}
    </section>
  );
}
