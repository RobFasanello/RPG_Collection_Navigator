import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';

type SetupNavItem = {
  label: string;
  path: string;
};

const SETUP_NAV_ITEMS: SetupNavItem[] = [
  { label: 'Publishers', path: '/home/setup/publishers' },
  { label: 'RPG Systems', path: '/home/setup/rpg-systems' },
  { label: 'Collections', path: '/home/setup/collections' },
  { label: 'Publisher / Collections', path: '/home/setup/publisher-collections' },
  { label: 'Collection / RPG Systems', path: '/home/setup/collection-rpg-systems' },
  { label: 'Collection Types', path: '/home/setup/collection-types' },
  { label: 'Categories', path: '/home/setup/categories' },
  { label: 'Sub Categories', path: '/home/setup/sub-categories' },
  { label: 'Category / Sub Categories', path: '/home/setup/category-sub-categories' },
  { label: 'Stores', path: '/home/setup/stores' },
  { label: 'Status', path: '/home/setup/status' },
];

export default function ManageSetupPage() {
  const location = useLocation();

  if (location.pathname === '/home/setup') {
    return <Navigate to="/home/setup/publishers" replace />;
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-bold text-slate-900">Manage Setup</h2>
        <p className="mt-1 text-sm text-slate-600">Use these setup screens to manage the configuration data used by the application.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {SETUP_NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`rounded-md border px-3 py-2 text-sm font-medium transition ${
              isActive(item.path)
                ? 'border-sky-600 bg-sky-600 text-white'
                : 'border-slate-300 bg-slate-50 text-slate-800 hover:border-sky-400 hover:bg-sky-50'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50">
        <Outlet />
      </div>
    </div>
  );
}
