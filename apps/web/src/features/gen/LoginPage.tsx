import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import type { SessionView } from '@semh/contracts';
import { authApi } from './auth-api';
import { AuthLayout } from './AuthLayout';

export function LoginPage({ onLogin }: { onLogin: (session: SessionView) => void }) {
  const { state } = useLocation();
  const registeredUsername = typeof state?.registeredUsername === 'string' ? state.registeredUsername : '';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError('');
    try {
      onLogin(await authApi.login(String(data.get('username')), String(data.get('password'))));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Đăng nhập thất bại');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout title="Đăng nhập">
      {registeredUsername && <p className="handoff-notice" role="status">Đã tạo tài khoản. Bạn có thể đăng nhập ngay.</p>}
      <form onSubmit={submit}>
        <label htmlFor="username">Tên đăng nhập</label>
        <input name="username" id="username" placeholder="MSSV hoặc tên đăng nhập" defaultValue={registeredUsername} autoComplete="username" required maxLength={100} />
        <label htmlFor="password">Mật khẩu</label>
        <input name="password" id="password" type="password" placeholder="Nhập mật khẩu" autoComplete="current-password" required maxLength={256} />
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={pending}>{pending ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      </form>
      <div className="auth-links">
        <Link className="secondary-link" to="/register">Đăng ký sinh viên</Link>
        <Link className="secondary-link" to="/hubs">Tra cứu Hub không cần đăng nhập</Link>
      </div>
    </AuthLayout>
  );
}
