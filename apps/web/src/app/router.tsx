import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router';
import type { Role, SessionView } from '@semh/contracts';
import { authApi } from '../features/gen/auth-api';
import { LoginPage } from '../features/gen/LoginPage';
import { RegisterPage } from '../features/gen/RegisterPage';
import { resRoute } from '../features/res/route';
import { tripRoute } from '../features/trip/route';
import { parkRoute, privateVehiclesRoute } from '../features/park/route';
import { chgRoute } from '../features/chg/route';
import { opsRoutes } from '../features/ops/routes';
import { simRoute } from '../features/sim/route';
import { administrationRoute } from '../features/gen/route';
import { SessionContext } from '../shared/auth/session-context';
import { StudentActivity } from '../features/hub/StudentActivity';
import { adminViews, operationViews } from './navigation';
import { ApiError } from '../shared/api/http';

interface Feature {
  path: string;
  label: string;
  element: ReactNode;
}

interface Portal {
  path: string;
  role: Role;
  label: string;
  features: readonly [Feature, ...Feature[]];
}

const HubPage = lazy(async () => ({ default: (await import('../features/hub/HubPage')).HubPage }));
const hubScreen = <Suspense fallback={<p role="status">Đang tải bản đồ…</p>}><HubPage /></Suspense>;
const hubRoute = {
  path: 'hubs',
  label: 'Khám phá Hub',
  element: <Suspense fallback={<p role="status">Đang tải bản đồ…</p>}><HubPage canBook /></Suspense>,
};
const portals: Portal[] = [
  { path: 'student', role: 'STU', label: 'Sinh viên', features: [
    hubRoute, { path: 'activity', label: 'Hoạt động của tôi', element: <StudentActivity /> },
    { ...resRoute, label: 'Lượt đặt xe' }, tripRoute, privateVehiclesRoute,
    { ...parkRoute, label: 'Chỗ đỗ của tôi' }, { ...chgRoute, label: 'Sạc của tôi' },
  ] },
  { path: 'operations', role: 'OPR', label: 'Vận hành', features: [opsRoutes.operations, chgRoute, simRoute] },
  { path: 'maintenance', role: 'MNT', label: 'Kỹ thuật', features: [opsRoutes.maintenance] },
  { path: 'admin', role: 'ADM', label: 'Quản trị', features: [administrationRoute] },
];

function portalPath(portal: Portal, feature = portal.features[0].path) {
  return '/' + portal.path + '/' + feature;
}

function AppFrame({ children, session, portal, feature, onLogout }: {
  children: ReactNode;
  session?: SessionView;
  portal?: Portal;
  feature?: Feature;
  onLogout?: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [logoutError, setLogoutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  async function logout() {
    setLogoutError('');
    setSigningOut(true);
    try {
      await onLogout?.();
    } catch {
      setLogoutError('Chưa thể đăng xuất. Vui lòng thử lại.');
    } finally {
      setSigningOut(false);
    }
  }

  const tab = new URLSearchParams(search).get('tab');
  const dashboard = '/operations/dashboard';
  const adminPath = '/admin/administration';
  const opsView = operationViews.find(item => item.key === tab) ?? operationViews[0];
  const adminView = adminViews.find(item => item.key === tab) ?? adminViews[0];
  const opsItems = [
    { ...operationViews[0], to: dashboard, active: pathname === dashboard && opsView.key === 'overview' },
    { label: 'Quản lý sạc', to: '/operations/charging', icon: 'bolt', active: feature?.path === 'charging' },
    ...operationViews.slice(1, 3).map(item => ({ ...item, to: dashboard + '?tab=' + item.key, active: pathname === dashboard && opsView.key === item.key })),
    { label: 'Mô phỏng', to: '/operations/simulation', icon: 'simulation', active: feature?.path === 'simulation' },
    { ...operationViews[3], to: dashboard + '?tab=resources', active: pathname === dashboard && opsView.key === 'resources' },
  ];
  const staff = portal?.role === 'OPR' || portal?.role === 'ADM';
  const sidebar = portal?.role === 'ADM'
    ? adminViews.map(item => ({ ...item, to: adminPath + (item.key === 'accounts' ? '' : '?tab=' + item.key), active: adminView.key === item.key }))
    : opsItems;
  const topbarTitle = portal?.role === 'ADM' ? adminView.title
    : pathname === dashboard ? opsView.title : feature?.path === 'charging' ? 'Quản lý sạc' : 'Không gian mô phỏng';
  const logo = <Link className="site-brand" to={portal ? portalPath(portal) : '/hubs'} aria-label="Smart E-Mobility Hub">
    <img className="brand-logo" src="/semh.svg" alt="" />
  </Link>;
  const initials = session?.displayName.trim().split(/\s+/).slice(-2).map(part => part.charAt(0)).join('').toUpperCase();
  const account = session && portal ? <details className="account-menu">
    <summary aria-label={'Tài khoản ' + session.displayName}>
      <span className="account-avatar" aria-hidden="true">{initials}</span>
      <span className="account-identity"><strong>{session.displayName}</strong><small>{portal.label}</small></span>
      <img className="account-chevron" src="/design/chevron.svg" alt="" width={14} height={14} />
    </summary>
    <div className="account-popover">
      {session.roles.length > 1 && <label>Vai trò
        <select aria-label="Đổi vai trò" value={portal.role} onChange={event => {
          const next = portals.find(item => item.role === event.target.value);
          event.target.closest('details')?.removeAttribute('open');
          if (next) navigate(portalPath(next));
        }}>
          {portals.filter(item => session.roles.includes(item.role)).map(item => (
            <option key={item.role} value={item.role}>{item.label}</option>
          ))}
        </select>
      </label>}
      <button type="button" className="outline" disabled={signingOut} onClick={logout}>Đăng xuất</button>
    </div>
  </details> : <Link className="primary" to="/login">Đăng nhập</Link>;

  return (
    <div className={staff ? 'staff-shell' : 'site-shell'}>
      {staff && <aside className="staff-sidebar">
        {logo}
        <nav className="feature-nav staff-nav" aria-label="Chức năng">
          {sidebar.map(item => <Link key={item.to} to={item.to} aria-current={item.active ? 'page' : undefined}>
            <img src={'/design/' + item.icon + '.svg'} alt="" width={20} height={20} />{item.label}
          </Link>)}
        </nav>
      </aside>}
      <div className="site-body">
        <header className={staff ? 'site-header staff-header' : 'site-header student-header'}>
          {staff ? <strong className="workspace-title">{topbarTitle}</strong> : logo}
          {!staff && portal && <nav className="feature-nav" aria-label={'Chức năng ' + portal.label.toLowerCase()}>
            {portal.features.map(item => (
              <NavLink key={item.path} to={portalPath(portal, item.path)}>
                {portal.role === 'MNT' ? 'Công việc của tôi' : item.label}
              </NavLink>
            ))}
          </nav>}
          {account}
        </header>
        <main className="page">
          {logoutError && <p className="error" role="alert">{logoutError}</p>}
          {children}
        </main>
      </div>
    </div>
  );
}

function PortalPage({ session, onLogout }: { session: SessionView | null; onLogout: () => Promise<void> }) {
  const { portal: portalName, feature: featureName } = useParams();
  if (!session) return <Navigate replace to="/login" />;

  const portal = portals.find(item => item.path === portalName && session.roles.includes(item.role));
  if (!portal) return <Navigate replace to="/" />;

  const feature = portal.features.find(item => item.path === featureName);
  if (!feature) return <Navigate replace to={portalPath(portal)} />;

  return <AppFrame session={session} portal={portal} feature={feature} onLogout={onLogout}>{feature.element}</AppFrame>;
}

export function AppRouter() {
  const [session, setSession] = useState<SessionView | null>(null);
  const [checking, setChecking] = useState(true);
  const [checkError, setCheckError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    authApi.me(controller.signal).then(setSession).catch(error => {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 401) setSession(null);
      else setCheckError(true);
    }).finally(() => {
      if (!controller.signal.aborted) setChecking(false);
    });
    return () => controller.abort();
  }, [attempt]);

  if (checking) return <main className="loading" role="status">Đang tải SEMH…</main>;
  if (checkError) {
    return (
      <main className="loading">
        <p role="alert">Chưa kết nối được đến SEMH.</p>
        <button className="primary" onClick={() => {
          setCheckError(false);
          setChecking(true);
          setAttempt(value => value + 1);
        }}>Thử lại</button>
      </main>
    );
  }

  const portal = portals.find(item => session?.roles.includes(item.role));
  const home = portal ? portalPath(portal) : '/login';

  async function logout() {
    if (!session) return;
    await authApi.logout(session.csrfToken);
    setSession(null);
  }

  return (
    <SessionContext.Provider value={session}>
      <BrowserRouter>
        <Routes>
        <Route path="/" element={<Navigate replace to={home} />} />
        <Route path="/login" element={portal ? <Navigate replace to={home} /> : <LoginPage onLogin={setSession} />} />
        <Route path="/register" element={portal ? <Navigate replace to={home} /> : <RegisterPage />} />
        <Route path="/hubs" element={portal ? <Navigate replace to={home} /> : <AppFrame>{hubScreen}</AppFrame>} />
        <Route path="/:portal/:feature" element={<PortalPage session={session} onLogout={logout} />} />
        <Route path="*" element={<Navigate replace to={home} />} />
        </Routes>
      </BrowserRouter>
    </SessionContext.Provider>
  );
}
