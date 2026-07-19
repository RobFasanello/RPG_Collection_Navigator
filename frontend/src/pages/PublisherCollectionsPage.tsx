import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronUp, ChevronDown } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import ComboSelect from '../components/ui/ComboSelect';
import { Dialog } from '../components/ui/Dialog';
import useModalFocusTrap from '../hooks/useModalFocusTrap';
import { tableAPI } from '../services/api';

interface PublisherCollection {
  [key: string]: any;
}

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'publisher' | 'collection' | 'itemCount' | null;

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

export default function PublisherCollectionsPage() {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PublisherCollection | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [sortColumn, setSortColumn] = useState<SortColumn>('publisher');
  const [formValues, setFormValues] = useState({ PublisherID: '', CollectionID: '' });
  const [filterInputs, setFilterInputs] = useState({ publisherName: '', collectionName: '' });
  const [activeFilters, setActiveFilters] = useState({ publisherName: '', collectionName: '' });
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useModalFocusTrap<HTMLDivElement>(isAdding || isEditing, () => closeForm());
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

  const { data: collectionTypeRecords = [] } = useQuery<any, Error>({
    queryKey: ['table', 'CollectionType'],
    queryFn: async () => {
      const response = await tableAPI.getTableData('CollectionType', 1, 500);
      return response.data.data;
    },
  });

  const { data: allItems = [] } = useQuery<any, Error>({
    queryKey: ['table', 'Item', 'all-for-link-counts'],
    queryFn: async () => getAllTableRows('Item'),
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

  const collectionTypeNameById = (collectionTypeRecords || []).reduce(
    (map: Record<number, string>, item: any) => {
      if (item?.CollectionTypeID != null) {
        map[item.CollectionTypeID] = item.CollectionTypeName ?? String(item.CollectionTypeID);
      }
      return map;
    },
    {}
  );

  const collectionNameById = (collectionRecords || []).reduce(
    (map: Record<number, string>, item: any) => {
      if (item?.CollectionID != null) {
        const collectionName = String(item.CollectionName ?? item.CollectionID);
        const collectionTypeName = collectionTypeNameById[item.CollectionTypeID] ?? '';
        map[item.CollectionID] = collectionTypeName ? `${collectionName} (${collectionTypeName})` : collectionName;
      }
      return map;
    },
    {}
  );

  const getCollectionLabel = (collection: any) => {
    const collectionName = String(collection?.CollectionName ?? '').trim();
    const collectionTypeName = collectionTypeNameById[collection?.CollectionTypeID] ?? '';
    if (!collectionTypeName) {
      return collectionName;
    }
    return `${collectionName} (${collectionTypeName})`;
  };

  const publisherFilterOptions = (publisherRecords || []).map((publisher: any) => ({
    value: String(publisher.PublisherName || ''),
    label: String(publisher.PublisherName || ''),
  })).sort((a: { value: string; label: string }, b: { value: string; label: string }) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  );

  const collectionFilterOptions = (collectionRecords || []).map((collection: any) => ({
    value: String(collection.CollectionID || ''),
    label: getCollectionLabel(collection),
  }));

  const publisherFormOptions = (publisherRecords || []).map((publisher: any) => ({
    value: String(publisher.PublisherID || ''),
    label: String(publisher.PublisherName || ''),
  })).sort((a: { value: string; label: string }, b: { value: string; label: string }) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  );

  const collectionFormOptions = (collectionRecords || []).map((collection: any) => ({
    value: String(collection.CollectionID || ''),
    label: getCollectionLabel(collection),
  }));

  const hasFilterChanges =
    filterInputs.publisherName !== activeFilters.publisherName ||
    filterInputs.collectionName !== activeFilters.collectionName;

  const itemCountByPublisherCollection = (allItems || []).reduce((map: Record<string, number>, item: any) => {
    const publisherId = Number(item?.PublisherID);
    const collectionId = Number(item?.CollectionID);

    if (!Number.isFinite(publisherId) || !Number.isFinite(collectionId)) {
      return map;
    }

    const key = `${publisherId}:${collectionId}`;
    map[key] = (map[key] || 0) + 1;
    return map;
  }, {});

  const deleteMutation = useMutation({
    mutationFn: async (payload: number | string | { publisherId: number; collectionId: number }) => {
      return await tableAPI.deleteRecord(tableName, payload);
    },
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

      if (referentialIntegrityConflict) {
        setDeleteError(
          backendError ||
            'Delete failed. This publisher/collection pair is still referenced by one or more items. Reassign or remove the linked items first, then try again.'
        );
        return;
      }

      setDeleteError(backendError || 'Delete failed. Please try again.');
    },
  });

  const handleDelete = (record: PublisherCollection) => {
    if (!confirm('Are you sure you want to delete this record?')) {
      return;
    }

    setDeleteError('');

    if (record.PublisherCollectionID != null) {
      deleteMutation.mutate(record.PublisherCollectionID);
    } else {
      deleteMutation.mutate({
        publisherId: Number(record.PublisherID),
        collectionId: Number(record.CollectionID),
      });
    }
  };

  const handleEdit = (record: PublisherCollection) => {
    setIsAdding(false);
    setIsEditing(true);
    setEditingRecord(record);
    setFormValues({
      PublisherID: String(record.PublisherID ?? ''),
      CollectionID: String(record.CollectionID ?? ''),
    });
    setFormError('');
  };

  const getNewFormValuesFromFilters = () => {
    const publisher = (publisherRecords || []).find(
      (record: any) => String(record.PublisherName || '') === activeFilters.publisherName
    );

    return {
      PublisherID: publisher?.PublisherID != null ? String(publisher.PublisherID) : '',
      CollectionID: activeFilters.collectionName,
    };
  };

  const closeForm = () => {
    setIsAdding(false);
    setIsEditing(false);
    setEditingRecord(null);
    setFormValues({ PublisherID: '', CollectionID: '' });
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

    const publisherFilter = activeFilters.publisherName.trim().toLowerCase();
    const collectionFilterId = parseInt(activeFilters.collectionName, 10);

    const filteredRecords = records.filter((record: PublisherCollection) => {
      const publisherName = String(publisherNameById[record.PublisherID] ?? record.PublisherID).toLowerCase();
      const collectionId = Number(record.CollectionID);

      const publisherMatches = !publisherFilter || publisherName.includes(publisherFilter);
      const collectionMatches = !Number.isInteger(collectionFilterId) || collectionId === collectionFilterId;

      return publisherMatches && collectionMatches;
    });

    if (!sortDirection || !sortColumn) {
      return filteredRecords;
    }

    const sorted = [...filteredRecords].sort((a, b) => {
      if (sortColumn === 'itemCount') {
        const countA = itemCountByPublisherCollection[`${Number(a.PublisherID)}:${Number(a.CollectionID)}`] || 0;
        const countB = itemCountByPublisherCollection[`${Number(b.PublisherID)}:${Number(b.CollectionID)}`] || 0;

        if (countA < countB) return sortDirection === 'asc' ? -1 : 1;
        if (countA > countB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      }

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

  const applyFilters = () => {
    setActiveFilters({
      publisherName: filterInputs.publisherName,
      collectionName: filterInputs.collectionName,
    });
  };

  const clearFilters = () => {
    setFilterInputs({ publisherName: '', collectionName: '' });
    setActiveFilters({ publisherName: '', collectionName: '' });
  };

  const getSortIcon = (column: Exclude<SortColumn, null>) => {
    if (sortColumn !== column) return null;
    if (sortDirection === 'asc') return <ChevronUp className="w-4 h-4" />;
    if (sortDirection === 'desc') return <ChevronDown className="w-4 h-4" />;
    return null;
  };

  return (
    <AdminLayout title="Publisher / Collections" subtitle="Use this screen to view, add, remove and modify the publisher and collection relationships used by your collection.">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 bg-white p-4 rounded-lg shadow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Publisher Name</label>
              <ComboSelect
                options={publisherFilterOptions}
                value={filterInputs.publisherName}
                onChange={(value) => setFilterInputs((prev) => ({ ...prev, publisherName: value }))}
                placeholder="Select publisher"
                className="w-full"
                tabIndex={1}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Collection Name</label>
              <ComboSelect
                options={collectionFilterOptions}
                value={filterInputs.collectionName}
                onChange={(value) => setFilterInputs((prev) => ({ ...prev, collectionName: value }))}
                placeholder="Select collection"
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
              Add New Publisher Collection
            </Button>
            <Button onClick={applyFilters} tabIndex={3} disabled={!hasFilterChanges}>Apply Filters</Button>
            <Button
              onClick={clearFilters}
              className="bg-gray-600 hover:bg-gray-700"
              tabIndex={4}
              disabled={!hasFilterChanges}
            >
              Clear
            </Button>
          </div>
        </div>

        {isAdding || isEditing ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div ref={modalRef} tabIndex={-1} className="w-full max-w-2xl bg-white p-6 rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">{isEditing ? 'Edit Publisher Collection' : 'New Publisher Collection'}</h2>
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
                    record.PublisherID === publisherId &&
                    record.CollectionID === collectionId &&
                    (
                      !isEditing ||
                      !editingRecord ||
                      record.PublisherCollectionID !== editingRecord.PublisherCollectionID ||
                      (Number(record.PublisherID) !== Number(editingRecord.PublisherID) || Number(record.CollectionID) !== Number(editingRecord.CollectionID))
                    )
                );

                if (duplicateExists) {
                  setFormError('That publisher/collection pair already exists.');
                  return;
                }

                setIsSaving(true);
                try {
                  if (isEditing && editingRecord) {
                    if (editingRecord.PublisherCollectionID != null) {
                      await tableAPI.updateRecord(tableName, editingRecord.PublisherCollectionID, {
                        PublisherID: publisherId,
                        CollectionID: collectionId,
                      });
                    } else {
                      const isSamePair =
                        Number(editingRecord.PublisherID) === publisherId &&
                        Number(editingRecord.CollectionID) === collectionId;

                      if (!isSamePair) {
                        await tableAPI.createRecord(tableName, {
                          PublisherID: publisherId,
                          CollectionID: collectionId,
                        });

                        await tableAPI.deleteRecord(tableName, {
                          publisherId: Number(editingRecord.PublisherID),
                          collectionId: Number(editingRecord.CollectionID),
                        });
                      }
                    }
                  } else {
                    await tableAPI.createRecord(tableName, {
                      PublisherID: publisherId,
                      CollectionID: collectionId,
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
                <label className="block text-sm font-medium mb-1">Publisher Name</label>
                <ComboSelect
                  options={publisherFormOptions}
                  value={formValues.PublisherID}
                  onChange={(value) => setFormValues((prev) => ({ ...prev, PublisherID: value }))}
                  placeholder="Select publisher"
                  className="w-full"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Collection Name</label>
                <ComboSelect
                  options={collectionFormOptions}
                  value={formValues.CollectionID}
                  onChange={(value) => setFormValues((prev) => ({ ...prev, CollectionID: value }))}
                  placeholder="Select collection"
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
                <th 
                  className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition"
                  onClick={() => handleSort('publisher')}
                  tabIndex={5}
                >
                  <div className="flex items-center gap-2">
                    Publisher Name
                    {getSortIcon('publisher')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition"
                  onClick={() => handleSort('collection')}
                  tabIndex={6}
                >
                  <div className="flex items-center gap-2">
                    Collection Name
                    {getSortIcon('collection')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-gray-200 transition"
                  onClick={() => handleSort('itemCount')}
                  tabIndex={7}
                >
                  <div className="flex items-center justify-end gap-2">
                    Item Count
                    {getSortIcon('itemCount')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Array.isArray(getSortedRecords()) && getSortedRecords().map((record: PublisherCollection, idx: number) => (
                <tr key={record.PublisherCollectionID ?? `${record.PublisherID}-${record.CollectionID}-${idx}`} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleEdit(record)}>
                  <td className="px-6 py-4">{publisherNameById[record.PublisherID] ?? record.PublisherID}</td>
                  <td className="px-6 py-4">{collectionNameById[record.CollectionID] ?? record.CollectionID}</td>
                  <td className="px-6 py-4 text-right">
                    {(itemCountByPublisherCollection[`${Number(record.PublisherID)}:${Number(record.CollectionID)}`] || 0).toLocaleString()}
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
