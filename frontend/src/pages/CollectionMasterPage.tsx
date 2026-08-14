import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import ComboSelect from '../components/ui/ComboSelect';
import { Dialog } from '../components/ui/Dialog';
import ImageCropDialog from '../components/ImageCropDialog';
import AdminLayout from '../components/AdminLayout';
import { tableAPI } from '../services/api';

interface CollectionRecord {
  [key: string]: any;
  CollectionID?: number;
  CollectionName?: string;
  CollectionTypeID?: number | null;
  CollectionTypeName?: string | null;
  ImageFileName?: string | null;
  ImageUploadDate?: string | null;
}

interface CollectionRPGSystemRecord {
  [key: string]: any;
  CollectionRPGSystemID?: number;
  CollectionID?: number;
  RPGSystemID?: number;
}

interface RPGSystemRecord {
  [key: string]: any;
  RPGSystemID?: number;
  RPGSystemName?: string;
}

interface CollectionTypeRecord {
  [key: string]: any;
  CollectionTypeID?: number;
  CollectionTypeName?: string;
}

interface ItemRecord {
  [key: string]: any;
  ItemID?: number;
  CollectionID?: number;
}

type Mode = 'existing' | 'new';
type EditorTab = 'details' | 'rpg-systems';

const emptyFormValues = {
  CollectionName: '',
  CollectionTypeID: '',
  ImageFileName: '',
};

function SidebarListSkeleton() {
  return (
    <div className="space-y-2 p-2" aria-label="Loading collections list">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] px-4 py-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
          <div className="mt-2 flex justify-end">
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

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

function getCollectionImageUrl(fileName?: string | null) {
  return fileName ? `/api/uploads/collections/${encodeURIComponent(fileName)}` : '';
}

function buildCollectionInventoryLink(collectionName: string, ownedOnly: boolean) {
  const params = new URLSearchParams();
  params.set('collection', collectionName);
  if (ownedOnly) {
    params.set('hasPurchaseOrder', 'true');
  }

  return `/admin/inventory?${params.toString()}`;
}

export default function CollectionMasterPage() {
  const queryClient = useQueryClient();
  const [urlSearchParams] = useSearchParams();
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('existing');
  const [activeTab, setActiveTab] = useState<EditorTab>('details');
  const [searchInput, setSearchInput] = useState('');
  const [formValues, setFormValues] = useState({ ...emptyFormValues });
  const [initialFormValues, setInitialFormValues] = useState({ ...emptyFormValues });
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [rpgSystemToLinkId, setRpgSystemToLinkId] = useState('');
  const [linkError, setLinkError] = useState('');
  const [isLinkSaving, setIsLinkSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const { data: collectionRecords = [], isLoading: collectionsLoading, error: collectionsError } = useQuery<CollectionRecord[], Error>({
    queryKey: ['table', 'Collection'],
    queryFn: async () => tableAPI.getAllRecords('Collection'),
  });

  const { data: collectionTypeRecords = [] } = useQuery<CollectionTypeRecord[], Error>({
    queryKey: ['table', 'CollectionType'],
    queryFn: async () => tableAPI.getTableData('CollectionType', 1, 500).then((response) => response.data.data),
  });

  const { data: rpgSystemRecords = [] } = useQuery<RPGSystemRecord[], Error>({
    queryKey: ['table', 'RPGSystem'],
    queryFn: async () => tableAPI.getTableData('RPGSystem', 1, 500).then((response) => response.data.data),
  });

  const { data: collectionRPGSystemRecords = [] } = useQuery<CollectionRPGSystemRecord[], Error>({
    queryKey: ['table', 'CollectionRPGSystem'],
    queryFn: async () => tableAPI.getAllRecords('CollectionRPGSystem'),
  });

  const { data: allItems = [] } = useQuery<ItemRecord[], Error>({
    queryKey: ['table', 'Item', 'all-for-collection-counts'],
    queryFn: async () => getAllTableRows('Item'),
  });

  const collectionTypeNameById = useMemo(() => {
    return (collectionTypeRecords || []).reduce((map: Record<number, string>, item: CollectionTypeRecord) => {
      if (item?.CollectionTypeID != null) {
        map[Number(item.CollectionTypeID)] = String(item.CollectionTypeName ?? item.CollectionTypeID);
      }
      return map;
    }, {});
  }, [collectionTypeRecords]);

  const rpgSystemNameById = useMemo(() => {
    return (rpgSystemRecords || []).reduce((map: Record<number, string>, item: RPGSystemRecord) => {
      if (item?.RPGSystemID != null) {
        map[Number(item.RPGSystemID)] = String(item.RPGSystemName ?? item.RPGSystemID);
      }
      return map;
    }, {});
  }, [rpgSystemRecords]);

  const linkedRpgSearchTextByCollection = useMemo(() => {
    return (collectionRPGSystemRecords || []).reduce((map: Record<number, string[]>, record: CollectionRPGSystemRecord) => {
      const collectionId = Number(record.CollectionID);
      if (!Number.isInteger(collectionId)) {
        return map;
      }

      const rpgName = String(rpgSystemNameById[Number(record.RPGSystemID)] ?? '').trim().toLowerCase();
      if (!rpgName) {
        return map;
      }

      map[collectionId] = [...(map[collectionId] || []), rpgName];
      return map;
    }, {});
  }, [collectionRPGSystemRecords, rpgSystemNameById]);

  const itemCountByCollection = useMemo(() => {
    return (allItems || []).reduce((map: Record<number, number>, item: ItemRecord) => {
      const collectionId = Number(item?.CollectionID);
      if (!Number.isFinite(collectionId)) {
        return map;
      }

      map[collectionId] = (map[collectionId] || 0) + 1;
      return map;
    }, {});
  }, [allItems]);

  const rpgCountByCollection = useMemo(() => {
    return (collectionRPGSystemRecords || []).reduce((map: Record<number, number>, record: CollectionRPGSystemRecord) => {
      const collectionId = Number(record?.CollectionID);
      if (!Number.isFinite(collectionId)) {
        return map;
      }

      map[collectionId] = (map[collectionId] || 0) + 1;
      return map;
    }, {});
  }, [collectionRPGSystemRecords]);

  const selectedCollection = useMemo(() => {
    if (mode === 'new' || selectedCollectionId === null) {
      return null;
    }

    return collectionRecords.find((collection) => Number(collection.CollectionID) === selectedCollectionId) ?? null;
  }, [collectionRecords, mode, selectedCollectionId]);

  const selectedCollectionLinks = useMemo(() => {
    if (selectedCollectionId === null) {
      return [] as CollectionRPGSystemRecord[];
    }

    return collectionRPGSystemRecords.filter((record) => Number(record.CollectionID) === selectedCollectionId);
  }, [collectionRPGSystemRecords, selectedCollectionId]);

  const collectionTypeOptions = useMemo(() => {
    return (collectionTypeRecords || [])
      .map((item: CollectionTypeRecord) => ({
        value: String(item.CollectionTypeID ?? ''),
        label: String(item.CollectionTypeName ?? '').trim(),
      }))
      .filter((option) => option.value && option.label)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [collectionTypeRecords]);

  const rpgSystemOptions = useMemo(() => {
    return (rpgSystemRecords || [])
      .map((item: RPGSystemRecord) => ({
        value: String(item.RPGSystemID ?? ''),
        label: String(item.RPGSystemName ?? '').trim(),
      }))
      .filter((option) => option.value && option.label)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [rpgSystemRecords]);

  const filteredCollections = useMemo(() => {
    const search = searchInput.trim().toLowerCase();

    return [...collectionRecords]
      .filter((collection) => {
        if (!search) {
          return true;
        }

        const name = String(collection.CollectionName || '').toLowerCase();
        const type = String(collectionTypeNameById[Number(collection.CollectionTypeID)] ?? collection.CollectionTypeName ?? '').toLowerCase();
        const linkedRpgSystems = (linkedRpgSearchTextByCollection[Number(collection.CollectionID)] || []).join(' ');
        return name.includes(search) || type.includes(search) || linkedRpgSystems.includes(search);
      })
      .sort((a, b) => {
        const nameA = String(a.CollectionName ?? '').toLowerCase();
        const nameB = String(b.CollectionName ?? '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
  }, [collectionRecords, collectionTypeNameById, linkedRpgSearchTextByCollection, searchInput]);

  useEffect(() => {
    const rpgSystem = (urlSearchParams.get('rpgSystem') || '').trim();
    if (!rpgSystem) {
      return;
    }

    setSearchInput(rpgSystem);
  }, [urlSearchParams]);

  const populateFormFromCollection = (collection: CollectionRecord | null) => {
    if (!collection) {
      setFormValues({ ...emptyFormValues });
      setInitialFormValues({ ...emptyFormValues });
      setSelectedImageFile(null);
      setCropSourceFile(null);
      return;
    }

    const nextValues = {
      CollectionName: String(collection.CollectionName ?? ''),
      CollectionTypeID: String(collection.CollectionTypeID ?? ''),
      ImageFileName: String(collection.ImageFileName ?? ''),
    };

    setFormValues(nextValues);
    setInitialFormValues(nextValues);
    setSelectedImageFile(null);
    setCropSourceFile(null);
    setFormError('');
    setDeleteError('');
    setLinkError('');
  };

  useEffect(() => {
    if (mode === 'new') {
      return;
    }

    if (selectedCollection) {
      populateFormFromCollection(selectedCollection);
      return;
    }

    if (filteredCollections.length > 0 && selectedCollectionId === null) {
      setSelectedCollectionId(Number(filteredCollections[0].CollectionID));
    }
  }, [filteredCollections, mode, selectedCollection, selectedCollectionId]);

  useEffect(() => {
    if (mode === 'new' || selectedCollectionId !== null || filteredCollections.length === 0) {
      return;
    }

    setSelectedCollectionId(Number(filteredCollections[0].CollectionID));
  }, [filteredCollections, mode, selectedCollectionId]);

  const handleAddCollection = () => {
    setMode('new');
    setSelectedCollectionId(null);
    setActiveTab('details');
    setRpgSystemToLinkId('');
    setLinkError('');
    setDeleteError('');
    populateFormFromCollection(null);
    window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);
  };

  const handleSelectCollection = (collectionId: number) => {
    setMode('existing');
    setSelectedCollectionId(collectionId);
    setRpgSystemToLinkId('');
    setLinkError('');
    setDeleteError('');
  };

  const refreshCollectionsAndSelect = async (preferredName?: string) => {
    const refreshed = await queryClient.fetchQuery({
      queryKey: ['table', 'Collection'],
      queryFn: async () => tableAPI.getAllRecords('Collection'),
    });

    const refreshedCollections = Array.isArray(refreshed) ? refreshed : [];

    if (preferredName) {
      const matched = refreshedCollections.find((collection: CollectionRecord) => String(collection.CollectionName ?? '').trim().toLowerCase() === preferredName.trim().toLowerCase());
      if (matched?.CollectionID != null) {
        setMode('existing');
        setSelectedCollectionId(Number(matched.CollectionID));
        populateFormFromCollection(matched);
        return;
      }
    }

    if (selectedCollectionId !== null) {
      const matched = refreshedCollections.find((collection: CollectionRecord) => Number(collection.CollectionID) === selectedCollectionId);
      if (matched) {
        populateFormFromCollection(matched);
        return;
      }
    }

    if (refreshedCollections.length > 0) {
      const firstCollection = refreshedCollections[0];
      setMode('existing');
      setSelectedCollectionId(Number(firstCollection.CollectionID));
      populateFormFromCollection(firstCollection);
      return;
    }

    setMode('new');
    setSelectedCollectionId(null);
    populateFormFromCollection(null);
  };

  const handleImageFileChange = (file: File | null) => {
    if (!file) {
      setSelectedImageFile(null);
      setCropSourceFile(null);
      return;
    }

    const extension = file.name.toLowerCase().match(/\.(webp|jpe?g)$/)?.[1];
    const hasValidType = !file.type || file.type === (extension === 'webp' ? 'image/webp' : 'image/jpeg');
    if (!extension || !hasValidType) {
      setSelectedImageFile(null);
      setCropSourceFile(null);
      setFormError('Image File Name must be a .webp, .jpg, or .jpeg file.');
      return;
    }

    setCropSourceFile(file);
    setFormError('');
  };

  const handleSaveDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const collectionName = formValues.CollectionName.trim();
    const collectionTypeId = parseInt(formValues.CollectionTypeID, 10);

    if (!collectionName) {
      setFormError('Collection Name is required.');
      return;
    }

    if (!Number.isInteger(collectionTypeId)) {
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

      if (mode === 'existing' && selectedCollectionId !== null) {
        await tableAPI.updateRecord('Collection', selectedCollectionId, payload);
      } else {
        await tableAPI.createRecord('Collection', payload);
      }

      await queryClient.invalidateQueries({ queryKey: ['table', 'Collection'] });
      await refreshCollectionsAndSelect(collectionName);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Error saving record');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCollection = async () => {
    if (selectedCollectionId === null || mode === 'new') {
      return;
    }

    if (!confirm('Are you sure you want to delete this collection?')) {
      return;
    }

    setDeleteError('');
    setIsSaving(true);
    try {
      await tableAPI.deleteRecord('Collection', selectedCollectionId);
      await queryClient.invalidateQueries({ queryKey: ['table', 'Collection'] });
      await queryClient.invalidateQueries({ queryKey: ['table', 'CollectionRPGSystem'] });
      const remaining = await queryClient.fetchQuery({
        queryKey: ['table', 'Collection'],
        queryFn: async () => tableAPI.getAllRecords('Collection'),
      });

      const remainingCollections = Array.isArray(remaining) ? remaining : [];
      if (remainingCollections.length > 0) {
        const firstCollection = remainingCollections[0];
        setMode('existing');
        setSelectedCollectionId(Number(firstCollection.CollectionID));
        populateFormFromCollection(firstCollection);
      } else {
        setMode('new');
        setSelectedCollectionId(null);
        populateFormFromCollection(null);
      }
    } catch (err: any) {
      const backendError = String(err?.response?.data?.error || err?.message || '').trim();
      const backendMessage = backendError.toLowerCase();
      const referentialIntegrityConflict =
        backendMessage.includes('reference constraint') ||
        backendMessage.includes('foreign key') ||
        backendMessage.includes('conflicted with the reference') ||
        backendMessage.includes('still referenced');

      setDeleteError(
        referentialIntegrityConflict
          ? 'Delete failed. This collection is still referenced by linked items or RPG system assignments. Remove the linked records first, then try again.'
          : backendError || 'Delete failed. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddRpgSystemLink = async () => {
    if (selectedCollectionId === null || mode === 'new') {
      setLinkError('Save the collection before assigning RPG systems.');
      return;
    }

    const rpgSystemId = parseInt(rpgSystemToLinkId, 10);
    if (!Number.isInteger(rpgSystemId) || rpgSystemId <= 0) {
      setLinkError('Select an RPG system to add.');
      return;
    }

    const duplicateExists = selectedCollectionLinks.some((record) => Number(record.RPGSystemID) === rpgSystemId);
    if (duplicateExists) {
      setLinkError('That RPG system is already linked to this collection.');
      return;
    }

    setLinkError('');
    setIsLinkSaving(true);
    try {
      await tableAPI.createRecord('CollectionRPGSystem', {
        CollectionID: selectedCollectionId,
        RPGSystemID: rpgSystemId,
      });
      await queryClient.invalidateQueries({ queryKey: ['table', 'CollectionRPGSystem'] });
      setRpgSystemToLinkId('');
    } catch (err: any) {
      setLinkError(err.response?.data?.error || 'Error adding RPG system link');
    } finally {
      setIsLinkSaving(false);
    }
  };

  const handleRemoveRpgSystemLink = async (record: CollectionRPGSystemRecord) => {
    if (selectedCollectionId === null) {
      return;
    }

    setLinkError('');
    setIsLinkSaving(true);
    try {
      if (record.CollectionRPGSystemID != null) {
        await tableAPI.deleteRecord('CollectionRPGSystem', record.CollectionRPGSystemID);
      } else {
        await tableAPI.deleteRecord('CollectionRPGSystem', {
          collectionId: Number(record.CollectionID),
          rpgSystemId: Number(record.RPGSystemID),
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['table', 'CollectionRPGSystem'] });
    } catch (err: any) {
      setLinkError(err.response?.data?.error || 'Error removing RPG system link');
    } finally {
      setIsLinkSaving(false);
    }
  };

  const formatImageUploadDate = (date?: string | null) => {
    if (!date) {
      return '-';
    }

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return date;
    }

    return parsed.toLocaleString();
  };

  const selectedCollectionItemCount = selectedCollectionId !== null ? itemCountByCollection[selectedCollectionId] || 0 : 0;
  const selectedCollectionRpgCount = selectedCollectionId !== null ? rpgCountByCollection[selectedCollectionId] || 0 : 0;

  return (
    <AdminLayout title="Collections" subtitle="Manage collections and their linked RPG systems in one place.">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] shadow-sm">
          <div className="space-y-4 border-b border-[var(--arcane-border-light)] p-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--arcane-ink-900)]">Collections</h2>
              <p className="text-sm text-[var(--arcane-ink-soft)]">Select a collection to edit details and linked RPG systems.</p>
            </div>
            <Button onClick={handleAddCollection} className="w-full">
              Add Collection
            </Button>
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onClear={() => setSearchInput('')}
              clearable
              clearAriaLabel="Clear collections search"
              placeholder="Search collections..."
            />
          </div>

          <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
            {collectionsLoading ? (
              <SidebarListSkeleton />
            ) : collectionsError ? (
              <div className="p-4 text-sm text-red-600">Error loading collections.</div>
            ) : filteredCollections.length === 0 ? (
              <div className="p-4 text-sm text-[var(--arcane-ink-soft)]">No collections found.</div>
            ) : (
              <div className="space-y-1">
                {filteredCollections.map((collection) => {
                  const isSelected = mode === 'existing' && Number(collection.CollectionID) === selectedCollectionId;
                  const itemCount = itemCountByCollection[Number(collection.CollectionID)] || 0;
                  const rpgCount = rpgCountByCollection[Number(collection.CollectionID)] || 0;

                  return (
                    <button
                      key={collection.CollectionID}
                      type="button"
                      onClick={() => handleSelectCollection(Number(collection.CollectionID))}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-[#b8864866] bg-[#b886481a] shadow-sm'
                          : 'border-transparent bg-[var(--arcane-paper-raised)] hover:border-[var(--arcane-border-light)] hover:bg-[var(--arcane-paper)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--arcane-ink-900)]">{collection.CollectionName}</div>
                          <div className="truncate text-xs text-[var(--arcane-ink-soft)]">{collectionTypeNameById[Number(collection.CollectionTypeID)] ?? collection.CollectionTypeName ?? 'Unknown type'}</div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-[var(--arcane-ink-soft)]">
                          <span>{rpgCount} RPG systems</span>
                          <span>{itemCount} items</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] shadow-sm">
          <div className="border-b border-[var(--arcane-border-light)] px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[var(--arcane-ink-900)]">
                  {mode === 'new' ? 'Add Collection' : selectedCollection?.CollectionName || 'Select a collection'}
                </h2>
                <p className="text-sm text-[var(--arcane-ink-soft)]">
                  {mode === 'new'
                    ? 'Create a collection, then link RPG systems from the second tab.'
                    : 'Edit collection details or manage linked RPG systems from the tabs below.'}
                </p>
              </div>

              {selectedCollectionId !== null && mode === 'existing' ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className={activeTab === 'details'
                      ? 'border border-[var(--arcane-gold-500)] !bg-[var(--arcane-gold-500)] !text-[var(--arcane-ink-950)] hover:!bg-[var(--arcane-gold-300)]'
                      : 'border border-[var(--arcane-border-light)] !bg-[var(--arcane-paper-raised)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-paper)]'}
                    onClick={() => setActiveTab('details')}
                  >
                    Details
                  </Button>
                  <Button
                    type="button"
                    className={activeTab === 'rpg-systems'
                      ? 'border border-[var(--arcane-gold-500)] !bg-[var(--arcane-gold-500)] !text-[var(--arcane-ink-950)] hover:!bg-[var(--arcane-gold-300)]'
                      : 'border border-[var(--arcane-border-light)] !bg-[var(--arcane-paper-raised)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-paper)]'}
                    onClick={() => setActiveTab('rpg-systems')}
                  >
                    RPG Systems
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="p-5">
            {formError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div> : null}
            {deleteError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{deleteError}</div> : null}
            {linkError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{linkError}</div> : null}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                {activeTab === 'details' ? (
                  <form className="space-y-4" onSubmit={handleSaveDetails}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block space-y-2 sm:col-span-2">
                        <span className="text-sm font-medium text-[var(--arcane-ink-900)]">Collection Name</span>
                        <Input
                          ref={nameInputRef}
                          type="text"
                          value={formValues.CollectionName}
                          onChange={(event) => setFormValues((prev) => ({ ...prev, CollectionName: event.target.value }))}
                          placeholder="Enter collection name"
                          autoFocus
                        />
                      </label>

                      <label className="block space-y-2 sm:col-span-2">
                        <span className="text-sm font-medium text-[var(--arcane-ink-900)]">Collection Type</span>
                        <ComboSelect
                          options={collectionTypeOptions}
                          value={formValues.CollectionTypeID}
                          onChange={(value) => setFormValues((prev) => ({ ...prev, CollectionTypeID: value }))}
                          placeholder="Select collection type"
                          className="w-full"
                        />
                      </label>

                      <div className="sm:col-span-2">
                        <span className="mb-2 block text-sm font-medium text-[var(--arcane-ink-900)]">Image File</span>
                        <Input
                          type="file"
                          accept=".webp,.jpg,.jpeg,image/webp,image/jpeg"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            handleImageFileChange(file);
                            if (file) {
                              event.target.value = '';
                            }
                          }}
                        />
                        {selectedImageFile ? (
                          <p className="mt-1 text-sm text-[var(--arcane-ink-soft)]">Selected: {selectedImageFile.name}</p>
                        ) : formValues.ImageFileName ? (
                          <p className="mt-1 text-sm text-[var(--arcane-ink-soft)]">
                            Current:{' '}
                            <a href={getCollectionImageUrl(formValues.ImageFileName)} target="_blank" rel="noreferrer" className="text-[var(--arcane-gold-700)] underline hover:text-[var(--arcane-gold-600)]">
                              {formValues.ImageFileName}
                            </a>
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div>
                        {mode === 'existing' && selectedCollectionId !== null ? (
                          <Button type="button" onClick={handleDeleteCollection} disabled={isSaving} className="!bg-[var(--arcane-danger)] hover:!bg-[var(--arcane-danger-hover)] !text-white">
                            Delete Collection
                          </Button>
                        ) : null}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white"
                          onClick={() => {
                            if (mode === 'new') {
                              setMode('existing');
                              if (selectedCollectionId !== null) {
                                const collection = collectionRecords.find((record) => Number(record.CollectionID) === selectedCollectionId) ?? null;
                                populateFormFromCollection(collection);
                              }
                            } else if (selectedCollectionId !== null) {
                              const collection = collectionRecords.find((record) => Number(record.CollectionID) === selectedCollectionId) ?? null;
                              populateFormFromCollection(collection);
                            }
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={isSaving || (mode === 'existing' && JSON.stringify(formValues) === JSON.stringify(initialFormValues) && !selectedImageFile)}
                        >
                          {isSaving ? 'Saving...' : mode === 'new' ? 'Add Collection' : 'Save Collection'}
                        </Button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    {selectedCollectionId === null || mode === 'new' ? (
                      <div className="rounded-xl border border-dashed border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-5 text-sm text-[var(--arcane-ink-soft)]">
                        Save this collection first to manage linked RPG systems.
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-4">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-[var(--arcane-ink-900)]">Add linked RPG system</div>
                            <div className="text-xs text-[var(--arcane-ink-soft)]">Choose an RPG system and link it immediately to this collection.</div>
                          </div>
                          <div className="min-w-[240px] flex-1">
                            <ComboSelect
                              options={rpgSystemOptions}
                              value={rpgSystemToLinkId}
                              onChange={(value) => setRpgSystemToLinkId(value)}
                              placeholder="Select RPG system"
                              className="w-full"
                              disablePortal
                              openOnFocus={false}
                            />
                          </div>
                          <Button type="button" className="bg-[var(--arcane-gold-500)] hover:bg-[var(--arcane-gold-300)]" onClick={handleAddRpgSystemLink} disabled={isLinkSaving}>
                            Add
                          </Button>
                        </div>

                        <div className="rounded-xl border border-[var(--arcane-border-light)]">
                          <div className="border-b border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] px-4 py-3">
                            <div className="text-sm font-semibold text-[var(--arcane-ink-900)]">Linked RPG Systems</div>
                            <div className="text-xs text-[var(--arcane-ink-soft)]">{selectedCollectionRpgCount} linked RPG system{selectedCollectionRpgCount === 1 ? '' : 's'}</div>
                          </div>
                          <div className="divide-y divide-[var(--arcane-border-light)]">
                            {selectedCollectionLinks.length === 0 ? (
                              <div className="px-4 py-5 text-sm text-[var(--arcane-ink-soft)]">No RPG systems linked yet.</div>
                            ) : (
                              selectedCollectionLinks.map((record) => (
                                <div key={record.CollectionRPGSystemID ?? `${record.CollectionID}-${record.RPGSystemID}`} className="flex items-center justify-between gap-4 px-4 py-3">
                                  <div className="text-sm font-medium text-[var(--arcane-ink-900)]">{rpgSystemNameById[Number(record.RPGSystemID)] ?? record.RPGSystemID}</div>
                                  <Button type="button" className="border border-red-300 !bg-[var(--arcane-paper-raised)] !text-red-700 hover:!bg-red-50" onClick={() => handleRemoveRpgSystemLink(record)} disabled={isLinkSaving}>
                                    Remove
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <aside className="space-y-4 rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-4">
                <div>
                  <div className="text-sm font-semibold text-[var(--arcane-ink-900)]">Collection Summary</div>
                  <div className="mt-2 space-y-1 text-sm text-[var(--arcane-ink-soft)]">
                    <div>Items: {selectedCollectionItemCount.toLocaleString()}</div>
                    <div>RPG Systems: {selectedCollectionRpgCount.toLocaleString()}</div>
                    <div>Type: {selectedCollection ? collectionTypeNameById[Number(selectedCollection.CollectionTypeID)] ?? String(selectedCollection.CollectionTypeID ?? '-') : '-'}</div>
                  </div>
                </div>

                {selectedCollection && mode === 'existing' ? (
                  <>
                    <div className="rounded-lg bg-[var(--arcane-paper-raised)] p-3 shadow-sm">
                      <div className="text-sm font-semibold text-[var(--arcane-ink-900)]">Quick Links</div>
                      <div className="mt-2 space-y-2 text-sm">
                        <Link
                          to={buildCollectionInventoryLink(String(selectedCollection.CollectionName || ''), false)}
                          className="block text-[var(--arcane-gold-700)] underline hover:text-[var(--arcane-gold-600)]"
                        >
                          View items for this collection
                        </Link>
                        <Link
                          to={buildCollectionInventoryLink(String(selectedCollection.CollectionName || ''), true)}
                          className="block text-[var(--arcane-gold-700)] underline hover:text-[var(--arcane-gold-600)]"
                        >
                          View owned items for this collection
                        </Link>
                      </div>
                    </div>

                    <div className="rounded-lg bg-[var(--arcane-paper-raised)] p-3 shadow-sm">
                      <div className="text-sm font-semibold text-[var(--arcane-ink-900)]">Image Preview</div>
                      <div className="mt-2 flex min-h-[160px] items-center justify-center overflow-hidden rounded-lg border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-2">
                        {formValues.ImageFileName ? (
                          <a href={getCollectionImageUrl(formValues.ImageFileName)} target="_blank" rel="noreferrer" className="block">
                            <img
                              src={getCollectionImageUrl(formValues.ImageFileName)}
                              alt={`${selectedCollection?.CollectionName ?? 'Collection'} preview`}
                              className="max-h-40 w-auto max-w-[220px] rounded-md border border-[var(--arcane-border-light)] object-contain bg-white"
                            />
                          </a>
                        ) : (
                          <div className="text-sm text-[var(--arcane-ink-soft)]">No image uploaded.</div>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-[var(--arcane-ink-soft)]">Upload date: {formatImageUploadDate(selectedCollection.ImageUploadDate)}</div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg bg-[var(--arcane-paper-raised)] p-3 text-sm text-[var(--arcane-ink-soft)] shadow-sm">Select a collection to see summary information.</div>
                )}
              </aside>
            </div>
          </div>
        </section>
      </div>

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
            <Button onClick={() => setDeleteError('')} className="!bg-[var(--arcane-danger)] hover:!bg-[var(--arcane-danger-hover)] !text-white">
              OK
            </Button>
          </div>
        </div>
      </Dialog>
    </AdminLayout>
  );
}
