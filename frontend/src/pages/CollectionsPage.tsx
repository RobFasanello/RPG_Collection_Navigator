import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronUp, ChevronDown } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import ComboSelect from '../components/ui/ComboSelect';
import { Dialog } from '../components/ui/Dialog';
import ImageCropDialog from '../components/ImageCropDialog';
import useModalFocusTrap from '../hooks/useModalFocusTrap';
import { tableAPI } from '../services/api';

interface Collection {
  [key: string]: any;
}

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'name' | 'collectionType' | 'imageFileName' | 'imageUploadDate' | null;

export default function CollectionsPage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [filterInputs, setFilterInputs] = useState({ collectionName: '', collectionTypeId: '' });
  const [activeFilters, setActiveFilters] = useState({ collectionName: '', collectionTypeId: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [formValues, setFormValues] = useState({
    CollectionName: '',
    CollectionTypeID: '',
    ImageFileName: '',
  });
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null);
  const modalRef = useModalFocusTrap<HTMLDivElement>(isAdding || editingId !== null, () => closeForm());
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
          'Delete failed. This collection is still referenced by one or more publisher/collection links or linked items. Reassign or remove the linked records first, then try again.'
        );
        return;
      }

      setDeleteError(backendError || 'Delete failed. Please try again.');
    },
  });

  const handleDelete = () => {
    if (editingId === null) {
      return;
    }

    if (confirm('Are you sure you want to delete this record?')) {
      setDeleteError('');
      deleteMutation.mutate(editingId);
    }
  };

  const handleEdit = (record: Collection) => {
    setIsAdding(false);
    setEditingId(String(record.CollectionID));
    setFormValues({
      CollectionName: String(record.CollectionName ?? ''),
      CollectionTypeID: String(record.CollectionTypeID ?? ''),
      ImageFileName: String(record.ImageFileName ?? ''),
    });
    setSelectedImageFile(null);
    setCropSourceFile(null);
    setFormError('');
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormValues({
      CollectionName: '',
      CollectionTypeID: '',
      ImageFileName: '',
    });
    setSelectedImageFile(null);
    setCropSourceFile(null);
    setFormError('');
  };

  const handleImageFileChange = (file: File | null) => {
    if (!file) {
      setSelectedImageFile(null);
      setCropSourceFile(null);
      return;
    }

    const isWebpFile = file.name.toLowerCase().endsWith('.webp') && (!file.type || file.type === 'image/webp');
    if (!isWebpFile) {
      setSelectedImageFile(null);
      setCropSourceFile(null);
      setFormError('Image File Name must be a .webp file.');
      return;
    }

    setCropSourceFile(file);
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

    const collectionNameFilter = activeFilters.collectionName.trim().toLowerCase();
    const collectionTypeFilter = parseInt(activeFilters.collectionTypeId, 10);
    const filteredRecords = records.filter((record: Collection) => {
      const collectionName = String(record.CollectionName || '').toLowerCase();
      const collectionTypeId = Number(record.CollectionTypeID);

      return (
        (!collectionNameFilter || collectionName.includes(collectionNameFilter)) &&
        (!Number.isInteger(collectionTypeFilter) || collectionTypeId === collectionTypeFilter)
      );
    });

    if (!sortDirection) {
      return filteredRecords;
    }

    const sorted = [...filteredRecords].sort((a, b) => {
      if (sortColumn === 'imageUploadDate') {
        const dateA = Date.parse(String(a.ImageUploadDate ?? '')) || 0;
        const dateB = Date.parse(String(b.ImageUploadDate ?? '')) || 0;

        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }

      const valueA =
        sortColumn === 'collectionType'
          ? String(collectionTypeNameById[Number(a.CollectionTypeID)] ?? a.CollectionTypeID ?? '')
          : sortColumn === 'imageFileName'
            ? String(a.ImageFileName ?? '')
            : String(a.CollectionName ?? '');
      const valueB =
        sortColumn === 'collectionType'
          ? String(collectionTypeNameById[Number(b.CollectionTypeID)] ?? b.CollectionTypeID ?? '')
          : sortColumn === 'imageFileName'
            ? String(b.ImageFileName ?? '')
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

  const hasFilterChanges =
    filterInputs.collectionName !== activeFilters.collectionName ||
    filterInputs.collectionTypeId !== activeFilters.collectionTypeId;

  const formatImageUploadDate = (date?: string) => {
    if (!date) {
      return '-';
    }

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleString();
  };

  const getCollectionImageUrl = (fileName?: string) =>
    fileName ? `/api/uploads/collections/${encodeURIComponent(fileName)}` : '';

  return (
    <AdminLayout title="Collections" subtitle="Use this screen to view, add, remove and modify the collections in your collection.">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 bg-white p-4 rounded-lg shadow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Collection Name</label>
              <Input
                type="text"
                value={filterInputs.collectionName}
                onChange={(event) => setFilterInputs((prev) => ({ ...prev, collectionName: event.target.value }))}
                placeholder="Filter by collection name"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Collection Type</label>
              <ComboSelect
                options={collectionTypeOptions}
                value={filterInputs.collectionTypeId}
                onChange={(value) => setFilterInputs((prev) => ({ ...prev, collectionTypeId: value }))}
                placeholder="Filter by collection type"
                className="w-full"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button onClick={() => setActiveFilters(filterInputs)} disabled={!hasFilterChanges}>Apply Filters</Button>
            <Button
              onClick={() => {
                setFilterInputs({ collectionName: '', collectionTypeId: '' });
                setActiveFilters({ collectionName: '', collectionTypeId: '' });
              }}
              className="bg-gray-600 hover:bg-gray-700"
              disabled={!filterInputs.collectionName && !filterInputs.collectionTypeId && !activeFilters.collectionName && !activeFilters.collectionTypeId}
            >
              Clear
            </Button>
            <Button
              onClick={() => {
                setIsAdding(true);
                setEditingId(null);
                setFormValues({ CollectionName: '', CollectionTypeID: '', ImageFileName: '' });
                setSelectedImageFile(null);
                setCropSourceFile(null);
                setFormError('');
              }}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="w-4 h-4" />
              New Collection
            </Button>
          </div>
        </div>

        {isAdding || editingId !== null ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div ref={modalRef} tabIndex={-1} className="w-full max-w-2xl bg-white p-6 rounded-lg shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {editingId !== null ? 'Edit Collection' : 'New Collection'}
              </h2>
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
                  const payload = new FormData();
                  payload.append('CollectionName', collectionName);
                  payload.append('CollectionTypeID', String(collectionTypeId));

                  if (selectedImageFile) {
                    payload.append('ImageFile', selectedImageFile);
                  }

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
                  autoFocus
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

              <div>
                <label className="block text-sm font-medium mb-1">Image File Name</label>
                <Input
                  type="file"
                  accept=".webp,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null;
                    handleImageFileChange(file);
                    const isWebpFile = file?.name.toLowerCase().endsWith('.webp') && (!file.type || file.type === 'image/webp');
                    if (file && !isWebpFile) {
                      e.target.value = '';
                    }
                    if (file) {
                      e.target.value = '';
                    }
                  }}
                />
                {selectedImageFile ? (
                  <p className="mt-1 text-sm text-gray-600">Selected: {selectedImageFile.name}</p>
                ) : formValues.ImageFileName ? (
                  <p className="mt-1 text-sm text-gray-600">
                    Current:{' '}
                    <a
                      href={getCollectionImageUrl(formValues.ImageFileName)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      {formValues.ImageFileName}
                    </a>
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-6">
                <div>
                  {editingId !== null ? (
                    <Button type="button" onClick={handleDelete} disabled={deleteMutation.isLoading || isSaving} className="bg-red-600 hover:bg-red-700">
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
                    {isSaving ? 'Saving...' : 'Save Collection'}
                  </Button>
                </div>
              </div>
            </form>
            </div>
          </div>
        ) : null}

        {cropSourceFile ? (
          <ImageCropDialog
            file={cropSourceFile}
            title="Crop Collection Image"
            onApply={(croppedFile) => {
              setSelectedImageFile(croppedFile);
              setCropSourceFile(null);
              setFormError('');
            }}
            onCancel={() => setCropSourceFile(null)}
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
                <th
                  className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition"
                  onClick={() => handleSort('imageFileName')}
                >
                  <div className="flex items-center gap-2">
                    Image File Name
                    {getSortIcon('imageFileName')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition"
                  onClick={() => handleSort('imageUploadDate')}
                >
                  <div className="flex items-center gap-2">
                    Image Upload Date
                    {getSortIcon('imageUploadDate')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Array.isArray(getSortedRecords()) && getSortedRecords().map((record: Collection) => (
                <tr key={record.CollectionID} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleEdit(record)}>
                  <td className="px-6 py-4">{record.CollectionName}</td>
                  <td className="px-6 py-4">
                    {collectionTypeNameById[Number(record.CollectionTypeID)] ?? `ID: ${record.CollectionTypeID ?? '-'}`}
                  </td>
                  <td className="px-6 py-4">
                    {record.ImageFileName ? (
                      <a
                        href={getCollectionImageUrl(record.ImageFileName)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-700 underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {record.ImageFileName}
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-6 py-4">{formatImageUploadDate(record.ImageUploadDate)}</td>
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
