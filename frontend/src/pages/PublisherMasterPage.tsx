import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import ComboSelect from '../components/ui/ComboSelect';
import { Dialog } from '../components/ui/Dialog';
import ImageCropDialog from '../components/ImageCropDialog';
import { tableAPI } from '../services/api';

interface Publisher {
  [key: string]: any;
  PublisherID?: number;
  PublisherName?: string;
  PublisherURL?: string | null;
  ImageFileName?: string | null;
  ImageUploadDate?: string | null;
}

interface PublisherCollection {
  [key: string]: any;
  PublisherCollectionID?: number;
  PublisherID?: number;
  CollectionID?: number;
}

interface CollectionRecord {
  [key: string]: any;
  CollectionID?: number;
  CollectionName?: string;
  CollectionTypeID?: number | null;
  CollectionTypeName?: string | null;
}

interface CollectionTypeRecord {
  [key: string]: any;
  CollectionTypeID?: number;
  CollectionTypeName?: string;
}

interface ItemRecord {
  [key: string]: any;
  ItemID?: number;
  PublisherID?: number;
}

interface PurchaseOrderDetailRecord {
  [key: string]: any;
  ItemID?: number;
  PurchaseOrderID?: number;
}

type EditorTab = 'details' | 'collections';
type Mode = 'existing' | 'new';

const emptyFormValues = {
  PublisherName: '',
  PublisherURL: '',
  ImageFileName: '',
};

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

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function normalizeMatchKey(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function getPublisherImageUrl(fileName?: string | null) {
  return fileName ? `/api/uploads/publishers/${encodeURIComponent(fileName)}` : '';
}

function buildPublisherInventoryLink(publisherName: string, ownedOnly: boolean) {
  const params = new URLSearchParams();
  params.set('publisher', publisherName);
  if (ownedOnly) {
    params.set('hasPurchaseOrder', 'true');
  }

  return `/admin/inventory?${params.toString()}`;
}

export default function PublisherMasterPage() {
  const queryClient = useQueryClient();
  const [selectedPublisherId, setSelectedPublisherId] = useState<number | null>(null);
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
  const [collectionToAddId, setCollectionToAddId] = useState('');
  const [collectionLinkError, setCollectionLinkError] = useState('');
  const [isLinkSaving, setIsLinkSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const { data: publisherRecords = [], isLoading: publishersLoading, error: publishersError } = useQuery<Publisher[], Error>({
    queryKey: ['table', 'Publisher'],
    queryFn: async () => tableAPI.getAllRecords('Publisher'),
  });

  const { data: collectionRecords = [] } = useQuery<CollectionRecord[], Error>({
    queryKey: ['table', 'Collection'],
    queryFn: async () => tableAPI.getAllRecords('Collection'),
  });

  const { data: collectionTypeRecords = [] } = useQuery<CollectionTypeRecord[], Error>({
    queryKey: ['table', 'CollectionType'],
    queryFn: async () => tableAPI.getTableData('CollectionType', 1, 500).then((response) => response.data.data),
  });

  const { data: allItems = [] } = useQuery<ItemRecord[], Error>({
    queryKey: ['table', 'Item', 'all-for-publisher-counts'],
    queryFn: async () => getAllTableRows('Item'),
  });

  const { data: allPurchaseOrderDetails = [] } = useQuery<PurchaseOrderDetailRecord[], Error>({
    queryKey: ['table', 'PurchaseOrderDetail', 'all-for-publisher-counts'],
    queryFn: async () => getAllTableRows('PurchaseOrderDetail'),
  });

  const { data: publisherCollectionRecords = [] } = useQuery<PublisherCollection[], Error>({
    queryKey: ['table', 'PublisherCollection'],
    queryFn: async () => tableAPI.getAllRecords('PublisherCollection'),
  });

  const collectionTypeNameById = useMemo(() => {
    return (collectionTypeRecords || []).reduce((map: Record<number, string>, item: CollectionTypeRecord) => {
      if (item?.CollectionTypeID != null) {
        map[Number(item.CollectionTypeID)] = String(item.CollectionTypeName ?? item.CollectionTypeID);
      }
      return map;
    }, {});
  }, [collectionTypeRecords]);

  const collectionNameById = useMemo(() => {
    return (collectionRecords || []).reduce((map: Record<number, string>, item: CollectionRecord) => {
      if (item?.CollectionID != null) {
        const collectionName = String(item.CollectionName ?? item.CollectionID);
        const collectionTypeName = collectionTypeNameById[Number(item.CollectionTypeID)] ?? String(item.CollectionTypeName ?? '');
        map[Number(item.CollectionID)] = collectionTypeName ? `${collectionName} (${collectionTypeName})` : collectionName;
      }
      return map;
    }, {});
  }, [collectionRecords, collectionTypeNameById]);

  const itemCountByPublisher = useMemo(() => {
    return (allItems || []).reduce((map: Record<number, number>, item: ItemRecord) => {
      const publisherId = Number(item?.PublisherID);
      if (!Number.isFinite(publisherId)) {
        return map;
      }

      map[publisherId] = (map[publisherId] || 0) + 1;
      return map;
    }, {});
  }, [allItems]);

  const publisherIdByItemId = useMemo(() => {
    return (allItems || []).reduce((map: Record<number, number>, item: ItemRecord) => {
      const itemId = Number(item?.ItemID);
      const publisherId = Number(item?.PublisherID);
      if (!Number.isFinite(itemId) || !Number.isFinite(publisherId)) {
        return map;
      }

      map[itemId] = publisherId;
      return map;
    }, {});
  }, [allItems]);

  const orderIdsByPublisher = useMemo(() => {
    const accumulator: Record<number, Set<number>> = {};

    (allPurchaseOrderDetails || []).forEach((detail) => {
      const itemId = Number(detail?.ItemID);
      const purchaseOrderId = Number(detail?.PurchaseOrderID);
      const publisherId = publisherIdByItemId[itemId];

      if (!Number.isFinite(itemId) || !Number.isFinite(purchaseOrderId) || !Number.isFinite(publisherId)) {
        return;
      }

      if (!accumulator[publisherId]) {
        accumulator[publisherId] = new Set<number>();
      }

      accumulator[publisherId].add(purchaseOrderId);
    });

    return Object.entries(accumulator).reduce((map: Record<number, number>, [publisherId, orderIds]) => {
      map[Number(publisherId)] = orderIds.size;
      return map;
    }, {});
  }, [allPurchaseOrderDetails, publisherIdByItemId]);

  const collectionCountByPublisher = useMemo(() => {
    return (publisherCollectionRecords || []).reduce((map: Record<number, number>, record: PublisherCollection) => {
      const publisherId = Number(record?.PublisherID);
      if (!Number.isFinite(publisherId)) {
        return map;
      }

      map[publisherId] = (map[publisherId] || 0) + 1;
      return map;
    }, {});
  }, [publisherCollectionRecords]);

  const filteredPublishers = useMemo(() => {
    const search = searchInput.trim().toLowerCase();

    return [...publisherRecords].filter((publisher) => {
      if (!search) {
        return true;
      }

      const publisherName = String(publisher.PublisherName || '').toLowerCase();
      const publisherUrl = String(publisher.PublisherURL || '').toLowerCase();
      return publisherName.includes(search) || publisherUrl.includes(search);
    });
  }, [publisherRecords, searchInput]);

  const sortedPublishers = useMemo(() => {
    return [...filteredPublishers].sort((a, b) => {
      const nameA = String(a.PublisherName ?? '').toLowerCase();
      const nameB = String(b.PublisherName ?? '').toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return Number(a.PublisherID) - Number(b.PublisherID);
    });
  }, [filteredPublishers]);

  const selectedPublisher = useMemo(() => {
    if (mode === 'new' || selectedPublisherId === null) {
      return null;
    }

    return publisherRecords.find((publisher) => Number(publisher.PublisherID) === selectedPublisherId) ?? null;
  }, [mode, publisherRecords, selectedPublisherId]);

  const hasDetailsChanges = useMemo(() => {
    if (mode === 'new') {
      return true;
    }

    return (
      formValues.PublisherName.trim() !== initialFormValues.PublisherName.trim() ||
      formValues.PublisherURL.trim() !== initialFormValues.PublisherURL.trim() ||
      !!selectedImageFile
    );
  }, [formValues, initialFormValues, mode, selectedImageFile]);

  const selectedPublisherCollectionLinks = useMemo(() => {
    if (!selectedPublisherId) {
      return [] as PublisherCollection[];
    }

    return publisherCollectionRecords.filter((record) => Number(record.PublisherID) === selectedPublisherId);
  }, [publisherCollectionRecords, selectedPublisherId]);

  const collectionOptions = useMemo(() => {
    return [...collectionRecords]
      .map((collection) => ({
        value: String(collection.CollectionID ?? ''),
        label: String(collection.CollectionName ?? '').trim() + (collection.CollectionTypeID != null ? ` (${collectionTypeNameById[Number(collection.CollectionTypeID)] || String(collection.CollectionTypeName ?? '')})` : ''),
      }))
      .filter((option) => option.value && option.label.trim())
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [collectionRecords, collectionTypeNameById]);

  const selectedPublisherLinkCount = collectionCountByPublisher[Number(selectedPublisherId)] || 0;
  const selectedPublisherItemCount = collectionRecords.length > 0 && selectedPublisherId ? itemCountByPublisher[Number(selectedPublisherId)] || 0 : 0;
  const selectedPublisherOrderCount = selectedPublisherId ? orderIdsByPublisher[Number(selectedPublisherId)] || 0 : 0;

  const populateFormFromPublisher = (publisher: Publisher | null) => {
    if (!publisher) {
      setFormValues({ ...emptyFormValues });
      setInitialFormValues({ ...emptyFormValues });
      setSelectedImageFile(null);
      setCropSourceFile(null);
      return;
    }

    const nextValues = {
      PublisherName: String(publisher.PublisherName ?? ''),
      PublisherURL: String(publisher.PublisherURL ?? ''),
      ImageFileName: String(publisher.ImageFileName ?? ''),
    };

    setFormValues(nextValues);
    setInitialFormValues(nextValues);
    setSelectedImageFile(null);
    setCropSourceFile(null);
    setFormError('');
    setDeleteError('');
    setCollectionLinkError('');
  };

  useEffect(() => {
    if (mode === 'new') {
      return;
    }

    if (selectedPublisher) {
      populateFormFromPublisher(selectedPublisher);
      return;
    }

    if (sortedPublishers.length > 0 && selectedPublisherId === null) {
      const firstPublisher = sortedPublishers[0];
      setSelectedPublisherId(Number(firstPublisher.PublisherID));
    }
  }, [mode, selectedPublisher, selectedPublisherId, sortedPublishers]);

  useEffect(() => {
    if (mode === 'new') {
      return;
    }

    if (!selectedPublisher && sortedPublishers.length === 0) {
      setMode('new');
      populateFormFromPublisher(null);
    }
  }, [mode, selectedPublisher, sortedPublishers.length]);

  const handleAddPublisher = () => {
    setMode('new');
    setSelectedPublisherId(null);
    setActiveTab('details');
    setCollectionToAddId('');
    setCollectionLinkError('');
    setDeleteError('');
    populateFormFromPublisher(null);
    window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);
  };

  const handleSelectPublisher = (publisherId: number) => {
    setMode('existing');
    setSelectedPublisherId(publisherId);
    setCollectionToAddId('');
    setCollectionLinkError('');
    setDeleteError('');
  };

  const refreshPublishersAndSelect = async (preferredMatch?: { name: string; url: string }) => {
    const refreshed = await queryClient.fetchQuery({
      queryKey: ['table', 'Publisher'],
      queryFn: async () => tableAPI.getAllRecords('Publisher'),
    });

    const refreshedPublishers = Array.isArray(refreshed) ? refreshed : [];
    if (preferredMatch) {
      const matchedPublisher = refreshedPublishers.find((publisher: Publisher) => {
        return (
          normalizeMatchKey(publisher.PublisherName) === normalizeMatchKey(preferredMatch.name) &&
          normalizeMatchKey(publisher.PublisherURL) === normalizeMatchKey(preferredMatch.url)
        );
      });

      if (matchedPublisher?.PublisherID != null) {
        setMode('existing');
        setSelectedPublisherId(Number(matchedPublisher.PublisherID));
        populateFormFromPublisher(matchedPublisher);
        return;
      }
    }

    if (selectedPublisherId !== null) {
      const matchedPublisher = refreshedPublishers.find((publisher: Publisher) => Number(publisher.PublisherID) === selectedPublisherId);
      if (matchedPublisher) {
        populateFormFromPublisher(matchedPublisher);
        return;
      }
    }

    if (refreshedPublishers.length > 0) {
      const firstPublisher = refreshedPublishers[0];
      setMode('existing');
      setSelectedPublisherId(Number(firstPublisher.PublisherID));
      populateFormFromPublisher(firstPublisher);
      return;
    }

    setMode('new');
    setSelectedPublisherId(null);
    populateFormFromPublisher(null);
  };

  const handleSaveDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const publisherName = formValues.PublisherName.trim();
    const publisherUrl = formValues.PublisherURL.trim();

    if (!publisherName) {
      setFormError('Publisher Name is required.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = new FormData();
      payload.append('PublisherName', publisherName);
      payload.append('PublisherURL', publisherUrl);

      if (selectedImageFile) {
        payload.append('ImageFile', selectedImageFile);
      }

      if (mode === 'existing' && selectedPublisherId !== null) {
        await tableAPI.updateRecord('Publisher', selectedPublisherId, payload);
      } else {
        await tableAPI.createRecord('Publisher', payload);
      }

      await queryClient.invalidateQueries({ queryKey: ['table', 'Publisher'] });
      await refreshPublishersAndSelect(mode === 'new' ? { name: publisherName, url: publisherUrl } : undefined);
      setCollectionToAddId('');
      setCollectionLinkError('');
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Error saving record');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePublisher = async () => {
    if (selectedPublisherId === null || mode === 'new') {
      return;
    }

    if (!confirm('Are you sure you want to delete this publisher?')) {
      return;
    }

    setDeleteError('');
    setIsSaving(true);
    try {
      await tableAPI.deleteRecord('Publisher', selectedPublisherId);
      await queryClient.invalidateQueries({ queryKey: ['table', 'Publisher'] });
      await queryClient.invalidateQueries({ queryKey: ['table', 'PublisherCollection'] });
      const remaining = await queryClient.fetchQuery({
        queryKey: ['table', 'Publisher'],
        queryFn: async () => tableAPI.getAllRecords('Publisher'),
      });

      const remainingPublishers = Array.isArray(remaining) ? remaining : [];
      if (remainingPublishers.length > 0) {
        const firstPublisher = remainingPublishers[0];
        setMode('existing');
        setSelectedPublisherId(Number(firstPublisher.PublisherID));
        populateFormFromPublisher(firstPublisher);
      } else {
        setMode('new');
        setSelectedPublisherId(null);
        populateFormFromPublisher(null);
      }
    } catch (err: any) {
      const backendError = String(err?.response?.data?.error || err?.message || '').trim();
      const backendMessage = backendError.toLowerCase();
      const referentialIntegrityConflict =
        backendMessage.includes('reference constraint') ||
        backendMessage.includes('foreign key') ||
        backendMessage.includes('conflicted with the reference') ||
        backendMessage.includes('still referenced');

      if (referentialIntegrityConflict) {
        setDeleteError(
          'Delete failed. This publisher is still referenced by linked collections or items. Remove the links first, then try again.'
        );
      } else {
        setDeleteError(backendError || 'Delete failed. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCollectionLink = async () => {
    if (selectedPublisherId === null || mode === 'new') {
      setCollectionLinkError('Save the publisher before assigning collections.');
      return;
    }

    const collectionId = parseInt(collectionToAddId, 10);
    if (!Number.isInteger(collectionId) || collectionId <= 0) {
      setCollectionLinkError('Select a collection to add.');
      return;
    }

    const duplicateExists = selectedPublisherCollectionLinks.some((record) => Number(record.CollectionID) === collectionId);
    if (duplicateExists) {
      setCollectionLinkError('That collection is already linked to this publisher.');
      return;
    }

    setCollectionLinkError('');
    setIsLinkSaving(true);
    try {
      await tableAPI.createRecord('PublisherCollection', {
        PublisherID: selectedPublisherId,
        CollectionID: collectionId,
      });
      await queryClient.invalidateQueries({ queryKey: ['table', 'PublisherCollection'] });
      setCollectionToAddId('');
    } catch (err: any) {
      setCollectionLinkError(err.response?.data?.error || 'Error adding collection link');
    } finally {
      setIsLinkSaving(false);
    }
  };

  const handleRemoveCollectionLink = async (record: PublisherCollection) => {
    if (selectedPublisherId === null) {
      return;
    }

    setCollectionLinkError('');
    setIsLinkSaving(true);
    try {
      if (record.PublisherCollectionID != null) {
        await tableAPI.deleteRecord('PublisherCollection', record.PublisherCollectionID);
      } else {
        await tableAPI.deleteRecord('PublisherCollection', {
          publisherId: Number(record.PublisherID),
          collectionId: Number(record.CollectionID),
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['table', 'PublisherCollection'] });
    } catch (err: any) {
      setCollectionLinkError(err.response?.data?.error || 'Error removing collection link');
    } finally {
      setIsLinkSaving(false);
    }
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

  return (
    <AdminLayout title="Publishers" subtitle="Manage publishers and their linked collections in one place.">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] shadow-sm">
          <div className="border-b border-[var(--arcane-border-light)] p-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--arcane-ink-900)]">Publishers</h2>
              <p className="text-sm text-[var(--arcane-ink-soft)]">Select a publisher to edit details and collection links.</p>
            </div>
            <Button className="w-full" onClick={handleAddPublisher}>
              Add Publisher
            </Button>
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onClear={() => setSearchInput('')}
              clearable
              clearAriaLabel="Clear publishers search"
              placeholder="Search publishers..."
            />
          </div>

          <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
            {publishersLoading ? (
              <div className="p-4 text-sm text-[var(--arcane-ink-soft)]">Loading publishers...</div>
            ) : publishersError ? (
              <div className="p-4 text-sm text-red-600">Error loading publishers.</div>
            ) : sortedPublishers.length === 0 ? (
              <div className="p-4 text-sm text-[var(--arcane-ink-soft)]">No publishers found.</div>
            ) : (
              <div className="space-y-1">
                {sortedPublishers.map((publisher) => {
                  const isSelected = mode === 'existing' && Number(publisher.PublisherID) === selectedPublisherId;
                  const publisherItemCount = itemCountByPublisher[Number(publisher.PublisherID)] || 0;
                  const publisherOrderCount = orderIdsByPublisher[Number(publisher.PublisherID)] || 0;
                  const publisherCollectionCount = collectionCountByPublisher[Number(publisher.PublisherID)] || 0;

                  return (
                    <button
                      key={publisher.PublisherID}
                      type="button"
                      onClick={() => handleSelectPublisher(Number(publisher.PublisherID))}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-[#b8864866] bg-[#b886481a] shadow-sm'
                          : 'border-transparent bg-[var(--arcane-paper-raised)] hover:border-[var(--arcane-border-light)] hover:bg-[var(--arcane-paper)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--arcane-ink-900)]">{publisher.PublisherName}</div>
                          <div className="truncate text-xs text-[var(--arcane-ink-soft)]">{publisher.PublisherURL || 'No URL'}</div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-[var(--arcane-ink-soft)]">
                          <span>{publisherCollectionCount} collections</span>
                          <span>{publisherItemCount} items</span>
                          <span>{publisherOrderCount} orders</span>
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
                  {mode === 'new' ? 'Add Publisher' : selectedPublisher?.PublisherName || 'Select a publisher'}
                </h2>
                <p className="text-sm text-[var(--arcane-ink-soft)]">
                  {mode === 'new'
                    ? 'Create a new publisher, then link collections from the Collections tab.'
                    : 'Edit the publisher details or manage linked collections from the tabs below.'}
                </p>
              </div>

              {selectedPublisherId !== null && mode === 'existing' ? (
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
                    className={activeTab === 'collections'
                      ? 'border border-[var(--arcane-gold-500)] !bg-[var(--arcane-gold-500)] !text-[var(--arcane-ink-950)] hover:!bg-[var(--arcane-gold-300)]'
                      : 'border border-[var(--arcane-border-light)] !bg-[var(--arcane-paper-raised)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-paper)]'}
                    onClick={() => setActiveTab('collections')}
                  >
                    Collections
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="p-5">
            {formError ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div>
            ) : null}
            {deleteError ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{deleteError}</div>
            ) : null}
            {collectionLinkError ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{collectionLinkError}</div>
            ) : null}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                {activeTab === 'details' ? (
                  <form className="space-y-4" onSubmit={handleSaveDetails}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block space-y-2 sm:col-span-2">
                        <span className="text-sm font-medium text-[var(--arcane-ink-900)]">Publisher Name</span>
                        <Input
                          ref={nameInputRef}
                          type="text"
                          value={formValues.PublisherName}
                          onChange={(event) => setFormValues((prev) => ({ ...prev, PublisherName: event.target.value }))}
                          placeholder="Enter publisher name"
                          autoFocus
                        />
                      </label>

                      <label className="block space-y-2 sm:col-span-2">
                        <span className="text-sm font-medium text-[var(--arcane-ink-900)]">Publisher URL</span>
                        <Input
                          type="url"
                          value={formValues.PublisherURL}
                          onChange={(event) => setFormValues((prev) => ({ ...prev, PublisherURL: event.target.value }))}
                          placeholder="Enter publisher URL"
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
                            <a
                              href={getPublisherImageUrl(formValues.ImageFileName)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[var(--arcane-gold-700)] underline hover:text-[var(--arcane-gold-600)]"
                            >
                              {formValues.ImageFileName}
                            </a>
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div>
                        {mode === 'existing' && selectedPublisherId !== null ? (
                          <Button
                            type="button"
                            onClick={handleDeletePublisher}
                            disabled={isSaving}
                            className="!bg-[var(--arcane-danger)] hover:!bg-[var(--arcane-danger-hover)] !text-white"
                          >
                            Delete Publisher
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
                              if (selectedPublisherId !== null) {
                                const publisher = publisherRecords.find((record) => Number(record.PublisherID) === selectedPublisherId) ?? null;
                                populateFormFromPublisher(publisher);
                              }
                            } else if (selectedPublisherId !== null) {
                              const publisher = publisherRecords.find((record) => Number(record.PublisherID) === selectedPublisherId) ?? null;
                              populateFormFromPublisher(publisher);
                            }
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={isSaving || (mode === 'existing' && !hasDetailsChanges)}
                        >
                          {isSaving ? 'Saving...' : mode === 'new' ? 'Add Publisher' : 'Save Publisher'}
                        </Button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    {selectedPublisherId === null || mode === 'new' ? (
                      <div className="rounded-xl border border-dashed border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-5 text-sm text-[var(--arcane-ink-soft)]">
                        Save this publisher first to manage linked collections.
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-4">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-[var(--arcane-ink-900)]">Add linked collection</div>
                            <div className="text-xs text-[var(--arcane-ink-soft)]">Choose a collection and add it immediately to this publisher.</div>
                          </div>
                          <div className="min-w-[240px] flex-1">
                            <ComboSelect
                              options={collectionOptions}
                              value={collectionToAddId}
                              onChange={(value) => setCollectionToAddId(value)}
                              placeholder="Select collection"
                              className="w-full"
                              disablePortal
                              openOnFocus={false}
                            />
                          </div>
                          <Button type="button" className="bg-[var(--arcane-gold-500)] hover:bg-[var(--arcane-gold-300)]" onClick={handleAddCollectionLink} disabled={isLinkSaving}>
                            Add
                          </Button>
                        </div>

                        <div className="rounded-xl border border-[var(--arcane-border-light)]">
                          <div className="border-b border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] px-4 py-3">
                            <div className="text-sm font-semibold text-[var(--arcane-ink-900)]">Linked Collections</div>
                            <div className="text-xs text-[var(--arcane-ink-soft)]">{selectedPublisherLinkCount} linked collection{selectedPublisherLinkCount === 1 ? '' : 's'}</div>
                          </div>

                          <div className="divide-y divide-[var(--arcane-border-light)]">
                            {selectedPublisherCollectionLinks.length === 0 ? (
                              <div className="px-4 py-5 text-sm text-[var(--arcane-ink-soft)]">No collections linked yet.</div>
                            ) : (
                              selectedPublisherCollectionLinks.map((record) => (
                                <div key={record.PublisherCollectionID ?? `${record.PublisherID}-${record.CollectionID}`} className="flex items-center justify-between gap-4 px-4 py-3">
                                  <div>
                                    <div className="text-sm font-medium text-[var(--arcane-ink-900)]">{collectionNameById[Number(record.CollectionID)] ?? record.CollectionID}</div>
                                  </div>
                                  <Button
                                    type="button"
                                    className="border border-red-300 !bg-[var(--arcane-paper-raised)] !text-red-700 hover:!bg-red-50"
                                    onClick={() => handleRemoveCollectionLink(record)}
                                    disabled={isLinkSaving}
                                  >
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
                  <div className="text-sm font-semibold text-[var(--arcane-ink-900)]">Publisher Summary</div>
                  <div className="mt-2 space-y-1 text-sm text-[var(--arcane-ink-soft)]">
                    <div>Items: {selectedPublisherItemCount.toLocaleString()}</div>
                    <div>Orders: {selectedPublisherOrderCount.toLocaleString()}</div>
                    <div>Collections: {selectedPublisherLinkCount.toLocaleString()}</div>
                  </div>
                </div>

                {selectedPublisher && mode === 'existing' ? (
                  <>
                    <div className="rounded-lg bg-[var(--arcane-paper-raised)] p-3 shadow-sm">
                      <div className="text-sm font-semibold text-[var(--arcane-ink-900)]">Quick Links</div>
                      <div className="mt-2 space-y-2 text-sm">
                        <Link
                          to={buildPublisherInventoryLink(String(selectedPublisher.PublisherName || ''), false)}
                          className="block text-[var(--arcane-gold-700)] underline hover:text-[var(--arcane-gold-600)]"
                        >
                          View items for this publisher
                        </Link>
                        <Link
                          to={buildPublisherInventoryLink(String(selectedPublisher.PublisherName || ''), true)}
                          className="block text-[var(--arcane-gold-700)] underline hover:text-[var(--arcane-gold-600)]"
                        >
                          View owned items for this publisher
                        </Link>
                      </div>
                    </div>

                    <div className="rounded-lg bg-[var(--arcane-paper-raised)] p-3 shadow-sm">
                      <div className="text-sm font-semibold text-[var(--arcane-ink-900)]">Image Preview</div>
                      <div className="mt-2 flex min-h-[160px] items-center justify-center overflow-hidden rounded-lg border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-2">
                        {formValues.ImageFileName ? (
                          <a href={getPublisherImageUrl(formValues.ImageFileName)} target="_blank" rel="noreferrer" className="block">
                            <img
                              src={getPublisherImageUrl(formValues.ImageFileName)}
                              alt={`${selectedPublisher?.PublisherName ?? 'Publisher'} preview`}
                              className="max-h-40 w-auto max-w-[220px] rounded-md border border-[var(--arcane-border-light)] object-contain bg-white"
                            />
                          </a>
                        ) : (
                          <div className="text-sm text-[var(--arcane-ink-soft)]">No image uploaded.</div>
                        )}
                      </div>
                      <div className="mt-2 text-xs text-[var(--arcane-ink-soft)]">
                        Upload date: {formatImageUploadDate(selectedPublisher.ImageUploadDate)}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg bg-[var(--arcane-paper-raised)] p-3 text-sm text-[var(--arcane-ink-soft)] shadow-sm">
                    Select a publisher to see summary information.
                  </div>
                )}
              </aside>
            </div>
          </div>
        </section>
      </div>

      {cropSourceFile ? (
        <ImageCropDialog
          file={cropSourceFile}
          title="Crop Publisher Image"
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
