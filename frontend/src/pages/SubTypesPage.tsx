import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X, ChevronUp, ChevronDown } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import RecordForm from '../components/RecordForm';
import { tableAPI } from '../services/api';

interface SubType {
  [key: string]: any;
}

type SortDirection = 'asc' | 'desc' | null;

export default function SubTypesPage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const queryClient = useQueryClient();
  const tableName = 'SubType';

  const { data: records = [], isLoading, error } = useQuery<any, Error>({
    queryKey: ['table', tableName],
    queryFn: async () => {
      const response = await tableAPI.getRecords(tableName);
      return response.data.data;
    },
  });

  const { data: schema = [] } = useQuery<any, Error>({
    queryKey: ['table', tableName, 'schema'],
    queryFn: async () => {
      const response = await tableAPI.getTableSchema(tableName);
      return response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (recordId: number | string) => {
      return await tableAPI.deleteRecord(tableName, recordId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['table', tableName] });
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
      const nameA = (a.SubTypeName || '').toLowerCase();
      const nameB = (b.SubTypeName || '').toLowerCase();

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
    <AdminLayout title="Subtypes">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
            }}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            New Subtype
          </Button>
        </div>

        {isAdding || editingId !== null ? (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {editingId !== null ? 'Edit Subtype' : 'New Subtype'}
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
              schema={schema || []}
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
              {Array.isArray(getSortedRecords()) && getSortedRecords().map((record: SubType) => (
                <tr key={record.SubTypeID} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{record.SubTypeName}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => {
                        setIsAdding(false);
                        setEditingId(String(record.SubTypeID));
                      }}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(String(record.SubTypeID))}
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
