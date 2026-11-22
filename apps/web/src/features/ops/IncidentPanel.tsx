import { useState, type FormEvent } from 'react';
import type { IncidentView, NetworkHub } from '@semh/contracts';
import { displayTime, field, useCommand } from '../../shared/api/use-screen';
import { kindLabel } from './ResourceCatalog';

export interface Technician { id: string; displayName: string }

const states: Record<IncidentView['status'], string> = {
  OPEN: 'Mới', ACKNOWLEDGED: 'Đã tiếp nhận', ASSIGNED: 'Đã giao', IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã khắc phục', CLOSED: 'Đã đóng',
};
const actions = {
  ACKNOWLEDGE: 'Tiếp nhận', ASSIGN: 'Giao kỹ thuật', START: 'Bắt đầu xử lý', HANDOVER: 'Ghi nhận bàn giao xe',
  CONFIRM_HANDOVER: 'Xác nhận bàn giao', RESOLVE: 'Ghi kết quả kiểm tra', CLOSE: 'Đóng sự cố',
};
type Action = keyof typeof actions;

function available(incident: IncidentView, maintenance?: boolean): Action[] {
  if (maintenance) {
    if (incident.status === 'ASSIGNED') return ['START'];
    return incident.status === 'IN_PROGRESS' ? (incident.tripId ? ['HANDOVER', 'RESOLVE'] : ['RESOLVE']) : [];
  }
  switch (incident.status) {
    case 'OPEN': return ['ACKNOWLEDGE'];
    case 'ACKNOWLEDGED':
    case 'ASSIGNED': return ['ASSIGN'];
    case 'IN_PROGRESS': return incident.handover ? ['CONFIRM_HANDOVER', 'ASSIGN'] : ['ASSIGN'];
    case 'RESOLVED': return ['CLOSE'];
    default: return [];
  }
}

export function IncidentPanel({ incidents, hubs, technicians, maintenance, refresh }: {
  incidents: IncidentView[]; hubs: NetworkHub[]; technicians: Technician[]; maintenance?: boolean; refresh: () => void;
}) {
  const command = useCommand(refresh);
  const [editing, setEditing] = useState<{ incident: IncidentView; action: Action }>();
  const [filter, setFilter] = useState(maintenance ? 'ALL' : 'OPEN');
  const [query, setQuery] = useState('');
  const [hubFilter, setHubFilter] = useState('');
  const [severity, setSeverity] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [resource, setResource] = useState('');
  const resources = hubs.flatMap(hub => hub.resources.map(item => ({ ...item, hubName: hub.name })));
  const hubNames = new Map(hubs.map(hub => [hub.id, hub.name]));
  const resourceCodes = new Map(resources.map(item => [item.id, item.code]));
  const severityLabels: Record<string, string> = { HIGH: 'Cao', MEDIUM: 'Vừa', LOW: 'Thấp' };
  const statusFilters = maintenance ? [
    { key: 'ASSIGNED', label: 'Chờ tiếp nhận', count: incidents.filter(item => item.status === 'ASSIGNED').length },
    { key: 'IN_PROGRESS', label: 'Đang xử lý', count: incidents.filter(item => item.status === 'IN_PROGRESS').length },
    { key: 'RESOLVED', label: 'Đã xử lý', count: incidents.filter(item => ['RESOLVED', 'CLOSED'].includes(item.status)).length },
  ] : [
    { key: 'OPEN', label: 'Chưa đóng', count: incidents.filter(item => item.status !== 'CLOSED').length },
    { key: 'IN_PROGRESS', label: 'Đang xử lý', count: incidents.filter(item => item.status === 'IN_PROGRESS').length },
    { key: 'RESOLVED', label: 'Đã khắc phục', count: incidents.filter(item => item.status === 'RESOLVED').length },
  ];
  const normalize = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('vi');
  const term = normalize(query.trim());
  const shown = incidents.filter(item => {
    const statusMatch = filter === 'ALL' || (filter === 'OPEN' ? item.status !== 'CLOSED'
      : filter === 'RESOLVED' && maintenance ? ['RESOLVED', 'CLOSED'].includes(item.status) : item.status === filter);
    return statusMatch && (!hubFilter || item.hubId === hubFilter) && (!severity || item.severity === severity) &&
      normalize([item.title, item.description, item.id, resourceCodes.get(item.resourceId)].join(' ')).includes(term);
  });
  const selected = incidents.find(item => item.id === selectedId);
  const overdue = (item: IncidentView) => item.dueAt && Date.parse(item.dueAt) < Date.now() &&
    !['RESOLVED', 'CLOSED'].includes(item.status);
  const tone = (status: IncidentView['status']) => ['RESOLVED', 'CLOSED'].includes(status) ? 'success'
    : status === 'IN_PROGRESS' ? 'info' : 'warning';

  async function report(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const selected = resources.find(item => item.id === resource);
    if (!selected) return;
    const created = await command.send('/operations/incidents', {
      kind: selected.kind, resourceId: selected.id, title: field(form, 'title'), description: field(form, 'description'),
    });
    if (created) { element.reset(); setResource(''); setReportOpen(false); }
  }

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const { incident, action } = editing;
    const form = new FormData(event.currentTarget);
    const due = field(form, 'dueAt');
    const updated = await command.send('/operations/incidents/' + incident.id, {
      version: incident.version, action, reason: field(form, 'reason'),
      severity: field(form, 'severity') || undefined,
      assigneeId: field(form, 'assignee') || undefined,
      dueAt: due ? new Date(due).toISOString() : undefined,
      safetyPassed: action === 'RESOLVE' ? field(form, 'safety') === 'pass' : undefined,
      actualHubId: field(form, 'actualHub') || undefined,
      location: field(form, 'location') || undefined,
    }, 'PATCH');
    if (updated) setEditing(undefined);
  }

  return <section className="work-stack">
    {command.error && <p role="alert" className="error">{command.error}</p>}
    <div className="metric-grid incident-metrics">
      {statusFilters.map((item, index) => <div className="work-card tinted-panel" key={item.key}
        data-tone={index === 0 ? 'info' : index === 1 ? 'aqua' : 'success'}>
        <span>{item.label}</span><b>{item.count}</b>
      </div>)}
      <div className="work-card tinted-panel" data-tone="danger"><span>Quá hạn</span><b>{incidents.filter(overdue).length}</b></div>
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
    <section className="work-card work-stack incident-list">
      <header className="work-heading"><h2>{maintenance ? 'Sự cố được giao' : 'Danh sách sự cố'}</h2>
        <div className="work-actions">
          {!maintenance && <button className="primary" type="button" onClick={() => setReportOpen(!reportOpen)} aria-expanded={reportOpen}>
            {reportOpen ? 'Đóng biểu mẫu' : 'Ghi nhận sự cố'}
          </button>}
          <button className="outline" type="button" onClick={refresh}>Làm mới</button>
        </div>
      </header>
      <div className="work-actions incident-status-tabs">
        {[{ key: 'ALL', label: 'Tất cả', count: incidents.length }, ...statusFilters].map(item => <button
          type="button" key={item.key} className="outline" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>
          {item.label} ({item.count})
        </button>)}
      </div>
      <div className="filter-toolbar">
        <label className="search-field">Tìm sự cố<input type="search" placeholder="Mã, tài nguyên hoặc nội dung" value={query}
          onChange={event => setQuery(event.target.value)} /></label>
        <label>Hub<select value={hubFilter} onChange={event => setHubFilter(event.target.value)}>
          <option value="">Tất cả Hub</option>{hubs.map(hub => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
        </select></label>
        <label>Mức độ<select value={severity} onChange={event => setSeverity(event.target.value)}>
          <option value="">Tất cả mức độ</option>{Object.entries(severityLabels).map(([value, label]) =>
            <option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>
      <div className="scroll-table" role="region" tabIndex={0} aria-label="Danh sách sự cố">
        <table>
          <thead><tr><th>Sự cố / Tài nguyên</th><th>Hub</th><th>Mức độ</th><th>Hạn xử lý</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
          <tbody>{shown.map(item => <tr key={item.id} data-selected={selectedId === item.id}>
            <td><strong>{item.title}</strong><small>{resourceCodes.get(item.resourceId) ?? kindLabel[item.resourceKind]}</small></td>
            <td>{hubNames.get(item.hubId ?? '') ?? '—'}</td>
            <td><span className="status-pill" data-tone={item.severity === 'HIGH' ? 'danger' : item.severity === 'MEDIUM' ? 'warning' : 'neutral'}>
              {severityLabels[item.severity] ?? item.severity}
            </span></td>
            <td data-overdue={!!overdue(item)}>{item.dueAt ? displayTime(item.dueAt) : '—'}</td>
            <td><span className="status-pill" data-tone={tone(item.status)}>{states[item.status]}</span></td>
            <td><button className="outline" type="button" onClick={() => { setSelectedId(item.id); setEditing(undefined); }}>Xem chi tiết</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!shown.length && <p>Không có sự cố phù hợp.</p>}
    </section>
    {editing && <form className="work-card work-form" onSubmit={apply} key={editing.incident.id + editing.action}>
      <h2>{actions[editing.action]} · {editing.incident.title}</h2>
      {editing.action === 'ACKNOWLEDGE' && <label>Mức độ<select name="severity" defaultValue="MEDIUM">
        <option value="LOW">Thấp</option><option value="MEDIUM">Vừa</option><option value="HIGH">Cao</option>
      </select></label>}
      {editing.action === 'ASSIGN' && <>
        <label>Người xử lý<select name="assignee" required><option value="">Chọn kỹ thuật viên</option>
          {technicians.map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}
        </select></label>
        <label>Hạn xử lý dự kiến<input name="dueAt" type="datetime-local" /></label>
      </>}
      {editing.action === 'HANDOVER' && <label>Vị trí bàn giao thực tế<input name="location" required maxLength={240} /></label>}
      {editing.action === 'RESOLVE' && <>
        <label>Kết quả kiểm tra<select name="safety" required><option value="fail">Chưa đạt</option><option value="pass">Đạt</option></select></label>
        {editing.incident.tripId && <label>Hub đã tiếp nhận xe<select name="actualHub"><option value="">Chọn nếu xe đang ngoài Hub</option>
          {hubs.map(hub => <option key={hub.id} value={hub.id}>{hub.name}</option>)}
        </select></label>}
      </>}
      <label>{editing.action === 'RESOLVE' ? 'Kết quả và công việc đã thực hiện' : 'Ghi chú hoặc lý do'}<textarea name="reason" required maxLength={500} /></label>
      <div className="work-actions"><button className="primary" disabled={command.pending}>Xác nhận</button>
        <button className="outline" type="button" onClick={() => setEditing(undefined)}>Đóng</button></div>
    </form>}
    {selected && <article className="work-card">
      <div className="work-heading"><h2>{selected.title}</h2><span className="status-pill" data-tone={tone(selected.status)}>{states[selected.status]}</span></div>
      <p>{kindLabel[selected.resourceKind]} · {resourceCodes.get(selected.resourceId) ?? hubNames.get(selected.hubId ?? '') ?? '—'} · {displayTime(selected.createdAt)}</p>
      <p>{selected.description}</p>
      {selected.dueAt && <p>Hạn xử lý {displayTime(selected.dueAt)}</p>}
      {selected.handover && <p>Bàn giao tại {selected.handover.location} · {displayTime(selected.handover.at)}</p>}
      {selected.resolution && <p>Kết quả {selected.resolution}</p>}
      <div className="work-actions">{available(selected, maintenance).map(action => (
        <button key={action} type="button" className="primary" onClick={() => setEditing({ incident: selected, action })}>{actions[action]}</button>
      ))}</div>
    </article>}
  </section>;
}
