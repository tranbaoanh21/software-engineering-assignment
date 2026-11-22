import type { ReactNode } from 'react';

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return <main className="login-page">
    <section className="login-visual" aria-label="Mạng lưới Mobility Hub">
      <div className="login-brand-panel"><img className="brand-logo" src="/semh.svg" alt="Smart E-Mobility Hub" /></div>
      <div>
        <h2>Mạng lưới Mobility Hub</h2>
        <p>Tra cứu xe, chỗ đỗ và cổng sạc trong khuôn viên ĐHQG TP.HCM.</p>
      </div>
      <img className="login-campus" src="/design/campus-illustration.png" alt="Sơ đồ minh họa các Hub trong khuôn viên" width={574} height={345} />
    </section>
    <section className="login-card" aria-labelledby="auth-title">
      <img className="brand-logo" src="/semh.svg" alt="Smart E-Mobility Hub" />
      <h1 id="auth-title">{title}</h1>
      {children}
    </section>
  </main>;
}
