import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  reservationHoldMinutes,
  reservationMinimumBatteryPercent,
  type HubView,
  type ReservationView,
} from '@semh/contracts';
import { api, ApiError } from '../../shared/api/http';
import { SessionContext } from '../../shared/auth/session-context';
import { MetricIcon } from '../../shared/ui/MetricIcon';
import { PageBanner } from '../../shared/ui/PageBanner';
import { reservationApi } from './reservation-api';

const bookingPath = '/student/hubs';
const reservationPath = '/student/reservations';
const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' });

function readAttempt(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveAttempt(key: string, requestId?: string) {
  try {
    if (requestId) sessionStorage.setItem(key, requestId);
    else sessionStorage.removeItem(key);
  } catch {
    // In-memory request IDs still support retries during this visit.
  }
}

function ReservationReceipt({ reservation, onChange }: {
  reservation: ReservationView;
  onChange: (value: ReservationView) => void;
}) {
  const session = useContext(SessionContext);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  async function cancel() {
    if (!session || cancelling) return;
    setCancelling(true);
    setCancelError('');
    try {
      onChange(await reservationApi.cancel(reservation.id, session.csrfToken));
      setShowCancel(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        window.location.assign('/login');
        return;
      }
      const outcome = await reservationApi.read(reservation.id, AbortSignal.timeout(5000)).catch(() => null);
      if (outcome && outcome.status !== 'CONFIRMED') {
        onChange(outcome);
        setShowCancel(false);
      } else {
        setCancelError(error instanceof ApiError ? error.message : 'Chưa xác nhận được kết quả hủy. Vui lòng thử lại.');
      }
    } finally {
      setCancelling(false);
    }
  }
  const initial = Math.max(0, Date.parse(reservation.expiresAt) - Date.parse(reservation.serverTime));
  const [deadline] = useState(() => Date.now() + initial);
  const [remaining, setRemaining] = useState(initial);

  useEffect(() => {
    const timer = window.setInterval(() => setRemaining(Math.max(0, deadline - Date.now())), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  const expired = reservation.status === 'EXPIRED' || (reservation.status === 'CONFIRMED' && remaining === 0);
  const confirmed = reservation.status === 'CONFIRMED' && !expired;
  const seconds = Math.ceil(remaining / 1000);
  const duration = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');

  return (
    <article className="booking-receipt">
      <Link className="receipt-back" to="/student/activity">← Hoạt động của tôi</Link>
      <PageBanner title={expired ? 'Lượt đặt đã hết hạn' : confirmed ? 'Lượt đặt xe' :
        reservation.status === 'CANCELLED' ? 'Đã hủy lượt đặt' : 'Chi tiết lượt đặt xe'}
        actions={confirmed && <span className="status-pill">Đã xác nhận</span>} />
      <div className="receipt-grid">
        <div className="work-stack">
          <section className="work-card receipt-vehicle">
            <div className="receipt-illustration"><img src="/design/scooter.svg" width={96} height={96} alt="" /></div>
            <div><h2>{reservation.vehicle.code}</h2><p>Xe dùng chung · {reservation.hub.name}</p></div>
          </section>
          <section className="work-card">
            <h2>Thông tin lượt đặt</h2>
            <dl className="reservation-details">
              <div><dt>Mã lượt đặt</dt><dd className="reservation-id">{reservation.id}</dd></div>
              <div><dt>Thời điểm xác nhận</dt><dd>{dateFormat.format(new Date(reservation.confirmedAt))}</dd></div>
              <div><dt>Hạn nhận xe</dt><dd>{dateFormat.format(new Date(reservation.expiresAt))}</dd></div>
              <div><dt>Hub nhận xe</dt><dd>{reservation.hub.name}</dd></div>
            </dl>
          </section>
        </div>
        <aside className="work-stack">
          <div className="work-card receipt-actions">
            <h2>{confirmed ? 'Xe đang được giữ cho bạn' : 'Thao tác'}</h2>
            {confirmed && <>
              <span className="receipt-time-label">Còn lại để nhận xe</span>
              <strong className="receipt-timer" aria-label="Thời gian giữ xe còn lại">{duration}</strong>
              <progress max={initial || 1} value={remaining} aria-label="Thời gian giữ xe" />
            </>}
      {showCancel && confirmed ? (
        <section className="cancel-confirmation" aria-label="Xác nhận hủy">
          <p>Hủy lượt đặt xe này?</p>
          <div className="reservation-actions">
            <button className="outline" onClick={() => { setShowCancel(false); setCancelError(''); }} disabled={cancelling}>Giữ lượt đặt</button>
            <button className="danger" onClick={cancel} disabled={cancelling}>Xác nhận hủy</button>
          </div>
          {cancelError && <p className="error" role="alert">{cancelError}</p>}
        </section>
      ) : (
        <div className="reservation-actions">
          {confirmed && <Link className="primary" to="/student/trips">Nhận xe</Link>}
          {confirmed && <button className="outline" type="button" onClick={() => setShowCancel(true)}>Hủy lượt đặt</button>}
          {reservation.status === 'FULFILLED' && <Link className="primary" to="/student/trips">Xem chuyến đi</Link>}
          <Link className="outline" to={bookingPath}>Về bản đồ Hub</Link>
        </div>
      )}
          </div>
          {confirmed && <div className="work-card metric-card">
            <h2>Nhận xe tại {reservation.hub.name}</h2>
            <p>Đến đúng Hub trước khi hết hạn và nhập mã trên xe để xác nhận bàn giao.</p>
            <MetricIcon name="hub" />
          </div>}
        </aside>
      </div>
    </article>
  );
}

function ReservationHoldDialog({ reservation }: { reservation: ReservationView }) {
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog className="reservation-card reservation-hold-dialog" ref={dialogRef} aria-labelledby="reservation-hold-title"
      onCancel={event => {
        event.preventDefault();
        navigate(reservationPath, { replace: true });
      }}>
      <h2 id="reservation-hold-title">Bạn đang giữ một xe</h2>
      <dl className="reservation-details">
        <div><dt>Mã xe</dt><dd>{reservation.vehicle.code}</dd></div>
        <div><dt>Hub nhận xe</dt><dd>{reservation.hub.name}</dd></div>
        <div><dt>Hạn nhận xe</dt><dd>{dateFormat.format(new Date(reservation.expiresAt))}</dd></div>
      </dl>
      <div className="reservation-actions">
        <Link className="primary" to={reservationPath} replace>Xem lượt đặt</Link>
        <Link className="outline" to={bookingPath} replace>Quay lại bản đồ</Link>
      </div>
    </dialog>
  );
}

export function ReservationPage() {
  const session = useContext(SessionContext);
  const [params] = useSearchParams();
  const vehicleId = params.get('vehicleId') ?? '';
  const hubId = params.get('hubId') ?? '';
  const attemptKey = session && vehicleId && hubId
    ? 'semh:reservation:' + [session.accountId, hubId, vehicleId].join(':')
    : '';
  const attempt = useRef<{ key: string; id: string }>(null);
  const submitting = useRef(false);
  const [reservation, setReservation] = useState<ReservationView | null>(null);
  const [hubs, setHubs] = useState<HubView[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(7000)]);
    let live = true;
    setLoading(true);
    setError('');
    setReservation(null);
    setHubs([]);

    async function load() {
      const previous = attemptKey && readAttempt(attemptKey);
      if (previous) {
        try {
          const record = await reservationApi.result(previous, signal);
          if (live) {
            saveAttempt(attemptKey);
            setReservation(record);
          }
          return;
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 404) throw err;
        }
      }

      const current = await reservationApi.active(signal);
      if (!live) return;
      if (current.reservation) {
        setReservation(current.reservation);
      } else if (vehicleId && hubId) {
        const list = await api<HubView[]>('/hubs', { signal });
        if (live) setHubs(list);
      }
    }

    load().catch(err => {
      if (!live) return;
      if (err instanceof ApiError && err.status === 401) window.location.assign('/login');
      else setError('Chưa tải được thông tin đặt xe. Vui lòng tải lại trang.');
    }).finally(() => {
      if (live) setLoading(false);
    });
    return () => {
      live = false;
      controller.abort();
    };
  }, [attemptKey, hubId, vehicleId]);

  const hub = hubs.find(item => item.id === hubId);
  const vehicle = hub?.vehicles.find(item => item.id === vehicleId);
  const bookable = vehicle?.status === 'AVAILABLE' && vehicle.batteryPercent >= reservationMinimumBatteryPercent;

  async function confirm() {
    if (!session || !bookable || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      const known = attempt.current?.key === attemptKey ? attempt.current.id : readAttempt(attemptKey);
      const requestId = known ?? crypto.randomUUID();
      attempt.current = { key: attemptKey, id: requestId };
      saveAttempt(attemptKey, requestId);
      await submit(requestId, session.csrfToken);
    } catch {
      setError('Chưa thể gửi yêu cầu đặt xe. Vui lòng thử lại.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  async function submit(requestId: string, csrfToken: string) {
    try {
      setReservation(await reservationApi.create({ requestId, vehicleId, hubId }, csrfToken));
      clearAttempt();
    } catch (err) {
      if (err instanceof ApiError && err.status < 500) {
        if (err.status === 401) {
          window.location.assign('/login');
          return;
        }
        clearAttempt();
        if (err.status === 409) {
          const current = await reservationApi.active(AbortSignal.timeout(5000)).catch(() => null);
          if (current?.reservation) {
            setReservation(current.reservation);
            return;
          }
        }
        setError(err.message);
        return;
      }

      try {
        setReservation(await reservationApi.result(requestId, AbortSignal.timeout(5000)));
        clearAttempt();
      } catch {
        setError('Chưa xác nhận được kết quả. Chọn Xác nhận đặt xe để kiểm tra lại cùng yêu cầu.');
      }
    }
  }

  function clearAttempt() {
    attempt.current = null;
    saveAttempt(attemptKey);
  }

  if (loading) return <p role="status">Đang tải thông tin đặt xe…</p>;
  if (reservation) {
    const choseAnotherVehicle = Boolean(hubId && vehicleId && vehicleId !== reservation.vehicle.id);
    return <>
      <ReservationReceipt key={reservation.id} reservation={reservation} onChange={setReservation} />
      {choseAnotherVehicle && reservation.status === 'CONFIRMED' && <ReservationHoldDialog reservation={reservation} />}
    </>;
  }

  return (
    <section><PageBanner title="Đặt xe" />
    <article className="reservation-card">
      {error && <p className="error" role="alert">{error}</p>}
      {vehicle && hub ? (
        <>
          <dl className="reservation-details">
            <div><dt>Xe dùng chung</dt><dd>{vehicle.code}</dd></div>
            <div><dt>Hub nhận xe</dt><dd>{hub.name}</dd></div>
            <div><dt>Mức pin</dt><dd>{vehicle.batteryPercent}%</dd></div>
            <div><dt>Thời gian giữ xe</dt><dd>{reservationHoldMinutes} phút</dd></div>
          </dl>
          {!bookable && <p role="status">Xe hiện chưa đủ điều kiện đặt. Vui lòng chọn xe khác.</p>}
          <div className="reservation-actions">
            <button className="primary" type="button" disabled={!bookable || saving} onClick={confirm}>
              {saving ? 'Đang xác nhận…' : 'Xác nhận đặt xe'}
            </button>
            <Link className="outline" to={bookingPath}>Chọn xe khác</Link>
          </div>
        </>
      ) : (
        <>
          {!error && <p>{vehicleId ? 'Xe đã chọn hiện không còn trong danh sách Hub.' : 'Bạn chưa có lượt đặt hiệu lực.'}</p>}
          <Link className="outline" to={bookingPath}>Chọn xe trên bản đồ Hub</Link>
        </>
      )}
    </article>
    </section>
  );
}
