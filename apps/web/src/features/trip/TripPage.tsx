import { useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { HubView, ReservationView, TripHandoffView, TripView } from '@semh/contracts';
import { field, useCommand } from '../../shared/api/use-screen';
import { api, ApiError } from '../../shared/api/http';
import { SessionContext } from '../../shared/auth/session-context';
import { reservationApi } from '../res/reservation-api';
import { PageBanner } from '../../shared/ui/PageBanner';
import { tripApi } from './trip-api';

const date = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' });

function resultMessage(status: string | null) {
  if (status === 'AWAITING_CHARGE') return 'Xe đang chờ sạc.';
  if (status === 'OUT_OF_SERVICE') return 'Xe cần được kỹ thuật kiểm tra.';
  return 'Xe đã được trả về Hub.';
}

export function TripPage() {
  const session = useContext(SessionContext);
  const report = useCommand();
  const [reportedTrip, setReportedTrip] = useState('');
  const [reservation, setReservation] = useState<ReservationView | null>(null);
  const [trips, setTrips] = useState<TripView[]>([]);
  const [hubs, setHubs] = useState<HubView[]>([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [vehicleCode, setVehicleCode] = useState('');
  const [selectedHubId, setSelectedHubId] = useState('');
  const [handoff, setHandoff] = useState<TripHandoffView | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const attempt = useRef<{ key: string; requestId: string }>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(7000)]);
    Promise.all([reservationApi.active(signal), tripApi.list(signal), api<HubView[]>('/hubs', { signal })])
      .then(([active, ownTrips, availableHubs]) => {
        if (controller.signal.aborted) return;
        setReservation(active.reservation);
        setTrips(ownTrips);
        setHubs(availableHubs);
      }).catch(err => {
        if (controller.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) window.location.assign('/login');
        else setError('Chưa tải được chuyến đi. Vui lòng tải lại trang.');
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!handoff || handoff.status !== 'PENDING') return;
    const controller = new AbortController();
    let busy = false;
    const timer = window.setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(4000)]);
        const state = await tripApi.handoff(handoff.id, signal);
        if (controller.signal.aborted || state.status === 'PENDING') return;
        setHandoff(state);
        attempt.current = null;
        if (state.status === 'APPLIED') {
          setVehicleCode('');
          setLoading(true);
          setRevision(value => value + 1);
        } else {
          setError(state.reason ?? 'Đã quá thời gian chờ xác nhận. Vui lòng thử lại.');
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) window.location.assign('/login');
      } finally {
        busy = false;
      }
    }, 1000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [handoff]);

  const trip = trips.find(item => item.id === selectedTripId) ?? trips[0];
  const waiting = handoff?.status === 'PENDING';

  async function submit(key: string, run: (requestId: string, csrfToken: string) => Promise<TripHandoffView>) {
    if (!session || sendingRef.current || waiting) return;
    sendingRef.current = true;
    setSending(true);
    setError('');
    try {
      if (attempt.current?.key !== key) attempt.current = { key, requestId: crypto.randomUUID() };
      const state = await run(attempt.current.requestId, session.csrfToken);
      setHandoff(state);
      if (state.status !== 'PENDING') {
        attempt.current = null;
        if (state.status === 'APPLIED') {
          setLoading(true);
          setRevision(value => value + 1);
        } else {
          setError(state.reason ?? 'Đã quá thời gian chờ xác nhận. Vui lòng thử lại.');
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.assign('/login');
        return;
      }
      if (err instanceof ApiError && err.status < 500) attempt.current = null;
      setError(err instanceof ApiError ? err.message : 'Chưa nhận được phản hồi. Hãy gửi lại thao tác này.');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  function pickup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = vehicleCode.trim().toUpperCase();
    if (!reservation || !code) return;
    setSelectedTripId('');
    void submit('pickup:' + reservation.id + ':' + code, (requestId, token) => tripApi.pickup({
      requestId, reservationId: reservation.id, vehicleCode: code,
    }, token));
  }

  function returnVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trip || !selectedHubId) return;
    setSelectedTripId(trip.id);
    void submit('return:' + trip.id + ':' + selectedHubId, (requestId, token) => tripApi.returnVehicle(
      trip.id, { requestId, hubId: selectedHubId }, token,
    ));
  }

  if (loading) return <p role="status">Đang tải chuyến đi…</p>;
  return (
    <div className="trip-content">
      <PageBanner title="Chuyến đi của bạn" />
      {(trip || reservation) && <ol className="trip-steps" aria-label="Tiến độ chuyến đi">
        <li aria-current={!trip ? 'step' : undefined}>Nhận xe</li>
        <li aria-current={trip?.status === 'IN_PROGRESS' ? 'step' : undefined}>Đang sử dụng</li>
        <li aria-current={trip && trip.status !== 'IN_PROGRESS' ? 'step' : undefined}>Kết thúc</li>
      </ol>}
      {error && <p className="error" role="alert">{error}</p>}
      {waiting && <p className="handoff-notice" role="status">Đang chờ thiết bị xác nhận bàn giao…</p>}
      {reservation?.status === 'CONFIRMED' && (
        <form className="reservation-card trip-form" onSubmit={pickup}>
          <h2>Nhận xe đã đặt</h2>
          <p>{reservation.vehicle.code} · {reservation.hub.name}</p>
          <label htmlFor="vehicle-code">Mã xe</label>
          <input id="vehicle-code" required maxLength={80} value={vehicleCode} onChange={event => setVehicleCode(event.target.value)} />
          <button className="primary" type="submit" disabled={sending || waiting}>Xác nhận nhận xe</button>
        </form>
      )}

      {trip && (
        <div className="trip-layout">
          <section className="work-card trip-vehicle-panel">
            <div className="trip-vehicle-visual"><img src="/design/bike.svg" alt="" width={160} height={160} /></div>
            <div><h2>{trip.vehicle.code}</h2><p>Xe dùng chung · {trip.startBattery}% pin đầu chuyến</p></div>
          </section>
        <section className="reservation-card">
          {trips.length > 1 && (
            <div className="trip-picker">
              <label htmlFor="selected-trip">Chọn chuyến</label>
              <select id="selected-trip" value={trip.id} onChange={event => setSelectedTripId(event.target.value)}>
                {trips.map(item => <option key={item.id} value={item.id}>{item.vehicle.code} · {date.format(new Date(item.startedAt))}</option>)}
              </select>
            </div>
          )}
          <h2>{trip.status === 'IN_PROGRESS' ? 'Đang diễn ra' : trip.status === 'COMPLETED' ? 'Chuyến đi hoàn tất' : 'Chuyến đi gián đoạn'}</h2>
          <dl className="reservation-details">
            <div><dt>Xe dùng chung</dt><dd>{trip.vehicle.code}</dd></div>
            <div><dt>Hub xuất phát</dt><dd>{trip.startHub.name}</dd></div>
            <div><dt>Bắt đầu</dt><dd>{date.format(new Date(trip.startedAt))}</dd></div>
            <div><dt>Pin đầu chuyến</dt><dd>{trip.startBattery}%</dd></div>
            {trip.endHub && <div><dt>Hub trả xe</dt><dd>{trip.endHub.name}</dd></div>}
            {trip.endBattery != null && <div><dt>Pin cuối chuyến</dt><dd>{trip.endBattery}%</dd></div>}
            {trip.endedAt && <div><dt>Kết thúc</dt><dd>{date.format(new Date(trip.endedAt))}</dd></div>}
            {trip.durationSeconds != null && <div><dt>Thời lượng</dt><dd>{Math.floor(trip.durationSeconds / 60)} phút {trip.durationSeconds % 60} giây</dd></div>}
          </dl>

          {trip.status === 'IN_PROGRESS' && (
            <form onSubmit={returnVehicle} className="trip-form">
              <label htmlFor="return-hub">Hub trả xe</label>
              <select id="return-hub" required value={selectedHubId} onChange={event => setSelectedHubId(event.target.value)}>
                <option value="">Chọn Hub tiếp nhận</option>
                {hubs.map(hub => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
              </select>
              <button className="primary" type="submit" disabled={sending || waiting}>Xác nhận trả xe</button>
            </form>
          )}
          {trip.status === 'IN_PROGRESS' && <details className="trip-incident">
            <summary>Báo sự cố với xe</summary>
            <form className="work-form" onSubmit={async event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const result = await report.send('/operations/trip-faults/' + trip.id, { description: field(form, 'description') });
              if (result) setReportedTrip(trip.id);
            }}>
              <label>Mô tả và vị trí hiện tại<textarea name="description" maxLength={1000} required /></label>
              <button className="outline" disabled={report.pending}>Gửi vận hành</button>
            </form>
            {report.error && <p className="error" role="alert">{report.error}</p>}
            {reportedTrip === trip.id && <p className="handoff-notice" role="status">Đã gửi sự cố cho vận hành.</p>}
          </details>}
          {trip.status === 'COMPLETED' && <p>{resultMessage(trip.endVehicleStatus)}</p>}
        </section>
        </div>
      )}

      {!trip && !reservation && !error && (
        <p>Bạn chưa có chuyến đi. <Link to="/student/hubs">Chọn xe trên bản đồ Hub</Link></p>
      )}
    </div>
  );
}
