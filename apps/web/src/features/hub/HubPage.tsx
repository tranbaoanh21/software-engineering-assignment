import { useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { reservationMinimumBatteryPercent, type NetworkHub } from '@semh/contracts';
import { MetricIcon } from '../../shared/ui/MetricIcon';
import { displayTime, field, useScreen } from '../../shared/api/use-screen';
import { kindLabel, stateLabel } from '../ops/ResourceCatalog';
import { availability, HubMap, type Need } from './HubMap';
import { HubSearchField } from './HubSearchField';
import './hub.css';

type Site = NetworkHub & { distanceKm: number | null };
type Position = { latitude: number; longitude: number };
const needs: readonly Need[] = ['vehicle', 'parking', 'charging'];
const noHubs: readonly Site[] = [];

function HubAvailability({ hub }: { hub: NetworkHub }) {
  return <dl className="metric-grid hub-availability">
    {needs.map(need => <div className="work-card metric-card" key={need}>
      <dt className="metric-label">{availability[need].label}<MetricIcon name={need} /></dt>
      <dd className="metric-value">{hub[availability[need].field]}</dd>
    </div>)}
  </dl>;
}

function HubDetails({ hub, canBook, initialNeed, onAlternatives }: {
  hub: Site;
  canBook: boolean;
  initialNeed: Need;
  onAlternatives: (need: Need) => void;
}) {
  const [kind, setKind] = useState(initialNeed);
  const hubQuery = new URLSearchParams({ hubId: hub.id });
  const resourceKind = { vehicle: 'VEHICLE', parking: 'PARKING_SPACE', charging: 'CHARGING_POINT' } as const;
  const resources = hub.resources.filter(item => item.kind === resourceKind[kind]);
  const chargingIsPrimary = canBook && kind === 'charging' && hub.availableCharging > 0;
  const updatedAt = hub.resources.reduce((latest, item) =>
    item.observedAt && item.observedAt > latest ? item.observedAt : latest, '');

  return <section className="hub-detail work-stack">
    <header className="work-card work-heading">
      <div>
        <span className="hub-code">{hub.code}</span>
        <h1>{hub.name}</h1>
        {hub.distanceKm !== null && <p className="hub-distance">Cách vị trí tham chiếu {hub.distanceKm.toFixed(1)} km</p>}
        {updatedAt && <p className="hub-distance">Cập nhật {displayTime(updatedAt)}</p>}
      </div>
      <span className="status-pill" data-tone={hub.serviceStatus === 'ACTIVE' ? 'success' : 'neutral'}>{stateLabel(hub.serviceStatus)}</span>
    </header>
    <HubAvailability hub={hub} />
    <div className="hub-detail-toolbar">
      <div className="work-tabs hub-detail-tabs" role="group" aria-label="Dịch vụ tại Hub">
        {needs.map(item => <button key={item} className="outline" type="button" aria-pressed={item === kind}
          onClick={() => setKind(item)}>{kindLabel[resourceKind[item]]}</button>)}
      </div>
      <div className="work-actions">
        {canBook && kind === 'charging' && <Link className={chargingIsPrimary ? 'primary' : 'outline'}
          to={'/student/charging?' + hubQuery}>Đăng ký nhu cầu sạc</Link>}
        <button className={chargingIsPrimary ? 'outline' : 'primary'} type="button"
          onClick={() => onAlternatives(kind)}>Tìm Hub thay thế</button>
      </div>
    </div>
    <div className="work-card data-card">
      <div className="scroll-table" role="region" tabIndex={0} aria-label={kindLabel[resourceKind[kind]]}>
        <table>
          <thead><tr><th>Mã tài nguyên</th><th>Loại</th>{kind === 'vehicle' && <th>Pin</th>}<th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>{resources.map(item => {
            const state = item.serviceStatus === 'ACTIVE' ? item.status : item.serviceStatus;
            const available = state === 'AVAILABLE';
            const bookable = available && hub.availableVehicles > 0 && (item.batteryPercent ?? 0) >= reservationMinimumBatteryPercent;
            return <tr key={item.id}>
              <td><strong>{item.code}</strong></td><td>{kindLabel[item.kind]}</td>
              {kind === 'vehicle' && <td>{item.batteryPercent === undefined ? '—' : item.batteryPercent + '%'}</td>}
              <td><span className="status-pill" data-tone={available ? 'success' : 'neutral'}>{stateLabel(state)}</span></td>
              <td>{kind === 'vehicle' && bookable ? <Link className="table-link" to={canBook
                  ? '/student/reservations?' + new URLSearchParams({ hubId: hub.id, vehicleId: item.id }) : '/login'}>{canBook ? 'Đặt xe' : 'Đăng nhập để đặt'}</Link>
                : kind !== 'vehicle' && canBook && available ? <Link className="table-link"
                  to={'/student/' + (kind === 'parking' ? 'parking?' : 'charging?') + hubQuery}>
                  {kind === 'parking' ? 'Đặt chỗ đỗ' : 'Đăng ký sạc'}
                </Link> : '—'}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      {!resources.length && <p className="data-empty">Chưa có tài nguyên thuộc loại này.</p>}
    </div>
  </section>;
}

export function HubPage({ canBook = false }: { canBook?: boolean }) {
  const [route, setRoute] = useSearchParams();
  const detailId = route.get('hub');
  const [selected, setSelected] = useState(detailId ?? undefined);
  const [filters, setFilters] = useState('');
  const [query, setQuery] = useState('');
  const [need, setNeed] = useState<Need | ''>('');
  const [origin, setOrigin] = useState<Position>();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const searchForm = useRef<HTMLFormElement>(null);
  const all = useScreen<Site[]>('/network/hubs', 10000);
  const search = useScreen<Site[]>(filters ? '/network/hubs?' + filters : '', 10000);
  const screen = filters ? search : all;
  const hubs = screen.data ?? noHubs;
  const active = hubs.find(hub => hub.id === selected) ?? hubs[0];
  const detail = hubs.find(hub => hub.id === detailId) ?? all.data?.find(hub => hub.id === detailId);
  const applied = new URLSearchParams(filters);
  const metric = (applied.get('need') as Need | null) ?? 'vehicle';
  const alternativeOrigin = applied.get('alternativeFor');
  const sourceHub = all.data?.find(hub => hub.id === alternativeOrigin);
  const selectedMetric = availability[metric];

  function locate() {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Trình duyệt chưa hỗ trợ vị trí.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      setOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLocating(false);
    }, () => {
      setLocationError('Không đọc được vị trí. Bạn vẫn có thể chọn một Hub làm mốc.');
      setLocating(false);
    }, { timeout: 7000 });
  }

  function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parameters = new URLSearchParams();
    const query = field(form, 'q');
    if (query) parameters.set('q', query);
    if (need) parameters.set('need', need);
    const start = origin ?? all.data?.find(hub => hub.id === field(form, 'origin'));
    if (start) {
      parameters.set('latitude', String(start.latitude));
      parameters.set('longitude', String(start.longitude));
      const radius = field(form, 'radius');
      if (radius) parameters.set('radiusKm', radius);
    }
    setSelected(undefined);
    setFilters(parameters.toString());
  }

  function reset() {
    searchForm.current?.reset();
    setQuery('');
    setFilters('');
    setNeed('');
    setOrigin(undefined);
    setLocationError('');
    setSelected(undefined);
  }

  function openHub(id: string) {
    setSelected(id);
    setRoute({ hub: id });
  }

  function alternatives(hub: Site, service: Need) {
    const parameters = new URLSearchParams({ alternativeFor: hub.id, radiusKm: '5', need: service });
    setSelected(undefined);
    setQuery('');
    setNeed(service);
    setFilters(parameters.toString());
    setRoute({});
  }

  if (detailId) return <div className="hub-detail-page">
    <Link className="outline" to={canBook ? "/student/hubs" : "/hubs"}>← Về bản đồ</Link>
    {detail ? <HubDetails key={detail.id} hub={detail} canBook={canBook} initialNeed={need || metric}
      onAlternatives={service => alternatives(detail, service)} />
      : <p role="status">{all.error || (all.data ? 'Không tìm thấy Hub này.' : 'Đang tải Hub…')}</p>}
  </div>;

  const map = <HubMap hubs={hubs} selected={active?.id} onSelect={setSelected} need={metric} searchKey={filters} />;
  const mapFirst = canBook && !alternativeOrigin;
  return (
    <section className="hub-content" aria-labelledby="hubs-title">
      <header className={alternativeOrigin ? 'work-card hub-alternative-heading' : 'page-heading'}>
        <div>
          <h1 id="hubs-title">{alternativeOrigin ? 'Hub thay thế' : 'Khám phá Mobility Hub'}</h1>
          <p>{alternativeOrigin ? 'Trong 5 km quanh ' + (sourceHub?.name ?? 'Hub ban đầu') : 'Khu đô thị Đại học Quốc gia TP.HCM'}</p>
        </div>
        {alternativeOrigin && <button className="outline" type="button" onClick={reset}>Về danh sách Hub</button>}
      </header>
      {!alternativeOrigin && <form className="work-card hub-filters" onSubmit={find} ref={searchForm} aria-label="Tìm Hub">
        <div className="hub-search-row">
          <HubSearchField hubs={all.data ?? noHubs} value={query} loading={!all.data && !all.error}
            onChange={setQuery} onSelect={openHub} />
          <button className="primary" type="submit">Tìm Hub</button>
        </div>
        <div className="hub-search-secondary">
          <div className="hub-service-filters" role="group" aria-label="Nhu cầu">
            {canBook && <span>Nhu cầu</span>}
            {([['', canBook ? 'Tất cả dịch vụ' : 'Tất cả'], ['vehicle', 'Xe dùng chung'],
              ['parking', canBook ? 'Chỗ đỗ cá nhân' : 'Chỗ đỗ'], ['charging', 'Cổng sạc']] as const)
              .map(([value, label]) => <button type="button" key={value} className="outline"
                aria-pressed={need === value} onClick={() => setNeed(value)}>{label}</button>)}
          </div>
          <details className="hub-location" onInvalid={event => { event.currentTarget.open = true; }}>
            <summary>Vị trí và bán kính</summary>
            <div className="hub-location-row">
              <label>Vị trí tham chiếu
                {origin ? <input value="Vị trí hiện tại" readOnly /> : <select name="origin">
                  <option value="">Không giới hạn</option>
                  {all.data?.map(hub => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
                </select>}
              </label>
              <label>Bán kính (km)<input name="radius" type="number" min=".1" max="80" step=".1" defaultValue="5" /></label>
              <button className="outline" type="button" disabled={locating} onClick={origin ? () => setOrigin(undefined) : locate}>
                {origin ? 'Bỏ vị trí' : locating ? 'Đang xác định vị trí…' : 'Dùng vị trí hiện tại'}
              </button>
            </div>
          </details>
          {filters && <button className="outline" type="button" onClick={reset}>Xóa bộ lọc</button>}
        </div>
        {locationError && <p className="error" role="status">{locationError}</p>}
      </form>}
      {screen.error && <div className="error hub-load-error" role="alert">
        <span>{screen.error}</span>
        <button className="outline" type="button" onClick={screen.refresh}>Thử lại</button>
      </div>}
      <div className="hub-grid">
        <section className="hub-results" aria-labelledby="hub-results-title">
          <header>
            <h2 id="hub-results-title">{alternativeOrigin ? selectedMetric.label : 'Các Hub'}</h2>
            {screen.data && <span>{hubs.length} Hub</span>}
          </header>
          {!screen.data && !screen.error && <p role="status">Đang tải Hub…</p>}
          {screen.data && !hubs.length && <p>{alternativeOrigin
            ? 'Không có Hub phù hợp trong bán kính 5 km.' : 'Không có Hub đáp ứng bộ lọc.'}</p>}
          <ul className="hub-options">
            {hubs.map(hub => <li key={hub.id}>
              <button type="button" aria-pressed={active?.id === hub.id} onClick={() => setSelected(hub.id)}>
                <span className="hub-card-title"><strong>{hub.name}</strong>
                  <small>{hub.code}</small></span>
                {hub.distanceKm !== null && <span>{hub.distanceKm.toFixed(1)} km</span>}
                {alternativeOrigin ? <span className="hub-alternative-count">
                  <strong>{hub[selectedMetric.field]}</strong> {selectedMetric.label.toLowerCase()}
                </span> : <span className="hub-card-counts">
                  <span>Xe dùng chung <strong>{hub.availableVehicles} / {hub.capacity}</strong></span>
                  <span>Chỗ đỗ trống <strong>{hub.availableParking} / {hub.parkingCount}</strong></span>
                  <span>Cổng sạc trống <strong>{hub.availableCharging} / {hub.chargingCount}</strong></span>
                </span>}
              </button>
            </li>)}
          </ul>
        </section>
        <div className="hub-map-stack">
          {mapFirst && map}
          {active && <article className="work-card work-heading hub-selected-summary">
            <div>
              <h2>{active.name}</h2>
              <p>{alternativeOrigin ? active[selectedMetric.field] + ' ' + selectedMetric.label.toLowerCase() :
                active.availableVehicles + ' xe khả dụng · ' + active.availableParking + ' chỗ đỗ trống · ' + active.availableCharging + ' cổng sạc trống'}</p>
            </div>
            <Link className="primary" to={'?hub=' + encodeURIComponent(active.id)}>Xem chi tiết Hub</Link>
          </article>}
          {!mapFirst && map}
        </div>
      </div>
    </section>
  );
}
