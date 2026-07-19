import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import AdminLayout from './AdminLayout';
import RecordForm from './RecordForm';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Input } from './ui/Input';
import { tableAPI } from '../services/api';

type SortDirection = 'asc' | 'desc' | null;

type SetupLookupPageProps = {
  title: string;
  subtitle: string;
  tableName: string;
  idColumn: string;
  nameColumn: string;
  nameHeader: string;
  filterLabel: string;
  filterPlaceholder: string;
  newButtonLabel: string;
  newTitle: string;
  editTitle: string;
  deleteConflictMessage: string;
};

export default function SetupLookupPage({
  title,
  subtitle,
  tableName,
  idColumn,
  nameColumn,
  nameHeader,
  filterLabel,
  filterPlaceholder,
  newButtonLabel,
  newTitle,
  editTitle,
  deleteConflictMessage,
}: SetupLookupPageProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [filterInput, setFilterInput] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const queryClient = useQueryClient();

  const { data: records = [], isLoading, error } = useQuery<any, Error>({
    queryKey: ['table', tableName],
    queryFn: async () => {
      const response = await tableAPI.getRecords(tableName);
      return response.data.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (recordId: number | string) => tableAPI.deleteRecord(tableName, recordId),
    onSuccess: () => {
      setDeleteError('');
      setEditingId(null);
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

      setDeleteError(referentialIntegrityConflict ? deleteConflictMessage : backendError || 'Delete failed. Please try again.');
    },
  });

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
  };

  const handleDelete = () => {
    if (editingId !== null && confirm('Are you sure you want to delete this record?')) {
      setDeleteError('');
      deleteMutation.mutate(editingId);
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

  const sortedRecords = Array.isArray(records)
    ? records
        .filter((record: any) => String(record[nameColumn] || '').toLowerCase().includes(activeFilter.trim().toLowerCase()))
        .sort((a: any, b: any) => {
          if (!sortDirection) {
            return 0;
          }

          const nameA = String(a[nameColumn] || '').toLowerCase();
          const nameB = String(b[nameColumn] || '').toLowerCase();
          return sortDirection === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        })
    : [];

  const getSortIcon = () => {
    if (sortDirection === 'asc') return <ChevronUp className="w-4 h-4" />;
    if (sortDirection === 'desc') return <ChevronDown className="w-4 h-4" />;
    return null;
  };

  const hasFilterChanges = filterInput !== activeFilter;

  return (
    <AdminLayout title={title} subtitle={subtitle}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 bg-white p-4 rounded-lg shadow space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{filterLabel}</label>
            <Input
              type="text"
              value={filterInput}
              onChange={(event) => setFilterInput(event.target.value)}
              placeholder={filterPlaceholder}
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button onClick={() => setActiveFilter(filterInput)} disabled={!hasFilterChanges}>
              Apply Filters
            </Button>
            <Button
              onClick={() => {
                setFilterInput('');
                setActiveFilter('');
              }}
              className="bg-gray-600 hover:bg-gray-700"
              disabled={!filterInput && !activeFilter}
            >
              Clear
            </Button>
            <Button
              onClick={() => {
                setIsAdding(true);
                setEditingId(null);
              }}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Plus className="w-4 h-4" />
              {newButtonLabel}
            </Button>
          </div>
        </div>

        {isAdding || editingId !== null ? (
          <RecordForm
            tableName={tableName}
            recordId={editingId ?? undefined}
            title={editingId !== null ? editTitle : newTitle}
            onClose={closeForm}
            onSuccess={() => {
              closeForm();
              queryClient.invalidateQueries({ queryKey: ['table', tableName] });
            }}
            onDelete={editingId !== null ? handleDelete : undefined}
            deleteDisabled={deleteMutation.isLoading}
          />
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
                    {nameHeader}
                    {getSortIcon()}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedRecords.map((record: any) => (
                <tr
                  key={record[idColumn]}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(String(record[idColumn]));
                  }}
                >
                  <td className="px-6 py-4">{record[nameColumn]}</td>
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