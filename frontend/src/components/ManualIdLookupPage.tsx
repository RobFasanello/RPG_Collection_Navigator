import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import AdminLayout from './AdminLayout';
import SetupTablePagination from './SetupTablePagination';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { Input } from './ui/Input';
import useModalFocusTrap from '../hooks/useModalFocusTrap';
import useSetupPagination from '../hooks/useSetupPagination';
import { tableAPI } from '../services/api';

type SortDirection = 'asc' | 'desc' | null;

type ManualIdLookupPageProps = {
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
  nameLabel: string;
  namePlaceholder: string;
  deleteConflictMessage: string;
};

export default function ManualIdLookupPage({
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
  nameLabel,
  namePlaceholder,
  deleteConflictMessage,
}: ManualIdLookupPageProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Record<string, any> | null>(null);
  const [filterInput, setFilterInput] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [formValues, setFormValues] = useState({ name: '' });
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const modalRef = useModalFocusTrap<HTMLDivElement>(isAdding || editingRecord !== null, () => closeForm());
  const queryClient = useQueryClient();

  const { data: records = [], isLoading, error } = useQuery<any, Error>({
    queryKey: ['table', tableName],
    queryFn: async () => {
      return tableAPI.getAllRecords(tableName);
    },
  });

  useEffect(() => {
    if (!editingRecord) {
      return;
    }

    setFormValues({
      name: String(editingRecord[nameColumn] ?? '').trim(),
    });
  }, [editingRecord, nameColumn]);

  const deleteMutation = useMutation({
    mutationFn: async (recordId: number | string) => tableAPI.deleteRecord(tableName, recordId),
    onSuccess: () => {
      setDeleteError('');
      closeForm();
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
    setEditingRecord(null);
    setFormValues({ name: '' });
    setFormError('');
  };

  const openAddForm = () => {
    setIsAdding(true);
    setEditingRecord(null);
    setFormValues({ name: '' });
    setFormError('');
  };

  const handleDelete = () => {
    if (!editingRecord || !confirm('Are you sure you want to delete this record?')) {
      return;
    }

    setDeleteError('');
    deleteMutation.mutate(editingRecord[idColumn]);
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
  const isEditing = editingRecord !== null;
  const pagination = useSetupPagination(sortedRecords, [activeFilter, sortDirection]);

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
            <Button onClick={openAddForm} className="gap-2 bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4" />
              {newButtonLabel}
            </Button>
          </div>
        </div>

        {isAdding || isEditing ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div ref={modalRef} tabIndex={-1} className="w-full max-w-2xl bg-white p-6 rounded-lg shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">{isEditing ? editTitle : newTitle}</h2>
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

                  const recordName = formValues.name.trim();

                  if (!recordName) {
                    setFormError(`${nameLabel} is required.`);
                    return;
                  }

                  setIsSaving(true);
                  try {
                    if (isEditing && editingRecord) {
                      await tableAPI.updateRecord(tableName, editingRecord[idColumn], {
                        [idColumn]: editingRecord[idColumn],
                        [nameColumn]: recordName,
                      });
                    } else {
                      await tableAPI.createRecord(tableName, {
                        [nameColumn]: recordName,
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
                  <label className="block text-sm font-medium mb-1">{nameLabel}</label>
                  <Input
                    type="text"
                    value={formValues.name}
                    onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder={namePlaceholder}
                    required
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-6">
                  <div>
                    {isEditing ? (
                      <Button type="button" onClick={handleDelete} disabled={deleteMutation.isLoading || isSaving} className="bg-red-600 hover:bg-red-700">
                        Delete
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" onClick={closeForm} className="bg-gray-200 text-gray-800 hover:bg-gray-300">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSaving}>
                      {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Save'}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {isLoading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-600">Error loading records</p>}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition" onClick={handleNameSort}>
                  <div className="flex items-center gap-2">
                    {nameHeader}
                    {getSortIcon()}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagination.paginatedRows.map((record: any) => (
                <tr
                  key={record[idColumn]}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingRecord(record);
                    setFormError('');
                  }}
                >
                  <td className="px-6 py-4">{String(record[nameColumn] ?? '').trim()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SetupTablePagination
          currentCount={pagination.paginatedRows.length}
          total={pagination.total}
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
        />

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
