import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import TableBrowser from './components/TableBrowser';
import CollectionsPage from './pages/CollectionsPage';
import CollectionTypesPage from './pages/CollectionTypesPage';
import CategoriesPage from './pages/CategoriesPage';
import SubTypesPage from './pages/SubTypesPage';
import PublishersPage from './pages/PublishersPage';
import StatusPage from './pages/StatusPage';
import StoresPage from './pages/StoresPage';
import MiniatureSizesPage from './pages/MiniatureSizesPage';
import MiniatureRaritiesPage from './pages/MiniatureRaritiesPage';
import LocationsPage from './pages/LocationsPage';
import LocationTypesPage from './pages/LocationTypesPage';
import CategorySubTypesPage from './pages/CategorySubTypesPage';
import PublisherCollectionsPage from './pages/PublisherCollectionsPage';
import InventoryLookupPage from './pages/InventoryLookupPage';
import MiniatureMasterPage from './pages/MiniatureMasterPage';
import './index.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<TableBrowser />} />
          <Route path="/admin/collections" element={<CollectionsPage />} />
          <Route path="/admin/collection-types" element={<CollectionTypesPage />} />
          <Route path="/admin/categories" element={<CategoriesPage />} />
          <Route path="/admin/subtypes" element={<SubTypesPage />} />
          <Route path="/admin/publishers" element={<PublishersPage />} />
          <Route path="/admin/status" element={<StatusPage />} />
          <Route path="/admin/stores" element={<StoresPage />} />
          <Route path="/admin/miniature-sizes" element={<MiniatureSizesPage />} />
          <Route path="/admin/miniature-rarities" element={<MiniatureRaritiesPage />} />
          <Route path="/admin/locations" element={<LocationsPage />} />
          <Route path="/admin/location-types" element={<LocationTypesPage />} />
          <Route path="/admin/category-subtypes" element={<CategorySubTypesPage />} />
          <Route path="/admin/publisher-collections" element={<PublisherCollectionsPage />} />
          <Route path="/admin/inventory" element={<InventoryLookupPage />} />
          <Route path="/admin/miniatures" element={<MiniatureMasterPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
