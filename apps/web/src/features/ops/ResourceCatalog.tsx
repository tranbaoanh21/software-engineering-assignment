import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import type { ChargingRequestView, NetworkHub, NetworkResource, ResourceKind } from '@semh/contracts';
import { canChargeLowBattery, lowBatteryChargePath } from '../chg/shared-charge';
import { displayTime, field, useCommand } from '../../shared/api/use-screen';

export const kindLabel: Record<ResourceKind, string> = {
  HUB: 'Hub', VEHICLE: 'Xe dùng chung', PARKING_SPACE: 'Chỗ đỗ', CHARGING_POINT: 'Cổng sạc',
};
const statuses: Record<string, string> = {
  DRAFT: 'Nháp', ACTIVE: 'Đang phục vụ', INACTIVE: 'Đã ngừng', AVAILABLE: 'Khả dụng',
  OUT_OF_SERVICE: 'Ngoài phục vụ', RESERVED: 'Đang giữ', OCCUPIED: 'Đang sử dụng',
  AWAITING_CHARGE: 'Chờ sạc', AWAITING_CHARGE_APPROVAL: 'Chờ đưa vào sử dụng', CHARGING: 'Đang sạc', TRANSFER_HELD: 'Đang giữ để điều chuyển',
};
export const stateLabel = (status: string) => statuses[status] ?? status;

export function ResourceCatalog({ hubs, admin, refresh }: { hubs: NetworkHub[]; admin?: boolean; refresh: () => void }) {
  const action = useCommand(refresh);
  const navigate = useNavigate();
  const [kind, setKind] = useState<ResourceKind>(admin ? 'HUB' : 'VEHICLE');
  const [hubId, setHubId] = useState('');
  const [category, setCategory] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<{ resource: NetworkResource; service?: 'ACTIVE' | 'INACTIVE' }>();
  const [message, setMessage] = useState('');
  const term = query.trim().toLocaleLowerCase('vi');
  const shown = hubs.filter(hub => !hubId || hub.id === hubId).flatMap(hub => hub.resources
    .filter(item => (!category || item.kind === category) && [item.code, item.description, hub.name, kindLabel[item.kind]].some(value => value.toLocaleLowerCase('vi').includes(term)))
    .map(resource => ({ hub, resource })));
  const selected = shown.find(item => item.resource.id === selectedId) ?? shown[0];
  const serving = selected?.resource.serviceStatus === 'ACTIVE';
  const canCharge = !admin && selected && selected.hub.serviceStatus === 'ACTIVE' &&
    selected.hub.resources.find(resource => resource.kind === 'HUB')?.status !== 'OUT_OF_SERVICE' &&
    canChargeLowBattery(selected.resource);

  async function chargeSelectedVehicle() {
    if (!selected) return;
    const result = await action.send<ChargingRequestView>(lowBatteryChargePath(selected.resource.id), { hubId: selected.hub.id });
    if (result) navigate('/operations/charging?' + new URLSearchParams({ request: result.id }));
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const input = {
      kind, code: field(form, 'code'), hubId: field(form, 'hub') || null, description: field(form, 'description'),
      name: field(form, 'name'), latitude: Number(field(form, 'latitude')), longitude: Number(field(form, 'longitude')),
      capacity: Number(field(form, 'capacity')), chargeKw: Number(field(form, 'chargeKw')),
      connector: field(form, 'connector'), powerKw: Number(field(form, 'powerKw')),
      reason: field(form, 'reason') || undefined,
    };
    const result = await action.send<NetworkResource>(admin ? '/operations/catalog' : '/operations/resources', input);
    if (result) {
      element.reset();
      setCreateOpen(false);
      setSelectedId(result.id);
      setQuery('');
      setCategory('');
      setHubId('');
      setMessage('Đã tạo ' + result.code + ' ở trạng thái nháp.');
    }
  }

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const { resource, service } = editing;
    const result = await action.send('/operations/resources/' + resource.kind + '/' + resource.id, {
      version: resource.version, reason: field(form, 'reason'),
      ...(service ? { serviceStatus: service } : { description: field(form, 'description') }),
    }, 'PATCH');
    if (result) {
      setMessage('Đã cập nhật ' + resource.code + '.');
      setEditing(undefined);
    }
  }

  return <div className="work-stack">
    {!editing && action.error && <p className="error" role="alert">{action.error}</p>}
    {message && <p className="handoff-notice" role="status">{message}</p>}
    <div className="filter-toolbar">
      <label className="search-field">Tìm tài nguyên<input type="search" placeholder="Mã, tên hoặc loại tài nguyên" value={query}
        onChange={event => { setQuery(event.target.value); setEditing(undefined); }} /></label>
      <label>Hub<select value={hubId} onChange={event => { setHubId(event.target.value); setEditing(undefined); }}>
        <option value="">Tất cả Hub</option>{hubs.map(hub => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
      </select></label>
      <label>Loại<select value={category} onChange={event => { setCategory(event.target.value); setEditing(undefined); }}>
        <option value="">Tất cả loại</option>{Object.entries(kindLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      {!createOpen && <button className={admin || !selected ? 'primary' : 'outline'} type="button" onClick={() => {
        setKind('VEHICLE');
        setEditing(undefined);
        setCreateOpen(true);
      }}>{admin ? 'Khai báo tài nguyên' : 'Thêm tài nguyên'}</button>}
      {admin && !createOpen && <button type="button" className="outline" onClick={() => { setKind('HUB'); setCreateOpen(true); }}>Khai báo Hub</button>}
    </div>
    {createOpen && <form className="work-card work-form work-form-wide" onSubmit={create}>
        <h2>{kind === 'HUB' ? 'Khai báo Hub' : 'Thêm tài nguyên'}</h2>
        <label>Loại<select value={kind} onChange={event => setKind(event.target.value as ResourceKind)}>
          {Object.entries(kindLabel).filter(([value]) => admin || value !== 'HUB')
            .map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>Mã tài nguyên<input name="code" required maxLength={32} /></label>
        {kind === 'HUB' ? <>
          <label>Tên Hub<input name="name" required maxLength={120} /></label>
          <label>Vĩ độ<input name="latitude" type="number" required step="any" min="-90" max="90" /></label>
          <label>Kinh độ<input name="longitude" type="number" required step="any" min="-180" max="180" /></label>
          <label>Sức chứa xe<input name="capacity" type="number" min="1" max="500" defaultValue="8" required /></label>
          <label>Công suất sạc Hub (kW)<input name="chargeKw" type="number" min=".1" step="any" defaultValue="2" required /></label>
        </> : <label>Hub<select name="hub" required><option value="">Chọn Hub</option>
          {hubs.map(hub => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
        </select></label>}
        {kind === 'CHARGING_POINT' && <>
          <label>Đầu nối<input name="connector" defaultValue="AC" maxLength={20} required /></label>
          <label>Công suất cổng (kW)<input name="powerKw" type="number" min=".05" step="any" defaultValue=".5" required /></label>
        </>}
        <label>Mô tả<input name="description" maxLength={400} /></label>
        {!admin && <label>Lý do<input name="reason" maxLength={500} required /></label>}
        <div className="work-actions">
          <button className="primary" disabled={action.pending}>Tạo bản ghi nháp</button>
          <button className="outline" type="button" onClick={() => setCreateOpen(false)}>Đóng</button>
        </div>
      </form>}
    <div className="app-pane-layout">
      <section className="work-card work-stack">
        <h2>Tài nguyên ({shown.length})</h2>
        {shown.length ? <div className="app-pane-list">{shown.map(({ hub, resource }) => <button className="app-pane-item" type="button"
          key={resource.id} aria-pressed={resource.id === selected?.resource.id} onClick={() => {
            setSelectedId(resource.id); setEditing(undefined); setMessage('');
          }}>
          <strong>{resource.code} · {kindLabel[resource.kind]}</strong><small>{hub.name}</small>
          <span className="status-pill" data-tone={resource.serviceStatus === 'DRAFT' ? 'warning'
            : resource.serviceStatus === 'ACTIVE' ? 'success' : 'danger'}>{stateLabel(resource.serviceStatus)}</span>
        </button>)}</div> : <p>Không tìm thấy tài nguyên phù hợp.</p>}
      </section>
      {selected && <section className="work-card work-stack" key={selected.resource.id}>
        <div className="work-heading"><h2>{selected.resource.code}</h2>
          <span className="status-pill">{stateLabel(selected.resource.status)}</span></div>
        <p>{kindLabel[selected.resource.kind]} · {selected.hub.name}</p>
        {selected.resource.description && <p>{selected.resource.description}</p>}
        <dl className="reservation-details">
          <div><dt>Phục vụ</dt><dd>{stateLabel(selected.resource.serviceStatus)}</dd></div>
          {selected.resource.batteryPercent !== undefined && <div><dt>Mức pin</dt><dd>{selected.resource.batteryPercent}%</dd></div>}
          <div><dt>Cập nhật</dt><dd>{selected.resource.observedAt ? displayTime(selected.resource.observedAt) : 'Chưa có dữ liệu'}</dd></div>
        </dl>
        {!admin && !editing && !createOpen && <div className="work-actions">
          {!serving && <button className="primary" type="button"
            onClick={() => setEditing({ resource: selected.resource, service: 'ACTIVE' })}>Kích hoạt</button>}
          {canCharge && <button className="primary" type="button" disabled={action.pending}
            onClick={() => void chargeSelectedVehicle()}>Sạc xe</button>}
          <button className={serving && !canCharge ? 'primary' : 'outline'} type="button"
            onClick={() => setEditing({ resource: selected.resource })}>Sửa mô tả</button>
          {serving && <button className="quiet-action quiet-action-destructive" type="button"
            onClick={() => setEditing({ resource: selected.resource, service: 'INACTIVE' })}>Ngừng phục vụ</button>}
        </div>}
        {editing && editing.resource.id === selected.resource.id && <form className="work-form inline-action" onSubmit={update} key={editing.resource.id + editing.service}>
          <h3>{editing.service === 'ACTIVE' ? 'Kích hoạt' : editing.service === 'INACTIVE' ? 'Ngừng phục vụ' : 'Sửa mô tả'} · {editing.resource.code}</h3>
          {!editing.service && <label>Mô tả<input name="description" defaultValue={editing.resource.description} maxLength={400} /></label>}
          {editing.service === 'INACTIVE' && <p>Tài nguyên sẽ không nhận lượt sử dụng mới sau khi ngừng phục vụ.</p>}
          <label>Lý do<input required name="reason" maxLength={500} /></label>
          {action.error && <p className="error" role="alert">{action.error}</p>}
          <div className="work-actions">
            <button className={editing.service === 'INACTIVE' ? 'danger' : 'primary'} disabled={action.pending}>
              {editing.service === 'ACTIVE' ? 'Xác nhận kích hoạt' : editing.service === 'INACTIVE' ? 'Xác nhận ngừng phục vụ' : 'Lưu mô tả'}
            </button>
            <button className="outline" type="button" disabled={action.pending} onClick={() => setEditing(undefined)}>Quay lại</button>
          </div>
        </form>}
      </section>}
    </div>
  </div>;
}
