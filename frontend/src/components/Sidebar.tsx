import { useState } from 'react';
import { Menu, X, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarItem {
  id: string;
  label: string;
  path: string;
  icon?: React.ReactNode;
}

const MAINTENANCE_ITEMS: SidebarItem[] = [
  { id: 'collection', label: 'Collections', path: '/admin/collections' },
  { id: 'category', label: 'Categories', path: '/admin/categories' },
  { id: 'categorysubtype', label: 'Category Subtypes', path: '/admin/category-subtypes' },
  { id: 'publisher', label: 'Publishers', path: '/admin/publishers' },
  { id: 'publishercollection', label: 'Publisher Collections', path: '/admin/publisher-collections' },
  { id: 'inventory', label: 'Inventory Lookup', path: '/admin/inventory' },
  { id: 'status', label: 'Status', path: '/admin/status' },
  { id: 'store', label: 'Stores', path: '/admin/stores' },
  { id: 'subtype', label: 'Subtypes', path: '/admin/subtypes' },
];

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

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
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <Settings className="w-8 h-8 text-blue-400" />
            <h2 className="text-xl font-bold">Admin</h2>
          </div>

          <nav className="space-y-2">
            <div className="mb-6">
              <h3 className="text-xs uppercase text-gray-400 font-semibold mb-3 px-3">
                Maintenance
              </h3>
              <div className="space-y-1">
                {MAINTENANCE_ITEMS.map((item) => (
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

            <div className="border-t border-gray-700 pt-4">
              <Link
                to="/"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-800 transition"
              >
                ← Back to Catalog
              </Link>
            </div>
          </nav>
        </div>
      </aside>

      {/* Content offset on desktop */}
      <div className="lg:ml-64" />
    </>
  );
}
