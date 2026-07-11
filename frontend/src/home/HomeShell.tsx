import { useMemo } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { appAPI } from '../services/api';
import { FRONTEND_BUILD_TIME_ISO } from '../generated/buildInfo';

type TopMenuItem = {
  label: string;
  path: string;
};

const TOP_MENU_ITEMS: TopMenuItem[] = [
  { label: 'Home', path: '/home' },
  { label: 'Manage Inventory', path: '/home/inventory' },
  { label: 'Manage Orders', path: '/home/orders' },
  { label: 'Manage Setup', path: '/home/setup' },
];

function formatBuildDateTime(value?: string) {
  if (!value || value === 'unknown') {
    return 'Unknown';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export default function HomeShell() {
  const location = useLocation();

  const { data: buildInfoResponse } = useQuery({
    queryKey: ['buildInfo'],
    queryFn: async () => {
      const response = await appAPI.getBuildInfo();
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const backendBuildLabel = useMemo(
    () => formatBuildDateTime(buildInfoResponse?.backendBuildTimeIso),
    [buildInfoResponse?.backendBuildTimeIso]
  );

  const frontendBuildLabel = useMemo(
    () => formatBuildDateTime(FRONTEND_BUILD_TIME_ISO),
    []
  );

  const isTopMenuItemActive = (path: string) => {
    if (path === '/home') {
      return location.pathname === '/home';
    }

    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="sticky top-0 z-50 border-b border-slate-300 bg-white shadow-sm">
        <div className="mx-auto w-full max-w-[1800px] px-4 py-4 sm:px-6 lg:h-24 lg:px-8 lg:py-0">
          <div className="flex flex-col gap-4 lg:h-full lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 lg:h-full">
              <img
                src="/favicon.png"
                alt="Arcane Library"
                className="h-20 w-20 rounded-md bg-white object-contain lg:h-full lg:w-auto"
              />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Arcane Library</h1>
                <p className="text-sm text-slate-600">RPG Collection Navigator</p>
              </div>
            </div>

            <nav className="flex flex-wrap items-center justify-end gap-2 md:gap-3">
              {TOP_MENU_ITEMS.map((item, index) => {
                const active = isTopMenuItemActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    tabIndex={1000 + index}
                    className={`rounded-lg border px-4 py-3 text-center text-sm font-semibold transition sm:text-base ${
                      active
                        ? 'border-sky-600 bg-sky-600 text-white shadow'
                        : 'border-slate-300 bg-slate-50 text-slate-800 hover:border-sky-400 hover:bg-sky-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-6 pb-20 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-slate-300 bg-white shadow-sm">
          <Outlet />
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-300 bg-white shadow-[0_-2px_8px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid w-full max-w-[1800px] gap-2 px-4 py-3 text-sm text-slate-700 sm:grid-cols-2 sm:px-6 lg:px-8">
          <div>
            <span className="font-semibold text-slate-800">Backend Build: </span>
            <span>{backendBuildLabel}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-800">Frontend Build: </span>
            <span>{frontendBuildLabel}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
