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
    <div className="theme-light min-h-[100dvh] bg-[var(--arcane-paper)] text-[var(--arcane-ink-900)] flex flex-col">
      <header className="sticky top-0 z-50 border-b border-[#d6b07c66] bg-[#17151af2] shadow-[0_10px_30px_rgba(18,15,19,0.2)] backdrop-blur-md">
        <div className="mx-auto w-full max-w-[1920px] px-4 py-3 sm:px-6 lg:px-8 2xl:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 shrink-0">
              <img
                src="/favicon.png"
                alt="Arcane Library"
                className="h-12 w-12 rounded-md bg-[var(--arcane-ivory)] object-contain ring-1 ring-[#b8864899]"
              />
              <div>
                <h1 className="text-xl font-bold text-[var(--arcane-ivory)]">Arcane Repository</h1>
                <p className="text-xs text-[var(--arcane-gold-300)]">A grimoire of your own making</p>
              </div>
            </div>

            <nav className="flex flex-wrap items-center gap-2">
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuLink asChild active={location.pathname === '/home'}>
                      <Link to="/home" className={navigationMenuTriggerStyle(location.pathname === '/home')}>
                        Dashboard
                      </Link>
                    </NavigationMenuLink>
                  </NavigationMenuItem>

                  <NavigationMenuItem>
                    <NavigationMenuTrigger active={MANAGE_NAV_ITEMS.some((item) => isTopMenuItemActive(item.path))}>
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
                                      ? 'bg-[var(--arcane-gold-500)] text-[var(--arcane-ink-950)]'
                                      : 'text-[var(--arcane-ivory)] hover:bg-[var(--arcane-ink-700)] hover:text-[var(--arcane-gold-300)]'
                                  }`}
                                >
                                  <div className="space-y-0.5">
                                    <div className="text-sm font-semibold leading-5">{item.label}</div>
                                    <div className={`text-xs leading-4 ${active ? 'text-[#120f13cc]' : 'text-[var(--arcane-sand)]'}`}>
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
                      <NavigationMenuTrigger active={isTopMenuItemActive('/home/setup')}>
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
                                        ? 'bg-[var(--arcane-gold-500)] text-[var(--arcane-ink-950)]'
                                        : 'text-[var(--arcane-ivory)] hover:bg-[var(--arcane-ink-700)] hover:text-[var(--arcane-gold-300)]'
                                    }`}
                                  >
                                    <div className="space-y-0.5">
                                      <div className="text-sm font-semibold leading-5">{item.label}</div>
                                      <div className={`text-xs leading-4 ${active ? 'text-[#120f13cc]' : 'text-[var(--arcane-sand)]'}`}>
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

              <div className="flex items-center gap-2 rounded-lg border border-[var(--arcane-line)] bg-[var(--arcane-ink-800)] px-3 py-2 text-sm text-[var(--arcane-ivory)] shadow-inner shadow-[#120f1333]">
                <span>
                  Signed in as <span className="font-medium text-[var(--arcane-ivory-bright)]">{name}</span>
                  <span className="text-[var(--arcane-sand)]"> · {MODE_LABELS[mode]}</span>
                </span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="text-[var(--arcane-ivory)] underline underline-offset-2 hover:text-[var(--arcane-gold-300)]"
                >
                  Log out
                </button>
              </div>

              <form
                onSubmit={handleSearchSubmit}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--arcane-line)] bg-[var(--arcane-ink-800)] px-3 py-2 transition focus-within:border-[var(--arcane-gold-500)] focus-within:ring-2 focus-within:ring-[#b8864840]"
              >
                <Search className="h-4 w-4 shrink-0 text-[var(--arcane-gold-300)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search…"
                  aria-label="Global search"
                  className="w-32 bg-transparent text-sm text-[var(--arcane-ivory)] outline-none placeholder:text-[#b9ae9d]/70 sm:w-40"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear global search"
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--arcane-gold-300)] transition hover:bg-[var(--arcane-ink-700)] hover:text-[var(--arcane-ivory)]"
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

      <main className="mx-auto w-full max-w-[1920px] flex-1 px-4 py-6 pb-20 sm:px-6 lg:px-8 2xl:px-10">
        <div className="rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] shadow-sm">
          <Outlet />
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] shadow-[0_-2px_8px_rgba(15,23,42,0.08)]">
        <div className="mx-auto grid w-full max-w-[1920px] gap-2 px-4 py-3 text-sm text-[var(--arcane-ink-soft)] sm:grid-cols-2 sm:px-6 lg:px-8 2xl:px-10">
          <div>
            <span className="font-semibold text-[var(--arcane-ink-900)]">Backend Build: </span>
            <span>{backendBuildLabel}</span>
          </div>
          <div>
            <span className="font-semibold text-[var(--arcane-ink-900)]">Frontend Build: </span>
            <span>{frontendBuildLabel}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
