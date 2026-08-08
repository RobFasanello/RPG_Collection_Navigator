import { useMemo, useState, type FormEvent } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { appAPI } from '../services/api';
import { FRONTEND_BUILD_TIME_ISO } from '../generated/buildInfo';
import GlobalSearchModal from '../components/GlobalSearchModal';
import { SETUP_NAV_ITEMS } from './setupNavItems';
import { useAppMode } from '../context/AppModeContext';
import type { AppMode } from '../state/appMode';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '../components/ui/NavigationMenu';

type TopMenuItem = {
  label: string;
  path: string;
  description: string;
};

const MODE_LABELS: Record<AppMode, string> = {
  'read-only': 'Read-only',
  update: 'Update',
  administrator: 'Administrator',
};

const MANAGE_NAV_ITEMS: TopMenuItem[] = [
  {
    label: 'Items',
    path: '/home/inventory',
    description: 'Select to view, add, delete or update Items within your collection.',
  },
  {
    label: 'Miniatures',
    path: '/home/miniatures',
    description: 'Select to view, add, delete or update Miniatures within your collection.',
  },
  {
    label: 'Orders',
    path: '/home/orders',
    description: 'Select to view, add, delete or update Orders within your collection.',
  },
  {
    label: 'Terrain',
    path: '/home/terrain',
    description: 'Select to view, add, delete or update Terrain within your collection.',
  },
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
  const { mode, name, isAdmin, logout } = useAppMode();
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
            <div className="flex items-center gap-3 shrink-0">
              <img
                src="/favicon.png"
                alt="Arcane Library"
                className="h-12 w-12 rounded-md bg-white object-contain"
              />
              <div>
                <h1 className="text-xl font-bold text-slate-900">Arcane Repository</h1>
                <p className="text-xs text-slate-500">A grimoire of your own making</p>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-2">
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuLink asChild active={location.pathname === '/home'}>
                      <Link to="/home" className={navigationMenuTriggerStyle(location.pathname === '/home')} tabIndex={1000}>
                        Home
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>

                  <NavigationMenuItem>
                    <NavigationMenuTrigger
                      active={MANAGE_NAV_ITEMS.some((item) => isTopMenuItemActive(item.path))}
                      tabIndex={1001}
                    >
                      Manage
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid w-[360px] grid-cols-1 gap-1 p-3 sm:w-[420px]">
                        {MANAGE_NAV_ITEMS.map((item) => {
                          const active = location.pathname === item.path;

                          return (
                            <li key={item.path}>
                              <NavigationMenuLink asChild active={active}>
                                <Link
                                  to={item.path}
                                  className={`block rounded-md px-3 py-2 transition ${
                                    active
                                      ? 'bg-sky-600 text-white'
                                      : 'text-slate-700 hover:bg-sky-50 hover:text-sky-700'
                                  }`}
                                >
                                  <div className="space-y-0.5">
                                    <div className="text-sm font-semibold leading-5">{item.label}</div>
                                    <div className={`text-xs leading-4 ${active ? 'text-sky-50' : 'text-slate-500'}`}>
                                      {item.description}
                                    </div>
                                  </div>
                                </Link>
                              </NavigationMenuLink>
                            </li>
                          );
                        })}
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  {isAdmin && (
                    <NavigationMenuItem>
                      <NavigationMenuTrigger active={isTopMenuItemActive('/home/setup')} tabIndex={1002}>
                        Setup
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-[420px] grid-cols-1 gap-1 p-3 sm:w-[520px]">
                          {SETUP_NAV_ITEMS.map((item) => {
                            const active = location.pathname === item.path;

                            return (
                              <li key={item.path}>
                                <NavigationMenuLink asChild active={active}>
                                  <Link
                                    to={item.path}
                                    className={`block rounded-md px-3 py-2 transition ${
                                      active
                                        ? 'bg-sky-600 text-white'
                                        : 'text-slate-700 hover:bg-sky-50 hover:text-sky-700'
                                    }`}
                                  >
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-semibold leading-5">{item.label}</div>
                                      <div className={`text-xs leading-4 ${active ? 'text-sky-50' : 'text-slate-500'}`}>
                                        {item.description}
                                      </div>
                                    </div>
                                  </Link>
                                </NavigationMenuLink>
                              </li>
                            );
                          })}
                        </ul>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  )}
                </NavigationMenuList>
              </NavigationMenu>

              <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span>
                  Signed in as <span className="font-medium text-slate-900">{name}</span>
                  <span className="text-slate-500"> · {MODE_LABELS[mode]}</span>
                </span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="text-sky-700 underline underline-offset-2 hover:text-sky-900"
                >
                  Log out
                </button>
              </div>

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
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear global search"
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
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
