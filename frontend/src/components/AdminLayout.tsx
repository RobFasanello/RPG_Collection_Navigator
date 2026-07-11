import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function AdminLayout({ children, title, subtitle = 'Manage your database records' }: AdminLayoutProps) {
  const location = useLocation();
  const isHomeShellMode = location.pathname.startsWith('/home');

  if (isHomeShellMode) {
    return (
      <div className="p-6 md:p-8">
        {title && (
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-600 mt-2">{subtitle}</p>
          </div>
        )}
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8">
        {title && (
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900">{title}</h1>
            <p className="text-gray-600 mt-2">{subtitle}</p>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
