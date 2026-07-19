import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronUp, ChevronDown } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import ComboSelect from '../components/ui/ComboSelect';
import { Dialog } from '../components/ui/Dialog';
import SetupTablePagination from '../components/SetupTablePagination';
import useModalFocusTrap from '../hooks/useModalFocusTrap';
import useSetupPagination from '../hooks/useSetupPagination';
import { tableAPI } from '../services/api';

interface CollectionRPGSystem {
  [key: string]: any;
}

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'collection' | 'rpgSystem' | null;

export default function CollectionRPGSystemsPage() {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CollectionRPGSystem | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [sortColumn, setSortColumn] = useState<SortColumn>('collection');
  const [formValues, setFormValues] = useState({ CollectionID: '', RPGSystemID: '' });
  const [filterInputs, setFilterInputs] = useState({ collectionName: '', rpgSystemName: '' });
  const [activeFilters, setActiveFilters] = useState({ collectionName: '', rpgSystemName: '' });
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useModalFocusTrap<HTMLDivElement>(isAdding || isEditing, () => closeForm());
  const queryClient = useQueryClient();
  const tableName = 'CollectionRPGSystem';

  const { data: records = [], isLoading, error } = useQuery<any, Error>({
    queryKey: ['table', tableName],
    queryFn: async () => {
      return tableAPI.getAllRecords(tableName);
    },
  });

  const { data: rpgSystemRecords = [] } = useQuery<any, Error>({
    queryKey: ['table', 'RPGSystem'],
    queryFn: async () => {
      const response = await tableAPI.getTableData('RPGSystem', 1, 500);
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

  const { data: collectionTypeRecords = [] } = useQuery<any, Error>({
    queryKey: ['table', 'CollectionType'],
    queryFn: async () => {
      const response = await tableAPI.getTableData('CollectionType', 1, 500);
      return response.data.data;
    },
  });

  const collectionTypeNameById = (collectionTypeRecords || []).reduce((map: Record<number, string>, item: any) => {
    if (item?.CollectionTypeID != null) {
      map[Number(item.CollectionTypeID)] = item.CollectionTypeName ?? String(item.CollectionTypeID);
    }
    return map;
  }, {});

  const collectionNameById = (collectionRecords || []).reduce((map: Record<number, string>, item: any) => {
    if (item?.CollectionID != null) {
      const collectionName = String(item.CollectionName ?? item.CollectionID);
      const collectionTypeName = collectionTypeNameById[Number(item.CollectionTypeID)] ?? String(item.CollectionTypeName ?? '');
      map[Number(item.CollectionID)] = collectionTypeName ? `${collectionName} (${collectionTypeName})` : collectionName;
    }
    return map;
  }, {});

  const rpgSystemNameById = (rpgSystemRecords || []).reduce((map: Record<number, string>, item: any) => {
    if (item?.RPGSystemID != null) {
      map[Number(item.RPGSystemID)] = item.RPGSystemName ?? String(item.RPGSystemID);
    }
    return map;
  }, {});

  const getCollectionLabel = (collection: any) => {
    const collectionName = String(collection?.CollectionName ?? '').trim();
    const collectionTypeName = collectionTypeNameById[Number(collection?.CollectionTypeID)] ?? String(collection?.CollectionTypeName ?? '');
    return collectionTypeName ? `${collectionName} (${collectionTypeName})` : collectionName;
  };

  const rpgCollectionRecords = (collectionRecords || []).filter((collection: any) => {
    const collectionTypeName = collectionTypeNameById[Number(collection?.CollectionTypeID)] ?? String(collection?.CollectionTypeName ?? '');
    return collectionTypeName.trim().toLowerCase() === 'rpg';
  });

  const collectionOptions = rpgCollectionRecords.map((collection: any) => ({
    value: String(collection.CollectionID || ''),
    label: getCollectionLabel(collection),
  }));

  const rpgSystemOptions = (rpgSystemRecords || []).map((rpgSystem: any) => ({
    value: String(rpgSystem.RPGSystemID || ''),
    label: String(rpgSystem.RPGSystemName || ''),
  })).sort((a: { value: string; label: string }, b: { value: string; label: string }) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  );

  const hasFilterChanges =
    filterInputs.collectionName !== activeFilters.collectionName ||
    filterInputs.rpgSystemName !== activeFilters.rpgSystemName;

  const deleteMutation = useMutation({
    mutationFn: async (payload: number | string | { collectionId: number; rpgSystemId: number }) => {
      return await tableAPI.deleteRecord(tableName, payload);
    },
    onSuccess: () => {
      setDeleteError('');
      closeForm();
      queryClient.invalidateQueries({ queryKey: ['table', tableName] });
    },
    onError: (error: any) => {
      const backendError = String(error?.response?.data?.error || error?.message || '').trim();
      setDeleteError(backendError || 'Delete failed. Please try again.');
    },
  });

  const handleDelete = (record: CollectionRPGSystem) => {
    if (!confirm('Are you sure you want to delete this record?')) {
      return;
    }

    setDeleteError('');

    if (record.CollectionRPGSystemID != null) {
      deleteMutation.mutate(record.CollectionRPGSystemID);
    } else {
      deleteMutation.mutate({
        collectionId: Number(record.CollectionID),
        rpgSystemId: Number(record.RPGSystemID),
      });
    }
  };

  const handleEdit = (record: CollectionRPGSystem) => {
    setIsAdding(false);
    setIsEditing(true);
    setEditingRecord(record);
    setFormValues({
      CollectionID: String(record.CollectionID ?? ''),
      RPGSystemID: String(record.RPGSystemID ?? ''),
    });
    setFormError('');
  };

  const getNewFormValuesFromFilters = () => ({
    CollectionID: activeFilters.collectionName,
    RPGSystemID: activeFilters.rpgSystemName,
  });

  const closeForm = () => {
    setIsAdding(false);
    setIsEditing(false);
    setEditingRecord(null);
    setFormValues({ CollectionID: '', RPGSystemID: '' });
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
    if (!Array.isArray(records)) {
      return [];
    }

    const collectionFilterId = parseInt(activeFilters.collectionName, 10);
    const rpgSystemFilterId = parseInt(activeFilters.rpgSystemName, 10);

    const filteredRecords = records.filter((record: CollectionRPGSystem) => {
      const collectionId = Number(record.CollectionID);
      const rpgSystemId = Number(record.RPGSystemID);

      const collectionMatches = !Number.isInteger(collectionFilterId) || collectionId === collectionFilterId;
      const rpgSystemMatches = !Number.isInteger(rpgSystemFilterId) || rpgSystemId === rpgSystemFilterId;

      return collectionMatches && rpgSystemMatches;
    });

    if (!sortDirection || !sortColumn) {
      return filteredRecords;
    }

    return [...filteredRecords].sort((a, b) => {
      const valueA =
        sortColumn === 'collection'
          ? (collectionNameById[Number(a.CollectionID)] ?? String(a.CollectionID))
          : (rpgSystemNameById[Number(a.RPGSystemID)] ?? String(a.RPGSystemID));
      const valueB =
        sortColumn === 'collection'
          ? (collectionNameById[Number(b.CollectionID)] ?? String(b.CollectionID))
          : (rpgSystemNameById[Number(b.RPGSystemID)] ?? String(b.RPGSystemID));

      return sortDirection === 'asc'
        ? String(valueA).toLowerCase().localeCompare(String(valueB).toLowerCase())
        : String(valueB).toLowerCase().localeCompare(String(valueA).toLowerCase());
    });
  };

  const applyFilters = () => {
    setActiveFilters({
      collectionName: filterInputs.collectionName,
      rpgSystemName: filterInputs.rpgSystemName,
    });
  };

  const clearFilters = () => {
    setFilterInputs({ collectionName: '', rpgSystemName: '' });
    setActiveFilters({ collectionName: '', rpgSystemName: '' });
  };

  const getSortIcon = (column: Exclude<SortColumn, null>) => {
    if (sortColumn !== column) return null;
    if (sortDirection === 'asc') return <ChevronUp className="w-4 h-4" />;
    if (sortDirection === 'desc') return <ChevronDown className="w-4 h-4" />;
    return null;
  };

  const sortedRecords = getSortedRecords();
  const pagination = useSetupPagination(sortedRecords, [activeFilters.collectionName, activeFilters.rpgSystemName, sortColumn, sortDirection]);

  return (
    <AdminLayout title="Collection / RPG Systems" subtitle="Use this screen to view, add, remove and modify collection and RPG system relationships.">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 bg-white p-4 rounded-lg shadow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Collection Name</label>
              <ComboSelect
                options={collectionOptions}
                value={filterInputs.collectionName}
                onChange={(value) => setFilterInputs((prev) => ({ ...prev, collectionName: value }))}
                placeholder="Select RPG collection"
                className="w-full"
                tabIndex={1}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">RPG System Name</label>
              <ComboSelect
                options={rpgSystemOptions}
                value={filterInputs.rpgSystemName}
                onChange={(value) => setFilterInputs((prev) => ({ ...prev, rpgSystemName: value }))}
                placeholder="Select RPG system"
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
                setFormValues(getNewFormValuesFromFilters());
                setFormError('');
              }}
              className="gap-2 bg-green-600 hover:bg-green-700"
              tabIndex={999}
            >
              <Plus className="w-4 h-4" />
              Add New Collection / RPG System
            </Button>
            <Button onClick={applyFilters} tabIndex={3} disabled={!hasFilterChanges}>Apply Filters</Button>
            <Button onClick={clearFilters} className="bg-gray-600 hover:bg-gray-700" tabIndex={4} disabled={!hasFilterChanges}>
              Clear
            </Button>
          </div>
        </div>

        {isAdding || isEditing ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div ref={modalRef} tabIndex={-1} className="w-full max-w-2xl bg-white p-6 rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">{isEditing ? 'Edit Collection / RPG System' : 'New Collection / RPG System'}</h2>
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

                if (!formValues.CollectionID || !formValues.RPGSystemID) {
                  setFormError('Please select both an RPG collection and an RPG system.');
                  return;
                }

                const collectionId = parseInt(formValues.CollectionID, 10);
                const rpgSystemId = parseInt(formValues.RPGSystemID, 10);
                const selectedCollection = rpgCollectionRecords.find((collection: any) => Number(collection.CollectionID) === collectionId);

                if (!selectedCollection) {
                  setFormError('Only collections with Collection Type RPG can be linked to an RPG system.');
                  return;
                }

                const duplicateExists = (records || []).some(
                  (record: any) =>
                    Number(record.CollectionID) === collectionId &&
                    Number(record.RPGSystemID) === rpgSystemId &&
                    (
                      !isEditing ||
                      !editingRecord ||
                      record.CollectionRPGSystemID !== editingRecord.CollectionRPGSystemID ||
                      (Number(record.CollectionID) !== Number(editingRecord.CollectionID) || Number(record.RPGSystemID) !== Number(editingRecord.RPGSystemID))
                    )
                );

                if (duplicateExists) {
                  setFormError('That collection/RPG system pair already exists.');
                  return;
                }

                setIsSaving(true);
                try {
                  if (isEditing && editingRecord) {
                    if (editingRecord.CollectionRPGSystemID != null) {
                      await tableAPI.updateRecord(tableName, editingRecord.CollectionRPGSystemID, {
                        CollectionID: collectionId,
                        RPGSystemID: rpgSystemId,
                      });
                    } else {
                      const isSamePair =
                        Number(editingRecord.CollectionID) === collectionId &&
                        Number(editingRecord.RPGSystemID) === rpgSystemId;

                      if (!isSamePair) {
                        await tableAPI.createRecord(tableName, {
                          CollectionID: collectionId,
                          RPGSystemID: rpgSystemId,
                        });

                        await tableAPI.deleteRecord(tableName, {
                          collectionId: Number(editingRecord.CollectionID),
                          rpgSystemId: Number(editingRecord.RPGSystemID),
                        });
                      }
                    }
                  } else {
                    await tableAPI.createRecord(tableName, {
                      CollectionID: collectionId,
                      RPGSystemID: rpgSystemId,
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
                <label className="block text-sm font-medium mb-1">Collection Name</label>
                <ComboSelect
                  options={collectionOptions}
                  value={formValues.CollectionID}
                  onChange={(value) => setFormValues((prev) => ({ ...prev, CollectionID: value }))}
                  placeholder="Select RPG collection"
                  className="w-full"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">RPG System Name</label>
                <ComboSelect
                  options={rpgSystemOptions}
                  value={formValues.RPGSystemID}
                  onChange={(value) => setFormValues((prev) => ({ ...prev, RPGSystemID: value }))}
                  placeholder="Select RPG system"
                  className="w-full"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-6">
                <div>
                  {isEditing && editingRecord ? (
                    <Button type="button" onClick={() => handleDelete(editingRecord)} disabled={deleteMutation.isLoading || isSaving} className="bg-red-600 hover:bg-red-700">
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
                <th className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition" onClick={() => handleSort('collection')} tabIndex={5}>
                  <div className="flex items-center gap-2">
                    Collection Name
                    {getSortIcon('collection')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition" onClick={() => handleSort('rpgSystem')} tabIndex={6}>
                  <div className="flex items-center gap-2">
                    RPG System Name
                    {getSortIcon('rpgSystem')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagination.paginatedRows.map((record: CollectionRPGSystem, index: number) => (
                <tr key={record.CollectionRPGSystemID ?? `${record.CollectionID}-${record.RPGSystemID}-${index}`} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleEdit(record)}>
                  <td className="px-6 py-4">{collectionNameById[Number(record.CollectionID)] ?? record.CollectionID}</td>
                  <td className="px-6 py-4">{rpgSystemNameById[Number(record.RPGSystemID)] ?? record.RPGSystemID}</td>
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