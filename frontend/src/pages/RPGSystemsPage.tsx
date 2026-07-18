import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X, ChevronUp, ChevronDown } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Dialog } from '../components/ui/Dialog';
import { tableAPI } from '../services/api';

interface RPGSystem {
  [key: string]: any;
  RPGSystemID?: number;
  RPGSystemName?: string;
  RPGSystemURL?: string | null;
  RPGSystemDescription?: string | null;
}

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'name' | 'url' | null;

export default function RPGSystemsPage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [formValues, setFormValues] = useState({
    RPGSystemName: '',
    RPGSystemURL: '',
    RPGSystemDescription: '',
  });
  const queryClient = useQueryClient();
  const tableName = 'RPGSystem';

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
          'Delete failed. This RPG system is still referenced by one or more collection/RPG system links. Remove the linked records first, then try again.'
        );
        return;
      }

      setDeleteError(backendError || 'Delete failed. Please try again.');
    },
  });

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormValues({ RPGSystemName: '', RPGSystemURL: '', RPGSystemDescription: '' });
    setFormError('');
  };

  const handleEdit = (record: RPGSystem) => {
    setIsAdding(false);
    setEditingId(String(record.RPGSystemID));
    setFormValues({
      RPGSystemName: String(record.RPGSystemName ?? ''),
      RPGSystemURL: String(record.RPGSystemURL ?? ''),
      RPGSystemDescription: String(record.RPGSystemDescription ?? ''),
    });
    setFormError('');
  };

  const handleDelete = (recordId: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      setDeleteError('');
      deleteMutation.mutate(recordId);
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

    return [...records].sort((a, b) => {
      const valueA = sortColumn === 'name' ? String(a.RPGSystemName || '') : String(a.RPGSystemURL || '');
      const valueB = sortColumn === 'name' ? String(b.RPGSystemName || '') : String(b.RPGSystemURL || '');
      const normalizedA = valueA.toLowerCase();
      const normalizedB = valueB.toLowerCase();

      if (normalizedA < normalizedB) return sortDirection === 'asc' ? -1 : 1;
      if (normalizedA > normalizedB) return sortDirection === 'asc' ? 1 : -1;

      return String(a.RPGSystemName || '').toLowerCase().localeCompare(String(b.RPGSystemName || '').toLowerCase());
    });
  };

  const getSortIcon = (column: Exclude<SortColumn, null>) => {
    if (sortColumn !== column) return null;
    if (sortDirection === 'asc') return <ChevronUp className="w-4 h-4" />;
    if (sortDirection === 'desc') return <ChevronDown className="w-4 h-4" />;
    return null;
  };

  const sortedRecordValues = getSortedRecords();
  const sortedRecords = Array.isArray(sortedRecordValues) ? sortedRecordValues : [];

  return (
    <AdminLayout title="RPG Systems" subtitle="Use this screen to view, add, remove and modify the RPG systems in your collection.">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
              setFormValues({ RPGSystemName: '', RPGSystemURL: '', RPGSystemDescription: '' });
              setFormError('');
            }}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="w-4 h-4" />
            New RPG System
          </Button>
        </div>

        {isAdding || editingId !== null ? (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {editingId !== null ? 'Edit RPG System' : 'New RPG System'}
              </h2>
              <button onClick={closeForm} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            {formError ? (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                {formError}
              </div>
            ) : null}

            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setFormError('');

                const rpgSystemName = formValues.RPGSystemName.trim();
                const rpgSystemUrl = formValues.RPGSystemURL.trim();
                const rpgSystemDescription = formValues.RPGSystemDescription.trim();

                if (!rpgSystemName) {
                  setFormError('RPG System Name is required.');
                  return;
                }

                setIsSaving(true);
                try {
                  const payload = {
                    RPGSystemName: rpgSystemName,
                    RPGSystemURL: rpgSystemUrl || null,
                    RPGSystemDescription: rpgSystemDescription || null,
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
                <label className="block text-sm font-medium mb-1">RPG System Name</label>
                <Input
                  type="text"
                  value={formValues.RPGSystemName}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, RPGSystemName: event.target.value }))}
                  placeholder="Enter RPG System Name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">RPG System URL</label>
                <Input
                  type="url"
                  value={formValues.RPGSystemURL}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, RPGSystemURL: event.target.value }))}
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">RPG System Description</label>
                <textarea
                  value={formValues.RPGSystemDescription}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, RPGSystemDescription: event.target.value }))}
                  placeholder="Enter RPG System Description"
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <Button type="button" onClick={closeForm} className="bg-gray-200 text-gray-800 hover:bg-gray-300">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save RPG System'}
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
                <th className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-2">
                    Name
                    {getSortIcon('name')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition" onClick={() => handleSort('url')}>
                  <div className="flex items-center gap-2">
                    RPG System URL
                    {getSortIcon('url')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Description</th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedRecords.map((record: RPGSystem) => (
                <tr key={record.RPGSystemID} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{record.RPGSystemName}</td>
                  <td className="px-6 py-4">
                    {record.RPGSystemURL ? (
                      <a
                        href={record.RPGSystemURL}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-700 underline break-all"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {record.RPGSystemURL}
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-pre-wrap">{record.RPGSystemDescription || <span className="text-gray-400">-</span>}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => handleEdit(record)} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700">
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button onClick={() => handleDelete(String(record.RPGSystemID))} className="inline-flex items-center gap-1 text-red-600 hover:text-red-700">
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