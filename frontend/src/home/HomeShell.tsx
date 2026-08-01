import { useMemo, useState, type FormEvent } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { appAPI } from '../services/api';
import { FRONTEND_BUILD_TIME_ISO } from '../generated/buildInfo';
import GlobalSearchModal from '../components/GlobalSearchModal';

type TopMenuItem = {
  label: string;
  path: string;
};

const TOP_MENU_ITEMS: TopMenuItem[] = [
  { label: 'Manage Inventory', path: '/home/inventory' },
  { label: 'Manage Miniatures', path: '/home/miniatures' },
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');

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

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setActiveSearchQuery(trimmed);
    setSearchModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      <header className="sticky top-0 z-50 border-b border-slate-300 bg-white shadow-sm">
        <div className="mx-auto w-full max-w-[1800px] px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to="/home" className="flex items-center gap-3 shrink-0 hover:opacity-80 transition-opacity">
              <img
                src="/favicon.png"
                alt="Arcane Library"
                className="h-12 w-12 rounded-md bg-white object-contain"
              />
              <div>
                <h1 className="text-xl font-bold text-slate-900">Arcane Repository</h1>
                <p className="text-xs text-slate-500">A grimoire of your own making</p>
              </div>
            </Link>

            <nav className="flex flex-wrap items-center gap-2">
              {TOP_MENU_ITEMS.map((item, index) => {
                const active = isTopMenuItemActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    tabIndex={1000 + index}
                    className={`rounded-lg border px-4 py-2 text-center text-sm font-semibold transition sm:text-base ${
                      active
                        ? 'border-sky-600 bg-sky-600 text-white shadow'
                        : 'border-slate-300 bg-slate-50 text-slate-800 hover:border-sky-400 hover:bg-sky-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}

              <form
                onSubmit={handleSearchSubmit}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-200 transition"
              >
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search…"
                  aria-label="Global search"
                  className="w-32 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 sm:w-40"
                />
              </form>
            </nav>
          </div>
        </div>
      </header>

      <GlobalSearchModal
        open={searchModalOpen}
        query={activeSearchQuery}
        onClose={() => setSearchModalOpen(false)}
      />

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
