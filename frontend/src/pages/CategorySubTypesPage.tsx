import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, ChevronUp, ChevronDown } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import { tableAPI } from '../services/api';

interface CategorySubType {
  [key: string]: any;
}

type SortDirection = 'asc' | 'desc' | null;

export default function CategorySubTypesPage() {
  const [isAdding, setIsAdding] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
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

  const handleCategorySort = () => {
    if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortDirection(null);
    } else {
      setSortDirection('asc');
    }
  };

  const getSortedRecords = () => {
    if (!Array.isArray(records) || !sortDirection) {
      return records;
    }

    const sorted = [...records].sort((a, b) => {
      const nameA = (categoryNameById[a.CategoryID] ?? String(a.CategoryID)).toLowerCase();
      const nameB = (categoryNameById[b.CategoryID] ?? String(b.CategoryID)).toLowerCase();

      if (nameA < nameB) return sortDirection === 'asc' ? -1 : 1;
      if (nameA > nameB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const getSortIcon = () => {
    if (sortDirection === 'asc') return <ChevronUp className="w-4 h-4" />;
    if (sortDirection === 'desc') return <ChevronDown className="w-4 h-4" />;
    return null;
  };

  return (
    <AdminLayout title="Category Subtypes">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button
            onClick={() => {
              setIsAdding(true);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            New Category Subtype
          </Button>
        </div>

        {isAdding ? (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">New Category Subtype</h2>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setFormValues({ CategoryID: '', SubTypeID: '' });
                  setFormError('');
                }}
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
                    record.CategoryID === categoryId && record.SubTypeID === subTypeId
                );

                if (duplicateExists) {
                  setFormError('That category/subtype pair already exists.');
                  return;
                }

                setIsSaving(true);
                try {
                  await tableAPI.createRecord(tableName, {
                    CategoryID: categoryId,
                    SubTypeID: subTypeId,
                  });
                  queryClient.invalidateQueries({ queryKey: ['table', tableName] });
                  setIsAdding(false);
                  setFormValues({ CategoryID: '', SubTypeID: '' });
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
                <select
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={formValues.CategoryID}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, CategoryID: e.target.value }))}
                  required
                >
                  <option value="">Select category</option>
                  {categoryRecords.map((category: any) => (
                    <option key={category.CategoryID} value={category.CategoryID}>
                      {category.CategoryName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">SubType Name</label>
                <select
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={formValues.SubTypeID}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, SubTypeID: e.target.value }))}
                  required
                >
                  <option value="">Select subtype</option>
                  {subTypeRecords.map((subType: any) => (
                    <option key={subType.SubTypeID} value={subType.SubTypeID}>
                      {subType.SubTypeName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <Button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setFormValues({ CategoryID: '', SubTypeID: '' });
                    setFormError('');
                  }}
                  className="bg-gray-200 text-gray-800 hover:bg-gray-300"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
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
                  onClick={handleCategorySort}
                >
                  <div className="flex items-center gap-2">
                    Category Name
                    {getSortIcon()}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">SubType Name</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Array.isArray(getSortedRecords()) && getSortedRecords().map((record: CategorySubType, idx: number) => (
                <tr key={record.CategorySubTypeID ?? `${record.CategoryID}-${record.SubTypeID}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{categoryNameById[record.CategoryID] ?? record.CategoryID}</td>
                  <td className="px-6 py-4">{subTypeNameById[record.SubTypeID] ?? record.SubTypeID}</td>
                  <td className="px-6 py-4 text-right space-x-2">
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
