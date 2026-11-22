import { useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { parkingHoldMinutes, type ParkingOverview, type ParkingReservationView } from '@semh/contracts';
import { ApiError } from '../../shared/api/http';
import { SessionContext } from '../../shared/auth/session-context';
import { PageBanner } from '../../shared/ui/PageBanner';
import { parkingApi, type ParkingAction } from './parking-api';

const statusLabels = {
  CONFIRMED: 'Đã giữ chỗ', CHECKED_IN: 'Đang đỗ', COMPLETED: 'Đã check-out', CANCELLED: 'Đã hủy', EXPIRED: 'Đã hết hạn',
};
const date = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const time = (value: string) => date.format(new Date(value));

function isActive(item: ParkingReservationView) {
  return item.status === 'CONFIRMED' || item.status === 'CHECKED_IN';
}

function verificationMessage(item: ParkingReservationView) {
  const state = item.verification;
  if (!state || !isActive(item) || state.status === 'APPLIED') return null;
  if (state.status === 'PENDING') return 'Đang chờ cảm biến xác nhận…';
  return state.reason ?? 'Đã quá thời gian xác minh. Vui lòng thử lại.';
}

export function ParkingPage() {
  const session = useContext(SessionContext);
  const [params] = useSearchParams();
  const [hubId, setHubId] = useState(params.get('hubId') ?? '');
  const [vehicleId, setVehicleId] = useState('');
  const [data, setData] = useState<ParkingOverview | null>(null);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [sending, setSending] = useState(false);
  const [revision, setRevision] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState<string>();
  const busy = useRef(false);
  const attempt = useRef<{ key: string; id: string }>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;
    async function load() {
      let nextRefresh = 8000;
      try {
        const result = await parkingApi.overview(AbortSignal.any([controller.signal, AbortSignal.timeout(7000)]));
        if (controller.signal.aborted) return;
        nextRefresh = result.reservations.some(item => item.verification?.status === 'PENDING') ? 1500 : 8000;
        if (!busy.current) setData(result);
        setRefreshError('');
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) {
          window.location.assign('/login');
          return;
        }
        setRefreshError('Chưa tải được thông tin chỗ đỗ. Đang thử lại.');
      }
      if (!controller.signal.aborted) timer = window.setTimeout(load, nextRefresh);
    }
    void load();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [revision]);

  const selectedHub = data?.hubs.find(hub => hub.id === hubId);
  const selectedVehicle = data?.vehicles.find(vehicle => vehicle.id === vehicleId) ??
    (data?.vehicles.length === 1 ? data.vehicles[0] : undefined);

  async function change(key: string, send: (id: string, token: string) => Promise<ParkingReservationView>) {
    if (!session || busy.current) return;
    busy.current = true;
    setSending(true);
    setError('');
    try {
      if (attempt.current?.key !== key) attempt.current = { key, id: crypto.randomUUID() };
      const record = await send(attempt.current.id, session.csrfToken);
      attempt.current = null;
      setConfirmCancel(undefined);
      setData(previous => previous && ({
        ...previous,
        reservations: previous.reservations.some(item => item.id === record.id)
          ? previous.reservations.map(item => item.id === record.id ? record : item)
          : [record, ...previous.reservations],
      }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.assign('/login');
        return;
      }
      if (err instanceof ApiError && err.status < 500) attempt.current = null;
      setError(err instanceof ApiError ? err.message : 'Chưa nhận được phản hồi. Vui lòng thử lại.');
    } finally {
      busy.current = false;
      setSending(false);
      setRevision(value => value + 1);
    }
  }

  function reserve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedHub || !selectedVehicle || selectedHub.availableSpaces === 0) return;
    const { id: selectedId } = selectedHub;
    const { id: privateVehicleId } = selectedVehicle;
    void change(selectedId + ':' + privateVehicleId, (requestId, token) =>
      parkingApi.reserve({ hubId: selectedId, requestId, privateVehicleId }, token));
  }

  function update(id: string, action: ParkingAction) {
    void change(action + ':' + id, (requestId, token) => parkingApi.update(id, action, requestId, token));
  }

  const active = data?.reservations.filter(isActive) ?? [];
  const history = data?.reservations.filter(item => !isActive(item)) ?? [];

  return (
    <section>
      <PageBanner title="Chỗ đỗ của tôi" />
      {error && <p className="error" role="alert">{error}</p>}
      {refreshError && <p className="error" role="status">{refreshError}</p>}
      {!data && !refreshError && <p role="status">Đang tải chỗ đỗ…</p>}
      {data && (
        <div className="parking-grid">
          <form className="reservation-card parking-form" onSubmit={reserve}>
            <div className="reservation-heading">
              <h2>Đặt chỗ đỗ</h2>
              <Link to="/student/hubs">Bản đồ Hub</Link>
            </div>
            <label htmlFor="parking-hub">Hub</label>
            <select id="parking-hub" required value={selectedHub?.id ?? ''} onChange={event => setHubId(event.target.value)}>
              <option value="">Chọn Hub</option>
              {data.hubs.map(hub => (
                <option key={hub.id} value={hub.id}>{hub.name} · {hub.availableSpaces} chỗ trống</option>
              ))}
            </select>
            <label htmlFor="parking-vehicle">Xe cá nhân</label>
            <select id="parking-vehicle" required value={selectedVehicle?.id ?? ''} onChange={event => setVehicleId(event.target.value)}>
              <option value="">Chọn phương tiện</option>
              {data.vehicles.map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate}</option>)}
            </select>
            {!data.vehicles.length && <p>Bạn chưa có phương tiện cá nhân trong hệ thống.</p>}
            {selectedHub?.availableSpaces === 0 && <p>Hub này đã hết chỗ. Vui lòng chọn Hub khác.</p>}
            <p>Thời gian giữ chỗ {parkingHoldMinutes} phút.</p>
            <button className="primary" type="submit"
              disabled={sending || !selectedVehicle || !selectedHub?.availableSpaces || active.some(item => item.vehicle.id === selectedVehicle.id)}>
              Xác nhận đặt chỗ
            </button>
          </form>

          <div className="parking-reservations">
            <h2>Lượt đỗ của tôi</h2>
            {active.length === 0 && <p>Bạn chưa có lượt đỗ đang hiệu lực.</p>}
            {active.map(item => {
              const waiting = item.verification?.status === 'PENDING';
              const message = verificationMessage(item);
              return (
                <article className="reservation-card" key={item.id}>
                  <div className="reservation-heading">
                    <h2 className="parking-space-code">{item.space.code}</h2>
                    <span className="status-pill" data-tone={item.status === 'CONFIRMED' ? 'info' : 'success'}>{statusLabels[item.status]}</span>
                  </div>
                  <dl className="reservation-details">
                    <div><dt>Hub</dt><dd>{item.hub.name}</dd></div>
                    <div><dt>Biển số</dt><dd>{item.vehicle.plate}</dd></div>
                    <div><dt>Mã lượt đặt</dt><dd className="reservation-id">{item.id}</dd></div>
                    {item.checkInAt
                      ? <div><dt>Check-in lúc</dt><dd>{time(item.checkInAt)}</dd></div>
                      : <div><dt>Giữ đến</dt><dd>{time(item.expiresAt)}</dd></div>}
                  </dl>
                  {message && <p className={waiting ? 'handoff-notice' : 'error'} role="status">{message}</p>}
                  <div className="reservation-actions parking-actions">
                    <button className="primary" type="button" disabled={sending || waiting || confirmCancel === item.id}
                      onClick={() => update(item.id, item.status === 'CONFIRMED' ? 'check-in' : 'check-out')}>
                      {item.status === 'CONFIRMED' ? 'Check-in' : 'Check-out'}
                    </button>
                    {item.status === 'CONFIRMED' && (
                      <button className="outline" type="button" disabled={sending} onClick={() => setConfirmCancel(item.id)}>
                        Hủy giữ chỗ
                      </button>
                    )}
                  </div>
                  {item.status === 'CONFIRMED' && confirmCancel === item.id && (
                    <div className="cancel-confirmation">
                      <p>Bạn muốn hủy lượt đặt tại {item.hub.name}?</p>
                      <div className="reservation-actions">
                        <button className="danger" type="button" disabled={sending} onClick={() => update(item.id, 'cancel')}>Xác nhận hủy</button>
                        <button className="outline" type="button" onClick={() => setConfirmCancel(undefined)}>Giữ lượt đặt</button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
            {history.length > 0 && (
              <section className="reservation-card parking-history">
                <h2>Lịch sử đỗ xe</h2>
                <ul>
                  {history.map(item => (
                    <li key={item.id}>
                      <strong>{statusLabels[item.status]}</strong>
                      <span>{item.space.code} · {item.hub.name}</span>
                      <time dateTime={item.checkOutAt ?? item.confirmedAt}>{time(item.checkOutAt ?? item.confirmedAt)}</time>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
