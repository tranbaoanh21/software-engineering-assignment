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
  const selected = accounts.data?.find(item => item.id === (view.key === 'permissions' ? permissionsId : selectedId));
  const shown = accounts.data?.filter(item =>
    (item.username + ' ' + item.displayName).toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))) ?? [];
  const hubNames = new Map(catalog.data?.hubs.map(hub => [hub.id, hub.name]));

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const data = new FormData(element);
    const result = await action.send<AccountView>('/admin/accounts', {
      username: field(data, 'username'), displayName: field(data, 'displayName'), password: String(data.get('password') ?? ''),
    });
    if (result) { setCreateOpen(false); setMessage('Đã tạo tài khoản ' + result.username + '.'); }
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
      {view.key === 'accounts' && <p>Cấp tài khoản và kiểm soát quyền truy cập hệ thống.</p>}
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
        <label className="search-field">Tìm tài khoản<input type="search" value={query} onChange={event => setQuery(event.target.value)}
          placeholder="Tên hoặc tên đăng nhập" /></label>
        <button type="button" className="primary" onClick={() => setCreateOpen(!createOpen)} aria-expanded={createOpen}>
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
      <div className="work-card data-card">
        <div className="scroll-table" tabIndex={0} role="region" aria-label="Danh sách tài khoản">
          <table>
            <thead><tr><th>Tài khoản</th><th>Họ và tên</th><th>Vai trò</th><th>Trạng thái</th><th>Phạm vi</th></tr></thead>
            <tbody>{shown.map(account => <tr key={account.id} data-selected={account.id === selectedId}>
              <td><button className="table-link" type="button" onClick={() => { setSelectedId(account.id); setAccountAction(undefined); }}>
                {account.username}
              </button></td>
              <td>{account.displayName}</td>
              <td>{account.assignments.map(assignment => roleNames[assignment.role]).join(', ') || 'Chưa cấp quyền'}</td>
              <td><span className="status-pill" data-tone={account.status === 'LOCKED' ? 'danger' : 'success'}>
                {account.status === 'ACTIVE' ? 'Hoạt động' : 'Đã khóa'}
              </span></td>
              <td>{scope(account)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {!shown.length && <p className="data-empty">Không tìm thấy tài khoản phù hợp.</p>}
      </div>
      {selected && <section className="work-card work-stack" key={selected.id}>
        <div className="work-heading"><h2>Tài khoản {selected.username}</h2>
          <button className="outline" type="button" onClick={() => setSelectedId('')}>Đóng chi tiết</button></div>
        <p>{selected.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'} · {scope(selected)}</p>
        <div className="work-actions">
          <button className="outline" type="button" onClick={() => setAccountAction('info')}>Sửa thông tin</button>
          <button className={selected.status === 'ACTIVE' ? 'danger' : 'outline'} type="button" onClick={() => setAccountAction('status')}>
            {selected.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
          </button>
          <Link className="outline" to={'?tab=permissions&account=' + encodeURIComponent(selected.id)}>Phân quyền</Link>
        </div>
        {accountAction === 'info' && <form className="work-form work-form-wide" onSubmit={event => void save(event, 'info')}>
          <label>Tên hiển thị<input name="name" defaultValue={selected.displayName} maxLength={100} required /></label>
          <button className="primary" disabled={action.pending}>Lưu thông tin</button>
        </form>}
        {accountAction === 'status' && <form className="work-form work-form-wide" onSubmit={event => void save(event, 'status')}>
          <label>Lý do<input name="reason" required maxLength={500} /></label>
          <button className={selected.status === 'ACTIVE' ? 'danger' : 'primary'} disabled={action.pending}>
            {selected.status === 'ACTIVE' ? 'Xác nhận khóa' : 'Xác nhận mở khóa'}
          </button>
        </form>}
      </section>}
    </> : <>
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
          <label className="check-field"><input name="allHubs" type="checkbox" />Tất cả Hub</label>
          {catalog.data?.hubs.map(hub => <label className="check-field" key={hub.id}>
            <input name="hubIds" type="checkbox" value={hub.id} />{hub.name}
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
    </>}
  </section>;
}
