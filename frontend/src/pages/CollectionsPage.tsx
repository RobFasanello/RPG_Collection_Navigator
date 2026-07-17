import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X, ChevronUp, ChevronDown } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import ComboSelect from '../components/ui/ComboSelect';
import { Dialog } from '../components/ui/Dialog';
import { tableAPI } from '../services/api';

interface Collection {
  [key: string]: any;
}

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'name' | 'collectionType' | null;

export default function CollectionsPage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [formValues, setFormValues] = useState({
    CollectionName: '',
    CollectionTypeID: '',
  });
  const queryClient = useQueryClient();
  const tableName = 'Collection';

  const { data: records = [], isLoading, error } = useQuery<any, Error>({
    queryKey: ['table', tableName],
    queryFn: async () => {
      const response = await tableAPI.getRecords(tableName);
      return response.data.data;
    },
  });

  const { data: collectionTypeRecords = [] } = useQuery<any, Error>({
    queryKey: ['table', 'CollectionType'],
    queryFn: async () => {
      const response = await tableAPI.getTableData('CollectionType', 1, 500);
      return response.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (recordId: number | string) => {
      return await tableAPI.deleteRecord(tableName, recordId);
    },
    onSuccess: () => {
      setDeleteError('');
      queryClient.invalidateQueries({ queryKey: ['table', tableName] });
    },
    onError: (error: any) => {
      const backendError = String(error?.response?.data?.error || error?.message || '').trim();
      const backendMessage = backendError.toLowerCase();
      const referentialIntegrityConflict =
        backendMessage.includes('reference constraint') ||
        backendMessage.includes('foreign key') ||
        backendMessage.includes('conflicted with the reference') ||
        backendMessage.includes('still referenced');

      if (referentialIntegrityConflict) {
        setDeleteError(
          'Delete failed. This collection is still referenced by one or more publisher/collection links or linked items. Reassign or remove the linked records first, then try again.'
        );
        return;
      }

      setDeleteError(backendError || 'Delete failed. Please try again.');
    },
  });

  const handleDelete = (recordId: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      setDeleteError('');
      deleteMutation.mutate(recordId);
    }
  };

  const handleEdit = (record: Collection) => {
    setIsAdding(false);
    setEditingId(String(record.CollectionID));
    setFormValues({
      CollectionName: String(record.CollectionName ?? ''),
      CollectionTypeID: String(record.CollectionTypeID ?? ''),
    });
    setFormError('');
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormValues({
      CollectionName: '',
      CollectionTypeID: '',
    });
    setFormError('');
  };

  const handleSort = (column: Exclude<SortColumn, null>) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('asc');
      return;
    }

    if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortDirection(null);
      setSortColumn(null);
    } else {
      setSortDirection('asc');
    }
  };

  const getSortedRecords = () => {
    if (!Array.isArray(records) || !sortDirection) {
      return records;
    }

    const sorted = [...records].sort((a, b) => {
      const valueA =
        sortColumn === 'collectionType'
          ? String(collectionTypeNameById[Number(a.CollectionTypeID)] ?? a.CollectionTypeID ?? '')
          : String(a.CollectionName ?? '');
      const valueB =
        sortColumn === 'collectionType'
          ? String(collectionTypeNameById[Number(b.CollectionTypeID)] ?? b.CollectionTypeID ?? '')
          : String(b.CollectionName ?? '');

      const nameA = valueA.toLowerCase();
      const nameB = valueB.toLowerCase();

      if (sortDirection === 'asc') {
        return nameA.localeCompare(nameB);
      }

      return nameB.localeCompare(nameA);
    });

    return sorted;
  };

  const getSortIcon = (column: Exclude<SortColumn, null>) => {
    if (sortColumn !== column) return null;
    if (sortDirection === 'asc') return <ChevronUp className="w-4 h-4" />;
    if (sortDirection === 'desc') return <ChevronDown className="w-4 h-4" />;
    return null;
  };

  const collectionTypeNameById = (collectionTypeRecords || []).reduce(
    (map: Record<number, string>, item: any) => {
      if (item?.CollectionTypeID != null) {
        map[item.CollectionTypeID] = item.CollectionTypeName ?? String(item.CollectionTypeID);
      }
      return map;
    },
    {}
  );

  const collectionTypeOptions = (collectionTypeRecords || []).map((item: any) => ({
    value: String(item.CollectionTypeID ?? ''),
    label: String(item.CollectionTypeName ?? ''),
  }));

  return (
    <AdminLayout title="Collections" subtitle="Use this screen to view, add, remove and modify the collections in your collection.">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
              setFormValues({ CollectionName: '', CollectionTypeID: '' });
              setFormError('');
            }}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="w-4 h-4" />
            New Collection
          </Button>
        </div>

        {isAdding || editingId !== null ? (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {editingId !== null ? 'Edit Collection' : 'New Collection'}
              </h2>
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

                const collectionName = formValues.CollectionName.trim();
                const collectionTypeId = parseInt(formValues.CollectionTypeID, 10);

                if (!collectionName) {
                  setFormError('Collection Name is required.');
                  return;
                }

                if (!Number.isFinite(collectionTypeId)) {
                  setFormError('Collection Type is required.');
                  return;
                }

                setIsSaving(true);
                try {
                  const payload = {
                    CollectionName: collectionName,
                    CollectionTypeID: collectionTypeId,
                  };

                  if (editingId !== null) {
                    await tableAPI.updateRecord(tableName, editingId, payload);
                  } else {
                    await tableAPI.createRecord(tableName, payload);
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
                <label className="block text-sm font-medium mb-1">Collection Name</label>
                <Input
                  type="text"
                  value={formValues.CollectionName}
                  onChange={(e) =>
                    setFormValues((prev) => ({ ...prev, CollectionName: e.target.value }))
                  }
                  placeholder="Enter Collection Name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Collection Type</label>
                <ComboSelect
                  options={collectionTypeOptions}
                  value={formValues.CollectionTypeID}
                  onChange={(value) =>
                    setFormValues((prev) => ({ ...prev, CollectionTypeID: value }))
                  }
                  placeholder="Select collection type"
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
                  {isSaving ? 'Saving...' : 'Save Collection'}
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
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Name
                    {getSortIcon('name')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition"
                  onClick={() => handleSort('collectionType')}
                >
                  <div className="flex items-center gap-2">
                    Collection Type
                    {getSortIcon('collectionType')}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Array.isArray(getSortedRecords()) && getSortedRecords().map((record: Collection) => (
                <tr key={record.CollectionID} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{record.CollectionName}</td>
                  <td className="px-6 py-4">
                    {collectionTypeNameById[Number(record.CollectionTypeID)] ?? `ID: ${record.CollectionTypeID ?? '-'}`}
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
                      onClick={() => handleDelete(String(record.CollectionID))}
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

        <Dialog
          open={!!deleteError}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteError('');
            }
          }}
          title="Delete Failed"
          onClose={() => setDeleteError('')}
          contentClassName="max-w-lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-red-700">{deleteError}</p>
            <div className="flex justify-end">
              <Button onClick={() => setDeleteError('')} className="bg-red-600 hover:bg-red-700">
                OK
              </Button>
            </div>
          </div>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
