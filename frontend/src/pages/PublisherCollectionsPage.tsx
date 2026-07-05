import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X, ChevronUp, ChevronDown } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import { tableAPI } from '../services/api';

interface PublisherCollection {
  [key: string]: any;
}

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'publisher' | 'collection' | null;

export default function PublisherCollectionsPage() {
  const [isAdding, setIsAdding] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [sortColumn, setSortColumn] = useState<SortColumn>('publisher');
  const [formValues, setFormValues] = useState({ PublisherID: '', CollectionID: '' });
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();
  const tableName = 'PublisherCollection';

  const { data: records = [], isLoading, error } = useQuery<any, Error>({
    queryKey: ['table', tableName],
    queryFn: async () => {
      const response = await tableAPI.getRecords(tableName);
      return response.data.data;
    },
  });

  const { data: publisherRecords = [] } = useQuery<any, Error>({
    queryKey: ['table', 'Publisher'],
    queryFn: async () => {
      const response = await tableAPI.getTableData('Publisher', 1, 500);
      return response.data.data;
    },
  });

  const { data: collectionRecords = [] } = useQuery<any, Error>({
    queryKey: ['table', 'Collection'],
    queryFn: async () => {
      const response = await tableAPI.getTableData('Collection', 1, 500);
      return response.data.data;
    },
  });

  const publisherNameById = (publisherRecords || []).reduce(
    (map: Record<number, string>, item: any) => {
      if (item?.PublisherID != null) {
        map[item.PublisherID] = item.PublisherName ?? String(item.PublisherID);
      }
      return map;
    },
    {}
  );

  const collectionNameById = (collectionRecords || []).reduce(
    (map: Record<number, string>, item: any) => {
      if (item?.CollectionID != null) {
        map[item.CollectionID] = item.CollectionName ?? String(item.CollectionID);
      }
      return map;
    },
    {}
  );

  const deleteMutation = useMutation({
    mutationFn: async (payload: number | string | { publisherId: number; collectionId: number }) => {
      return await tableAPI.deleteRecord(tableName, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['table', tableName] });
    },
  });

  const handleDelete = (record: PublisherCollection) => {
    if (!confirm('Are you sure you want to delete this record?')) {
      return;
    }

    if (record.PublisherCollectionID != null) {
      deleteMutation.mutate(record.PublisherCollectionID);
    } else {
      deleteMutation.mutate({
        publisherId: Number(record.PublisherID),
        collectionId: Number(record.CollectionID),
      });
    }
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
    if (!Array.isArray(records) || !sortDirection || !sortColumn) {
      return records;
    }

    const sorted = [...records].sort((a, b) => {
      const valueA =
        sortColumn === 'publisher'
          ? (publisherNameById[a.PublisherID] ?? String(a.PublisherID))
          : (collectionNameById[a.CollectionID] ?? String(a.CollectionID));
      const valueB =
        sortColumn === 'publisher'
          ? (publisherNameById[b.PublisherID] ?? String(b.PublisherID))
          : (collectionNameById[b.CollectionID] ?? String(b.CollectionID));

      const nameA = String(valueA).toLowerCase();
      const nameB = String(valueB).toLowerCase();

      if (nameA < nameB) return sortDirection === 'asc' ? -1 : 1;
      if (nameA > nameB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  };

  const getSortIcon = (column: Exclude<SortColumn, null>) => {
    if (sortColumn !== column) return null;
    if (sortDirection === 'asc') return <ChevronUp className="w-4 h-4" />;
    if (sortDirection === 'desc') return <ChevronDown className="w-4 h-4" />;
    return null;
  };

  return (
    <AdminLayout title="Publisher Collections">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button
            onClick={() => {
              setIsAdding(true);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            New Publisher Collection
          </Button>
        </div>

        {isAdding ? (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">New Publisher Collection</h2>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setFormValues({ PublisherID: '', CollectionID: '' });
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

                if (!formValues.PublisherID || !formValues.CollectionID) {
                  setFormError('Please select both a publisher and a collection.');
                  return;
                }

                const publisherId = parseInt(formValues.PublisherID, 10);
                const collectionId = parseInt(formValues.CollectionID, 10);
                const duplicateExists = (records || []).some(
                  (record: any) =>
                    record.PublisherID === publisherId && record.CollectionID === collectionId
                );

                if (duplicateExists) {
                  setFormError('That publisher/collection pair already exists.');
                  return;
                }

                setIsSaving(true);
                try {
                  await tableAPI.createRecord(tableName, {
                    PublisherID: publisherId,
                    CollectionID: collectionId,
                  });
                  queryClient.invalidateQueries({ queryKey: ['table', tableName] });
                  setIsAdding(false);
                  setFormValues({ PublisherID: '', CollectionID: '' });
                } catch (err: any) {
                  setFormError(err.response?.data?.error || 'Error saving record');
                } finally {
                  setIsSaving(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">Publisher Name</label>
                <select
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={formValues.PublisherID}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, PublisherID: e.target.value }))}
                  required
                >
                  <option value="">Select publisher</option>
                  {publisherRecords.map((publisher: any) => (
                    <option key={publisher.PublisherID} value={publisher.PublisherID}>
                      {publisher.PublisherName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Collection Name</label>
                <select
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  value={formValues.CollectionID}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, CollectionID: e.target.value }))}
                  required
                >
                  <option value="">Select collection</option>
                  {collectionRecords.map((collection: any) => (
                    <option key={collection.CollectionID} value={collection.CollectionID}>
                      {collection.CollectionName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <Button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setFormValues({ PublisherID: '', CollectionID: '' });
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
                  onClick={() => handleSort('publisher')}
                >
                  <div className="flex items-center gap-2">
                    Publisher Name
                    {getSortIcon('publisher')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition"
                  onClick={() => handleSort('collection')}
                >
                  <div className="flex items-center gap-2">
                    Collection Name
                    {getSortIcon('collection')}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Array.isArray(getSortedRecords()) && getSortedRecords().map((record: PublisherCollection, idx: number) => (
                <tr key={record.PublisherCollectionID ?? `${record.PublisherID}-${record.CollectionID}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{publisherNameById[record.PublisherID] ?? record.PublisherID}</td>
                  <td className="px-6 py-4">{collectionNameById[record.CollectionID] ?? record.CollectionID}</td>
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
