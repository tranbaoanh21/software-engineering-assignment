import { useState, type FormEvent } from 'react';
import type { NetworkHub, PlanView } from '@semh/contracts';
import { displayTime, field, useCommand } from '../../shared/api/use-screen';
import type { Technician } from './IncidentPanel';

export interface TransferDraft {
  sourceHubId: string;
  targetHubId: string;
  vehicleIds: string[];
  reason: string;
  recommendationId: string | null;
}

const statuses: Record<PlanView['status'], string> = {
  DRAFT: 'Nháp',
  APPROVED: 'Đã giao kỹ thuật',
  IN_PROGRESS: 'Đang điều chuyển',
  AWAITING_APPROVAL: 'Chờ vận hành xác nhận',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

const itemStatuses: Record<PlanView['items'][number]['status'], string> = {
  PLANNED: 'Tại Hub nguồn', DEPARTED: 'Đang chuyển', ARRIVED: 'Đã ghi nhận tại Hub đích', CANCELLED: 'Đã hủy',
};
const confirmations = {
  ASSIGN: 'Đã giao kế hoạch cho kỹ thuật.',
  START: 'Đã ghi nhận xe rời Hub nguồn.',
  REPORT_ARRIVAL: 'Đã báo vận hành. Xe chờ xác nhận tại Hub đích.',
  COMPLETE: 'Đã cập nhật vị trí xe tại Hub đích.',
  CANCEL: 'Đã hủy kế hoạch.',
};
type Action = keyof typeof confirmations;

function dateInput(iso?: string) {
  if (!iso) return '';
  const time = new Date(iso);
  return new Date(time.getTime() - time.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function statusLabel(plan: PlanView) {
  return plan.status === 'APPROVED' && !plan.assigneeId ? 'Chờ giao kỹ thuật' : statuses[plan.status];
}

function PlanTechnicianSelect({ technicians, value, onChange }: {
  technicians: Technician[];
  value: string;
  onChange: (value: string) => void;
}) {
  return <label>Kỹ thuật viên<select name="assignee" value={value} onChange={event => onChange(event.target.value)}>
    <option value="">Chọn kỹ thuật viên</option>
    {technicians.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}
  </select></label>;
}

export function TransferPanel({ hubs, plans, technicians, maintenance, prefilled, refresh }: {
  hubs: NetworkHub[];
  plans: PlanView[];
  technicians: Technician[];
  maintenance?: boolean;
  prefilled?: TransferDraft;
  refresh: () => void;
}) {
  const command = useCommand(refresh);
  const defaultTechnician = technicians.length === 1 ? technicians[0]?.id ?? '' : '';
  const [formOpen, setFormOpen] = useState(!!prefilled);
  const [recommendation, setRecommendation] = useState(prefilled);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [editing, setEditing] = useState<PlanView>();
  const [source, setSource] = useState(prefilled?.sourceHubId ?? '');
  const [picked, setPicked] = useState(prefilled?.vehicleIds ?? []);
  const [assignee, setAssignee] = useState(defaultTechnician);
  const [operation, setOperation] = useState<'ASSIGN' | 'CANCEL'>();
  const [message, setMessage] = useState('');
  const activeHubs = hubs.filter(hub => hub.serviceStatus === 'ACTIVE');
  const sourceHub = activeHubs.find(hub => hub.id === source);
  const vehicles = sourceHub?.resources.filter(item => item.kind === 'VEHICLE' && item.status === 'AVAILABLE' &&
    item.serviceStatus === 'ACTIVE' && item.observedAt && (item.batteryPercent ?? 0) >= 30) ?? [];
  const eligiblePicked = vehicles.filter(item => picked.includes(item.id)).map(item => item.id);
  const name = (id: string) => hubs.find(hub => hub.id === id)?.name ?? id.slice(0, 8);
  const visible = plans.filter(plan => !filter || plan.status === filter);
  const selected = visible.find(plan => plan.id === selectedId) ?? visible[0];
  const hasPlanned = selected?.items.some(item => item.status === 'PLANNED');
  const hasMoving = selected?.items.some(item => item.status === 'DEPARTED');
  const canAssign = selected?.status === 'DRAFT' || ((selected?.status === 'APPROVED' || selected?.status === 'IN_PROGRESS') &&
    (hasPlanned || hasMoving));
  const canComplete = selected?.status === 'AWAITING_APPROVAL' || (selected?.status === 'IN_PROGRESS' &&
    selected.items.every(item => item.status === 'ARRIVED'));
  const canCancel = selected && (selected.status === 'DRAFT' || selected.status === 'APPROVED' ||
    (selected.status === 'IN_PROGRESS' && !hasMoving));

  function editPlan(plan?: PlanView) {
    setEditing(plan);
    setRecommendation(undefined);
    setSource(plan?.sourceHubId ?? '');
    setPicked(plan?.items.map(item => item.vehicleId) ?? []);
    setAssignee(defaultTechnician);
    setOperation(undefined);
    setMessage('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const intent = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value');
    const assigning = intent !== 'draft';
    if (assigning && !assignee) return;
    const scheduled = field(form, 'scheduledAt');
    const result = await command.send<PlanView>('/operations/plans' + (editing ? '/' + editing.id : ''), {
      sourceHubId: source, targetHubId: field(form, 'target'), vehicleIds: eligiblePicked,
      scheduledAt: scheduled ? new Date(scheduled).toISOString() : undefined,
      reason: field(form, 'reason') || undefined,
      assigneeId: assigning ? assignee : undefined,
      recommendationId: editing?.recommendationId ?? recommendation?.recommendationId ?? null, version: editing?.version,
    }, editing ? 'PATCH' : 'POST');
    if (result) {
      editPlan();
      setMessage(assigning ? confirmations.ASSIGN : 'Đã lưu kế hoạch nháp.');
      setSelectedId(result.id);
      setFilter('');
      setFormOpen(false);
    }
  }

  async function apply(plan: PlanView, action: Action) {
    const result = await command.send<PlanView>('/operations/plans/' + plan.id + '/actions', {
      action, version: plan.version, assigneeId: action === 'ASSIGN' ? assignee : undefined,
    });
    if (result) {
      setOperation(undefined);
      setSelectedId(result.id);
      setFilter('');
      setMessage(action === 'REPORT_ARRIVAL' && result.status === 'COMPLETED'
        ? 'Đã cập nhật vị trí xe tại Hub đích.' : confirmations[action]);
    }
  }

  return <section className="work-stack">
    {!operation && command.error && <p className="error" role="alert">{command.error}</p>}
    {message && <p className="handoff-notice" role="status">{message}</p>}
    <div className="filter-toolbar work-heading">
      {!formOpen && <label>Trạng thái<select value={filter} onChange={event => { setFilter(event.target.value); setOperation(undefined); }}>
        <option value="">Tất cả trạng thái</option>
        {Object.entries(statuses).filter(([status]) => !maintenance || status !== 'DRAFT')
          .map(([status, label]) => <option key={status} value={status}>{label}</option>)}
      </select></label>}
      {!maintenance && <button className={formOpen || canAssign || canComplete ? 'outline' : 'primary'} type="button" aria-expanded={formOpen}
        onClick={() => { editPlan(); setFormOpen(!formOpen); }}>
        {formOpen ? 'Đóng biểu mẫu' : 'Tạo kế hoạch'}
      </button>}
    </div>
    {!maintenance && formOpen && <form className="work-card work-form work-form-wide" onSubmit={save}
      key={editing?.id ?? recommendation?.recommendationId ?? 'new'}>
      <h2>{editing ? 'Sửa kế hoạch' : recommendation ? 'Giao theo đề xuất mô phỏng' : 'Lập kế hoạch điều chuyển'}</h2>
      <label>Hub nguồn<select value={source} required onChange={event => { setSource(event.target.value); setPicked([]); }}>
        <option value="">Chọn Hub nguồn</option>
        {activeHubs.map(hub => <option value={hub.id} key={hub.id}>{hub.name}</option>)}
      </select></label>
      <label>Hub đích<select name="target" required defaultValue={editing?.targetHubId ?? recommendation?.targetHubId ?? ''}>
        <option value="">Chọn Hub đích</option>
        {activeHubs.map(hub => <option value={hub.id} key={hub.id} disabled={hub.id === source}>
          {hub.name} · {Math.max(0, hub.capacity - hub.vehicleCount - hub.heldArrivals)} chỗ nhận xe
        </option>)}
      </select></label>
      <PlanTechnicianSelect technicians={technicians} value={assignee} onChange={setAssignee} />
      <fieldset className="work-choice-grid"><legend>Xe điều chuyển ({eligiblePicked.length} đã chọn)</legend>
        {!vehicles.length && <p>Chọn Hub nguồn có xe khả dụng và đủ pin.</p>}
        {vehicles.map(item => <label className="check-field" key={item.id}>
          <input type="checkbox" checked={picked.includes(item.id)} onChange={event => setPicked(prior =>
            event.target.checked ? [...prior, item.id] : prior.filter(id => id !== item.id))} />
          {item.code} · {item.batteryPercent}% pin
        </label>)}
      </fieldset>
      {eligiblePicked.length < picked.length && <p role="status">Một số xe vừa đổi trạng thái. Kế hoạch chỉ gồm xe còn khả dụng.</p>}
      <details>
        <summary>Thời gian và ghi chú (tùy chọn)</summary>
        <label>Lịch dự kiến<input name="scheduledAt" type="datetime-local" defaultValue={dateInput(editing?.scheduledAt)} /></label>
        <label>Ghi chú<input name="reason" maxLength={500} defaultValue={editing?.reason ?? recommendation?.reason} /></label>
      </details>
      <div className="work-actions">
        <button className={assignee ? 'primary' : 'outline'} type="submit" value="assign"
          disabled={command.pending || !assignee || !eligiblePicked.length}>Giao kỹ thuật</button>
        <button className={assignee ? 'outline' : 'primary'} type="submit" value="draft"
          disabled={command.pending || !eligiblePicked.length}>Lưu nháp</button>
      </div>
    </form>}
    {!formOpen && <div className="app-pane-layout">
      <section className="work-card work-stack">
        <h2>{maintenance ? 'Việc điều chuyển' : 'Kế hoạch'} ({visible.length})</h2>
        {visible.length ? <div className="app-pane-list">{visible.map(plan => <button key={plan.id} type="button"
          className="app-pane-item" aria-pressed={plan.id === selected?.id} onClick={() => {
            setSelectedId(plan.id); setOperation(undefined); setMessage('');
          }}>
          <strong>{name(plan.sourceHubId)} → {name(plan.targetHubId)}</strong>
          <small>{plan.items.length} xe · {displayTime(plan.scheduledAt)}</small>
          <span className="status-pill" data-tone={plan.status === 'COMPLETED' ? 'success'
            : plan.status === 'CANCELLED' ? 'danger' : plan.status === 'AWAITING_APPROVAL' ? 'warning' : 'info'}>{statusLabel(plan)}</span>
        </button>)}</div> : <p>{maintenance ? 'Chưa có kế hoạch được giao.' : 'Không có kế hoạch phù hợp.'}</p>}
      </section>
      {selected && <article className="work-card work-stack" key={selected.id}>
        <div className="work-heading"><h2>{name(selected.sourceHubId)} → {name(selected.targetHubId)}</h2>
          <span className="status-pill">{statusLabel(selected)}</span></div>
        {!maintenance && selected.assigneeName && <p>Kỹ thuật viên {selected.assigneeName}</p>}
        <ul className="work-list">{selected.items.map(item => <li key={item.vehicleId}>
          <strong>{item.vehicleCode}</strong>
          <span>{selected.status === 'AWAITING_APPROVAL' && item.status === 'DEPARTED'
            ? 'Đã báo đến đích' : itemStatuses[item.status]}</span>
        </li>)}</ul>
        {selected.reason && <details><summary>Ghi chú kế hoạch</summary><p>{selected.reason}</p></details>}
        {selected.status === 'AWAITING_APPROVAL' && <p className="work-notice">
          Kỹ thuật đã báo xe tới Hub đích. Xe sẽ xuất hiện ở Hub đích khi vận hành xác nhận.
        </p>}
        {!operation && <div className="work-actions">
          {maintenance && hasPlanned && (selected.status === 'APPROVED' || selected.status === 'IN_PROGRESS') &&
            <button className="primary" type="button" disabled={command.pending}
              onClick={() => void apply(selected, 'START')}>Bắt đầu điều chuyển</button>}
          {maintenance && selected.status === 'IN_PROGRESS' && !hasPlanned && hasMoving &&
            <button className="primary" type="button" disabled={command.pending}
              onClick={() => void apply(selected, 'REPORT_ARRIVAL')}>
              {selected.completeOnArrival ? 'Xác nhận đã đến Hub đích' : 'Báo đã đến Hub đích'}
            </button>}
          {!maintenance && canComplete &&
            <button className="primary" type="button" disabled={command.pending}
              onClick={() => void apply(selected, 'COMPLETE')}>Xác nhận hoàn tất</button>}
          {!maintenance && canAssign &&
            <button className={selected.assigneeId ? 'outline' : 'primary'} type="button" onClick={() => {
              setAssignee(selected.assigneeId ?? defaultTechnician); setOperation('ASSIGN'); setFormOpen(false);
            }}>{selected.assigneeId ? 'Đổi kỹ thuật viên' : 'Giao kỹ thuật'}</button>}
          {!maintenance && selected.status === 'DRAFT' &&
            <button className="outline" type="button" onClick={() => { editPlan(selected); setFormOpen(true); }}>Sửa nháp</button>}
          {!maintenance && canCancel &&
            <button className="quiet-action quiet-action-destructive" type="button"
              onClick={() => setOperation('CANCEL')}>Hủy kế hoạch</button>}
        </div>}
        {operation && <form className="work-form inline-action" onSubmit={event => {
          event.preventDefault();
          void apply(selected, operation);
        }}>
          {operation === 'ASSIGN'
            ? <PlanTechnicianSelect technicians={technicians} value={assignee} onChange={setAssignee} />
            : <p>Bạn muốn hủy kế hoạch từ {name(selected.sourceHubId)} đến {name(selected.targetHubId)}?</p>}
          {command.error && <p className="error" role="alert">{command.error}</p>}
          <div className="work-actions">
            <button className={operation === 'CANCEL' ? 'danger' : 'primary'}
              disabled={command.pending || (operation === 'ASSIGN' && !assignee)}>
              {operation === 'ASSIGN' ? 'Xác nhận giao kỹ thuật' : 'Xác nhận hủy'}
            </button>
            <button className="outline" type="button" onClick={() => setOperation(undefined)}>Quay lại</button>
          </div>
        </form>}
      </article>}
    </div>}
  </section>;
}
