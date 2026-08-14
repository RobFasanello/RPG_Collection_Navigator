import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAppMode } from '../context/AppModeContext';
import { Skeleton } from './ui/Skeleton';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAppMode();

  if (isLoading) {
    return (
      <div className="space-y-4 p-6" aria-label="Checking sign-in status">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
