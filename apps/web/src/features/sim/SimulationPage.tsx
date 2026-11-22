import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { ScenarioView, SimulationMetrics, SimulationParameters, SimulationRunView } from '@semh/contracts';
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
  const [runScenario, setRunScenario] = useState<ScenarioView>();
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

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!runScenario) return;
    const form = new FormData(event.currentTarget);
    const result = await action.send<SimulationRunView>('/simulations/scenarios/' + runScenario.id + '/runs', {
      version: runScenario.version, sourceRunId: field(form, 'snapshot') || null,
    });
    if (result) { setOpenRun(result.id); setRunScenario(undefined); }
  }

  const scenario = editing ?? copied;
  const current = detail.data?.id === openRun ? detail.data : undefined;
  const parameters = scenario?.parameters ?? initial;
  const { data } = screen;
  const lastRun = data?.runs[0];
  const scenarioDemand = current?.result?.hubs.reduce((total, hub) => ({
    served: total.served + hub.scenario.tripsServed,
    missed: total.missed + hub.scenario.tripsMissed,
  }), { served: 0, missed: 0 });
  const demandCount = (scenarioDemand?.served ?? 0) + (scenarioDemand?.missed ?? 0);
  const serviceRate = scenarioDemand && demandCount ? Math.round(scenarioDemand.served / demandCount * 100) + '%' : '—';
  return <section className="simulation-content">
    <PageBanner title={openRun ? 'Kết quả mô phỏng' : 'Không gian mô phỏng'}
      actions={openRun && <button className="outline" type="button" onClick={() => setOpenRun('')}>Về kịch bản</button>}>
      {openRun && current ? <p>{current.name} · {labels[current.status]}</p> : !openRun && <p>Thiết lập giả định và chạy trên bản sao mạng lưới.</p>}
    </PageBanner>
    {(action.error || screen.error || detail.error) && <p className="error" role="alert">{action.error || screen.error || detail.error}</p>}
    {!data && !screen.error && <p role="status">Đang tải kịch bản…</p>}
    {data && !openRun && <div className="work-stack">
      <div className="simulation-layout">
        <aside className="work-stack">
          <h2>Kịch bản của tôi</h2>
          {!data.scenarios.length && <p>Chưa có kịch bản.</p>}
          {data.scenarios.map(item => <article key={item.id} className="work-card">
            <h3>{item.name}</h3><p>{item.objective}</p>
            <p>{item.hubIds.length} Hub · {item.parameters.durationMinutes} phút · v{item.version + 1}</p>
            <div className="work-actions">
              <button className="outline" onClick={() => choose(item)}>Mở</button>
              <button className="outline" onClick={() => choose(item, true)}>Sao chép</button>
              <button className="primary" onClick={() => setRunScenario(item)}>Chạy mô phỏng</button>
            </div>
          </article>)}
          {runScenario && <form className="work-card work-form" onSubmit={start} key={runScenario.id}>
            <h2>Chạy {runScenario.name}</h2>
            <label>Trạng thái cơ sở<select name="snapshot"><option value="">Dữ liệu hiện tại</option>
              {data.runs.filter(item => item.status === 'COMPLETED' && runScenario.hubIds.every(id => item.hubIds.includes(id))).map(item => (
                <option key={item.id} value={item.id}>{item.name} · {displayTime(item.baseTime)}</option>))}
            </select></label>
            <button className="primary" disabled={action.pending}>Xác nhận chạy</button>
          </form>}
          {lastRun && <div className="work-card tinted-panel" data-tone="info">
            <h2>Lần chạy gần nhất</h2><p>{lastRun.name} · {labels[lastRun.status]}</p>
            <button className="outline" type="button" onClick={() => setOpenRun(lastRun.id)}>Xem kết quả</button>
          </div>}
        </aside>
        <form className="work-card work-form simulation-form" onSubmit={save} key={(editing?.id ?? copied?.id ?? 'new') + String(!!copied)}>
          <div className="work-heading"><h2>Cấu hình kịch bản</h2>
            {scenario && <button className="outline" type="button" onClick={() => choose()}>Tạo mới</button>}</div>
          <label>Tên kịch bản<input name="name" maxLength={120} defaultValue={copied ? copied.name + ' (bản sao)' : editing?.name} required /></label>
          <label>Mục tiêu<textarea name="objective" defaultValue={scenario?.objective} maxLength={400} required /></label>
          <fieldset><legend>Phạm vi Hub</legend>{data.hubs.map(hub => <label className="check-field" key={hub.id}>
            <input type="checkbox" checked={scope.includes(hub.id)} onChange={event => setScope(prior =>
              event.target.checked ? [...prior, hub.id] : prior.filter(id => id !== hub.id))} />{hub.name}
          </label>)}</fieldset>
          <label>Thời lượng (phút)<input name="duration" type="number" min="1" max="240" defaultValue={parameters.durationMinutes} required /></label>
          <label>Hệ số nhu cầu<input name="demand" type="number" min="0" max="3" step=".01" defaultValue={parameters.demandMultiplier} required /></label>
          <label>Bộ nhu cầu<select name="profile" defaultValue={parameters.demandProfile}>
            <option value="REGULAR">Ngày thường</option><option value="PEAK">Cao điểm</option>
          </select></label>
          <label>Hub tạm ngừng<select name="closedHub" defaultValue={parameters.closedHubId ?? ''}>
            <option value="">Không tạm ngừng</option>{data.hubs.filter(hub => scope.includes(hub.id)).map(hub => (
              <option key={hub.id} value={hub.id}>{hub.name}</option>))}
          </select></label>
          <label>Giảm năng lực sạc (%)<input name="reduction" type="number" min="0" max="100" defaultValue={parameters.chargingReduction} required /></label>
          <details>
            <summary>Điều chỉnh tài nguyên</summary>
            <div className="work-form">
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
          <div className="work-notice">Mô phỏng không thay đổi dữ liệu vận hành.</div>
          <div className="work-actions">
            <button className="primary" disabled={action.pending || !scope.length}>Lưu kịch bản</button>
            {editing && <button className="outline" type="button" onClick={() => setRunScenario(editing)}>Chọn mốc và chạy</button>}
          </div>
        </form>
      </div>
      <article className="work-card">
        <h2>Lần chạy</h2>
        {!data.runs.length && <p>Chưa chạy mô phỏng.</p>}
        <ul className="work-list">{data.runs.map(item => <li key={item.id}>
          <span>{item.name} · {displayTime(item.capturedAt)} · {labels[item.status]}</span>
          <button type="button" className="outline" onClick={() => setOpenRun(item.id)}>Xem kết quả</button>
        </li>)}</ul>
      </article>
    </div>}
    {openRun && !current && !detail.error && <p role="status">Đang tải lần chạy…</p>}
    {current && <div className="work-stack">
      <section className="work-card work-heading">
        <span className="status-pill" data-tone={current.status === 'COMPLETED' ? 'success' : 'info'}>{labels[current.status]}</span>
        <span>Snapshot {displayTime(current.baseTime)} · {current.parameters.durationMinutes} phút · {current.hubIds.length} Hub</span>
      </section>
      {current.result && <div className="metric-grid">
        <div className="work-card tinted-panel" data-tone="info"><span>Tỷ lệ chuyến được phục vụ</span><b>{serviceRate}</b></div>
        <div className="work-card tinted-panel" data-tone="danger"><span>Chuyến thiếu xe</span><b>{scenarioDemand?.missed ?? 0}</b></div>
        <div className="work-card tinted-panel" data-tone="aqua"><span>Hub mô phỏng</span><b>{current.result.hubs.length}</b></div>
        <div className="work-card"><span>Khuyến nghị</span><b>{current.analysisReady ? current.result.recommendations.length : '—'}</b></div>
      </div>}
      <div className="simulation-results">
        <article className="work-card work-stack">
        <h2>So sánh theo Hub</h2>
        {current.status === 'RUNNING' && <progress value={current.progress} max={100} aria-label="Tiến độ mô phỏng" />}
        {current.error && <p className="error">{current.error}</p>}
        {current.result && <>
          {current.result.hubs.map(hub => <details key={hub.hubId} open>
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
        </article>
        {current.result && <section className="work-card">
          <h2>Khuyến nghị điều phối</h2>
          {!current.analysisReady && <p>{current.error ? 'Phân tích chưa hoàn tất.' : 'Đang phân tích kết quả…'}</p>}
          {current.analysisReady && !current.result.recommendations.length && <p>Không phát sinh khuyến nghị.</p>}
          <ul className="work-list">{current.result.recommendations.map(rec => <li key={rec.id}>
            <span><strong>{data?.hubs.find(hub => hub.id === rec.hubId)?.name}</strong> · {rec.evidence}</span>
            {rec.kind === 'TRANSFER' && <Link className="outline" to={'/operations/dashboard?' +
              new URLSearchParams({ tab: 'plans', run: current.id, rec: rec.id })}>Mở phương án điều chuyển {rec.count} xe</Link>}
          </li>)}</ul>
        </section>}
      </div>
    </div>}
  </section>;
}
