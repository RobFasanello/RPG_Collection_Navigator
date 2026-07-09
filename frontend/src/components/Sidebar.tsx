import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Menu, X, BookOpen } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { appAPI } from '../services/api';
import { FRONTEND_BUILD_TIME_ISO } from '../generated/buildInfo';

interface SidebarItem {
  id: string;
  label: string;
  path: string;
}

const SETUP_ITEMS: SidebarItem[] = [
  { id: 'publisher', label: 'Publishers', path: '/admin/publishers' },
  { id: 'collection', label: 'Collections', path: '/admin/collections' },
  { id: 'publishercollection', label: 'Publisher/Collections', path: '/admin/publisher-collections' },
  { id: 'collectiontype', label: 'Collection Types', path: '/admin/collection-types' },
  { id: 'category', label: 'Categories', path: '/admin/categories' },
  { id: 'subtype', label: 'Sub Categories', path: '/admin/subtypes' },
  { id: 'categorysubtype', label: 'Category/Sub Categories', path: '/admin/category-subtypes' },
  { id: 'status', label: 'Status', path: '/admin/status' },
];

const INVENTORY_ITEMS: SidebarItem[] = [
  { id: 'inventory', label: 'Item Master', path: '/admin/inventory' },
  { id: 'ordermaster', label: 'Order Master', path: '/admin/order-master' },
  { id: 'store', label: 'Stores', path: '/admin/stores' },
];

type NavTab = 'setup' | 'inventory';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
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

  const initialTab: NavTab =
    INVENTORY_ITEMS.some((item) => item.path === location.pathname) ? 'inventory' : 'setup';
  const [activeTab, setActiveTab] = useState<NavTab>(initialTab);

  useEffect(() => {
    if (INVENTORY_ITEMS.some((item) => item.path === location.pathname)) {
      setActiveTab('inventory');
      return;
    }

    if (SETUP_ITEMS.some((item) => item.path === location.pathname)) {
      setActiveTab('setup');
    }
  }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path;
  const visibleItems = activeTab === 'setup' ? SETUP_ITEMS : INVENTORY_ITEMS;

  const formatBuildDateTime = (value?: string) => {
    if (!value || value === 'unknown') {
      return 'Unknown';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleString();
  };

  const backendBuildLabel = formatBuildDateTime(buildInfoResponse?.backendBuildTimeIso);
  const frontendBuildLabel = formatBuildDateTime(FRONTEND_BUILD_TIME_ISO);

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-40 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-64 bg-gray-900 text-white transition-transform duration-300 transform lg:translate-x-0 z-30 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <BookOpen className="w-8 h-8 text-blue-400" />
              <h2 className="text-xl font-bold">Arcane Repository</h2>
            </div>
            <p className="text-sm text-gray-400">Collection Manager</p>
          </div>

          <nav className="space-y-2 flex-1">
            <div className="mb-6">
              <Link
                to="/"
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-2 rounded-lg transition mb-3 ${
                  isActive('/')
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                Home
              </Link>

              <div className="grid grid-cols-2 gap-2 bg-gray-800 rounded-lg p-1 mb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('setup')}
                  className={`px-3 py-2 text-sm rounded-md transition ${
                    activeTab === 'setup'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Setup
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('inventory')}
                  className={`px-3 py-2 text-sm rounded-md transition ${
                    activeTab === 'inventory'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Inventory
                </button>
              </div>

              <div className="space-y-1">
                {visibleItems.map((item) => (
                  <Link
                    key={item.id}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={`block px-4 py-2 rounded-lg transition ${
                      isActive(item.path)
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </nav>

          <div className="mt-auto border-t border-gray-700 pt-4 text-xs text-gray-400 space-y-3">
            <div>
              <div className="font-semibold text-gray-300">Backend Build:</div>
              <div>{backendBuildLabel}</div>
            </div>
            <div>
              <div className="font-semibold text-gray-300">Frontend Build:</div>
              <div>{frontendBuildLabel}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Content offset on desktop */}
      <div className="lg:ml-64" />
    </>
  );
}
