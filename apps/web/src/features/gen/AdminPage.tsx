import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { AccountView, NetworkHub, Role } from '@semh/contracts';
import { field, useCommand, useScreen } from '../../shared/api/use-screen';
import { adminViews } from '../../app/navigation';
import { ResourceCatalog } from '../ops/ResourceCatalog';

const roleNames: Record<Role, string> = { STU: 'Sinh viên', OPR: 'Vận hành', MNT: 'Kỹ thuật', ADM: 'Quản trị' };

export function AdminPage() {
  const [params, setParams] = useSearchParams();
  const view = adminViews.find(item => item.key === params.get('tab')) ?? adminViews[0];
  const accounts = useScreen<AccountView[]>(view.key === 'catalog' ? '' : '/admin/accounts');
  const catalog = useScreen<{ hubs: NetworkHub[] }>('/operations/catalog');
  const action = useCommand(accounts.refresh);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [accountAction, setAccountAction] = useState<'info' | 'status'>();
  const [selectedId, setSelectedId] = useState('');
  const [role, setRole] = useState<Role>('OPR');
  const [grant, setGrant] = useState(true);
  const [message, setMessage] = useState('');
  const permissionsId = params.get('account') ?? selectedId;
  const shown = accounts.data?.filter(item =>
    (item.username + ' ' + item.displayName).toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))) ?? [];
  const selected = view.key === 'permissions' ? accounts.data?.find(item => item.id === permissionsId)
    : shown.find(item => item.id === selectedId) ?? shown[0];
  const locked = selected?.status === 'LOCKED';
  const operatorRole = selected?.assignments.find(item => item.role === 'OPR');
  const hubNames = new Map(catalog.data?.hubs.map(hub => [hub.id, hub.name]));

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const data = new FormData(element);
    const result = await action.send<AccountView>('/admin/accounts', {
      username: field(data, 'username'), displayName: field(data, 'displayName'), password: String(data.get('password') ?? ''),
    });
    if (result) {
      setCreateOpen(false); setQuery(''); setSelectedId(result.id); setAccountAction(undefined);
      setMessage('Đã tạo tài khoản ' + result.username + '.');
    }
  }

  async function save(event: FormEvent<HTMLFormElement>, mode: 'info' | 'status' | 'permissions') {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const common = { version: selected.version, reason: field(form, 'reason') || undefined };
    const path = '/admin/accounts/' + selected.id;
    const result = await (mode === 'permissions'
      ? action.send(path + '/roles', { ...common, role, grant, allHubs: form.has('allHubs'), hubIds: form.getAll('hubIds') })
      : action.send(path, {
        ...common, ...(mode === 'info' ? { displayName: field(form, 'name') }
          : { status: selected.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE' }),
      }, 'PATCH'));
    if (result) {
      setAccountAction(undefined);
      setMessage('Đã cập nhật ' + selected.username + '.');
    }
  }

  function scope(account: AccountView) {
    const assignment = account.assignments.find(item => item.role === 'OPR');
    if (assignment) return assignment.allHubs ? 'Tất cả Hub'
      : assignment.hubIds.map(id => hubNames.get(id) ?? 'Hub ngoài danh mục').join(', ') || 'Chưa có Hub';
    if (account.assignments.some(item => item.role === 'ADM')) return 'Quản trị dùng chung';
    if (account.assignments.some(item => item.role === 'MNT')) return 'Công việc được giao';
    if (account.assignments.some(item => item.role === 'STU')) return 'Dữ liệu cá nhân';
    return '—';
  }

  const screenError = view.key === 'catalog' ? catalog.error : accounts.error;

  return <section className="work-stack admin-content">
    <header className="page-heading">
      <h1>{view.title}</h1>
      {view.key === 'catalog' && <p>Khai báo Hub và thiết bị ở trạng thái nháp.</p>}
    </header>
    {(action.error || screenError) && <p className="error" role="alert">{action.error || screenError}</p>}
    {message && <p className="handoff-notice" role="status">{message}</p>}
    {view.key === 'catalog' ? (
      catalog.data ? <ResourceCatalog admin hubs={catalog.data.hubs} refresh={catalog.refresh} />
        : !catalog.error && <p role="status">Đang tải danh mục…</p>
    ) : !accounts.data ? (
      !accounts.error && <p role="status">Đang tải tài khoản…</p>
    ) : view.key === 'accounts' ? <>
      <div className="filter-toolbar">
        <label className="search-field">Tìm tài khoản<input type="search" value={query} onChange={event => { setQuery(event.target.value); setAccountAction(undefined); }}
          placeholder="Tên hoặc tên đăng nhập" /></label>
        <button type="button" className={selected || createOpen ? 'outline' : 'primary'} onClick={() => {
          setAccountAction(undefined);
          setCreateOpen(!createOpen);
        }} aria-expanded={createOpen}>
          {createOpen ? 'Đóng biểu mẫu' : 'Cấp tài khoản'}
        </button>
      </div>
      {createOpen && <form className="work-card work-form work-form-wide" onSubmit={create}>
        <h2>Thông tin tài khoản mới</h2>
        <label>Tên đăng nhập<input name="username" maxLength={50} autoComplete="off" required /></label>
        <label>Tên hiển thị<input name="displayName" maxLength={100} required /></label>
        <label>Mật khẩu khởi tạo<input name="password" type="password" minLength={12} maxLength={256} autoComplete="new-password" required /></label>
        <button className="primary" disabled={action.pending}>Tạo tài khoản sinh viên</button>
      </form>}
      <div className="app-pane-layout">
      <section className="work-card work-stack">
        <h2>Tài khoản ({shown.length})</h2>
        {shown.length ? <div className="app-pane-list">{shown.map(account => <button key={account.id} type="button"
          className="app-pane-item" aria-pressed={selected?.id === account.id} onClick={() => {
            setSelectedId(account.id); setAccountAction(undefined); setMessage('');
          }}>
          <strong>{account.displayName}</strong><small>{account.username}</small>
          <span className="status-pill" data-tone={account.status === 'LOCKED' ? 'danger' : 'success'}>
            {account.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}</span>
        </button>)}</div> : <p>Không tìm thấy tài khoản phù hợp.</p>}
      </section>
      {selected && <section className="work-card work-stack" key={selected.id}>
        <h2>{selected.displayName}</h2>
        <dl className="reservation-details">
          <div><dt>Tên đăng nhập</dt><dd>{selected.username}</dd></div>
          <div><dt>Trạng thái</dt><dd>{selected.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}</dd></div>
          <div><dt>Vai trò</dt><dd>{selected.assignments.map(item => roleNames[item.role]).join(', ') || 'Chưa cấp quyền'}</dd></div>
          <div><dt>Phạm vi</dt><dd>{scope(selected)}</dd></div>
        </dl>
        {!createOpen && !accountAction && <div className="work-actions">
          {locked && <button className="primary" type="button" onClick={() => setAccountAction('status')}>Mở khóa tài khoản</button>}
          <Link className={locked ? 'outline' : 'primary'}
            to={'?tab=permissions&account=' + encodeURIComponent(selected.id)}>Phân quyền</Link>
          <button className={locked ? 'quiet-action' : 'outline'} type="button"
            onClick={() => setAccountAction('info')}>Sửa thông tin</button>
          {!locked && <button className="quiet-action quiet-action-destructive" type="button"
            onClick={() => setAccountAction('status')}>Khóa tài khoản</button>}
        </div>}
        {accountAction === 'info' && <form className="work-form inline-action" onSubmit={event => void save(event, 'info')}>
          <label>Tên hiển thị<input name="name" defaultValue={selected.displayName} maxLength={100} required /></label>
          <div className="work-actions">
            <button className="primary" disabled={action.pending}>Lưu thông tin</button>
            <button className="outline" type="button" disabled={action.pending} onClick={() => setAccountAction(undefined)}>Quay lại</button>
          </div>
        </form>}
        {accountAction === 'status' && <form className="work-form inline-action" onSubmit={event => void save(event, 'status')}>
          <h3>{locked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}</h3>
          {!locked && <p>Tài khoản sẽ bị đăng xuất và không thể đăng nhập cho tới khi được mở khóa.</p>}
          <label>Lý do<input name="reason" required maxLength={500} /></label>
          <div className="work-actions">
            <button className={locked ? 'primary' : 'danger'} disabled={action.pending}>
              {locked ? 'Xác nhận mở khóa' : 'Xác nhận khóa'}
            </button>
            <button className="outline" type="button" disabled={action.pending} onClick={() => setAccountAction(undefined)}>Quay lại</button>
          </div>
        </form>}
      </section>}
      </div>
    </> : <div className="app-pane-layout">
      <form className="work-card work-form work-form-wide" onSubmit={event => void save(event, 'permissions')} key={selected?.id ?? 'empty'}>
        <h2>Tài khoản được phân quyền</h2>
        <label>Tài khoản<select value={permissionsId} onChange={event => {
          const next = new URLSearchParams({ tab: 'permissions' });
          if (event.target.value) next.set('account', event.target.value);
          setParams(next, { replace: true });
          setSelectedId(event.target.value);
        }} required>
          <option value="">Chọn tài khoản</option>
          {accounts.data.map(account => <option key={account.id} value={account.id}>{account.username} · {account.displayName}</option>)}
        </select></label>
        <label>Vai trò<select value={role} onChange={event => setRole(event.target.value as Role)}>
          {Object.entries(roleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <label>Thay đổi<select value={grant ? 'grant' : 'revoke'} onChange={event => setGrant(event.target.value === 'grant')}>
          <option value="grant">Cấp hoặc cập nhật phạm vi</option><option value="revoke">Thu hồi</option>
        </select></label>
        <label>Lý do<input name="reason" required maxLength={500} /></label>
        {role === 'OPR' && grant && <fieldset><legend>Phạm vi Hub</legend>
          <label className="check-field"><input name="allHubs" type="checkbox" defaultChecked={operatorRole?.allHubs} />Tất cả Hub</label>
          {catalog.data?.hubs.map(hub => <label className="check-field" key={hub.id}>
            <input name="hubIds" type="checkbox" value={hub.id} defaultChecked={operatorRole?.hubIds.includes(hub.id)} />{hub.name}
          </label>)}
        </fieldset>}
        <button className={grant ? 'primary' : 'danger'} disabled={action.pending || !selected}>
          {grant ? 'Lưu phân quyền' : 'Thu hồi vai trò'}
        </button>
      </form>
      {selected && <div className="work-card data-card">
        <h2 className="data-card-heading">Quyền hiện tại</h2>
        <div className="scroll-table"><table>
          <thead><tr><th>Vai trò</th><th>Phạm vi truy cập</th></tr></thead>
          <tbody>{selected.assignments.map(assignment => <tr key={assignment.role}>
            <td>{roleNames[assignment.role]}</td><td>{scope({ ...selected, assignments: [assignment] })}</td>
          </tr>)}</tbody>
        </table></div>
        {!selected.assignments.length && <p className="data-empty">Tài khoản chưa có vai trò.</p>}
      </div>}
    </div>}
  </section>;
}
