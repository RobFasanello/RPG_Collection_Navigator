import { useMemo, useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import ComboMultiSelect from '../components/ui/ComboMultiSelect';
import { tablesAPI } from '../services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';

interface InventoryItem {
  ItemID: number;
  ItemName: string;
  ProductID?: string;
  ReleaseDate?: string;
  PublisherID: number;
  CollectionID: number;
  CategoryID: number;
  SubTypeID: number;
  PublisherName: string;
  CollectionName: string;
  CategoryName: string;
  SubTypeName: string;
}

export default function InventoryLookupPage() {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('ItemName');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [filterValues, setFilterValues] = useState({
    itemName: '',
    // publisherName is now an array of selected publisher names
    publisherName: [] as string[],
    collectionName: [] as string[],
    categoryName: [] as string[],
    subTypeName: [] as string[],
  });
  const [searchParams, setSearchParams] = useState(filterValues);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editValues, setEditValues] = useState({
    ItemName: '',
    ProductID: '',
    ReleaseDate: '',
    PublisherID: '',
    CollectionID: '',
    CategoryID: '',
    SubTypeID: '',
  });
  const [editError, setEditError] = useState('');

  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () => ['inventory', searchParams, page, sortBy, sortOrder],
    [searchParams, page, sortBy, sortOrder]
  );

  const formatReleaseDate = (date?: string) => {
    if (!date) {
      return '-';
    }

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const formatReleaseDateForModal = (date?: string) => {
    if (!date) {
      return '';
    }

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${month}/${day}/${year}`;
  };

  const normalizeReleaseDateForSave = (date: string) => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    const day = String(parsed.getDate()).padStart(2, '0');
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const year = parsed.getFullYear();
    return `${year}-${month}-${day}`;
  };

  // Load publisher options for the multi-select
  const { data: publisherResp } = useQuery(['publishers'], async () => {
    const resp = await tablesAPI.getTableData('Publisher', 1, 100);
    return resp.data;
  });
  const publisherOptions = (publisherResp?.data || []).map((p: any) => ({ value: p.PublisherName, label: p.PublisherName }));
  const publisherSelectOptions = (publisherResp?.data || []).map((p: any) => ({ value: p.PublisherID, label: p.PublisherName }));

  // Load collection options for the multi-select
  const { data: collectionResp } = useQuery(['collections'], async () => {
    const resp = await tablesAPI.getTableData('Collection', 1, 500);
    return resp.data;
  });
  const collectionOptions = (collectionResp?.data || []).map((c: any) => ({ value: c.CollectionName, label: c.CollectionName }));
  const collectionSelectOptions = (collectionResp?.data || []).map((c: any) => ({ value: c.CollectionID, label: c.CollectionName }));

  // Load category options for the multi-select
  const { data: categoryResp } = useQuery(['categories'], async () => {
    const resp = await tablesAPI.getTableData('Category', 1, 500);
    return resp.data;
  });
  const categoryOptions = (categoryResp?.data || []).map((c: any) => ({ value: c.CategoryName, label: c.CategoryName }));
  const categorySelectOptions = (categoryResp?.data || []).map((c: any) => ({ value: c.CategoryID, label: c.CategoryName }));

  // Load subtype options for the multi-select
  const { data: subTypeResp } = useQuery(['subtypes'], async () => {
    const resp = await tablesAPI.getTableData('SubType', 1, 500);
    return resp.data;
  });
  const subTypeOptions = (subTypeResp?.data || []).map((s: any) => ({ value: s.SubTypeName, label: s.SubTypeName }));
  const subTypeSelectOptions = (subTypeResp?.data || []).map((s: any) => ({ value: s.SubTypeID, label: s.SubTypeName }));

  const { data, isLoading, error } = useQuery<
    {
      data: InventoryItem[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    },
    Error
  >({
    queryKey,
    queryFn: async () => {
      const response = await tablesAPI.getInventoryItems({
        ...searchParams,
        page,
        pageSize: 50,
        sortBy,
        sortOrder,
      });
      return response.data;
    },
    keepPreviousData: true,
  });

  const handleFilterChange = (field: string, value: string) => {
    setFilterValues((current) => ({ ...current, [field]: value }));
  };

  // handle multi-select change for publisherName
  const handlePublisherChange = (values: string[]) => {
    setFilterValues((current) => ({ ...current, publisherName: values }));
  };

  // handle multi-select change for collectionName
  const handleCollectionChange = (values: string[]) => {
    setFilterValues((current) => ({ ...current, collectionName: values }));
  };

  // handle multi-select change for categoryName
  const handleCategoryChange = (values: string[]) => {
    setFilterValues((current) => ({ ...current, categoryName: values }));
  };

  // handle multi-select change for subTypeName
  const handleSubTypeChange = (values: string[]) => {
    setFilterValues((current) => ({ ...current, subTypeName: values }));
  };

  const applyFilters = () => {
    setPage(1);
    setSearchParams(filterValues);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
    setPage(1);
  };

  const SortIndicator = ({ column }: { column: string }) => {
    if (sortBy !== column) {
      return <span className="ml-1 text-gray-300">↕</span>;
    }
    return <span className="ml-1">{sortOrder === 'ASC' ? '↑' : '↓'}</span>;
  };

  const clearFilters = () => {
    setFilterValues({
      itemName: '',
      publisherName: [],
      collectionName: [],
      categoryName: [],
      subTypeName: [],
    });
    setSearchParams({
      itemName: '',
      publisherName: [],
      collectionName: [],
      categoryName: [],
      subTypeName: [],
    });
    setPage(1);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setEditValues({
      ItemName: item.ItemName || '',
      ProductID: item.ProductID || '',
      ReleaseDate: formatReleaseDateForModal(item.ReleaseDate),
      PublisherID: String(item.PublisherID),
      CollectionID: String(item.CollectionID),
      CategoryID: String(item.CategoryID),
      SubTypeID: String(item.SubTypeID),
    });
    setEditError('');
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setEditValues({
      ItemName: '',
      ProductID: '',
      ReleaseDate: '',
      PublisherID: '',
      CollectionID: '',
      CategoryID: '',
      SubTypeID: '',
    });
    setEditError('');
  };

  const editMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      if (!editingItem) {
        throw new Error('No item selected');
      }
      return tablesAPI.updateRecord('Item', editingItem.ItemID, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      closeEditModal();
    },
    onError: (error: any) => {
      setEditError(error.response?.data?.error || 'Failed to save inventory item');
    },
  });

  const handleEditChange = (field: string, value: string) => {
    setEditValues((current) => ({ ...current, [field]: value }));
  };

  const handleEditSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setEditError('');

    if (!editingItem) {
      return;
    }

    editMutation.mutate({
      ItemName: editValues.ItemName,
      ProductID: editValues.ProductID || null,
      ReleaseDate: editValues.ReleaseDate ? normalizeReleaseDateForSave(editValues.ReleaseDate) : null,
      PublisherID: editValues.PublisherID ? parseInt(editValues.PublisherID, 10) : null,
      CollectionID: editValues.CollectionID ? parseInt(editValues.CollectionID, 10) : null,
      CategoryID: editValues.CategoryID ? parseInt(editValues.CategoryID, 10) : null,
      SubTypeID: editValues.SubTypeID ? parseInt(editValues.SubTypeID, 10) : null,
    });
  };

  return (
    <AdminLayout title="Inventory Lookup">
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="bg-white shadow rounded-lg p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 flex-1">
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Item</span>
                <Input
                  value={filterValues.itemName}
                  onChange={(event) => handleFilterChange('itemName', event.target.value)}
                  placeholder="Item name"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Publisher</span>
                <ComboMultiSelect
                  options={publisherOptions}
                  selected={filterValues.publisherName}
                  onChange={handlePublisherChange}
                  placeholder="Publisher"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Collection</span>
                <ComboMultiSelect
                  options={collectionOptions}
                  selected={filterValues.collectionName}
                  onChange={handleCollectionChange}
                  placeholder="Collection"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Category</span>
                <ComboMultiSelect
                  options={categoryOptions}
                  selected={filterValues.categoryName}
                  onChange={handleCategoryChange}
                  placeholder="Category"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">SubType</span>
                <ComboMultiSelect
                  options={subTypeOptions}
                  selected={filterValues.subTypeName}
                  onChange={handleSubTypeChange}
                  placeholder="SubType"
                />
              </label>
            </div>

            <div className="flex gap-3">
              <Button onClick={applyFilters}>Apply Filters</Button>
              <Button className="bg-gray-600 hover:bg-gray-700" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </div>
        </section>

        <section className="bg-white shadow rounded-lg p-6">
          {isLoading && <p className="text-gray-500">Loading inventory...</p>}
          {error && <p className="text-red-600">Error loading inventory.</p>}

          {!isLoading && !error && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button onClick={() => handleSort('ItemName')} className="flex items-center hover:text-blue-600">
                          Item <SortIndicator column="ItemName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('PublisherName')} className="flex items-center hover:text-blue-600">
                          Publisher <SortIndicator column="PublisherName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('CollectionName')} className="flex items-center hover:text-blue-600">
                          Collection <SortIndicator column="CollectionName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('CategoryName')} className="flex items-center hover:text-blue-600">
                          Category <SortIndicator column="CategoryName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('SubTypeName')} className="flex items-center hover:text-blue-600">
                          SubType <SortIndicator column="SubTypeName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('ProductID')} className="flex items-center hover:text-blue-600">
                          Product ID <SortIndicator column="ProductID" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('ReleaseDate')} className="flex items-center hover:text-blue-600">
                          Release Date <SortIndicator column="ReleaseDate" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(data?.data) && data.data.length ? (
                      data.data.map((item: InventoryItem) => (
                        <TableRow
                          key={item.ItemID}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => openEditModal(item)}
                        >
                          <TableCell>{item.ItemName}</TableCell>
                          <TableCell>{item.PublisherName}</TableCell>
                          <TableCell>{item.CollectionName}</TableCell>
                          <TableCell>{item.CategoryName}</TableCell>
                          <TableCell>{item.SubTypeName}</TableCell>
                          <TableCell>{item.ProductID || '-'}</TableCell>
                          <TableCell>{formatReleaseDate(item.ReleaseDate)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                          No matching items found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-gray-600">
                  Showing {data?.data?.length ?? 0} of {data?.total ?? 0} results
                  {data?.page && data?.totalPages ? ` — Page ${data.page} of ${data.totalPages}` : ''}
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= (data?.totalPages ?? 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {editingItem ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-semibold">Edit Inventory Item</h2>
                <p className="text-sm text-gray-500">Update item values and save changes.</p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            {editError ? (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {editError}
              </div>
            ) : null}

            <form onSubmit={handleEditSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                  <Input
                    value={editValues.ItemName}
                    onChange={(e) => handleEditChange('ItemName', e.target.value)}
                    placeholder="Item name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
                  <Input
                    value={editValues.ProductID}
                    onChange={(e) => handleEditChange('ProductID', e.target.value)}
                    placeholder="Product ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Release Date</label>
                  <Input
                    value={editValues.ReleaseDate}
                    onChange={(e) => handleEditChange('ReleaseDate', e.target.value)}
                    placeholder="Release date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
                  <select
                    value={editValues.PublisherID}
                    onChange={(e) => handleEditChange('PublisherID', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="">Select publisher</option>
                    {publisherSelectOptions.map((option) => (
                      <option key={option.value} value={String(option.value)}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Collection</label>
                  <select
                    value={editValues.CollectionID}
                    onChange={(e) => handleEditChange('CollectionID', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="">Select collection</option>
                    {collectionSelectOptions.map((option) => (
                      <option key={option.value} value={String(option.value)}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={editValues.CategoryID}
                    onChange={(e) => handleEditChange('CategoryID', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="">Select category</option>
                    {categorySelectOptions.map((option) => (
                      <option key={option.value} value={String(option.value)}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SubType</label>
                  <select
                    value={editValues.SubTypeID}
                    onChange={(e) => handleEditChange('SubTypeID', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="">Select subtype</option>
                    {subTypeSelectOptions.map((option) => (
                      <option key={option.value} value={String(option.value)}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  className="bg-gray-200 text-gray-800 hover:bg-gray-300"
                  onClick={closeEditModal}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editMutation.isLoading}>
                  {editMutation.isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  );
}
