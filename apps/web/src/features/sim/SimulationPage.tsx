import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { ScenarioView, SimulationMetrics, SimulationParameters, SimulationRunView } from '@semh/contracts';
import { MetricIcon } from '../../shared/ui/MetricIcon';
import { PageBanner } from '../../shared/ui/PageBanner';
import { displayTime, field, useCommand, useScreen } from '../../shared/api/use-screen';

interface Overview { hubs: { id: string; name: string; resources: { id: string; code: string }[] }[]; scenarios: ScenarioView[]; runs: SimulationRunView[] }
interface RunDetail extends SimulationRunView { parameters: SimulationParameters; profileVersion: string; sourceRunId: string | null }
const initial = { durationMinutes: 60, demandMultiplier: 1.5, demandProfile: 'PEAK', chargingReduction: 0, closedHubId: null } as const;
const labels = { RUNNING: 'Đang chạy', COMPLETED: 'Hoàn tất', FAILED: 'Thất bại' };
const indicators: Record<keyof SimulationMetrics, string> = {
  tripsServed: 'Chuyến phục vụ', tripsMissed: 'Chuyến thiếu xe', parkingMissed: 'Lượt đỗ không đáp ứng',
  chargingMissed: 'Nhu cầu sạc không đáp ứng', vehiclesAtEnd: 'Xe khả dụng cuối kỳ',
};

export function SimulationPage() {
  const screen = useScreen<Overview>('/simulations', 4000);
  const action = useCommand(screen.refresh);
  const [editing, setEditing] = useState<ScenarioView>();
  const [scope, setScope] = useState<string[]>([]);
  const [openRun, setOpenRun] = useState('');
  const [copied, setCopied] = useState<ScenarioView>();
  const detail = useScreen<RunDetail>(openRun ? '/simulations/runs/' + openRun : '', 1400);

  function choose(scenario?: ScenarioView, copy = false) {
    setEditing(copy ? undefined : scenario);
    setCopied(copy ? scenario : undefined);
    setScope(scenario?.hubIds ?? []);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const overrideHub = field(form, 'overrideHub');
    const optionalNumber = (key: string) => field(form, key) ? Number(field(form, key)) : undefined;
    const data = await action.send<ScenarioView>('/simulations/scenarios' + (editing ? '/' + editing.id : ''), {
      name: field(form, 'name'), objective: field(form, 'objective'), hubIds: scope, version: editing?.version,
      parameters: {
        durationMinutes: Number(field(form, 'duration')), demandMultiplier: Number(field(form, 'demand')),
        demandProfile: field(form, 'profile'), chargingReduction: Number(field(form, 'reduction')),
        closedHubId: field(form, 'closedHub') || null,
        override: overrideHub ? {
          hubId: overrideHub, fleetCapacity: optionalNumber('fleetCapacity'), parkingCapacity: optionalNumber('parkingCapacity'),
          chargingCapacity: optionalNumber('chargingCapacity'), chargeKw: optionalNumber('chargeKw'),
        } : undefined,
        pausedResourceIds: form.getAll('pausedResourceIds'),
      },
    }, editing ? 'PATCH' : 'POST');
    if (data) choose(data);
  }

  async function start(scenario: ScenarioView, sourceRunId: string | null = null) {
    const result = await action.send<SimulationRunView>('/simulations/scenarios/' + scenario.id + '/runs', {
      version: scenario.version, sourceRunId,
    });
    if (result) setOpenRun(result.id);
  }

  const scenario = editing ?? copied;
  const current = detail.data?.id === openRun ? detail.data : undefined;
  const parameters = scenario?.parameters ?? initial;
  const { data } = screen;
  const lastRun = data?.runs[0];
  const previousRuns = editing ? data?.runs.filter(run => run.status === 'COMPLETED' &&
    editing.hubIds.every(id => run.hubIds.includes(id))) ?? [] : [];
  const scenarioDemand = current?.result?.hubs.reduce((total, hub) => ({
    served: total.served + hub.scenario.tripsServed,
    missed: total.missed + hub.scenario.tripsMissed,
  }), { served: 0, missed: 0 });
  const demandCount = (scenarioDemand?.served ?? 0) + (scenarioDemand?.missed ?? 0);
  const serviceRate = scenarioDemand && demandCount ? Math.round(scenarioDemand.served / demandCount * 100) + '%' : '—';
  return <section className="simulation-content">
    <PageBanner title={openRun ? 'Kết quả mô phỏng' : 'Mô phỏng nhu cầu'}
      actions={openRun && <button className="outline" type="button" onClick={() => setOpenRun('')}>Về kịch bản</button>}>
      {openRun && current ? <p>{current.name} · {labels[current.status]}</p> : !openRun && <p>Thử thay đổi nhu cầu hoặc năng lực phục vụ tại các Hub.</p>}
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
              <button className="primary" type="button" disabled={action.pending}
                onClick={() => void start(editing)}>{action.pending ? 'Đang gửi…' : 'Chạy mô phỏng'}</button>
              <button className="outline" type="button" onClick={() => choose(editing, true)}>Sao chép</button>
            </div>
            {!!previousRuns.length && <details>
              <summary>Dùng dữ liệu từ lần chạy trước</summary>
              <form className="work-form" key={editing.id} onSubmit={event => {
                event.preventDefault();
                void start(editing, field(new FormData(event.currentTarget), 'snapshot'));
              }}>
                <label>Mốc dữ liệu<select name="snapshot" required>
                  <option value="">Chọn lần chạy</option>
                  {previousRuns.map(item => <option key={item.id} value={item.id}>{item.name} · {displayTime(item.baseTime)}</option>)}
                </select></label>
                <button className="outline" disabled={action.pending}>Chạy với dữ liệu đã chọn</button>
              </form>
            </details>}
          </section>}
          <form className="work-card work-form simulation-form" onSubmit={save} key={(editing?.id ?? copied?.id ?? 'new') + String(!!copied)}>
            <h2>{editing ? 'Chỉnh kịch bản' : copied ? 'Sao chép kịch bản' : 'Tạo kịch bản'}</h2>
            <label>Tên kịch bản<input name="name" maxLength={120} defaultValue={copied ? copied.name + ' (bản sao)' : editing?.name} required /></label>
            <fieldset className="work-choice-grid"><legend>Các Hub cần mô phỏng</legend>{data.hubs.map(hub => <label className="check-field" key={hub.id}>
              <input type="checkbox" checked={scope.includes(hub.id)} onChange={event => setScope(prior =>
                event.target.checked ? [...prior, hub.id] : prior.filter(id => id !== hub.id))} />{hub.name}
            </label>)}</fieldset>
            <label>Thời lượng (phút)<input name="duration" type="number" min="1" max="240" defaultValue={parameters.durationMinutes} required /></label>
            <label>Nhu cầu so với khung đã chọn (lần)<input name="demand" type="number" min="0" max="3" step=".01" defaultValue={parameters.demandMultiplier} required /></label>
            <label>Khung nhu cầu<select name="profile" defaultValue={parameters.demandProfile}>
              <option value="REGULAR">Ngày thường</option><option value="PEAK">Cao điểm</option>
            </select></label>
            <details className="simulation-advanced">
              <summary>Tùy chọn nâng cao</summary>
              <div className="work-form">
                <label>Mục tiêu (tùy chọn)<textarea name="objective" defaultValue={scenario?.objective} maxLength={400} /></label>
                <label>Hub tạm ngừng<select name="closedHub" defaultValue={parameters.closedHubId ?? ''}>
                  <option value="">Không tạm ngừng</option>{data.hubs.filter(hub => scope.includes(hub.id)).map(hub => (
                    <option key={hub.id} value={hub.id}>{hub.name}</option>))}
                </select></label>
                <label>Giảm công suất sạc (%)<input name="reduction" type="number" min="0" max="100" defaultValue={parameters.chargingReduction} required /></label>
                <label>Hub điều chỉnh<select name="overrideHub" defaultValue={scenario?.parameters.override?.hubId ?? ''}>
                  <option value="">Giữ cấu hình cơ sở</option>{data.hubs.filter(hub => scope.includes(hub.id)).map(hub => (
                    <option key={hub.id} value={hub.id}>{hub.name}</option>))}
                </select></label>
                <label>Sức chứa xe<input name="fleetCapacity" type="number" min="0" max="500" defaultValue={scenario?.parameters.override?.fleetCapacity} /></label>
                <label>Số chỗ đỗ<input name="parkingCapacity" type="number" min="0" max="500" defaultValue={scenario?.parameters.override?.parkingCapacity} /></label>
                <label>Số cổng sạc<input name="chargingCapacity" type="number" min="0" max="500" defaultValue={scenario?.parameters.override?.chargingCapacity} /></label>
                <label>Công suất Hub (kW)<input name="chargeKw" type="number" min="0" max="1500" step="any" defaultValue={scenario?.parameters.override?.chargeKw} /></label>
                <label>Thiết bị tạm ngừng<select multiple size={5} name="pausedResourceIds" defaultValue={scenario?.parameters.pausedResourceIds ?? []}>
                  {data.hubs.filter(hub => scope.includes(hub.id)).map(hub => <optgroup key={hub.id} label={hub.name}>
                    {hub.resources.map(item => <option key={item.id} value={item.id}>{item.code}</option>)}
                  </optgroup>)}
                </select></label>
              </div>
            </details>
            {!scope.length && <p className="muted">Chọn ít nhất một Hub để lưu kịch bản.</p>}
            <button className={editing ? 'outline' : 'primary'} disabled={action.pending || !scope.length}>Lưu kịch bản</button>
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
    {current && <div className="work-stack">
      <section className="work-card work-heading">
        <span className="status-pill" data-tone={current.status === 'COMPLETED' ? 'success' : 'info'}>{labels[current.status]}</span>
        <span>Dữ liệu lúc {displayTime(current.baseTime)} · {current.parameters.durationMinutes} phút · {current.hubIds.length} Hub</span>
      </section>
      {current.result && <div className="metric-grid">
        <div className="work-card metric-card">
          <span className="metric-label">Tỷ lệ chuyến được phục vụ</span><b className="metric-value">{serviceRate}</b>
          <MetricIcon name="served" />
        </div>
        <div className="work-card metric-card">
          <span className="metric-label">Chuyến thiếu xe</span><b className="metric-value">{scenarioDemand?.missed ?? 0}</b>
          <MetricIcon name="shortage" />
        </div>
        <div className="work-card metric-card">
          <span className="metric-label">Hub mô phỏng</span><b className="metric-value">{current.result.hubs.length}</b>
          <MetricIcon name="hub" />
        </div>
        <div className="work-card metric-card">
          <span className="metric-label">Khuyến nghị</span><b className="metric-value">{current.analysisReady ? current.result.recommendations.length : '—'}</b>
          <MetricIcon name="recommendation" />
        </div>
      </div>}
      {current.result && <section className="work-card">
        <h2>Khuyến nghị điều phối</h2>
        {!current.analysisReady && <p>{current.error ? 'Phân tích chưa hoàn tất.' : 'Đang phân tích kết quả…'}</p>}
        {current.analysisReady && !current.result.recommendations.length && <p>Không phát sinh khuyến nghị.</p>}
        <ul className="work-list">{current.result.recommendations.map(rec => <li key={rec.id}>
          <span><strong>{data?.hubs.find(hub => hub.id === rec.hubId)?.name}</strong><br />{rec.evidence}</span>
          {rec.kind === 'TRANSFER' && <Link className="primary" to={'/operations/dashboard?' +
            new URLSearchParams({ tab: 'plans', run: current.id, rec: rec.id })}>Lập kế hoạch chuyển {rec.count} xe</Link>}
        </li>)}</ul>
      </section>}
      <section className="work-card work-stack">
        <h2>So sánh theo Hub</h2>
        {current.status === 'RUNNING' && <progress value={current.progress} max={100} aria-label="Tiến độ mô phỏng" />}
        {current.error && <p className="error">{current.error}</p>}
        {current.result && <>
          {current.result.hubs.map(hub => <details key={hub.hubId}>
            <summary>{hub.name}</summary>
            <div className="scroll-table"><table><thead><tr><th>Chỉ số</th><th>Cơ sở</th><th>Kịch bản</th><th>Chênh lệch</th></tr></thead>
              <tbody>{(Object.keys(indicators) as (keyof SimulationMetrics)[]).map(key => <tr key={key}>
                <td>{indicators[key]}</td><td>{hub.baseline[key]}</td><td>{hub.scenario[key]}</td>
                <td>{hub.scenario[key] - hub.baseline[key]}</td></tr>)}</tbody></table></div>
            <details><summary>Xe khả dụng theo phút</summary>
              <div className="scroll-table timeline-table"><table><thead><tr><th>Phút</th><th>Cơ sở</th><th>Kịch bản</th></tr></thead>
                <tbody>{hub.timeline.map(point => <tr key={point.minute}><td>{point.minute}</td><td>{point.baseline}</td><td>{point.scenario}</td></tr>)}</tbody>
              </table></div>
            </details>
          </details>)}
          {!!current.result.warnings.length && <ul>{current.result.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>}
        </>}
      </section>
    </div>}
  </section>;
}
