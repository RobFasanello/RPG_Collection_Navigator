import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, ChevronUp, ChevronDown, Edit2 } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import ComboSelect from '../components/ui/ComboSelect';
import { tableAPI } from '../services/api';

interface CategorySubType {
  [key: string]: any;
}

type SortDirection = 'asc' | 'desc' | null;

async function getAllTableRows(tableName: string): Promise<any[]> {
  const pageSize = 500;
  const firstResponse = await tableAPI.getTableData(tableName, 1, pageSize);
  const firstData = firstResponse.data;
  const rows = [...(firstData?.data || [])];
  const totalPages = Number(firstData?.totalPages || 1);

  for (let page = 2; page <= totalPages; page++) {
    const response = await tableAPI.getTableData(tableName, page, pageSize);
    rows.push(...(response.data?.data || []));
  }

  return rows;
}

export default function CategorySubTypesPage() {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CategorySubType | null>(null);
  const [sortColumn, setSortColumn] = useState<'CategoryName' | 'SubTypeName' | 'ItemCount'>('CategoryName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterInputs, setFilterInputs] = useState({ categoryName: '', subTypeName: '' });
  const [activeFilters, setActiveFilters] = useState({ categoryName: '', subTypeName: '' });
  const [formValues, setFormValues] = useState({ CategoryID: '', SubTypeID: '' });
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();
  const tableName = 'CategorySubType';

  const { data: records = [], isLoading, error } = useQuery<any, Error>({
    queryKey: ['table', tableName],
    queryFn: async () => {
      const response = await tableAPI.getRecords(tableName);
      return response.data.data;
    },
  });

  const { data: categoryRecords = [] } = useQuery<any, Error>({
    queryKey: ['table', 'Category'],
    queryFn: async () => {
      const response = await tableAPI.getTableData('Category', 1, 500);
      return response.data.data;
    },
  });

  const { data: subTypeRecords = [] } = useQuery<any, Error>({
    queryKey: ['table', 'SubType'],
    queryFn: async () => {
      const response = await tableAPI.getTableData('SubType', 1, 500);
      return response.data.data;
    },
  });

  const { data: allItems = [] } = useQuery<any, Error>({
    queryKey: ['table', 'Item', 'all-for-category-subtype-counts'],
    queryFn: async () => getAllTableRows('Item'),
  });

  const categoryNameById = (categoryRecords || []).reduce(
    (map: Record<number, string>, item: any) => {
      if (item?.CategoryID != null) {
        map[item.CategoryID] = item.CategoryName ?? String(item.CategoryID);
      }
      return map;
    },
    {}
  );

  const subTypeNameById = (subTypeRecords || []).reduce(
    (map: Record<number, string>, item: any) => {
      if (item?.SubTypeID != null) {
        map[item.SubTypeID] = item.SubTypeName ?? String(item.SubTypeID);
      }
      return map;
    },
    {}
  );

  const categoryFilterOptions = (categoryRecords || []).map((category: any) => ({
    value: String(category.CategoryName || ''),
    label: String(category.CategoryName || ''),
  }));

  const subTypeFilterOptions = (subTypeRecords || []).map((subType: any) => ({
    value: String(subType.SubTypeName || ''),
    label: String(subType.SubTypeName || ''),
  }));

  const categoryFormOptions = (categoryRecords || []).map((category: any) => ({
    value: String(category.CategoryID || ''),
    label: String(category.CategoryName || ''),
  }));

  const subTypeFormOptions = (subTypeRecords || []).map((subType: any) => ({
    value: String(subType.SubTypeID || ''),
    label: String(subType.SubTypeName || ''),
  }));

  const hasFilterChanges =
    filterInputs.categoryName !== activeFilters.categoryName ||
    filterInputs.subTypeName !== activeFilters.subTypeName;

  const itemCountByCategorySubType = (allItems || []).reduce((map: Record<string, number>, item: any) => {
    const categoryId = Number(item?.CategoryID);
    const subTypeId = Number(item?.SubTypeID);

    if (!Number.isFinite(categoryId) || !Number.isFinite(subTypeId)) {
      return map;
    }

    const key = `${categoryId}:${subTypeId}`;
    map[key] = (map[key] || 0) + 1;
    return map;
  }, {});

  const deleteMutation = useMutation({
    mutationFn: async (payload: number | string | { categoryId: number; subTypeId: number }) => {
      return await tableAPI.deleteRecord(tableName, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['table', tableName] });
    },
  });

  const handleDelete = (record: CategorySubType) => {
    if (!confirm('Are you sure you want to delete this record?')) {
      return;
    }

    if (record.CategorySubTypeID != null) {
      deleteMutation.mutate(record.CategorySubTypeID);
    } else {
      deleteMutation.mutate({
        categoryId: Number(record.CategoryID),
        subTypeId: Number(record.SubTypeID),
      });
    }
  };

  const handleEdit = (record: CategorySubType) => {
    setIsAdding(false);
    setIsEditing(true);
    setEditingRecord(record);
    setFormValues({
      CategoryID: String(record.CategoryID ?? ''),
      SubTypeID: String(record.SubTypeID ?? ''),
    });
    setFormError('');
  };

  const closeForm = () => {
    setIsAdding(false);
    setIsEditing(false);
    setEditingRecord(null);
    setFormValues({ CategoryID: '', SubTypeID: '' });
    setFormError('');
  };

  const handleSort = (column: 'CategoryName' | 'SubTypeName' | 'ItemCount') => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('asc');
      return;
    }

    if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortDirection(null);
    } else {
      setSortDirection('asc');
    }
  };

  const getSortedRecords = () => {
    if (!Array.isArray(records)) {
      return [];
    }

    const categoryFilter = activeFilters.categoryName.trim().toLowerCase();
    const subTypeFilter = activeFilters.subTypeName.trim().toLowerCase();

    const filteredRecords = records.filter((record: CategorySubType) => {
      const categoryName = String(categoryNameById[record.CategoryID] ?? record.CategoryID).toLowerCase();
      const subTypeName = String(subTypeNameById[record.SubTypeID] ?? record.SubTypeID).toLowerCase();

      const categoryMatches = !categoryFilter || categoryName.includes(categoryFilter);
      const subTypeMatches = !subTypeFilter || subTypeName.includes(subTypeFilter);

      return categoryMatches && subTypeMatches;
    });

    if (!sortDirection) {
      return filteredRecords;
    }

    const sorted = [...filteredRecords].sort((a, b) => {
      if (sortColumn === 'ItemCount') {
        const countA = itemCountByCategorySubType[`${Number(a.CategoryID)}:${Number(a.SubTypeID)}`] || 0;
        const countB = itemCountByCategorySubType[`${Number(b.CategoryID)}:${Number(b.SubTypeID)}`] || 0;

        if (countA < countB) return sortDirection === 'asc' ? -1 : 1;
        if (countA > countB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      }

      if (sortColumn === 'SubTypeName') {
        const nameA = (subTypeNameById[a.SubTypeID] ?? String(a.SubTypeID)).toLowerCase();
        const nameB = (subTypeNameById[b.SubTypeID] ?? String(b.SubTypeID)).toLowerCase();

        if (nameA < nameB) return sortDirection === 'asc' ? -1 : 1;
        if (nameA > nameB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      }

      const nameA = (categoryNameById[a.CategoryID] ?? String(a.CategoryID)).toLowerCase();
      const nameB = (categoryNameById[b.CategoryID] ?? String(b.CategoryID)).toLowerCase();

      if (nameA < nameB) return sortDirection === 'asc' ? -1 : 1;
      if (nameA > nameB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const applyFilters = () => {
    setActiveFilters({
      categoryName: filterInputs.categoryName,
      subTypeName: filterInputs.subTypeName,
    });
  };

  const clearFilters = () => {
    setFilterInputs({ categoryName: '', subTypeName: '' });
    setActiveFilters({ categoryName: '', subTypeName: '' });
  };

  const getSortIcon = (column: 'CategoryName' | 'SubTypeName' | 'ItemCount') => {
    if (sortColumn !== column) return null;
    if (sortDirection === 'asc') return <ChevronUp className="w-4 h-4" />;
    if (sortDirection === 'desc') return <ChevronDown className="w-4 h-4" />;
    return null;
  };

  return (
    <AdminLayout title="Category / Sub Categories">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 bg-white p-4 rounded-lg shadow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category Name</label>
              <ComboSelect
                options={categoryFilterOptions}
                value={filterInputs.categoryName}
                onChange={(value) => setFilterInputs((prev) => ({ ...prev, categoryName: value }))}
                placeholder="Select category"
                className="w-full"
                tabIndex={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sub Category Name</label>
              <ComboSelect
                options={subTypeFilterOptions}
                value={filterInputs.subTypeName}
                onChange={(value) => setFilterInputs((prev) => ({ ...prev, subTypeName: value }))}
                placeholder="Select sub category"
                className="w-full"
                tabIndex={2}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              onClick={() => {
                setIsEditing(false);
                setEditingRecord(null);
                setIsAdding(true);
                setFormValues({ CategoryID: '', SubTypeID: '' });
                setFormError('');
              }}
              className="gap-2 bg-green-600 hover:bg-green-700"
              tabIndex={999}
            >
              <Plus className="w-4 h-4" />
              Add New Category / Sub Category
            </Button>
            <Button onClick={applyFilters} tabIndex={3} disabled={!hasFilterChanges}>Apply Filters</Button>
            <Button
              onClick={clearFilters}
              className="bg-gray-200 text-gray-800 hover:bg-gray-300"
              tabIndex={4}
              disabled={!hasFilterChanges}
            >
              Clear
            </Button>
          </div>
        </div>

        {isAdding || isEditing ? (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">{isEditing ? 'Edit Category Subtype' : 'New Category Subtype'}</h2>
              <button
                onClick={closeForm}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                {formError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setFormError('');

                if (!formValues.CategoryID || !formValues.SubTypeID) {
                  setFormError('Please select both a category and a subtype.');
                  return;
                }

                const categoryId = parseInt(formValues.CategoryID, 10);
                const subTypeId = parseInt(formValues.SubTypeID, 10);
                const duplicateExists = (records || []).some(
                  (record: any) =>
                    record.CategoryID === categoryId &&
                    record.SubTypeID === subTypeId &&
                    (
                      !isEditing ||
                      !editingRecord ||
                      record.CategorySubTypeID !== editingRecord.CategorySubTypeID ||
                      (Number(record.CategoryID) !== Number(editingRecord.CategoryID) || Number(record.SubTypeID) !== Number(editingRecord.SubTypeID))
                    )
                );

                if (duplicateExists) {
                  setFormError('That category/subtype pair already exists.');
                  return;
                }

                setIsSaving(true);
                try {
                  if (isEditing && editingRecord) {
                    if (editingRecord.CategorySubTypeID != null) {
                      await tableAPI.updateRecord(tableName, editingRecord.CategorySubTypeID, {
                        CategoryID: categoryId,
                        SubTypeID: subTypeId,
                      });
                    } else {
                      const isSamePair =
                        Number(editingRecord.CategoryID) === categoryId &&
                        Number(editingRecord.SubTypeID) === subTypeId;

                      if (!isSamePair) {
                        await tableAPI.createRecord(tableName, {
                          CategoryID: categoryId,
                          SubTypeID: subTypeId,
                        });

                        await tableAPI.deleteRecord(tableName, {
                          categoryId: Number(editingRecord.CategoryID),
                          subTypeId: Number(editingRecord.SubTypeID),
                        });
                      }
                    }
                  } else {
                    await tableAPI.createRecord(tableName, {
                      CategoryID: categoryId,
                      SubTypeID: subTypeId,
                    });
                  }

                  queryClient.invalidateQueries({ queryKey: ['table', tableName] });
                  closeForm();
                } catch (err: any) {
                  setFormError(err.response?.data?.error || 'Error saving record');
                } finally {
                  setIsSaving(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">Category Name</label>
                <ComboSelect
                  options={categoryFormOptions}
                  value={formValues.CategoryID}
                  onChange={(value) => setFormValues((prev) => ({ ...prev, CategoryID: value }))}
                  placeholder="Select category"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Sub Category Name</label>
                <ComboSelect
                  options={subTypeFormOptions}
                  value={formValues.SubTypeID}
                  onChange={(value) => setFormValues((prev) => ({ ...prev, SubTypeID: value }))}
                  placeholder="Select sub category"
                  className="w-full"
                />
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <Button
                  type="button"
                  onClick={closeForm}
                  className="bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        {isLoading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-600">Error loading records</p>}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition"
                  onClick={() => handleSort('CategoryName')}
                  tabIndex={5}
                >
                  <div className="flex items-center gap-2">
                    Category Name
                    {getSortIcon('CategoryName')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition"
                  onClick={() => handleSort('SubTypeName')}
                  tabIndex={6}
                >
                  <div className="flex items-center gap-2">
                    Sub Category Name
                    {getSortIcon('SubTypeName')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-gray-200 transition"
                  onClick={() => handleSort('ItemCount')}
                  tabIndex={7}
                >
                  <div className="flex items-center justify-end gap-2">
                    Item Count
                    {getSortIcon('ItemCount')}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Array.isArray(getSortedRecords()) && getSortedRecords().map((record: CategorySubType, idx: number) => (
                <tr key={record.CategorySubTypeID ?? `${record.CategoryID}-${record.SubTypeID}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{categoryNameById[record.CategoryID] ?? record.CategoryID}</td>
                  <td className="px-6 py-4">{subTypeNameById[record.SubTypeID] ?? record.SubTypeID}</td>
                  <td className="px-6 py-4 text-right">
                    {(itemCountByCategorySubType[`${Number(record.CategoryID)}:${Number(record.SubTypeID)}`] || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => handleEdit(record)}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(record)}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
