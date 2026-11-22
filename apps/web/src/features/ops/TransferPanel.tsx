import { useState, type FormEvent } from 'react';
import type { NetworkHub, PlanView } from '@semh/contracts';
import { displayTime, field, useCommand } from '../../shared/api/use-screen';

export interface TransferDraft {
  sourceHubId: string;
  targetHubId: string;
  vehicleIds: string[];
  reason: string;
  recommendationId: string | null;
}

const statuses: Record<PlanView['status'], string> = {
  DRAFT: 'Nháp', APPROVED: 'Đã duyệt', IN_PROGRESS: 'Đang thực hiện', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy',
};
const actions = {
  APPROVE: 'Duyệt kế hoạch', DEPART: 'Xác nhận đã rời nguồn', ARRIVE: 'Xác nhận đã đến đích',
  COMPLETE: 'Hoàn tất', CANCEL: 'Hủy kế hoạch',
};
type Action = keyof typeof actions;

const dateInput = (iso?: string) => {
  const time = iso ? new Date(iso) : new Date(Date.now() + 30 * 60_000);
  return new Date(time.getTime() - time.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export function TransferPanel({ hubs, plans, prefilled, refresh }: {
  hubs: NetworkHub[]; plans: PlanView[]; prefilled?: TransferDraft; refresh: () => void;
}) {
  const command = useCommand(refresh);
  const [formOpen, setFormOpen] = useState(!!prefilled);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [edit, setEdit] = useState<PlanView>();
  const [source, setSource] = useState(prefilled?.sourceHubId ?? '');
  const [picked, setPicked] = useState(prefilled?.vehicleIds ?? []);
  const [operation, setOperation] = useState<{ plan: PlanView; action: Action; vehicleId?: string }>();
  const [message, setMessage] = useState('');
  const sourceHub = hubs.find(hub => hub.id === source);
  const vehicles = sourceHub?.resources.filter(item => item.kind === 'VEHICLE' && item.status === 'AVAILABLE' &&
    item.serviceStatus === 'ACTIVE' && (item.batteryPercent ?? 0) >= 30) ?? [];
  const name = (id: string) => hubs.find(hub => hub.id === id)?.name ?? id.slice(0, 8);
  const visible = plans.filter(plan => !filter || plan.status === filter);
  const selected = plans.find(plan => plan.id === selectedId);
  const vehicleName = (id: string) => hubs.flatMap(hub => hub.resources).find(item => item.id === id)?.code ?? id.slice(0, 8);

  function editPlan(plan?: PlanView) {
    setEdit(plan);
    setSource(plan?.sourceHubId ?? prefilled?.sourceHubId ?? '');
    setPicked(plan?.items.map(item => item.vehicleId) ?? prefilled?.vehicleIds ?? []);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await command.send<PlanView>('/operations/plans' + (edit ? '/' + edit.id : ''), {
      sourceHubId: source, targetHubId: field(form, 'target'), vehicleIds: picked,
      scheduledAt: new Date(field(form, 'scheduledAt')).toISOString(), reason: field(form, 'reason'),
      recommendationId: edit?.recommendationId ?? prefilled?.recommendationId ?? null, version: edit?.version,
    }, edit ? 'PATCH' : 'POST');
    if (result) {
      setMessage('Đã lưu kế hoạch nháp.');
      editPlan();
      setFormOpen(false);
    }
  }

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!operation) return;
    const { plan, action, vehicleId } = operation;
    const form = new FormData(event.currentTarget);
    const result = await command.send<PlanView>('/operations/plans/' + plan.id + '/actions', {
      action, vehicleId, actualHubId: field(form, 'actualHub') || undefined, version: plan.version, reason: field(form, 'reason'),
    });
    if (result) { setOperation(undefined); setMessage(actions[action] + ' thành công.'); }
  }

  return <section className="work-stack">
    {command.error && <p className="error" role="alert">{command.error}</p>}
    {message && <p className="handoff-notice" role="status">{message}</p>}
    <div className="filter-toolbar work-heading">
      <label>Trạng thái<select value={filter} onChange={event => setFilter(event.target.value)}>
        <option value="">Tất cả trạng thái</option>
        {Object.entries(statuses).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
      </select></label>
      <button className="primary" type="button" onClick={() => { editPlan(); setFormOpen(!formOpen); }}>
        {formOpen ? 'Đóng biểu mẫu' : 'Tạo kế hoạch'}
      </button>
    </div>
    {formOpen && <form className="work-card work-form work-form-wide" onSubmit={save} key={edit?.id ?? 'new'}>
      <h2>{edit ? 'Sửa kế hoạch' : 'Lập kế hoạch điều chuyển'}</h2>
      <label>Hub nguồn<select value={source} required onChange={event => { setSource(event.target.value); setPicked([]); }}>
        <option value="">Chọn Hub nguồn</option>
        {hubs.filter(hub => hub.serviceStatus === 'ACTIVE').map(hub => <option value={hub.id} key={hub.id}>{hub.name}</option>)}
      </select></label>
      <label>Hub đích<select name="target" required defaultValue={edit?.targetHubId ?? prefilled?.targetHubId ?? ''}>
        <option value="">Chọn Hub đích</option>
        {hubs.filter(hub => hub.serviceStatus === 'ACTIVE').map(hub => <option value={hub.id} key={hub.id} disabled={hub.id === source}>
          {hub.name} · {Math.max(0, hub.capacity - hub.vehicleCount - hub.heldArrivals)} chỗ nhận xe
        </option>)}
      </select></label>
      <label>Thời gian dự kiến<input name="scheduledAt" type="datetime-local" required defaultValue={dateInput(edit?.scheduledAt)} /></label>
      <label>Lý do<input name="reason" maxLength={500} required defaultValue={edit?.reason ?? prefilled?.reason} /></label>
      <fieldset><legend>Xe đủ điều kiện</legend>
        {!vehicles.length && <p>Chọn Hub nguồn còn xe khả dụng.</p>}
        {vehicles.map(item => <label className="check-field" key={item.id}>
          <input type="checkbox" checked={picked.includes(item.id)} onChange={event => setPicked(prior =>
            event.target.checked ? [...prior, item.id] : prior.filter(id => id !== item.id))} />
          {item.code} · {item.batteryPercent}% pin
        </label>)}
      </fieldset>
      <div className="work-actions">
        <button className="primary" disabled={command.pending || !picked.length}>Lưu nháp</button>
        {edit && <button className="outline" type="button" onClick={() => editPlan()}>Bỏ sửa</button>}
      </div>
    </form>}
    {operation && <form className="work-card work-form" onSubmit={apply} key={operation.plan.id + operation.action + operation.vehicleId}>
      <h2>{actions[operation.action]}</h2>
      {operation.vehicleId && <p>Xe {vehicleName(operation.vehicleId)}</p>}
      {operation.vehicleId && <label>Hub xác nhận thực tế<select name="actualHub" required><option value="">Chọn Hub</option>
        {hubs.map(hub => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
      </select></label>}
      <label>Ghi chú hoặc lý do<input name="reason" required maxLength={500} /></label>
      <div className="work-actions"><button className="primary" disabled={command.pending}>Xác nhận thao tác</button>
        <button className="outline" type="button" onClick={() => setOperation(undefined)}>Đóng</button></div>
    </form>}
    <section className="work-card data-card">
      <h2 className="data-card-heading">Danh sách kế hoạch ({visible.length})</h2>
      <div className="scroll-table" role="region" tabIndex={0} aria-label="Kế hoạch điều chuyển">
        <table>
          <thead><tr><th>Hub nguồn</th><th>Hub đích</th><th>Số xe</th><th>Thời gian dự kiến</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>{visible.map(plan => <tr key={plan.id} data-selected={plan.id === selectedId}>
            <td>{name(plan.sourceHubId)}</td><td>{name(plan.targetHubId)}</td><td>{plan.items.length}</td>
            <td>{displayTime(plan.scheduledAt)}</td><td><span className="status-pill" data-tone={
              plan.status === 'COMPLETED' ? 'success' : plan.status === 'CANCELLED' ? 'danger' : 'info'
            }>{statuses[plan.status]}</span></td>
            <td><button type="button" className="outline" onClick={() => setSelectedId(plan.id)}>Xem chi tiết</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!visible.length && <p className="data-empty">Không có kế hoạch phù hợp.</p>}
    </section>
    {selected && <article className="work-card" key={selected.id}>
      <div className="work-heading"><h3>{name(selected.sourceHubId)} → {name(selected.targetHubId)}</h3><span className="status-pill">{statuses[selected.status]}</span></div>
      <p>{displayTime(selected.scheduledAt)} · {selected.reason}</p>
      <ul className="work-list">{selected.items.map(item => <li key={item.vehicleId}>
        <span>{vehicleName(item.vehicleId)} · {{ PLANNED: 'Chưa rời Hub', DEPARTED: 'Đang chuyển', ARRIVED: 'Đã đến đích', CANCELLED: 'Đã hủy' }[item.status]}</span>
        {['APPROVED', 'IN_PROGRESS'].includes(selected.status) && ['PLANNED', 'DEPARTED'].includes(item.status) && <button className="outline" type="button"
          onClick={() => setOperation({ plan: selected, action: item.status === 'PLANNED' ? 'DEPART' : 'ARRIVE', vehicleId: item.vehicleId })}>
          {item.status === 'PLANNED' ? actions.DEPART : actions.ARRIVE}</button>}
      </li>)}</ul>
      <div className="work-actions">
        {selected.status === 'DRAFT' && <>
          <button className="primary" type="button" onClick={() => setOperation({ plan: selected, action: 'APPROVE' })}>Duyệt kế hoạch</button>
          <button className="outline" type="button" onClick={() => { editPlan(selected); setFormOpen(true); }}>Sửa nháp</button>
        </>}
        {selected.status === 'IN_PROGRESS' && selected.items.every(item => item.status === 'ARRIVED') &&
          <button className="primary" type="button" onClick={() => setOperation({ plan: selected, action: 'COMPLETE' })}>Hoàn tất kế hoạch</button>}
        {['DRAFT', 'APPROVED', 'IN_PROGRESS'].includes(selected.status) && !selected.items.some(item => item.status === 'DEPARTED') &&
          <button className="outline" type="button" onClick={() => setOperation({ plan: selected, action: 'CANCEL' })}>Hủy kế hoạch</button>}
      </div>
    </article>}
  </section>;
}
