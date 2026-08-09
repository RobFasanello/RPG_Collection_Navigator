import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router';
import HomeShell from './home/HomeShell';
import { ToastProvider } from './components/ui/ToastProvider';
import { Skeleton } from './components/ui/Skeleton';
import { AppModeProvider } from './context/AppModeContext';
import RequireMode from './components/RequireMode';
import RequireAuth from './components/RequireAuth';
import ApiErrorToastBridge from './components/ApiErrorToastBridge';
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
const UsersSetupPage = lazy(() => import('./pages/UsersSetupPage'));
const MarketingPage = lazy(() => import('./pages/MarketingPage'));

function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

function RouteSkeletonFallback() {
  return (
    <div className="space-y-4 p-6" aria-label="Loading page">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppModeProvider>
      <ToastProvider>
        <ApiErrorToastBridge />
        <Router>
          <Suspense fallback={<RouteSkeletonFallback />}>
            <Routes>
            <Route path="/" element={<MarketingPage />} />

            <Route path="/home" element={<RequireAuth><HomeShell /></RequireAuth>}>
              <Route index element={<HomePage />} />
              <Route path="inventory" element={<InventoryLookupPage />} />
              <Route path="miniatures" element={<MiniatureMasterPage />} />
              <Route path="terrain" element={<TerrainMasterPage />} />
              <Route path="orders" element={<OrderMasterPage />} />
              <Route path="setup" element={<RequireMode mode="administrator"><SetupLandingPage /></RequireMode>} />
              <Route path="setup/publishers" element={<RequireMode mode="administrator"><PublisherMasterPage /></RequireMode>} />
              <Route path="setup/rpg-systems" element={<Navigate to="/home/setup/reference-lists?table=rpg-systems" replace />} />
              <Route path="setup/collections" element={<RequireMode mode="administrator"><CollectionMasterPage /></RequireMode>} />
              <Route path="setup/publisher-collections" element={<Navigate to="/home/setup/publishers" replace />} />
              <Route path="setup/collection-rpg-systems" element={<Navigate to="/home/setup/collections" replace />} />
              <Route path="setup/collection-types" element={<Navigate to="/home/setup/reference-lists?table=collection-types" replace />} />
              <Route path="setup/categories" element={<RequireMode mode="administrator"><CategoryMasterPage /></RequireMode>} />
              <Route path="setup/sub-categories" element={<RequireMode mode="administrator"><SubTypesPage /></RequireMode>} />
              <Route path="setup/category-sub-categories" element={<Navigate to="/home/setup/categories" replace />} />
              <Route path="setup/locations" element={<RequireMode mode="administrator"><LocationMasterPage /></RequireMode>} />
              <Route path="setup/location-types" element={<Navigate to="/home/setup/reference-lists?table=location-types" replace />} />
              <Route path="setup/stores" element={<Navigate to="/home/setup/reference-lists?table=stores" replace />} />
              <Route path="setup/miniature-sizes" element={<Navigate to="/home/setup/reference-lists?table=miniature-sizes" replace />} />
              <Route path="setup/miniature-rarities" element={<Navigate to="/home/setup/reference-lists?table=miniature-rarities" replace />} />
              <Route path="setup/status" element={<Navigate to="/home/setup/reference-lists?table=status" replace />} />
              <Route path="setup/reference-lists" element={<RequireMode mode="administrator"><ReferenceListsPage /></RequireMode>} />
              <Route path="setup/users" element={<RequireMode mode="administrator"><UsersSetupPage /></RequireMode>} />
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
      </ToastProvider>
      </AppModeProvider>
    </QueryClientProvider>
  );
}

export default App;
