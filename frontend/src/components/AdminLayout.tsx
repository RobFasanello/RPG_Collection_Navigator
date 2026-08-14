import { ReactNode } from 'react';

interface AdminLayoutProps {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: string | null;
}

export default function AdminLayout({ children, title, subtitle = 'Manage your database records' }: AdminLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-[1920px] p-6 md:p-8 2xl:p-10">
      {title && (
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--arcane-ink-900)]">{title}</h1>
          {subtitle ? <p className="text-sm text-[var(--arcane-ink-soft)] mt-2">{subtitle}</p> : null}
        </div>
      )}
      {children}
    </div>
  );
}
