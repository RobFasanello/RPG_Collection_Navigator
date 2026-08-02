import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router';
import HomeShell from './home/HomeShell';
import './index.css';

const queryClient = new QueryClient();

const HomePage = lazy(() => import('./pages/HomePage'));
const CollectionMasterPage = lazy(() => import('./pages/CollectionMasterPage'));
const CategoryMasterPage = lazy(() => import('./pages/CategoryMasterPage'));
const SubTypesPage = lazy(() => import('./pages/SubTypesPage'));
const PublisherMasterPage = lazy(() => import('./pages/PublisherMasterPage'));
const LocationMasterPage = lazy(() => import('./pages/LocationMasterPage'));
const InventoryLookupPage = lazy(() => import('./pages/InventoryLookupPage'));
const MiniatureMasterPage = lazy(() => import('./pages/MiniatureMasterPage'));
const TerrainMasterPage = lazy(() => import('./pages/TerrainMasterPage'));
const OrderMasterPage = lazy(() => import('./pages/OrderMasterPage'));
const SetupLandingPage = lazy(() => import('./pages/SetupLandingPage'));
const ReferenceListsPage = lazy(() => import('./pages/ReferenceListsPage'));

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
              <Route path="terrain" element={<TerrainMasterPage />} />
              <Route path="orders" element={<OrderMasterPage />} />
              <Route path="setup" element={<SetupLandingPage />} />
              <Route path="setup/publishers" element={<PublisherMasterPage />} />
              <Route path="setup/rpg-systems" element={<Navigate to="/home/setup/reference-lists?table=rpg-systems" replace />} />
              <Route path="setup/collections" element={<CollectionMasterPage />} />
              <Route path="setup/publisher-collections" element={<Navigate to="/home/setup/publishers" replace />} />
              <Route path="setup/collection-rpg-systems" element={<Navigate to="/home/setup/collections" replace />} />
              <Route path="setup/collection-types" element={<Navigate to="/home/setup/reference-lists?table=collection-types" replace />} />
              <Route path="setup/categories" element={<CategoryMasterPage />} />
              <Route path="setup/sub-categories" element={<SubTypesPage />} />
              <Route path="setup/category-sub-categories" element={<Navigate to="/home/setup/categories" replace />} />
              <Route path="setup/locations" element={<LocationMasterPage />} />
              <Route path="setup/location-types" element={<Navigate to="/home/setup/reference-lists?table=location-types" replace />} />
              <Route path="setup/stores" element={<Navigate to="/home/setup/reference-lists?table=stores" replace />} />
              <Route path="setup/miniature-sizes" element={<Navigate to="/home/setup/reference-lists?table=miniature-sizes" replace />} />
              <Route path="setup/miniature-rarities" element={<Navigate to="/home/setup/reference-lists?table=miniature-rarities" replace />} />
              <Route path="setup/status" element={<Navigate to="/home/setup/reference-lists?table=status" replace />} />
              <Route path="setup/reference-lists" element={<ReferenceListsPage />} />
            </Route>

            <Route path="/admin/collections" element={<Navigate to="/home/setup/collections" replace />} />
            <Route path="/admin/collection-types" element={<Navigate to="/home/setup/reference-lists?table=collection-types" replace />} />
            <Route path="/admin/categories" element={<Navigate to="/home/setup/categories" replace />} />
            <Route path="/admin/subtypes" element={<Navigate to="/home/setup/sub-categories" replace />} />
            <Route path="/admin/publishers" element={<Navigate to="/home/setup/publishers" replace />} />
            <Route path="/admin/rpg-systems" element={<Navigate to="/home/setup/reference-lists?table=rpg-systems" replace />} />
            <Route path="/admin/status" element={<Navigate to="/home/setup/reference-lists?table=status" replace />} />
            <Route path="/admin/stores" element={<Navigate to="/home/setup/reference-lists?table=stores" replace />} />
            <Route path="/admin/miniature-sizes" element={<Navigate to="/home/setup/reference-lists?table=miniature-sizes" replace />} />
            <Route path="/admin/miniature-rarities" element={<Navigate to="/home/setup/reference-lists?table=miniature-rarities" replace />} />
            <Route path="/admin/locations" element={<Navigate to="/home/setup/locations" replace />} />
            <Route path="/admin/location-types" element={<Navigate to="/home/setup/reference-lists?table=location-types" replace />} />
            <Route path="/admin/category-subtypes" element={<Navigate to="/home/setup/categories" replace />} />
            <Route path="/admin/publisher-collections" element={<Navigate to="/home/setup/publishers" replace />} />
            <Route path="/admin/collection-rpg-systems" element={<Navigate to="/home/setup/collections" replace />} />
            <Route path="/admin/inventory" element={<RedirectWithSearch to="/home/inventory" />} />
            <Route path="/admin/miniatures" element={<RedirectWithSearch to="/home/miniatures" />} />
            <Route path="/admin/terrain" element={<RedirectWithSearch to="/home/terrain" />} />
            <Route path="/admin/order-master" element={<RedirectWithSearch to="/home/orders" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
