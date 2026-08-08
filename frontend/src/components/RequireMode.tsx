import { type ReactNode, useEffect } from 'react';
import { Navigate } from 'react-router';
import { useAppMode } from '../context/AppModeContext';
import { MODE_RANK, type AppMode } from '../state/appMode';
import { useToast } from './ui/ToastProvider';

interface RequireModeProps {
  mode: AppMode;
  children: ReactNode;
}

export default function RequireMode({ mode, children }: RequireModeProps) {
  const { mode: currentMode } = useAppMode();
  const { toast } = useToast();
  const allowed = MODE_RANK[currentMode] >= MODE_RANK[mode];

  useEffect(() => {
    if (!allowed) {
      toast({
        title: 'Administrator mode required',
        description: 'Switch to Administrator mode to access Setup.',
        variant: 'warning',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  if (!allowed) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
}
