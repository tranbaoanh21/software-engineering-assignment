import { useState, type FormEvent } from 'react';
import type { IncidentView, NetworkHub } from '@semh/contracts';
import { displayTime, field, useCommand } from '../../shared/api/use-screen';
import { kindLabel } from './ResourceCatalog';

export interface Technician { id: string; displayName: string }

const states: Record<IncidentView['status'], string> = {
  OPEN: 'Mới', ACKNOWLEDGED: 'Đã tiếp nhận', ASSIGNED: 'Chờ kỹ thuật tiếp nhận', IN_PROGRESS: 'Đang sửa',
  AWAITING_APPROVAL: 'Chờ vận hành xác nhận', RESOLVED: 'Đã khắc phục', CLOSED: 'Đã đóng',
};

type Action = 'ACKNOWLEDGE' | 'ASSIGN' | 'START' | 'RESOLVE' | 'CLOSE';

function needsTripDelivery(incident: IncidentView) {
  return incident.tripId !== null && incident.status === 'AWAITING_APPROVAL' && !incident.receivingHub;
}

function nextAction(incident: IncidentView, maintenance?: boolean): Action | undefined {
  if (maintenance) {
    if (incident.status === 'ASSIGNED' || (incident.status === 'IN_PROGRESS' && incident.tripInProgress)) return 'START';
    if (incident.status === 'IN_PROGRESS' || needsTripDelivery(incident)) return 'RESOLVE';
    return;
  }
  switch (incident.status) {
    case 'OPEN': return incident.tripId ? 'ASSIGN' : 'ACKNOWLEDGE';
    case 'ACKNOWLEDGED':
    case 'ASSIGNED':
    case 'IN_PROGRESS': return 'ASSIGN';
    case 'AWAITING_APPROVAL': return needsTripDelivery(incident) ? undefined : 'CLOSE';
    case 'RESOLVED': return 'CLOSE';
    default: return;
  }
}

function actionLabel(action: Action, incident: IncidentView) {
  switch (action) {
    case 'ACKNOWLEDGE': return 'Tiếp nhận';
    case 'ASSIGN': return incident.assigneeId ? 'Giao lại kỹ thuật' : incident.tripId ? 'Xác nhận vị trí và giao kỹ thuật' : 'Giao kỹ thuật';
    case 'START': return incident.tripId ? 'Tiếp nhận xe' : 'Bắt đầu xử lý';
    case 'RESOLVE': return incident.tripId ? 'Xác nhận Hub trả xe' : 'Ghi kết quả kiểm tra';
    case 'CLOSE': return incident.status === 'AWAITING_APPROVAL' ? 'Xác nhận đưa vào phục vụ' : 'Đóng sự cố';
  }
}

export function IncidentPanel({ incidents, hubs, technicians, maintenance, refresh }: {
  incidents: IncidentView[]; hubs: NetworkHub[]; technicians: Technician[]; maintenance?: boolean; refresh: () => void;
}) {
  const command = useCommand(refresh);
  const [editing, setEditing] = useState<{ id: string; action: Action }>();
  const [filter, setFilter] = useState(maintenance ? 'ALL' : 'ACTIVE');
  const [query, setQuery] = useState('');
  const [hubFilter, setHubFilter] = useState('');
  const [severity, setSeverity] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [resource, setResource] = useState('');
  const [message, setMessage] = useState('');
  const resources = hubs.flatMap(hub => hub.resources.map(item => ({ ...item, hubName: hub.name })));
  const hubNames = new Map(hubs.map(hub => [hub.id, hub.name]));
  const resourceCodes = new Map(resources.map(item => [item.id, item.code]));
  const severityLabels: Record<string, string> = { HIGH: 'Cao', MEDIUM: 'Vừa', LOW: 'Thấp' };
  const statusFilters = maintenance ? [
    { key: 'ASSIGNED', label: 'Chờ tiếp nhận' }, { key: 'IN_PROGRESS', label: 'Đang sửa' },
    { key: 'AWAITING_APPROVAL', label: 'Chờ vận hành xác nhận' }, { key: 'CLOSED', label: 'Đã xử lý' },
  ] : [
    { key: 'ACTIVE', label: 'Chưa đóng' }, { key: 'IN_PROGRESS', label: 'Đang sửa' },
    { key: 'AWAITING_APPROVAL', label: 'Chờ xác nhận đưa vào phục vụ' },
  ];
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('vi');
  const term = normalize(query.trim());
  const matchesStatus = (item: IncidentView, key: string) => key === 'ALL' || item.status === key ||
    (key === 'ACTIVE' && item.status !== 'CLOSED') || (maintenance && key === 'CLOSED' && item.status === 'RESOLVED');
  const shown = incidents.filter(item => matchesStatus(item, filter) &&
    (!hubFilter || (item.receivingHub?.id ?? item.hubId) === hubFilter) && (!severity || item.severity === severity) &&
    normalize([item.title, item.description, item.reportedLocation, item.confirmedLocation, item.receivingHub?.name, item.id,
      resourceCodes.get(item.resourceId), item.vehicle?.code].join(' ')).includes(term));
  const selected = shown.find(item => item.id === selectedId) ?? shown[0];
  const action = selected ? nextAction(selected, maintenance) : undefined;
  const needsReceivingHub = selected?.status === 'AWAITING_APPROVAL' && !selected.tripId && selected.vehicle?.hubId === null;
  const tripDelivery = action === 'RESOLVE' && !!selected?.tripId;
  const receivingHubs = hubs.filter(hub => hub.serviceStatus === 'ACTIVE' &&
    (hub.id === selected?.vehicle?.hubId || hub.vehicleCount + hub.heldArrivals < hub.capacity));
  const currentLocation = selected?.confirmedLocation ?? selected?.reportedLocation ?? selected?.handover?.location;
  const formVisible = !!editing && editing.id === selected?.id && editing.action === action;
  const overdue = (item: IncidentView) => item.dueAt && Date.parse(item.dueAt) < Date.now() &&
    !['AWAITING_APPROVAL', 'RESOLVED', 'CLOSED'].includes(item.status);
  const tone = (status: IncidentView['status']) => ['RESOLVED', 'CLOSED'].includes(status) ? 'success'
    : status === 'IN_PROGRESS' ? 'info' : 'warning';

  async function report(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const selected = resources.find(item => item.id === resource);
    if (!selected) return;
    const created = await command.send<IncidentView>('/operations/incidents', {
      kind: selected.kind, resourceId: selected.id, title: field(form, 'title'), description: field(form, 'description'),
    });
    if (created) {
      element.reset();
      setResource('');
      setReportOpen(false);
      setFilter('ACTIVE');
      setQuery('');
      setHubFilter('');
      setSeverity('');
      setSelectedId(created.id);
      setMessage('Đã ghi nhận sự cố.');
    }
  }

  async function apply(incident: IncidentView, action: Action, form: FormData = new FormData()) {
    const due = field(form, 'dueAt');
    const updated = await command.send<IncidentView>('/operations/incidents/' + incident.id, {
      version: incident.version, action,
      reason: field(form, 'reason') || undefined,
      severity: field(form, 'severity') || undefined,
      assigneeId: field(form, 'assignee') || undefined,
      dueAt: due ? new Date(due).toISOString() : undefined,
      safetyPassed: action === 'RESOLVE' ? incident.tripId !== null || field(form, 'safety') === 'pass' : undefined,
      actualHubId: field(form, 'actualHub') || undefined,
      location: field(form, 'location') || undefined,
    }, 'PATCH');
    if (updated) {
      setEditing(undefined);
      setFilter('ALL');
      setSelectedId(updated.id);
      setMessage(updated.status === 'AWAITING_APPROVAL' ? 'Đã bàn giao cho vận hành xác nhận.'
        : action === 'START' && incident.tripInProgress ? 'Đã tiếp nhận xe và kết thúc chuyến đi.'
          : action === 'CLOSE' && incident.status === 'AWAITING_APPROVAL' ? 'Đã xác nhận tài nguyên quay lại phục vụ.'
            : 'Đã cập nhật sự cố.');
    }
  }

  function act(incident: IncidentView, action: Action) {
    setMessage('');
    const needsForm = action === 'ASSIGN' || action === 'ACKNOWLEDGE' || action === 'RESOLVE' ||
      (action === 'CLOSE' && needsReceivingHub);
    if (needsForm) setEditing({ id: incident.id, action });
    else void apply(incident, action);
  }

  return <section className="work-stack">
    {command.error && !formVisible && <p role="alert" className="error">{command.error}</p>}
    {message && <p className="handoff-notice" role="status">{message}</p>}
    <div className="work-heading">
      <span className="muted">{incidents.filter(overdue).length} sự cố quá hạn</span>
      <div className="work-actions">
        <button className="outline" type="button" onClick={refresh}>Làm mới</button>
        {!maintenance && <button className="primary" type="button" onClick={() => setReportOpen(!reportOpen)} aria-expanded={reportOpen}>
          {reportOpen ? 'Đóng biểu mẫu' : 'Ghi nhận sự cố'}
        </button>}
      </div>
    </div>
    {reportOpen && <form className="work-card work-form work-form-wide" onSubmit={report}>
        <h2>Ghi nhận sự cố</h2>
        <label>Tài nguyên<select required value={resource} onChange={event => setResource(event.target.value)}>
          <option value="">Chọn tài nguyên</option>
          {resources.map(item => <option key={item.id} value={item.id}>{item.hubName} · {item.code}</option>)}
        </select></label>
        <label>Tiêu đề<input name="title" required maxLength={140} /></label>
        <label>Mô tả<textarea name="description" required maxLength={1000} /></label>
        <button className="primary" disabled={command.pending}>Gửi báo cáo sự cố</button>
      </form>}
    <div className="work-stack">
      <div className="work-actions incident-status-tabs">
        {[{ key: 'ALL', label: 'Tất cả' }, ...statusFilters].map(item => <button
          type="button" key={item.key} className="outline" aria-pressed={filter === item.key} onClick={() => { setFilter(item.key); setEditing(undefined); }}>
          {item.label} ({incidents.filter(incident => matchesStatus(incident, item.key)).length})
        </button>)}
      </div>
      <div className="filter-toolbar">
        <label className="search-field">Tìm sự cố<input type="search" placeholder="Tên, mã xe hoặc địa điểm" value={query}
          onChange={event => { setQuery(event.target.value); setEditing(undefined); }} /></label>
        <label>Hub<select value={hubFilter} onChange={event => { setHubFilter(event.target.value); setEditing(undefined); }}>
          <option value="">Tất cả Hub</option>{hubs.map(hub => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
        </select></label>
        <label>Mức độ<select value={severity} onChange={event => { setSeverity(event.target.value); setEditing(undefined); }}>
          <option value="">Tất cả mức độ</option>{Object.entries(severityLabels).map(([value, label]) =>
            <option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>
    </div>
    <div className="app-pane-layout">
      <section className="work-card work-stack">
        <h2>{maintenance ? 'Sự cố được giao' : 'Danh sách sự cố'} ({shown.length})</h2>
        {shown.length ? <div className="app-pane-list">{shown.map(item => <button key={item.id} type="button"
          className="app-pane-item" aria-pressed={selected?.id === item.id} onClick={() => {
            setSelectedId(item.id); setEditing(undefined); setMessage('');
          }}>
          <strong>{item.title}</strong>
          <small>{[item.vehicle?.code ?? resourceCodes.get(item.resourceId) ?? kindLabel[item.resourceKind], item.receivingHub?.name ?? hubNames.get(item.hubId ?? '')].filter(Boolean).join(' · ')}</small>
          <span className="work-actions">
            <span className="status-pill" data-tone={tone(item.status)}>{states[item.status]}</span>
            {item.severity === 'HIGH' && <span className="status-pill" data-tone="danger">Mức cao</span>}
            {overdue(item) && <span className="status-pill" data-tone="danger">Quá hạn</span>}
          </span>
        </button>)}</div> : <p>Không có sự cố phù hợp.</p>}
      </section>
      {selected && <article className="work-card work-stack" key={selected.id}>
        <div className="work-heading"><h2>{selected.title}</h2><span className="status-pill" data-tone={tone(selected.status)}>{states[selected.status]}</span></div>
        <p className="muted">{kindLabel[selected.resourceKind]} · {selected.vehicle?.code ?? resourceCodes.get(selected.resourceId) ?? hubNames.get(selected.hubId ?? '') ?? '—'}</p>
        {currentLocation && <div className="work-notice">
          <strong>{selected.confirmedLocation ? 'Địa điểm đã xác nhận' : 'Địa điểm báo hỏng'}</strong>
          <p>{currentLocation}</p>
          {selected.confirmedLocation && selected.reportedLocation && selected.reportedLocation !== selected.confirmedLocation &&
            <small>Sinh viên báo tại {selected.reportedLocation}</small>}
        </div>}
        {selected.description && <p>{selected.description}</p>}
        <dl className="reservation-details">
          <div><dt>Mức độ</dt><dd>{severityLabels[selected.severity] ?? selected.severity}</dd></div>
          <div><dt>Ghi nhận lúc</dt><dd>{displayTime(selected.createdAt)}</dd></div>
          {selected.dueAt && <div><dt>Hạn xử lý</dt><dd>{displayTime(selected.dueAt)}</dd></div>}
          {!maintenance && selected.assigneeId && <div><dt>Kỹ thuật viên</dt><dd>{technicians.find(item => item.id === selected.assigneeId)?.displayName ?? 'Đã phân công'}</dd></div>}
        </dl>
        {selected.receivingHub && <p className="work-notice">
          Hub nhận xe <strong>{selected.receivingHub.name}</strong>
          {selected.status === 'AWAITING_APPROVAL' && ' · Xe tạm ngừng phục vụ'}
        </p>}
        {selected.status === 'AWAITING_APPROVAL' && !selected.receivingHub && <p className="work-notice">
          {selected.tripId ? 'Kỹ thuật cần xác nhận Hub đã nhận xe.' : 'Kỹ thuật đã báo sửa xong. Tài nguyên chờ vận hành xác nhận để phục vụ trở lại.'}
        </p>}
        {selected.resolution && selected.safe !== null && <p><strong>Kết quả kiểm tra</strong> · {selected.resolution}</p>}
        {action && !formVisible && <div className="work-actions">
          <button type="button" className={action === 'ASSIGN' && selected.assigneeId ? 'outline' : 'primary'}
            disabled={command.pending} onClick={() => act(selected, action)}>{actionLabel(action, selected)}</button>
        </div>}
        {action && formVisible && <form className="work-form inline-action" key={action} onSubmit={event => {
          event.preventDefault();
          void apply(selected, action, new FormData(event.currentTarget));
        }}>
          <h3>{actionLabel(action, selected)}</h3>
          {action === 'ACKNOWLEDGE' && <label>Mức độ<select name="severity" defaultValue={selected.severity}>
            <option value="LOW">Thấp</option><option value="MEDIUM">Vừa</option><option value="HIGH">Cao</option>
          </select></label>}
          {action === 'ASSIGN' && <>
            {selected.tripId && <label>Địa điểm xe bị hư<input name="location" required maxLength={240}
              defaultValue={currentLocation} placeholder="Ví dụ: Cổng chính KTX B" /></label>}
            <label>Kỹ thuật viên<select name="assignee" required
              defaultValue={selected.assigneeId ?? (technicians.length === 1 ? technicians[0]?.id : '')}>
              <option value="">Chọn kỹ thuật viên</option>
              {technicians.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}
            </select></label>
            {!selected.tripId && <label>Hạn xử lý dự kiến<input name="dueAt" type="datetime-local" /></label>}
          </>}
          {action === 'RESOLVE' && !tripDelivery && <>
            <label>Kết quả kiểm tra<select name="safety" required defaultValue="pass">
              <option value="pass">Đạt · Bàn giao vận hành</option><option value="fail">Chưa đạt · Tiếp tục xử lý</option>
            </select></label>
            <label>Ghi chú kỹ thuật (tùy chọn)<textarea name="reason" maxLength={500} /></label>
          </>}
          {(tripDelivery || (action === 'CLOSE' && needsReceivingHub)) && <label>Hub đã nhận xe
            <select name="actualHub" required defaultValue={tripDelivery ? selected.vehicle?.hubId ?? '' : ''}>
              <option value="">{receivingHubs.length ? 'Chọn Hub tiếp nhận' : 'Chưa có Hub còn chỗ'}</option>
              {receivingHubs.map(hub => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
            </select>
          </label>}
          {command.error && <p className="error" role="alert">{command.error}</p>}
          <div className="work-actions">
            <button className="primary" disabled={command.pending}>{command.pending ? 'Đang lưu…'
              : action === 'ASSIGN' ? 'Xác nhận giao kỹ thuật' : tripDelivery ? 'Xác nhận đã đưa xe về Hub' : 'Xác nhận'}</button>
            <button className="outline" type="button" onClick={() => setEditing(undefined)}>Đóng</button>
          </div>
        </form>}
      </article>}
    </div>
  </section>;
}
