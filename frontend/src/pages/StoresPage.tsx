import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X, ChevronUp, ChevronDown } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import RecordForm from '../components/RecordForm';
import { tableAPI } from '../services/api';

interface Store {
  [key: string]: any;
}

type SortDirection = 'asc' | 'desc' | null;

export default function StoresPage() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const tableName = 'Store';

  const { data: records = [], isLoading, error } = useQuery<any, Error>({
    queryKey: ['table', tableName],
    queryFn: async () => {
      const response = await tableAPI.getRecords(tableName);
      return response.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (recordId: number | string) => {
      return await tableAPI.deleteRecord(tableName, recordId);
    },
    onSuccess: () => {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ['table', tableName] });
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to delete record';
      setErrorMessage(errorMsg);
      setTimeout(() => setErrorMessage(null), 5000);
    },
  });

  const handleDelete = (recordId: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      deleteMutation.mutate(recordId);
    }
  };

  const handleNameSort = () => {
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
      const nameA = (a.StoreName || '').toLowerCase();
      const nameB = (b.StoreName || '').toLowerCase();

      if (sortDirection === 'asc') {
        return nameA.localeCompare(nameB);
      } else {
        return nameB.localeCompare(nameA);
      }
    });

    return sorted;
  };

  const getSortIcon = () => {
    if (sortDirection === 'asc') return <ChevronUp className="w-4 h-4" />;
    if (sortDirection === 'desc') return <ChevronDown className="w-4 h-4" />;
    return null;
  };

  return (
    <AdminLayout title="Stores">
      <div className="max-w-7xl mx-auto">
        {errorMessage && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{errorMessage}</p>
          </div>
        )}
        <div className="mb-6">
          <Button
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            New Store
          </Button>
        </div>

        {isAdding || editingId !== null ? (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {editingId !== null ? 'Edit Store' : 'New Store'}
              </h2>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <RecordForm
              tableName={tableName}
              recordId={editingId ?? undefined}
              onClose={() => {
                setIsAdding(false);
                setEditingId(null);
              }}
              onSuccess={() => {
                setIsAdding(false);
                setEditingId(null);
                queryClient.invalidateQueries({ queryKey: ['table', tableName] });
              }}
            />
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
                  onClick={handleNameSort}
                >
                  <div className="flex items-center gap-2">
                    Name
                    {getSortIcon()}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Array.isArray(getSortedRecords()) && getSortedRecords().map((record: Store) => (
                <tr key={record.StoreID} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{record.StoreName}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => setEditingId(record.StoreID)}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(String(record.StoreID))}
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
