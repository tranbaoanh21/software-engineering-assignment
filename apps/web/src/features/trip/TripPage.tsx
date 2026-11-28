import { useContext, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { HubView, ReservationView, TripHandoffView, TripView } from '@semh/contracts';
import { field, useCommand } from '../../shared/api/use-screen';
import { api, ApiError } from '../../shared/api/http';
import { SessionContext } from '../../shared/auth/session-context';
import { reservationApi } from '../res/reservation-api';
import { MetricIcon } from '../../shared/ui/MetricIcon';
import { SharedVehicleSummary, VehiclePlate } from '../../shared/ui/VehicleVisual';
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
  const [returningTripId, setReturningTripId] = useState('');
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
          setSelectedHubId('');
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

  const activeTrips = trips.filter(item => item.status === 'IN_PROGRESS');
  const history = trips.filter(item => item.status !== 'IN_PROGRESS');
  const trip = activeTrips.find(item => item.id === selectedTripId) ?? activeTrips[0];
  const returned = history.find(item => item.id === (returningTripId || reportedTrip));
  const hasActiveTrip = activeTrips.length > 0;
  const waiting = handoff?.status === 'PENDING';
  const pickupReservation = reservation?.status === 'CONFIRMED' ? reservation : null;
  const step = trip ? 2 : pickupReservation ? 1 : returned ? 3 : null;

  useEffect(() => {
    if (!hasActiveTrip || waiting || loading) return;
    const controller = new AbortController();
    let busy = false;
    const timer = window.setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const next = await tripApi.list(AbortSignal.any([controller.signal, AbortSignal.timeout(3500)]));
        if (!controller.signal.aborted) setTrips(next);
      } catch (err) {
        if (!controller.signal.aborted && err instanceof ApiError && err.status === 401) window.location.assign('/login');
      } finally {
        busy = false;
      }
    }, 1500);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [hasActiveTrip, waiting, loading]);

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
          setVehicleCode('');
          setSelectedHubId('');
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
    setReturningTripId('');
    setReportedTrip('');
    void submit('pickup:' + reservation.id + ':' + code, (requestId, token) => tripApi.pickup({
      requestId, reservationId: reservation.id, vehicleCode: code,
    }, token));
  }

  function returnVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trip || trip.vehicleFault || !selectedHubId) return;
    setSelectedTripId(trip.id);
    setReturningTripId(trip.id);
    void submit('return:' + trip.id + ':' + selectedHubId, (requestId, token) => tripApi.returnVehicle(
      trip.id, { requestId, hubId: selectedHubId }, token,
    ));
  }

  if (loading) return <p role="status">Đang tải chuyến đi…</p>;
  const pickupForm = pickupReservation && <form className="work-card trip-form" onSubmit={pickup}>
    <h2>Nhận xe đã đặt</h2>
    <p className="trip-pickup-vehicle"><VehiclePlate code={pickupReservation.vehicle.code} /><span>{pickupReservation.hub.name}</span></p>
    <label htmlFor="vehicle-code">Mã trên xe</label>
    <input id="vehicle-code" required maxLength={80} value={vehicleCode} onChange={event => setVehicleCode(event.target.value)} />
    <button className="primary" type="submit" disabled={sending || waiting}>Xác nhận nhận xe</button>
  </form>;

  return (
    <section className="trip-content">
      <PageBanner title="Chuyến đi của bạn" />
      {step && <ol className="trip-steps" aria-label="Tiến độ chuyến đi">
        <li aria-current={step === 1 ? 'step' : undefined}>Nhận xe</li>
        <li aria-current={step === 2 ? 'step' : undefined}>Đang sử dụng</li>
        <li aria-current={step === 3 ? 'step' : undefined}>Kết thúc</li>
      </ol>}
      {error && <p className="error" role="alert">{error}</p>}
      {waiting && <p className="handoff-notice" role="status">Đang chờ thiết bị xác nhận bàn giao…</p>}

      {!trip && pickupForm}
      {trip && <article className="work-card work-stack trip-current">
        <SharedVehicleSummary code={trip.vehicle.code} hubName={trip.startHub.name} status="Đang sử dụng" />
        {activeTrips.length > 1 && <div className="trip-picker">
          <label htmlFor="selected-trip">Chuyến đang diễn ra</label>
          <select id="selected-trip" value={trip.id} onChange={event => {
            setSelectedTripId(event.target.value);
            setSelectedHubId('');
          }} disabled={waiting || sending}>
            {activeTrips.map(item => <option key={item.id} value={item.id}>{item.vehicle.code}</option>)}
          </select>
        </div>}
        <div className="work-card metric-card trip-battery">
          <span className="metric-label">Pin hiện tại</span>
          <strong className="metric-value">{trip.currentBattery ?? trip.startBattery}%</strong>
          <MetricIcon name="battery" />
          <progress value={trip.currentBattery ?? trip.startBattery} max={100} aria-label="Pin hiện tại" />
        </div>
        {trip.vehicleFault || reportedTrip === trip.id
          ? <p className="handoff-notice" role="status">Đã ghi nhận sự cố. Chờ kỹ thuật tiếp nhận xe tại địa điểm báo hỏng.</p>
          : <form onSubmit={returnVehicle} className="trip-form">
            <label htmlFor="return-hub">Hub trả xe</label>
            <select id="return-hub" required value={selectedHubId} onChange={event => setSelectedHubId(event.target.value)}>
              <option value="">Chọn Hub tiếp nhận</option>
              {hubs.map(hub => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
            </select>
            <button className="primary" type="submit" disabled={sending || waiting || report.pending}>Xác nhận trả xe</button>
          </form>}
        <details>
          <summary>Thông tin chuyến đi</summary>
          <dl className="reservation-details">
            <div><dt>Hub xuất phát</dt><dd>{trip.startHub.name}</dd></div>
            <div><dt>Bắt đầu</dt><dd>{date.format(new Date(trip.startedAt))}</dd></div>
            <div><dt>Pin đầu chuyến</dt><dd>{trip.startBattery}%</dd></div>
          </dl>
        </details>
        {reportedTrip !== trip.id && <details className="trip-incident">
          <summary className={trip.vehicleFault ? 'primary' : undefined}>
            {trip.vehicleFault ? 'Cập nhật địa điểm sự cố' : 'Báo sự cố với xe'}
          </summary>
          <form className="work-form" key={trip.id} onSubmit={async event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const result = await report.send('/operations/trip-faults/' + trip.id, {
              location: field(form, 'location'), description: field(form, 'description') || undefined,
            });
            if (result) setReportedTrip(trip.id);
          }}>
            <label>Địa điểm xe bị hư<input name="location" maxLength={240} placeholder="Ví dụ: Cổng chính KTX B" required /></label>
            <label>Mô tả thêm (tùy chọn)<textarea name="description" maxLength={1000} /></label>
            <button className="primary" disabled={report.pending || sending || waiting}>{report.pending ? 'Đang gửi…' : 'Gửi vận hành'}</button>
          </form>
          {report.error && <p className="error" role="alert">{report.error}</p>}
        </details>}
      </article>}
      {trip && pickupForm && <details className="work-card"><summary>Xe đang được giữ</summary>{pickupForm}</details>}

      {!trip && !pickupReservation && returned && <article className="work-card trip-current" role="status">
        <h2>{returned.status === 'COMPLETED' ? 'Chuyến đi hoàn tất' : 'Chuyến đi gián đoạn'}</h2>
        <p>{returned.vehicle.code}{returned.endHub && ' · ' + returned.endHub.name}</p>
        {returned.endBattery !== null && <p>Pin đầu chuyến {returned.startBattery}% → Pin cuối chuyến {returned.endBattery}%</p>}
        {returned.status === 'COMPLETED' ? <p>{resultMessage(returned.endVehicleStatus)}</p>
          : <p>Kỹ thuật đã tiếp nhận xe và kết thúc chuyến đi.</p>}
        <Link className="primary" to="/student/hubs">Về bản đồ Hub</Link>
      </article>}
      {!trip && !pickupReservation && !returned && !error && <div className="work-card trip-current">
        <p>Bạn chưa có chuyến đi đang diễn ra.</p>
        <Link className="primary" to="/student/hubs">Chọn xe trên bản đồ Hub</Link>
      </div>}

      {history.length > 0 && <details className="work-card trip-history">
        <summary>Lịch sử chuyến đi ({history.length})</summary>
        {history.map(item => <details key={item.id} className="trip-history-item">
          <summary><strong>{item.vehicle.code}</strong> · {date.format(new Date(item.startedAt))}
            <span>{item.status === 'COMPLETED' ? 'Hoàn tất' : 'Gián đoạn'}</span>
          </summary>
          <dl className="reservation-details">
            <div><dt>Hub xuất phát</dt><dd>{item.startHub.name}</dd></div>
            <div><dt>Pin đầu chuyến</dt><dd>{item.startBattery}%</dd></div>
            {item.endHub && <div><dt>Hub trả xe</dt><dd>{item.endHub.name}</dd></div>}
            {item.endBattery !== null && <div><dt>Pin cuối chuyến</dt><dd>{item.endBattery}%</dd></div>}
            {item.endedAt && <div><dt>Kết thúc</dt><dd>{date.format(new Date(item.endedAt))}</dd></div>}
            {item.durationSeconds !== null && <div><dt>Thời lượng</dt><dd>{Math.floor(item.durationSeconds / 60)} phút {item.durationSeconds % 60} giây</dd></div>}
          </dl>
        </details>)}
      </details>}
    </section>
  );
}
