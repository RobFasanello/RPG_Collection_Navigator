import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router';
import HomeShell from './home/HomeShell';
import './index.css';

const queryClient = new QueryClient();

const HomePage = lazy(() => import('./pages/HomePage'));
const CollectionsPage = lazy(() => import('./pages/CollectionsPage'));
const CollectionTypesPage = lazy(() => import('./pages/CollectionTypesPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const SubTypesPage = lazy(() => import('./pages/SubTypesPage'));
const PublishersPage = lazy(() => import('./pages/PublishersPage'));
const RPGSystemsPage = lazy(() => import('./pages/RPGSystemsPage'));
const StatusPage = lazy(() => import('./pages/StatusPage'));
const StoresPage = lazy(() => import('./pages/StoresPage'));
const MiniatureSizesPage = lazy(() => import('./pages/MiniatureSizesPage'));
const MiniatureRaritiesPage = lazy(() => import('./pages/MiniatureRaritiesPage'));
const LocationsPage = lazy(() => import('./pages/LocationsPage'));
const LocationTypesPage = lazy(() => import('./pages/LocationTypesPage'));
const CategorySubTypesPage = lazy(() => import('./pages/CategorySubTypesPage'));
const PublisherCollectionsPage = lazy(() => import('./pages/PublisherCollectionsPage'));
const CollectionRPGSystemsPage = lazy(() => import('./pages/CollectionRPGSystemsPage'));
const InventoryLookupPage = lazy(() => import('./pages/InventoryLookupPage'));
const MiniatureMasterPage = lazy(() => import('./pages/MiniatureMasterPage'));
const OrderMasterPage = lazy(() => import('./pages/OrderMasterPage'));

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
              <Route path="miniatures" element={<MiniatureMasterPage />} />
              <Route path="orders" element={<OrderMasterPage />} />
              <Route path="setup" element={<Navigate to="/home/setup/publishers" replace />} />
              <Route path="setup/publishers" element={<PublishersPage />} />
              <Route path="setup/rpg-systems" element={<RPGSystemsPage />} />
              <Route path="setup/collections" element={<CollectionsPage />} />
              <Route path="setup/publisher-collections" element={<PublisherCollectionsPage />} />
              <Route path="setup/collection-rpg-systems" element={<CollectionRPGSystemsPage />} />
              <Route path="setup/collection-types" element={<CollectionTypesPage />} />
              <Route path="setup/categories" element={<CategoriesPage />} />
              <Route path="setup/sub-categories" element={<SubTypesPage />} />
              <Route path="setup/category-sub-categories" element={<CategorySubTypesPage />} />
              <Route path="setup/locations" element={<LocationsPage />} />
              <Route path="setup/location-types" element={<LocationTypesPage />} />
              <Route path="setup/stores" element={<StoresPage />} />
              <Route path="setup/miniature-sizes" element={<MiniatureSizesPage />} />
              <Route path="setup/miniature-rarities" element={<MiniatureRaritiesPage />} />
              <Route path="setup/status" element={<StatusPage />} />
            </Route>

            <Route path="/admin/collections" element={<Navigate to="/home/setup/collections" replace />} />
            <Route path="/admin/collection-types" element={<Navigate to="/home/setup/collection-types" replace />} />
            <Route path="/admin/categories" element={<Navigate to="/home/setup/categories" replace />} />
            <Route path="/admin/subtypes" element={<Navigate to="/home/setup/sub-categories" replace />} />
            <Route path="/admin/publishers" element={<Navigate to="/home/setup/publishers" replace />} />
            <Route path="/admin/rpg-systems" element={<Navigate to="/home/setup/rpg-systems" replace />} />
            <Route path="/admin/status" element={<Navigate to="/home/setup/status" replace />} />
            <Route path="/admin/stores" element={<Navigate to="/home/setup/stores" replace />} />
            <Route path="/admin/miniature-sizes" element={<Navigate to="/home/setup/miniature-sizes" replace />} />
            <Route path="/admin/miniature-rarities" element={<Navigate to="/home/setup/miniature-rarities" replace />} />
            <Route path="/admin/locations" element={<Navigate to="/home/setup/locations" replace />} />
            <Route path="/admin/location-types" element={<Navigate to="/home/setup/location-types" replace />} />
            <Route path="/admin/category-subtypes" element={<Navigate to="/home/setup/category-sub-categories" replace />} />
            <Route path="/admin/publisher-collections" element={<Navigate to="/home/setup/publisher-collections" replace />} />
            <Route path="/admin/collection-rpg-systems" element={<Navigate to="/home/setup/collection-rpg-systems" replace />} />
            <Route path="/admin/inventory" element={<RedirectWithSearch to="/home/inventory" />} />
            <Route path="/admin/miniatures" element={<RedirectWithSearch to="/home/miniatures" />} />
            <Route path="/admin/order-master" element={<RedirectWithSearch to="/home/orders" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
