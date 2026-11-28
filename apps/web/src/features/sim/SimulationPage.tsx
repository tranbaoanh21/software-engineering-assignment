import { useState, type FormEvent } from 'react';
import type { PlanView, ScenarioView, SimulationParameters, SimulationRunView } from '@semh/contracts';
import { PageBanner } from '../../shared/ui/PageBanner';
import { displayTime, field, useCommand, useScreen } from '../../shared/api/use-screen';

interface Overview { hubs: { id: string; name: string; resources: { id: string; code: string }[] }[]; scenarios: ScenarioView[]; runs: SimulationRunView[] }
interface RunDetail extends SimulationRunView {
  parameters: SimulationParameters;
  profileVersion: string;
  sourceRunId: string | null;
  hasDonorSnapshot: boolean;
}
const initial: ScenarioView['parameters'] = {
  durationMinutes: 60, demandMultiplier: 1.5, demandProfile: 'PEAK', chargingReduction: 0, closedHubId: null,
};
const labels = { RUNNING: 'Đang chạy', COMPLETED: 'Hoàn tất', FAILED: 'Thất bại' };
interface DispatchOverview {
  technicians: { id: string; displayName: string }[];
  plans: PlanView[];
}

export function SimulationPage() {
  const screen = useScreen<Overview>('/simulations', 4000);
  const action = useCommand(screen.refresh);
  const [editing, setEditing] = useState<ScenarioView>();
  const [scope, setScope] = useState<string[]>([]);
  const [snapshotRunId, setSnapshotRunId] = useState('');
  const [openRun, setOpenRun] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [approvedPlans, setApprovedPlans] = useState<Record<string, PlanView>>({});
  const [copied, setCopied] = useState<ScenarioView>();
  const detail = useScreen<RunDetail>(openRun ? '/simulations/runs/' + openRun : '', 1400);

  function choose(scenario?: ScenarioView, copy = false) {
    setEditing(copy ? undefined : scenario);
    setCopied(copy ? scenario : undefined);
    setScope(scenario?.hubIds ?? []);
    setSnapshotRunId(scenario?.parameters.snapshotRunId ?? '');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedResources = new Set(hubs.filter(hub => scope.includes(hub.id)).flatMap(hub => hub.resources.map(item => item.id)));
    const { closedHubId, override, pausedResourceIds } = parameters;
    const data = await action.send<ScenarioView>('/simulations/scenarios' + (editing ? '/' + editing.id : ''), {
      name: field(form, 'name'), objective: scenario?.objective ?? '', hubIds: scope, version: editing?.version,
      parameters: {
        ...parameters,
        durationMinutes: Number(field(form, 'duration')), demandMultiplier: Number(field(form, 'demand')),
        demandProfile: field(form, 'profile'), snapshotRunId: snapshotRunId || null,
        closedHubId: closedHubId && scope.includes(closedHubId) ? closedHubId : null,
        override: override && scope.includes(override.hubId) ? override : undefined,
        pausedResourceIds: pausedResourceIds?.filter(id => selectedResources.has(id)),
      },
    }, editing ? 'PATCH' : 'POST');
    if (data) choose(data);
  }

  async function start(scenario: ScenarioView) {
    const result = await action.send<SimulationRunView>('/simulations/scenarios/' + scenario.id + '/runs', {
      version: scenario.version,
    });
    if (result) setOpenRun(result.id);
  }

  const scenario = editing ?? copied;
  const current = detail.data?.id === openRun ? detail.data : undefined;
  const parameters = scenario?.parameters ?? initial;
  const { data } = screen;
  const hubs = data?.hubs ?? [];
  const runs = data?.runs ?? [];
  const lastRun = runs[0];
  const previousRuns = scope.length ? runs.filter(run => run.status === 'COMPLETED' &&
    scope.every(id => run.hubIds.includes(id))) : [];
  const savedSnapshotOutsideHistory = !!snapshotRunId && snapshotRunId === scenario?.parameters.snapshotRunId &&
    scope.every(id => scenario.hubIds.includes(id)) && !runs.some(run => run.id === snapshotRunId);
  const snapshotAvailable = !snapshotRunId || savedSnapshotOutsideHistory || previousRuns.some(run => run.id === snapshotRunId);
  const snapshotChanged = !!editing && snapshotRunId !== (editing.parameters.snapshotRunId ?? '');
  const transfers = current?.result?.recommendations.filter(item => item.kind === 'TRANSFER' && item.sourceHubId) ?? [];
  const dispatch = useScreen<DispatchOverview>(transfers.length ? '/operations' : '', 4000);
  const approve = useCommand(dispatch.refresh);
  const technicians = dispatch.data?.technicians ?? [];
  const assignee = technicians.find(technician => technician.id === assigneeId) ?? (technicians.length === 1 ? technicians[0] : undefined);
  const hubName = (id: string | undefined) =>
    current?.result?.hubs.find(hub => hub.hubId === id)?.name ?? hubs.find(hub => hub.id === id)?.name ?? 'Hub';

  async function approveTransfer(recommendationId: string) {
    if (!assignee) return;
    const plan = await approve.send<PlanView>(
      '/simulations/runs/' + openRun + '/recommendations/' + recommendationId + '/approve', { assigneeId: assignee.id },
    );
    if (plan) setApprovedPlans(previous => ({ ...previous, [recommendationId]: plan }));
  }

  return <section className="simulation-content">
    <PageBanner title={openRun ? 'Kết quả mô phỏng' : 'Mô phỏng nhu cầu'}
      actions={openRun && <button className="outline" type="button" onClick={() => setOpenRun('')}>Về kịch bản</button>}>
      {openRun && current ? <p>{current.name}</p> : !openRun && <p>Chọn Hub để mô phỏng nhu cầu. Xe điều chuyển lấy từ các Hub khác còn dư xe.</p>}
    </PageBanner>
    {(action.error || screen.error || detail.error) && <p className="error" role="alert">{action.error || screen.error || detail.error}</p>}
    {!data && !screen.error && <p role="status">Đang tải kịch bản…</p>}
    {data && !openRun && <div className="work-stack">
      <div className="simulation-layout">
        <aside className="work-card work-stack">
          <div className="work-heading"><h2>Kịch bản</h2>
            <button className="outline" type="button" onClick={() => choose()}>Tạo mới</button>
          </div>
          {!data.scenarios.length && <p>Chưa có kịch bản.</p>}
          <div className="app-pane-list">{data.scenarios.map(item => <button key={item.id} type="button" className="app-pane-item"
            aria-pressed={editing?.id === item.id} onClick={() => choose(item)}>
            <strong>{item.name}</strong><small>{item.hubIds.length} Hub · {item.parameters.durationMinutes} phút</small>
          </button>)}</div>
          {lastRun && <div className="work-notice">
            <strong>Lần chạy gần nhất</strong><p>{lastRun.name} · {labels[lastRun.status]}</p>
            <button className="outline" type="button" onClick={() => setOpenRun(lastRun.id)}>Xem kết quả</button>
          </div>}
        </aside>
        <div className="work-stack">
          {editing && <section className="work-card work-stack">
            <h2>{editing.name}</h2>
            {editing.objective && <p>{editing.objective}</p>}
            <div className="work-actions">
              <button className="primary" type="button" disabled={action.pending || snapshotChanged}
                onClick={() => void start(editing)}>{action.pending ? 'Đang gửi…' : 'Chạy mô phỏng'}</button>
              <button className="outline" type="button" onClick={() => choose(editing, true)}>Sao chép</button>
            </div>
          </section>}
          <form className="work-card work-form simulation-form" onSubmit={save} key={(editing?.id ?? copied?.id ?? 'new') + String(!!copied)}>
            <h2>{editing ? 'Chỉnh kịch bản' : copied ? 'Sao chép kịch bản' : 'Tạo kịch bản'}</h2>
            <label>Tên kịch bản<input name="name" maxLength={120} defaultValue={copied ? copied.name + ' (bản sao)' : editing?.name} required /></label>
            <fieldset className="work-choice-grid"><legend>Các Hub cần mô phỏng</legend>{data.hubs.map(hub => <label className="check-field" key={hub.id}>
              <input type="checkbox" checked={scope.includes(hub.id)} onChange={event => setScope(prior =>
                event.target.checked ? [...prior, hub.id] : prior.filter(id => id !== hub.id))} />{hub.name}
            </label>)}</fieldset>
            <label>Thời lượng (phút)<input name="duration" type="number" min="1" max="240" defaultValue={parameters.durationMinutes} required /></label>
            <label><span id="simulation-demand-label">Hệ số nhu cầu</span>
              <input name="demand" type="number" min="0" max="3" step=".01" defaultValue={parameters.demandMultiplier}
                aria-labelledby="simulation-demand-label" aria-describedby="simulation-demand-help" required />
              <small id="simulation-demand-help" className="muted">1× là mức cơ sở. 1,5× tăng 50% tại mỗi Hub đã chọn.</small>
            </label>
            <label><span id="simulation-profile-label">Khung nhu cầu</span>
              <select name="profile" defaultValue={parameters.demandProfile} aria-labelledby="simulation-profile-label" aria-describedby="simulation-profile-help">
                <option value="REGULAR">Ngày thường · 1 lượt mỗi 12 phút</option>
                <option value="PEAK">Cao điểm · 1 lượt mỗi 5 phút</option>
              </select>
              <small id="simulation-profile-help" className="muted">Nhịp giả lập yêu cầu mượn xe tại mỗi Hub trước khi nhân hệ số.</small>
            </label>
            <label><span id="simulation-snapshot-label">Mốc dữ liệu (snapshot)</span>
              <select name="snapshot" value={snapshotRunId} onChange={event => setSnapshotRunId(event.target.value)}
                aria-labelledby="simulation-snapshot-label" aria-describedby="simulation-snapshot-help">
                <option value="">Trạng thái hệ thống hiện tại</option>
                {previousRuns.map(run => <option key={run.id} value={run.id}>{run.name} · {displayTime(run.baseTime)}</option>)}
                {savedSnapshotOutsideHistory && <option value={snapshotRunId}>Snapshot đã lưu của kịch bản</option>}
                {!snapshotAvailable && <option value={snapshotRunId} disabled>Snapshot đã chọn thiếu dữ liệu cho các Hub</option>}
              </select>
              <small id="simulation-snapshot-help" className="muted">
                {!snapshotAvailable ? 'Chọn lại mốc dữ liệu có đủ các Hub.' : snapshotChanged ? 'Lưu kịch bản để áp dụng mốc dữ liệu mới.'
                  : 'Lấy trạng thái Hub lúc bấm Chạy mô phỏng hoặc dùng lại một mốc đã lưu.'}
              </small>
            </label>
            {!scope.length && <p className="muted">Chọn ít nhất một Hub để lưu kịch bản.</p>}
            <button className={editing ? 'outline' : 'primary'} disabled={action.pending || !scope.length || !snapshotAvailable}>Lưu kịch bản</button>
          </form>
        </div>
      </div>
      <details className="work-card">
        <summary>Lịch sử mô phỏng ({data.runs.length})</summary>
        {!data.runs.length && <p>Chưa chạy mô phỏng.</p>}
        <ul className="work-list">{data.runs.map(item => <li key={item.id}>
          <span>{item.name} · {displayTime(item.capturedAt)} · {labels[item.status]}</span>
          <button type="button" className="outline" onClick={() => setOpenRun(item.id)}>Xem kết quả</button>
        </li>)}</ul>
      </details>
    </div>}
    {openRun && !current && !detail.error && <p role="status">Đang tải lần chạy…</p>}
    {current && <section className="work-card work-stack">
      <h2>Đề xuất điều phối xe</h2>
      {current.status === 'RUNNING' && <p role="status">Đang chạy mô phỏng…</p>}
      {current.error && <p className="error" role="alert">{current.error}</p>}
      {current.status === 'COMPLETED' && !current.analysisReady && !current.error && <p role="status">Đang tìm phương án…</p>}
      {current.analysisReady && !transfers.length && <p>{current.result?.hubs.some(hub => hub.scenario.tripsMissed > 0)
        ? current.hasDonorSnapshot ? 'Chưa có phương án chuyển xe phù hợp từ các Hub khác.'
          : 'Chạy lại với trạng thái hiện tại để tìm xe từ các Hub khác.'
        : 'Các Hub đáp ứng đủ nhu cầu mượn xe.'}</p>}
      {transfers.length > 0 && <>
        {(approve.error || dispatch.error) && <p className="error" role="alert">{approve.error || dispatch.error}</p>}
        {dispatch.data && !technicians.length && <p>Chưa có kỹ thuật viên đang hoạt động.</p>}
        {technicians.length > 1 && <label className="inline-field">Giao cho Kỹ thuật
          <select value={assigneeId} onChange={event => setAssigneeId(event.target.value)}>
            <option value="">Chọn kỹ thuật viên</option>
            {technicians.map(technician => <option key={technician.id} value={technician.id}>{technician.displayName}</option>)}
          </select>
        </label>}
        <ul className="work-list">{transfers.map(rec => {
          const approved = approvedPlans[rec.id];
          const recorded = dispatch.data?.plans.find(plan => plan.recommendationId === rec.id &&
            !['DRAFT', 'CANCELLED'].includes(plan.status));
          const plan = recorded ?? dispatch.data?.plans.find(plan => plan.id === approved?.id) ?? approved;
          const count = plan && plan.status !== 'CANCELLED' ? plan.items.length : rec.count;
          return <li key={rec.id}>
            <strong>Chuyển {count} xe từ {hubName(rec.sourceHubId)} đến {hubName(rec.hubId)}</strong>
            {plan && plan.status !== 'CANCELLED' ? <span className="status-pill">
              {plan.status === 'COMPLETED' ? 'Hoàn tất' : plan.status === 'AWAITING_APPROVAL' ? 'Chờ Vận hành xác nhận'
                : plan.status === 'IN_PROGRESS' ? 'Đang điều chuyển' : 'Đã giao Kỹ thuật'}
            </span> : <button className="primary" type="button" disabled={!assignee || approve.pending}
              onClick={() => void approveTransfer(rec.id)}>Duyệt điều phối</button>}
          </li>;
        })}</ul>
      </>}
    </section>}
  </section>;
}
