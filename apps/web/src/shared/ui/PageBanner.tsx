import type { ReactNode } from 'react';

export function PageBanner({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return <header className="page-banner">
    <div><h1>{title}</h1>{children}</div>
    {actions && <div className="work-actions">{actions}</div>}
  </header>;
}
