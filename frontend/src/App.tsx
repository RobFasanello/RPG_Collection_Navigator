import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CollectionsPage from './pages/CollectionsPage';
import CollectionTypesPage from './pages/CollectionTypesPage';
import CategoriesPage from './pages/CategoriesPage';
import SubTypesPage from './pages/SubTypesPage';
import PublishersPage from './pages/PublishersPage';
import StatusPage from './pages/StatusPage';
import StoresPage from './pages/StoresPage';
import CategorySubTypesPage from './pages/CategorySubTypesPage';
import PublisherCollectionsPage from './pages/PublisherCollectionsPage';
import InventoryLookupPage from './pages/InventoryLookupPage';
import OrderMasterPage from './pages/OrderMasterPage';
import HomeShell from './home/HomeShell';
import ManageSetupPage from './home/ManageSetupPage';
import './index.css';

const queryClient = new QueryClient();

function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
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
      </Router>
    </QueryClientProvider>
  );
}

export default App;
