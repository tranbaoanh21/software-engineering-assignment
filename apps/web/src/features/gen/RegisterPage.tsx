import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { authApi } from './auth-api';
import { AuthLayout } from './AuthLayout';

export function RegisterPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    if (password !== form.get('confirmation')) {
      setError('Mật khẩu nhập lại chưa khớp.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const { username } = await authApi.register({
        username: String(form.get('username')),
        displayName: String(form.get('displayName')),
        password,
      });
      navigate('/login', { replace: true, state: { registeredUsername: username } });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Chưa thể tạo tài khoản. Vui lòng thử lại.');
    } finally {
      setPending(false);
    }
  }

  return <AuthLayout title="Đăng ký sinh viên">
    <form onSubmit={submit}>
      <label htmlFor="display-name">Họ và tên</label>
      <input name="displayName" id="display-name" autoComplete="name" required maxLength={100} />
      <label htmlFor="student-id">Mã số sinh viên</label>
      <input name="username" id="student-id" inputMode="numeric" autoComplete="username"
        pattern="[0-9]{3,50}" title="Nhập mã sinh viên bằng chữ số" required maxLength={50} />
      <label htmlFor="new-password">Mật khẩu</label>
      <input name="password" id="new-password" type="password" autoComplete="new-password" required
        minLength={12} maxLength={256} aria-describedby="password-length" />
      <small id="password-length" className="auth-hint">Ít nhất 12 ký tự</small>
      <label htmlFor="confirm-password">Nhập lại mật khẩu</label>
      <input name="confirmation" id="confirm-password" type="password" autoComplete="new-password" required
        minLength={12} maxLength={256} />
      {error && <p className="error" role="alert">{error}</p>}
      <button className="primary" type="submit" disabled={pending}>{pending ? 'Đang tạo tài khoản…' : 'Đăng ký'}</button>
    </form>
    <Link className="secondary-link" to="/login">Quay lại đăng nhập</Link>
  </AuthLayout>;
}
