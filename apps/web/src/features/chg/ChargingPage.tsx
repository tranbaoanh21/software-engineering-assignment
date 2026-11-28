import { useState, type FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import type { ChargingRequestView, NetworkHub, PrivateChargingVehicleView } from '@semh/contracts';
import { MetricIcon } from '../../shared/ui/MetricIcon';
import { PageBanner } from '../../shared/ui/PageBanner';
import { displayTime, field, useCommand, useScreen } from '../../shared/api/use-screen';
import { useLiveUpdates } from '../../shared/api/use-live-updates';
import { PrivateVehicleForm } from '../park/PrivateVehicleForm';
import { canChargeLowBattery, lowBatteryChargePath } from './shared-charge';

interface ChargingOverview {
  hubs: { id: string; name: string }[];
  vehicles: PrivateChargingVehicleView[];
  requests: ChargingRequestView[];
  demoBatteryEnabled?: boolean;
}
interface Quote { reason: string | null; pointId: string | null; startsAt: string | null; endsAt: string | null }

const labels = {
  PENDING: 'Đang chờ', SCHEDULED: 'Đã xếp lịch', CHARGING: 'Đang sạc',
  AWAITING_APPROVAL: 'Chờ đưa vào sử dụng', COMPLETED: 'Đã hoàn tất', INTERRUPTED: 'Gián đoạn',
};

function hasUnfinishedCharge(request: ChargingRequestView) {
  return ['PENDING', 'SCHEDULED', 'CHARGING', 'AWAITING_APPROVAL'].includes(request.status) ||
    (!!request.session && !request.session.releasedAt && ['COMPLETED', 'INTERRUPTED'].includes(request.status));
}

function requestLabel(request: ChargingRequestView) {
  if (request.status === 'SCHEDULED' && request.requiresFleetHandoff) {
    return request.session?.plugConfirmedAt ? 'Chờ cổng xác nhận' : 'Chờ Kỹ thuật cắm sạc';
  }
  return labels[request.status];
}

const chargingMetrics = [
  { status: 'AWAITING_APPROVAL', icon: 'pending' },
  { status: 'CHARGING', icon: 'charging' },
  { status: 'SCHEDULED', icon: 'scheduled' },
  { status: 'PENDING', icon: 'pending' },
] as const;

export function ChargingPage() {
  const operator = useLocation().pathname.startsWith('/operations');
  const [params] = useSearchParams();
  const connected = useLiveUpdates(['charging'], () => {
    screen.refresh();
    network.refresh();
    if (preview && !action.pending) void refreshQuote(preview);
  });
  const screen = useScreen<ChargingOverview>('/charging?mode=' + (operator ? 'OPR' : 'STU'), connected ? 30000 : 4000);
  const network = useScreen<NetworkHub[]>('/network/hubs', connected ? 30000 : 12000);
  const action = useCommand(screen.refresh);
  const quoteRefresh = useCommand();
  const [hubId, setHubId] = useState(params.get('hubId') ?? '');
  const [formOpen, setFormOpen] = useState(!!params.get('hubId'));
  const [privateVehicleId, setPrivateVehicleId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [hubFilter, setHubFilter] = useState('');
  const [focusedRequest, setFocusedRequest] = useState(operator ? params.get('request') ?? '' : '');
  const [preview, setPreview] = useState<{ quote: Quote; input: object } | null>(null);
  const [message, setMessage] = useState('');

  async function refreshQuote(current: NonNullable<typeof preview>) {
    const quote = await quoteRefresh.send<Quote>('/charging/preview', current.input, 'POST', false);
    if (quote) setPreview(latest => latest === current ? { ...current, quote } : latest);
  }

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

  async function simulateLowBattery(id: string) {
    setPreview(null);
    setMessage('');
    const result = await action.send<{ batteryPercent: number }>('/charging/vehicles/' + id + '/demo-low-battery', {});
    if (result) setMessage('IoT giả lập đã cập nhật pin xe còn ' + result.batteryPercent + '%.');
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

  async function chargeSharedVehicle(vehicleId: string, currentHubId: string) {
    setMessage('');
    const created = await action.send<ChargingRequestView>(lowBatteryChargePath(vehicleId), { hubId: currentHubId });
    if (!created) return;
    setPreview(null);
    setFormOpen(false);
    setStatusFilter('');
    setHubFilter('');
    setFocusedRequest(created.id);
    setMessage(created.status === 'SCHEDULED'
      ? 'Xe ' + created.vehicleCode + ' đã được xếp lịch sạc.'
      : 'Xe ' + created.vehicleCode + ' đã được đưa vào hàng chờ sạc.');
  }

  async function approveService(request: ChargingRequestView) {
    setMessage('');
    const result = await action.send<ChargingRequestView>('/charging/requests/' + request.id + '/approve-service', {});
    if (result) setMessage('Xe ' + result.vehicleCode + ' đã sẵn sàng cho sinh viên đặt.');
  }

  async function adjust(request: ChargingRequestView, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await action.send('/charging/requests/' + request.id, {
      rank: field(form, 'rank') ? Number(field(form, 'rank')) : null,
      pointId: field(form, 'point') || null, reason: field(form, 'reason'), version: request.version,
    }, 'PATCH');
  }

  const previewTime = preview?.quote.startsAt && preview.quote.endsAt
    ? displayTime(preview.quote.startsAt) + ' – ' + displayTime(preview.quote.endsAt)
    : null;
  const { data } = screen;
  const privateVehicle = data?.vehicles.find(vehicle => vehicle.id === privateVehicleId);
  const fullyCharged = privateVehicle?.batteryPercent === 100;
  const activePrivateCharge = privateVehicle && data?.requests.some(item => item.vehicleId === privateVehicle.id &&
    hasUnfinishedCharge(item));
  const hubs = new Map(data?.hubs.map(hub => [hub.id, hub.name]));
  const requestedVehicles = new Set(data?.requests.filter(hasUnfinishedCharge).map(item => item.vehicleId));
  const lowBatteryFleet = operator ? (network.data ?? []).filter(hub => hubs.has(hub.id)).flatMap(hub =>
    hub.resources.filter(vehicle => canChargeLowBattery(vehicle) && !requestedVehicles.has(vehicle.id))
      .map(vehicle => ({ hubId: hub.id, hubName: hub.name, vehicle }))) : [];
  const fleet = network.data?.find(hub => hub.id === hubId)?.resources
    .filter(item => item.kind === 'VEHICLE' && ['AVAILABLE', 'AWAITING_CHARGE'].includes(item.status)) ?? [];
  const requests = data?.requests.filter(item => (!statusFilter || item.status === statusFilter) &&
    (!hubFilter || item.hubId === hubFilter)) ?? [];
  const ongoing = operator ? requests.filter(hasUnfinishedCharge) : requests;
  const history = operator ? requests.filter(item => !ongoing.includes(item)) : [];
  const request = requests.find(item => item.id === focusedRequest) ??
    ongoing.find(item => item.status === 'AWAITING_APPROVAL') ?? ongoing.find(item => item.status === 'CHARGING') ?? ongoing[0];
  const session = request?.session;
  const points = network.data?.find(hub => hub.id === request?.hubId)?.resources.filter(item => item.kind === 'CHARGING_POINT') ?? [];
  const statusTone = (status: ChargingRequestView['status']) => status === 'COMPLETED' ? 'success'
    : status === 'CHARGING' || (operator && status === 'SCHEDULED') ? 'info' : status === 'INTERRUPTED' ? 'danger' : 'warning';

  return (
    <section className="charging-content">
      <PageBanner title={operator ? 'Quản lý sạc' : 'Sạc của tôi'} actions={
        <button type="button" className={formOpen || (operator && (ongoing.length > 0 || lowBatteryFleet.length > 0)) ? 'outline' : 'primary'} aria-expanded={formOpen} onClick={() => {
          setFormOpen(!formOpen);
          if (operator) setPreview(null);
        }}>
          {formOpen ? 'Đóng biểu mẫu' : operator ? 'Tạo yêu cầu thủ công' : 'Đăng ký nhu cầu sạc'}
        </button>
      } />
      {(screen.error || action.error) && <p className="error" role="alert">{action.error || screen.error}</p>}
      {message && <p className="handoff-notice" role="status">{message}</p>}
      {!data && !screen.error && <p role="status">Đang tải lịch sạc…</p>}
      {data && <div className="work-stack">
        {operator && <div className="metric-grid">
          {chargingMetrics.map(({ status, icon }) => <div className="work-card metric-card" key={status}>
            <span className="metric-label">{labels[status]}</span>
            <b className="metric-value">{data.requests.filter(item => item.status === status).length}</b>
            <MetricIcon name={icon} />
          </div>)}
        </div>}
        {operator && lowBatteryFleet.length > 0 && <section className="work-card work-stack" aria-labelledby="fleet-needs-charge">
          <h2 id="fleet-needs-charge">Xe dùng chung cần sạc</h2>
          <ul className="work-list">
            {lowBatteryFleet.map(({ hubId: currentHubId, hubName, vehicle }) => <li key={vehicle.id}>
              <div><strong>{vehicle.code}</strong><br /><small>{hubName} · Pin {vehicle.batteryPercent}%</small></div>
              <button type="button" className="primary" disabled={action.pending}
                aria-label={'Sạc xe ' + vehicle.code}
                onClick={() => void chargeSharedVehicle(vehicle.id, currentHubId)}>Sạc xe</button>
            </li>)}
          </ul>
        </section>}
        {formOpen && <section className="work-card">
          <h2>Yêu cầu sạc mới</h2>
          {!operator && data.vehicles.length === 0
            ? <Link className="primary" to="/student/vehicles?add=1">Thêm xe cá nhân</Link>
            : <form className="work-form charging-request-form" onSubmit={previewRequest} onChange={() => setPreview(null)}>
              <label>Hub<select name="hub" required value={hubId} onChange={event => setHubId(event.target.value)}>
                <option value="">Chọn Hub</option>
                {data.hubs.map(hub => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
              </select></label>
              <label>{operator ? 'Xe dùng chung' : 'Xe cá nhân'}<select name="vehicle" required key={operator ? hubId : 'private'}
                value={operator ? undefined : privateVehicleId} onChange={operator ? undefined : event => setPrivateVehicleId(event.target.value)}>
                <option value="">Chọn xe</option>
                {operator ? fleet.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.code} · {vehicle.batteryPercent}%</option>)
                  : data.vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.plate}{vehicle.batteryPercent !== null && ' · ' + vehicle.batteryPercent + '%'}
                  </option>)}
              </select></label>
              <details className="charging-time-options">
                <summary>Thời gian mong muốn (tùy chọn)</summary>
                <div className="charging-time-fields">
                  <div>
                    <label>Cần xe lúc
                      <input name="neededAt" type="datetime-local" aria-describedby="charging-needed-help charging-time-help" />
                    </label>
                    <small id="charging-needed-help">Giờ bạn cần dùng xe. Yêu cầu được ưu tiên nếu cần xe trong 60 phút tới.</small>
                  </div>
                  <div>
                    <label>Hạn hoàn tất
                      <input name="desiredBy" type="datetime-local" aria-describedby="charging-deadline-help charging-time-help" />
                    </label>
                    <small id="charging-deadline-help">Giờ muộn nhất bạn muốn sạc xong.</small>
                  </div>
                  <small className="charging-time-help" id="charging-time-help">
                    Nếu nhập cả hai, hệ thống xếp lịch theo mốc sớm hơn.
                  </small>
                </div>
              </details>
              {fullyCharged && <p className="charging-time-help" role="status">Xe đã đầy pin.</p>}
              <button className={preview ? 'outline' : 'primary'} disabled={action.pending || fullyCharged}>
                {preview ? 'Kiểm tra lại lịch' : 'Xem lịch dự kiến'}
              </button>
            </form>}
          {!operator && data.demoBatteryEnabled && privateVehicle && (privateVehicle.batteryPercent ?? 100) > 15 &&
            <details className="work-notice">
              <summary>Giả lập IoT</summary>
              <p>Đưa pin xe về 15% để thử đăng ký sạc.</p>
              {activePrivateCharge ? <p>Chờ phiên sạc kết thúc và cổng được giải phóng.</p>
                : <button className="outline" type="button" disabled={action.pending}
                  onClick={() => void simulateLowBattery(privateVehicle.id)}>Giả lập pin thấp</button>}
            </details>}
          {!operator && privateVehicle?.batteryPercent === null && <details className="work-notice">
            <summary>Bổ sung mức pin để lên lịch</summary>
            <PrivateVehicleForm key={privateVehicle.id} vehicle={privateVehicle}
              onSaved={() => {
                setPreview(null);
                setMessage('Đã lưu mức pin ban đầu.');
                screen.refresh();
              }} />
          </details>}
          {preview && <div className="work-notice">
            <h3>{previewTime ? 'Lịch dự kiến' : 'Chưa có lịch phù hợp'}</h3>
            {(previewTime || preview.quote.reason) && <p>{previewTime ?? preview.quote.reason}</p>}
            <button className="primary" type="button" onClick={() => void submit()} disabled={action.pending || quoteRefresh.pending}>
              {previewTime ? 'Đăng ký sạc' : 'Gửi yêu cầu chờ xếp lịch'}
            </button>
          </div>}
        </section>}
        <div className={'charging-layout' + (operator ? '' : ' charging-layout-student')}>
          <section className="work-card work-stack">
            <div className="work-heading"><h2>Lịch và phiên sạc</h2><button type="button" className="quiet-action" onClick={screen.refresh}>Làm mới</button></div>
            <div className="filter-toolbar">
              <label>Hub<select value={hubFilter} onChange={event => setHubFilter(event.target.value)}>
                <option value="">Tất cả Hub</option>
                {data.hubs.map(hub => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
              </select></label>
              <label>Trạng thái<select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
                <option value="">Tất cả trạng thái</option>
                {Object.entries(labels).filter(([value]) => operator || value !== 'AWAITING_APPROVAL')
                  .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></label>
            </div>
            {operator ? <>
              {ongoing.length ? <div className="app-pane-list">{ongoing.map(item => <button className="app-pane-item" type="button"
                key={item.id} aria-pressed={item.id === request?.id} onClick={() => setFocusedRequest(item.id)}>
                <strong>{item.vehicleCode}</strong><small>{hubs.get(item.hubId) ?? 'Hub đã ngừng phục vụ'}</small>
                <span className="status-pill" data-tone={statusTone(item.status)}>{requestLabel(item)}</span>
              </button>)}</div> : <p>Chưa có yêu cầu sạc đang theo dõi.</p>}
              {!!history.length && <details open={history.some(item => item.id === request?.id) || undefined}>
                <summary>Lịch sử sạc ({history.length})</summary>
                <div className="app-pane-list">{history.map(item => <button className="app-pane-item" type="button"
                  key={item.id} aria-pressed={item.id === request?.id} onClick={() => setFocusedRequest(item.id)}>
                  <strong>{item.vehicleCode}</strong><small>{hubs.get(item.hubId) ?? 'Hub đã ngừng phục vụ'}</small>
                  <span className="status-pill" data-tone={statusTone(item.status)}>{labels[item.status]}</span>
                </button>)}</div>
              </details>}
            </> : <>
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
            </>}
          </section>
          {request && <article className="work-card" key={request.id}>
              <div className="work-heading"><h2>{session ? 'Tiến độ phiên sạc' : 'Chi tiết yêu cầu'}</h2>
                <span className="status-pill" data-tone={statusTone(request.status)}>{requestLabel(request)}</span></div>
              <p>{request.vehicleCode} · {hubs.get(request.hubId) ?? 'Hub đã ngừng phục vụ'}</p>
              {request.reason && <p>{request.reason}</p>}
              {session && <>
                <div className="work-card metric-card charging-battery">
                  <span className="metric-label">Mức pin hiện tại</span>
                  <strong className="metric-value">{session.batteryPercent}%</strong>
                  <MetricIcon name="charging" />
                  <progress value={session.batteryPercent} max={100} aria-label="Mức pin hiện tại" />
                </div>
                <dl className="reservation-details">
                  <div><dt>Cổng sạc</dt><dd>{session.pointCode}</dd></div>
                  <div><dt>Lịch dự kiến</dt><dd>{displayTime(session.startAt)} – {displayTime(session.endAt)}</dd></div>
                  {session.observedAt && <div><dt>Cập nhật</dt><dd>{displayTime(session.observedAt)}</dd></div>}
                  {['COMPLETED', 'AWAITING_APPROVAL'].includes(request.status) && <div>
                    <dt>Cổng</dt><dd>{session.releasedAt ? 'Đã giải phóng' : 'Chờ xác nhận xe đã rời'}</dd>
                  </div>}
                </dl>
              </>}
              {operator && request.status === 'AWAITING_APPROVAL' && <div className="work-notice">
                <p>{session?.status === 'INTERRUPTED' ? 'Xe đã rời cổng sạc. Kiểm tra mức pin trước khi xác nhận.'
                  : 'Xe đã sạc xong và cổng đã trống.'}</p>
                <button type="button" className="primary" disabled={action.pending}
                  onClick={() => void approveService(request)}>Đưa vào sử dụng</button>
              </div>}
              {operator && ['PENDING', 'SCHEDULED'].includes(request.status) && !session?.plugConfirmedAt && <details>
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
