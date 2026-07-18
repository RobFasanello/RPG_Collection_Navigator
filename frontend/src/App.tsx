import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomeShell from './home/HomeShell';
import './index.css';

const queryClient = new QueryClient();

const HomePage = lazy(() => import('./pages/HomePage'));
const CollectionsPage = lazy(() => import('./pages/CollectionsPage'));
const CollectionTypesPage = lazy(() => import('./pages/CollectionTypesPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const SubTypesPage = lazy(() => import('./pages/SubTypesPage'));
const PublishersPage = lazy(() => import('./pages/PublishersPage'));
const StatusPage = lazy(() => import('./pages/StatusPage'));
const StoresPage = lazy(() => import('./pages/StoresPage'));
const CategorySubTypesPage = lazy(() => import('./pages/CategorySubTypesPage'));
const PublisherCollectionsPage = lazy(() => import('./pages/PublisherCollectionsPage'));
const InventoryLookupPage = lazy(() => import('./pages/InventoryLookupPage'));
const OrderMasterPage = lazy(() => import('./pages/OrderMasterPage'));
const ManageSetupPage = lazy(() => import('./home/ManageSetupPage'));

function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Suspense fallback={<div className="p-6 text-sm text-gray-600">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />

            <Route path="/home" element={<HomeShell />}>
              <Route index element={<HomePage />} />
              <Route path="inventory" element={<InventoryLookupPage />} />
              <Route path="orders" element={<OrderMasterPage />} />
              <Route path="setup" element={<ManageSetupPage />}>
                <Route path="publishers" element={<PublishersPage />} />
                <Route path="collections" element={<CollectionsPage />} />
                <Route path="publisher-collections" element={<PublisherCollectionsPage />} />
                <Route path="collection-types" element={<CollectionTypesPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="sub-categories" element={<SubTypesPage />} />
                <Route path="category-sub-categories" element={<CategorySubTypesPage />} />
                <Route path="stores" element={<StoresPage />} />
                <Route path="status" element={<StatusPage />} />
              </Route>
            </Route>

            <Route path="/admin/collections" element={<Navigate to="/home/setup/collections" replace />} />
            <Route path="/admin/collection-types" element={<Navigate to="/home/setup/collection-types" replace />} />
            <Route path="/admin/categories" element={<Navigate to="/home/setup/categories" replace />} />
            <Route path="/admin/subtypes" element={<Navigate to="/home/setup/sub-categories" replace />} />
            <Route path="/admin/publishers" element={<Navigate to="/home/setup/publishers" replace />} />
            <Route path="/admin/status" element={<Navigate to="/home/setup/status" replace />} />
            <Route path="/admin/stores" element={<Navigate to="/home/setup/stores" replace />} />
            <Route path="/admin/category-subtypes" element={<Navigate to="/home/setup/category-sub-categories" replace />} />
            <Route path="/admin/publisher-collections" element={<Navigate to="/home/setup/publisher-collections" replace />} />
            <Route path="/admin/inventory" element={<RedirectWithSearch to="/home/inventory" />} />
            <Route path="/admin/order-master" element={<RedirectWithSearch to="/home/orders" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
