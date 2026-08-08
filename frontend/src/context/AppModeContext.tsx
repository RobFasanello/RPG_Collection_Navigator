import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authAPI } from '../services/api';
import { type AppMode, APP_MODE_UNAUTHENTICATED_EVENT } from '../state/appMode';

interface AuthenticatedUser {
  email: string;
  name: string;
  mode: AppMode;
}

interface AppModeContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  email: string | null;
  name: string | null;
  mode: AppMode;
  canWrite: boolean;
  isAdmin: boolean;
  logout: () => Promise<void>;
}

const AppModeContext = createContext<AppModeContextValue | null>(null);

const ME_QUERY_KEY = ['auth', 'me'];

export function AppModeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      try {
        const response = await authAPI.getMe();
        return response.data as AuthenticatedUser;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const handleUnauthenticated = () => queryClient.setQueryData(ME_QUERY_KEY, null);
    window.addEventListener(APP_MODE_UNAUTHENTICATED_EVENT, handleUnauthenticated);
    return () => window.removeEventListener(APP_MODE_UNAUTHENTICATED_EVENT, handleUnauthenticated);
  }, [queryClient]);

  const logout = async () => {
    await authAPI.logout();
    queryClient.setQueryData(ME_QUERY_KEY, null);
  };

  const mode = user?.mode ?? 'read-only';

  const value: AppModeContextValue = {
    isLoading,
    isAuthenticated: Boolean(user),
    email: user?.email ?? null,
    name: user?.name ?? null,
    mode,
    canWrite: mode === 'update' || mode === 'administrator',
    isAdmin: mode === 'administrator',
    logout,
  };

  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
}

export function useAppMode(): AppModeContextValue {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return context;
}
