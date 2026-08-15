import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CircleHelp, Link2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import ComboSelect from '../components/ui/ComboSelect';
import { Dialog } from '../components/ui/Dialog';
import AlertDialog from '../components/ui/AlertDialog';
import SelectionScopeMenu from '../components/ui/SelectionScopeMenu';
import { useToast } from '../components/ui/ToastProvider';
import LinkedOrderDetailModal, { type LinkedPurchaseOrder } from '../components/order/LinkedOrderDetailModal';
import BulkItemUploadDialog from '../components/inventory/BulkItemUploadDialog';
import FilterChipBar, { type FilterChipField } from '../components/inventory/FilterChipBar';
import ImageCropDialog from '../components/ImageCropDialog';
import useModalFocusTrap from '../hooks/useModalFocusTrap';
import { useAppMode } from '../context/AppModeContext';
import { tablesAPI } from '../services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';

const ITEM_VERSION_MAX_LENGTH = 15;

interface InventoryItem {
  ItemID: number;
  ItemName: string;
  ItemVersion?: string;
  ProductID?: string;
  ReleaseDate?: string;
  IsPhysical?: boolean;
  IsDigital?: boolean;
  ImageFileName?: string | null;
  ImageUploadDate?: string | null;
  PublisherID: number;
  CollectionID: number;
  CategoryID: number;
  SubTypeID: number;
  SubItemCount: number;
  HasPurchaseOrder?: boolean;
  PublisherName: string;
  CollectionName: string;
  CategoryName: string;
  SubTypeName: string;
}

interface InventoryExportRow {
  Publisher?: string | null;
  Collection?: string | null;
  Item?: string | null;
  Version?: string | null;
  Category?: string | null;
  SubType?: string | null;
  ProductID?: string | null;
  ReleaseDate?: string | null;
  IsPhysical?: boolean | null;
  IsDigital?: boolean | null;
  Store?: string | null;
  InvoiceNumber?: string | null;
  PurchaseDate?: string | null;
  Price?: number | null;
  Count?: number | null;
  POStatus?: string | null;
}

interface ItemLookup {
  ItemID: number;
  ItemName: string;
  ProductID: string;
}

interface CreateOrderDetailDraft {
  id: number;
  ItemID: string;
  Quantity: string;
  Price: string;
}

function parseHasPurchaseOrderQueryParam(value: string | null): boolean | undefined {
  const normalized = (value || '').trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }
  return undefined;
}

function getItemImageUrl(fileName?: string | null) {
  return fileName ? `/api/uploads/items/${encodeURIComponent(fileName)}` : '';
}

function truncateMiddle(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  const visibleLength = maxLength - 3;
  const startLength = Math.ceil(visibleLength / 2);
  return `${value.slice(0, startLength)}...${value.slice(-(visibleLength - startLength))}`;
}

function formatImageUploadDate(date?: string | null) {
  if (!date) {
    return 'Not available';
  }

  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime()) ? date : parsedDate.toLocaleString();
}

export default function InventoryLookupPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canWrite } = useAppMode();
  const [urlSearchParams] = useSearchParams();
  const addItemInputRef = useRef<HTMLInputElement>(null);
  const editItemInputRef = useRef<HTMLInputElement>(null);
  const firstRelatedOrderOpenButtonRef = useRef<HTMLButtonElement>(null);
  const relatedOrdersCloseButtonRef = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('ItemName');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [searchInput, setSearchInput] = useState('');
  const [filterValues, setFilterValues] = useState({
    search: '',
    itemVersion: '',
    releaseDateFrom: '',
    releaseDateTo: '',
    // publisherName is now an array of selected publisher names
    publisherName: [] as string[],
    collectionName: [] as string[],
    categoryName: [] as string[],
    subTypeName: [] as string[],
    isPhysical: undefined as boolean | undefined,
    isDigital: undefined as boolean | undefined,
    hasPurchaseOrder: undefined as boolean | undefined,
  });
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingImageItem, setViewingImageItem] = useState<InventoryItem | null>(null);
  const [selectedEditImageFile, setSelectedEditImageFile] = useState<File | null>(null);
  const [selectedEditImageUrl, setSelectedEditImageUrl] = useState('');
  const [editCropSourceFile, setEditCropSourceFile] = useState<File | null>(null);
  const closeEditModal = useCallback(() => {
    setPendingEditNavigation(null);
    setEditingItem(null);
    setSelectedEditImageFile(null);
    setEditCropSourceFile(null);
    setEditValues({
      ItemName: '',
      ItemVersion: '',
      ProductID: '',
      ReleaseDate: '',
      IsPhysical: false,
      IsDigital: false,
      PublisherID: '',
      CollectionID: '',
      CategoryID: '',
      SubTypeID: '',
    });
    setEditError('');
  }, []);
  const editModalRef = useModalFocusTrap<HTMLDivElement>(Boolean(editingItem), closeEditModal);
  const [pendingEditNavigation, setPendingEditNavigation] = useState<
    { direction: 'previous' | 'next'; targetPage: number } | null
  >(null);
  const [editValues, setEditValues] = useState({
    ItemName: '',
    ItemVersion: '',
    ProductID: '',
    ReleaseDate: '',
    IsPhysical: false,
    IsDigital: false,
    PublisherID: '',
    CollectionID: '',
    CategoryID: '',
    SubTypeID: '',
  });
  const [editError, setEditError] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [addValues, setAddValues] = useState({
    ItemName: '',
    ItemVersion: '',
    ProductID: '',
    ReleaseDate: '',
    IsPhysical: false,
    IsDigital: false,
    PublisherID: '',
    CollectionID: '',
    CategoryID: '',
    SubTypeID: '',
  });
  const [addError, setAddError] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState<'edit' | 'confirm'>('edit');
  const [bulkValues, setBulkValues] = useState({
    PublisherID: '',
    CollectionID: '',
    CategoryID: '',
    SubTypeID: '',
    ItemVersion: '',
    IsPhysical: '',
    IsDigital: '',
  });
  const [bulkError, setBulkError] = useState('');
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const [bulkDeleteError, setBulkDeleteError] = useState('');
  const [isRelatedOrdersModalOpen, setIsRelatedOrdersModalOpen] = useState(false);
  const [selectedItemForRelatedOrders, setSelectedItemForRelatedOrders] = useState<InventoryItem | null>(null);
  const [relatedOrdersLoading, setRelatedOrdersLoading] = useState(false);
  const [relatedOrdersError, setRelatedOrdersError] = useState('');
  const [relatedOrders, setRelatedOrders] = useState<LinkedPurchaseOrder[]>([]);
  const [isOrderDetailModalOpen, setIsOrderDetailModalOpen] = useState(false);
  const [selectedLinkedOrder, setSelectedLinkedOrder] = useState<LinkedPurchaseOrder | null>(null);
  const [detailTargetItemId, setDetailTargetItemId] = useState<number | null>(null);
  const [fallbackHasPurchaseOrder, setFallbackHasPurchaseOrder] = useState<Record<number, boolean>>({});
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
  const [createOrderError, setCreateOrderError] = useState<string | null>(null);
  const [createOrderValues, setCreateOrderValues] = useState({
    InvoiceNumber: '',
    StoreID: '',
    StatusID: '',
    PurchaseDate: '',
  });
  const [createOrderDetails, setCreateOrderDetails] = useState<CreateOrderDetailDraft[]>([
    { id: 1, ItemID: '', Quantity: '1', Price: '' },
  ]);
  const [nextCreateOrderDetailRowId, setNextCreateOrderDetailRowId] = useState(2);

  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () => ['inventory', filterValues, page, sortBy, sortOrder],
    [filterValues, page, sortBy, sortOrder]
  );

  useEffect(() => {
    setSelectedItemIds([]);
    setIsBulkUpdateOpen(false);
    setBulkStep('edit');
    setBulkError('');
    setIsBulkDeleteOpen(false);
    setBulkDeleteConfirmText('');
    setBulkDeleteError('');
  }, [queryKey]);

  // Reset to page 1 whenever the active filters change (chips, search, etc.)
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterValues]);

  // Debounce the always-visible search box (searches Item Name / Product ID) before applying it
  useEffect(() => {
    const handle = setTimeout(() => {
      const trimmed = searchInput.trim();
      setFilterValues((current) => (trimmed === current.search ? current : { ...current, search: trimmed }));
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    const publisher = (urlSearchParams.get('publisher') || '').trim();
    const collection = (urlSearchParams.get('collection') || '').trim();
    const item = (urlSearchParams.get('item') || '').trim();
    const category = (urlSearchParams.get('category') || '').trim();
    const subType = (urlSearchParams.get('subType') || '').trim();
    const hasPurchaseOrder = parseHasPurchaseOrderQueryParam(urlSearchParams.get('hasPurchaseOrder'));

    if (!publisher && !collection && !item && !category && !subType && typeof hasPurchaseOrder === 'undefined') {
      return;
    }

    const nextFilters = {
      search: item,
      itemVersion: '',
      releaseDateFrom: '',
      releaseDateTo: '',
      publisherName: publisher ? [publisher] : [],
      collectionName: collection ? [collection] : [],
      categoryName: category ? [category] : [],
      subTypeName: subType ? [subType] : [],
      isPhysical: undefined as boolean | undefined,
      isDigital: undefined as boolean | undefined,
      hasPurchaseOrder,
    };

    setSearchInput(item);
    setFilterValues(nextFilters);
    setPage(1);
  }, [urlSearchParams]);

  const parseDateParts = (value?: string | Date | null) => {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        return null;
      }
      return {
        year: value.getUTCFullYear(),
        month: value.getUTCMonth() + 1,
        day: value.getUTCDate(),
      };
    }

    const raw = String(value).trim();
    if (!raw) {
      return null;
    }

    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return {
        year: Number(iso[1]),
        month: Number(iso[2]),
        day: Number(iso[3]),
      };
    }

    const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdy) {
      return {
        year: Number(mdy[3]),
        month: Number(mdy[1]),
        day: Number(mdy[2]),
      };
    }

    return null;
  };

  const formatReleaseDate = (date?: string) => {
    const parts = parseDateParts(date);
    if (!parts) {
      return date || '-';
    }

    return `${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}/${parts.year}`;
  };

  const formatReleaseDateForModal = (date?: string) => {
    const parts = parseDateParts(date);
    if (!parts) {
      return date || '';
    }

    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  };

  const normalizeReleaseDateForSave = (date: string) => {
    const raw = date.trim();
    if (!raw) {
      return raw;
    }

    // Accept MM/DD/YYYY input from edit modal.
    const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdy) {
      const month = Number(mdy[1]);
      const day = Number(mdy[2]);
      const year = Number(mdy[3]);
      const candidate = new Date(year, month - 1, day);
      if (
        candidate.getFullYear() === year &&
        candidate.getMonth() === month - 1 &&
        candidate.getDate() === day
      ) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      return raw;
    }

    // Accept YYYY-MM-DD input from date picker.
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const year = Number(iso[1]);
      const month = Number(iso[2]);
      const day = Number(iso[3]);
      const candidate = new Date(year, month - 1, day);
      if (
        candidate.getFullYear() === year &&
        candidate.getMonth() === month - 1 &&
        candidate.getDate() === day
      ) {
        return raw;
      }
      return raw;
    }

    return raw;
  };

  // Load publisher options for the multi-select
  const { data: publisherResp } = useQuery(['publishers'], async () => {
    const resp = await tablesAPI.getTableData('Publisher', 1, 100);
    return resp.data;
  });

  const { data: storesResp } = useQuery(['stores'], async () => {
    const resp = await tablesAPI.getTableData('Store', 1, 100);
    return resp.data;
  });

  const { data: statusesResp } = useQuery(['statuses'], async () => {
    const resp = await tablesAPI.getTableData('Status', 1, 100);
    return resp.data;
  });

  const { data: itemLookupResp, isLoading: itemLookupLoading } = useQuery([
    'itemLookupForCreateOrderFromItemMaster',
  ], async () => {
    try {
      const response = await tablesAPI.getItemsForLookup();
      const items = response.data?.data;
      if (Array.isArray(items) && items.length > 0) {
        return { data: items };
      }
    } catch {
      // Fall through to paginated fallback.
    }

    const allItems: ItemLookup[] = [];
    let nextPage = 1;
    while (true) {
      const response = await tablesAPI.getInventoryItems({
        page: nextPage,
        pageSize: 100,
        sortBy: 'ItemName',
        sortOrder: 'ASC',
      });
      const rows: any[] = response.data?.data || [];
      rows.forEach((item) =>
        allItems.push({ ItemID: item.ItemID, ItemName: item.ItemName, ProductID: item.ProductID })
      );
      if (nextPage >= (response.data?.totalPages ?? 1)) {
        break;
      }
      nextPage++;
    }
    return { data: allItems };
  });

  // Load collection options for the multi-select
  const { data: collectionResp } = useQuery(['collections'], async () => {
    const resp = await tablesAPI.getTableData('Collection', 1, 500);
    return resp.data;
  });

  const { data: collectionTypeResp } = useQuery(['collectionTypes'], async () => {
    const resp = await tablesAPI.getTableData('CollectionType', 1, 500);
    return resp.data;
  });

  // Load publisher-collection relationships for dependent filter options
  const { data: publisherCollectionResp } = useQuery(['publisherCollections'], async () => {
    const resp = await tablesAPI.getTableData('PublisherCollection', 1, 5000);
    return resp.data;
  });

  const publishersData = publisherResp?.data || [];
  const storesData = storesResp?.data || [];
  const statusesData = statusesResp?.data || [];
  const itemLookupData = (itemLookupResp?.data || []) as ItemLookup[];
  const collectionsData = collectionResp?.data || [];
  const collectionTypesData = collectionTypeResp?.data || [];
  const publisherCollectionLinks = publisherCollectionResp?.data || [];

  const collectionTypeNameById = useMemo(() => {
    return (collectionTypesData || []).reduce((map: Record<number, string>, item: any) => {
      if (item?.CollectionTypeID != null) {
        map[item.CollectionTypeID] = item.CollectionTypeName ?? String(item.CollectionTypeID);
      }
      return map;
    }, {});
  }, [collectionTypesData]);

  const getCollectionLabel = (collection: any) => {
    const collectionName = String(collection?.CollectionName ?? '').trim();
    const collectionTypeName = collectionTypeNameById[Number(collection?.CollectionTypeID)] ?? '';
    if (!collectionTypeName) {
      return collectionName;
    }
    return `${collectionName} (${collectionTypeName})`;
  };

  const collectionLabelById = useMemo(() => {
    return collectionsData.reduce((map: Record<number, string>, collection: any) => {
      if (collection?.CollectionID != null) {
        map[Number(collection.CollectionID)] = getCollectionLabel(collection);
      }
      return map;
    }, {});
  }, [collectionsData, collectionTypeNameById]);

  const publisherIdByName = useMemo(() => {
    return publishersData.reduce((map: Record<string, number>, item: any) => {
      if (item?.PublisherName != null && item?.PublisherID != null) {
        map[item.PublisherName] = item.PublisherID;
      }
      return map;
    }, {});
  }, [publishersData]);

  const collectionIdsByName = useMemo(() => {
    return collectionsData.reduce((map: Record<string, number[]>, item: any) => {
      if (item?.CollectionName != null && item?.CollectionID != null) {
        const key = String(item.CollectionName);
        if (!map[key]) {
          map[key] = [];
        }
        map[key].push(Number(item.CollectionID));
      }
      return map;
    }, {});
  }, [collectionsData]);

  const selectedPublisherIds = useMemo(() => {
    return (filterValues.publisherName || [])
      .map((name) => publisherIdByName[name])
      .filter((id): id is number => typeof id === 'number');
  }, [filterValues.publisherName, publisherIdByName]);

  const selectedCollectionIds = useMemo(() => {
    return Array.from(
      new Set(
        (filterValues.collectionName || []).flatMap((value) => {
          const parsedId = parseInt(value, 10);
          if (Number.isInteger(parsedId)) {
            return [parsedId];
          }
          return collectionIdsByName[value] || [];
        })
      )
    );
  }, [filterValues.collectionName, collectionIdsByName]);

  const allowedCollectionIds = useMemo(() => {
    if (selectedPublisherIds.length === 0) {
      return null;
    }

    const selectedSet = new Set(selectedPublisherIds);
    const linkedCollections = new Set<number>();
    for (const link of publisherCollectionLinks) {
      if (selectedSet.has(link.PublisherID)) {
        linkedCollections.add(link.CollectionID);
      }
    }

    return linkedCollections;
  }, [selectedPublisherIds, publisherCollectionLinks]);

  const allowedPublisherIds = useMemo(() => {
    if (selectedCollectionIds.length === 0) {
      return null;
    }

    const selectedSet = new Set(selectedCollectionIds);
    const linkedPublishers = new Set<number>();
    for (const link of publisherCollectionLinks) {
      if (selectedSet.has(link.CollectionID)) {
        linkedPublishers.add(link.PublisherID);
      }
    }

    return linkedPublishers;
  }, [selectedCollectionIds, publisherCollectionLinks]);

  const publisherOptions = useMemo(() => {
    return publishersData
      .filter((p: any) => !allowedPublisherIds || allowedPublisherIds.has(p.PublisherID))
      .map((p: any) => ({ value: p.PublisherName, label: p.PublisherName }))
      .sort((a: { value: string; label: string }, b: { value: string; label: string }) =>
        a.label.localeCompare(b.label)
      );
  }, [publishersData, allowedPublisherIds]);

  const collectionOptions = useMemo(() => {
    return collectionsData
      .filter((c: any) => !allowedCollectionIds || allowedCollectionIds.has(c.CollectionID))
      .map((c: any) => ({ value: String(c.CollectionID), label: getCollectionLabel(c) }));
  }, [collectionsData, allowedCollectionIds, collectionTypeNameById]);

  const defaultOnOrderStatusId = useMemo(() => {
    const status = statusesData.find(
      (s: any) => String(s.StatusName || '').trim().toLowerCase() === 'on order'
    );
    return status ? String(status.StatusID) : '';
  }, [statusesData]);

  const isOnOrderStatusMissing = statusesData.length > 0 && !defaultOnOrderStatusId;

  const itemLookupOptions = useMemo(() => {
    return itemLookupData.map((item) => ({
      value: String(item.ItemID),
      label: item.ProductID ? `${item.ItemName} (${item.ProductID})` : item.ItemName,
    }));
  }, [itemLookupData]);

  const itemLookupById = useMemo(() => {
    const map = new Map<number, ItemLookup>();
    itemLookupData.forEach((item) => {
      map.set(item.ItemID, item);
    });
    return map;
  }, [itemLookupData]);

  const formatCurrency = (amount?: number) => {
    if (amount === null || amount === undefined) {
      return '-';
    }
    return `$${amount.toFixed(2)}`;
  };

  const publisherSelectOptions = useMemo(() => {
    return publishersData
      .map((p: any) => ({ value: p.PublisherID, label: p.PublisherName }))
      .sort((a: { value: string | number; label: string }, b: { value: string | number; label: string }) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
      );
  }, [publishersData]);
  const addPublisherSelectOptions = useMemo(() => {
    return [...publisherSelectOptions].sort((a: { value: string | number; label: string }, b: { value: string | number; label: string }) =>
      a.label.localeCompare(b.label)
    );
  }, [publisherSelectOptions]);
  const collectionSelectOptions = collectionsData.map((c: any) => ({ value: c.CollectionID, label: getCollectionLabel(c) }));
  const collectionUploadOptions = collectionsData.map((c: any) => ({ value: String(c.CollectionID), label: getCollectionLabel(c) }));

  useEffect(() => {
    if (!allowedCollectionIds) {
      return;
    }

    setFilterValues((current) => {
      const nextCollectionNames = current.collectionName.filter((value) => {
        const id = parseInt(value, 10);
        return Number.isInteger(id) && allowedCollectionIds.has(id);
      });

      if (nextCollectionNames.length === current.collectionName.length) {
        return current;
      }

      return {
        ...current,
        collectionName: nextCollectionNames,
      };
    });
  }, [allowedCollectionIds]);

  useEffect(() => {
    if (!allowedPublisherIds) {
      return;
    }

    setFilterValues((current) => {
      const nextPublisherNames = current.publisherName.filter((name) => {
        const id = publisherIdByName[name];
        return typeof id === 'number' && allowedPublisherIds.has(id);
      });

      if (nextPublisherNames.length === current.publisherName.length) {
        return current;
      }

      return {
        ...current,
        publisherName: nextPublisherNames,
      };
    });
  }, [allowedPublisherIds, publisherIdByName]);

  // Load category options for the multi-select
  const { data: categoryResp } = useQuery(['categories'], async () => {
    const resp = await tablesAPI.getTableData('Category', 1, 500);
    return resp.data;
  });

  // Load subtype options for the multi-select
  const { data: subTypeResp } = useQuery(['subtypes'], async () => {
    const resp = await tablesAPI.getTableData('SubType', 1, 500);
    return resp.data;
  });

  // Load category-subtype relationships for dependent filter options
  const { data: categorySubTypeResp } = useQuery(['categorySubTypes'], async () => {
    const resp = await tablesAPI.getTableData('CategorySubType', 1, 5000);
    return resp.data;
  });

  const categoriesData = categoryResp?.data || [];
  const subTypesData = subTypeResp?.data || [];
  const categorySubTypeLinks = categorySubTypeResp?.data || [];

  const categoryIdByName = useMemo(() => {
    return categoriesData.reduce((map: Record<string, number>, item: any) => {
      if (item?.CategoryName != null && item?.CategoryID != null) {
        map[item.CategoryName] = item.CategoryID;
      }
      return map;
    }, {});
  }, [categoriesData]);

  const subTypeIdByName = useMemo(() => {
    return subTypesData.reduce((map: Record<string, number>, item: any) => {
      if (item?.SubTypeName != null && item?.SubTypeID != null) {
        map[item.SubTypeName] = item.SubTypeID;
      }
      return map;
    }, {});
  }, [subTypesData]);

  const selectedCategoryIds = useMemo(() => {
    return (filterValues.categoryName || [])
      .map((name) => categoryIdByName[name])
      .filter((id): id is number => typeof id === 'number');
  }, [filterValues.categoryName, categoryIdByName]);

  const selectedSubTypeIds = useMemo(() => {
    return (filterValues.subTypeName || [])
      .map((name) => subTypeIdByName[name])
      .filter((id): id is number => typeof id === 'number');
  }, [filterValues.subTypeName, subTypeIdByName]);

  const allowedSubTypeIds = useMemo(() => {
    if (selectedCategoryIds.length === 0) {
      return null;
    }

    const selectedSet = new Set(selectedCategoryIds);
    const linkedSubTypes = new Set<number>();
    for (const link of categorySubTypeLinks) {
      if (selectedSet.has(link.CategoryID)) {
        linkedSubTypes.add(link.SubTypeID);
      }
    }

    return linkedSubTypes;
  }, [selectedCategoryIds, categorySubTypeLinks]);

  const allowedCategoryIds = useMemo(() => {
    if (selectedSubTypeIds.length === 0) {
      return null;
    }

    const selectedSet = new Set(selectedSubTypeIds);
    const linkedCategories = new Set<number>();
    for (const link of categorySubTypeLinks) {
      if (selectedSet.has(link.SubTypeID)) {
        linkedCategories.add(link.CategoryID);
      }
    }

    return linkedCategories;
  }, [selectedSubTypeIds, categorySubTypeLinks]);

  const categoryOptions = useMemo(() => {
    return categoriesData
      .filter((c: any) => !allowedCategoryIds || allowedCategoryIds.has(c.CategoryID))
      .map((c: any) => ({ value: c.CategoryName, label: c.CategoryName }));
  }, [categoriesData, allowedCategoryIds]);

  const subTypeOptions = useMemo(() => {
    return subTypesData
      .filter((s: any) => !allowedSubTypeIds || allowedSubTypeIds.has(s.SubTypeID))
      .map((s: any) => ({ value: s.SubTypeName, label: s.SubTypeName }));
  }, [subTypesData, allowedSubTypeIds]);

  const categorySelectOptions = categoriesData.map((c: any) => ({ value: c.CategoryID, label: c.CategoryName }));
  const subTypeSelectOptions = subTypesData.map((s: any) => ({ value: s.SubTypeID, label: s.SubTypeName }));

  const allowedAddSubTypeIds = useMemo(() => {
    const categoryId = parseInt(addValues.CategoryID, 10);
    if (!Number.isInteger(categoryId)) {
      return null;
    }

    const ids = new Set<number>();
    for (const link of categorySubTypeLinks) {
      if (link.CategoryID === categoryId) {
        ids.add(link.SubTypeID);
      }
    }

    return ids;
  }, [addValues.CategoryID, categorySubTypeLinks]);

  const allowedAddCollectionIds = useMemo(() => {
    const publisherId = parseInt(addValues.PublisherID, 10);
    if (!Number.isInteger(publisherId)) {
      return null;
    }

    const ids = new Set<number>();
    for (const link of publisherCollectionLinks) {
      if (link.PublisherID === publisherId) {
        ids.add(link.CollectionID);
      }
    }

    return ids;
  }, [addValues.PublisherID, publisherCollectionLinks]);

  const allowedEditSubTypeIds = useMemo(() => {
    const categoryId = parseInt(editValues.CategoryID, 10);
    if (!Number.isInteger(categoryId)) {
      return null;
    }

    const ids = new Set<number>();
    for (const link of categorySubTypeLinks) {
      if (link.CategoryID === categoryId) {
        ids.add(link.SubTypeID);
      }
    }

    return ids;
  }, [editValues.CategoryID, categorySubTypeLinks]);

  const allowedEditCollectionIds = useMemo(() => {
    const publisherId = parseInt(editValues.PublisherID, 10);
    if (!Number.isInteger(publisherId)) {
      return null;
    }

    const ids = new Set<number>();
    for (const link of publisherCollectionLinks) {
      if (link.PublisherID === publisherId) {
        ids.add(link.CollectionID);
      }
    }

    return ids;
  }, [editValues.PublisherID, publisherCollectionLinks]);

  const addSubTypeSelectOptions = useMemo(() => {
    return subTypeSelectOptions.filter((option: { value: string | number; label: string }) =>
      !allowedAddSubTypeIds || allowedAddSubTypeIds.has(Number(option.value))
    );
  }, [subTypeSelectOptions, allowedAddSubTypeIds]);

  const addCollectionSelectOptions = useMemo(() => {
    return collectionSelectOptions.filter((option: { value: string | number; label: string }) =>
      !allowedAddCollectionIds || allowedAddCollectionIds.has(Number(option.value))
    );
  }, [collectionSelectOptions, allowedAddCollectionIds]);

  const editSubTypeSelectOptions = useMemo(() => {
    return subTypeSelectOptions.filter((option: { value: string | number; label: string }) =>
      !allowedEditSubTypeIds || allowedEditSubTypeIds.has(Number(option.value))
    );
  }, [subTypeSelectOptions, allowedEditSubTypeIds]);

  const editCollectionSelectOptions = useMemo(() => {
    return collectionSelectOptions.filter((option: { value: string | number; label: string }) =>
      !allowedEditCollectionIds || allowedEditCollectionIds.has(Number(option.value))
    );
  }, [collectionSelectOptions, allowedEditCollectionIds]);

  useEffect(() => {
    if (!allowedSubTypeIds) {
      return;
    }

    setFilterValues((current) => {
      const nextSubTypeNames = current.subTypeName.filter((name) => {
        const id = subTypeIdByName[name];
        return typeof id === 'number' && allowedSubTypeIds.has(id);
      });

      if (nextSubTypeNames.length === current.subTypeName.length) {
        return current;
      }

      return {
        ...current,
        subTypeName: nextSubTypeNames,
      };
    });
  }, [allowedSubTypeIds, subTypeIdByName]);

  useEffect(() => {
    if (!allowedCategoryIds) {
      return;
    }

    setFilterValues((current) => {
      const nextCategoryNames = current.categoryName.filter((name) => {
        const id = categoryIdByName[name];
        return typeof id === 'number' && allowedCategoryIds.has(id);
      });

      if (nextCategoryNames.length === current.categoryName.length) {
        return current;
      }

      return {
        ...current,
        categoryName: nextCategoryNames,
      };
    });
  }, [allowedCategoryIds, categoryIdByName]);

  useEffect(() => {
    if (!allowedAddSubTypeIds || !addValues.SubTypeID) {
      return;
    }

    const subTypeId = parseInt(addValues.SubTypeID, 10);
    if (!Number.isInteger(subTypeId) || allowedAddSubTypeIds.has(subTypeId)) {
      return;
    }

    setAddValues((current) => ({ ...current, SubTypeID: '' }));
  }, [allowedAddSubTypeIds, addValues.SubTypeID]);

  useEffect(() => {
    if (!allowedAddCollectionIds || !addValues.CollectionID) {
      return;
    }

    const collectionId = parseInt(addValues.CollectionID, 10);
    if (!Number.isInteger(collectionId) || allowedAddCollectionIds.has(collectionId)) {
      return;
    }

    setAddValues((current) => ({ ...current, CollectionID: '' }));
  }, [allowedAddCollectionIds, addValues.CollectionID]);

  useEffect(() => {
    if (!allowedEditSubTypeIds || !editValues.SubTypeID) {
      return;
    }

    const subTypeId = parseInt(editValues.SubTypeID, 10);
    if (!Number.isInteger(subTypeId) || allowedEditSubTypeIds.has(subTypeId)) {
      return;
    }

    setEditValues((current) => ({ ...current, SubTypeID: '' }));
  }, [allowedEditSubTypeIds, editValues.SubTypeID]);

  useEffect(() => {
    if (!allowedEditCollectionIds || !editValues.CollectionID) {
      return;
    }

    const collectionId = parseInt(editValues.CollectionID, 10);
    if (!Number.isInteger(collectionId) || allowedEditCollectionIds.has(collectionId)) {
      return;
    }

    setEditValues((current) => ({ ...current, CollectionID: '' }));
  }, [allowedEditCollectionIds, editValues.CollectionID]);

  const { data, isLoading, error } = useQuery<
    {
      data: InventoryItem[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    },
    Error
  >({
    queryKey,
    queryFn: async () => {
      const cleanedParams = buildCleanedInventoryFilters(filterValues);

      const response = await tablesAPI.getInventoryItems({
        ...cleanedParams,
        page,
        pageSize: 10,
        sortBy,
        sortOrder,
      });
      return response.data;
    },
    keepPreviousData: true,
  });

  const gridRowTabIndexStart = 33;
  const gridRowCount = Array.isArray(data?.data) ? data.data.length : 0;
  const pagerTabIndexStart = gridRowTabIndexStart + gridRowCount * 4;

  const currentPageItems: InventoryItem[] = Array.isArray(data?.data) ? data.data : [];
  const currentPageItemsWithImages = useMemo(
    () => currentPageItems.filter((item) => Boolean(item.ImageFileName)),
    [currentPageItems]
  );
  const currentImageItemIndex = useMemo(() => {
    if (!viewingImageItem) {
      return -1;
    }

    return currentPageItemsWithImages.findIndex((item) => item.ItemID === viewingImageItem.ItemID);
  }, [currentPageItemsWithImages, viewingImageItem]);
  const currentEditItemIndex = useMemo(() => {
    if (!editingItem) {
      return -1;
    }

    return currentPageItems.findIndex((item) => item.ItemID === editingItem.ItemID);
  }, [currentPageItems, editingItem]);
  const totalPages = data?.totalPages ?? 1;
  const canNavigateToPreviousEditItem = Boolean(
    editingItem && (currentEditItemIndex > 0 || page > 1)
  );
  const canNavigateToNextEditItem = Boolean(
    editingItem && ((currentEditItemIndex >= 0 && currentEditItemIndex < currentPageItems.length - 1) || page < totalPages)
  );
  const selectedItemIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const selectedCurrentPageItems = useMemo(
    () => currentPageItems.filter((item) => selectedItemIdSet.has(item.ItemID)),
    [currentPageItems, selectedItemIdSet]
  );
  const areAllCurrentPageItemsSelected = currentPageItems.length > 0 && currentPageItems.every((item) => selectedItemIdSet.has(item.ItemID));

  const selectCurrentPageItems = () => {
    setSelectedItemIds(currentPageItems.map((item) => item.ItemID));
  };

  const selectAllFilteredItems = async () => {
    const cleanedParams = buildCleanedInventoryFilters(filterValues);
    const allIds: number[] = [];
    let nextPage = 1;
    let totalPages = 1;

    while (nextPage <= totalPages) {
      const response = await tablesAPI.getInventoryItems({
        ...cleanedParams,
        page: nextPage,
        pageSize: 100,
        sortBy,
        sortOrder,
      });

      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      rows.forEach((item: InventoryItem) => allIds.push(item.ItemID));
      totalPages = Number(response.data?.totalPages || 1);
      nextPage += 1;
    }

    setSelectedItemIds(allIds);
  };

  const bulkUpdateMutation = useMutation({
    mutationFn: async (payload: { itemIds: number[]; updates: Record<string, number | string | boolean> }) => {
      return tablesAPI.bulkUpdateItems({ itemIds: payload.itemIds, ...payload.updates });
    },
    onSuccess: () => {
      const updatedCount = selectedItemIds.length;
      queryClient.invalidateQueries({ queryKey });
      setSelectedItemIds([]);
      setIsBulkUpdateOpen(false);
      setBulkStep('edit');
      setBulkValues({
        PublisherID: '',
        CollectionID: '',
        CategoryID: '',
        SubTypeID: '',
        ItemVersion: '',
        IsPhysical: '',
        IsDigital: '',
      });
      setBulkError('');
      toast({
        title: updatedCount === 1 ? 'Item Updated' : 'Items Updated',
        description:
          updatedCount === 1
            ? 'Applied bulk updates to 1 selected item.'
            : `Applied bulk updates to ${updatedCount} selected items.`,
        variant: 'success',
      });
    },
    onError: (error: any) => {
      setBulkError(error.response?.data?.error || 'Failed to bulk update items');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (itemIds: number[]) => {
      await Promise.all(itemIds.map((itemId) => tablesAPI.deleteRecord('Item', itemId)));
    },
    onSuccess: () => {
      const deletedCount = selectedItemIds.length;
      queryClient.invalidateQueries({ queryKey });
      setSelectedItemIds([]);
      setIsBulkDeleteOpen(false);
      setBulkDeleteConfirmText('');
      setBulkDeleteError('');
      toast({
        title: deletedCount === 1 ? 'Item Deleted' : 'Items Deleted',
        description:
          deletedCount === 1
            ? 'Removed 1 selected item from Item Master.'
            : `Removed ${deletedCount} selected items from Item Master.`,
        variant: 'success',
      });
    },
    onError: (error: any) => {
      setBulkDeleteError(error.response?.data?.error || 'Failed to bulk delete selected items');
    },
  });

  const handleChipFiltersChange = (patch: Partial<typeof filterValues>) => {
    setDownloadError('');
    setFilterValues((current) => ({ ...current, ...patch }));
  };

  const clearAllChipFilters = () => {
    handleChipFiltersChange({
      publisherName: [],
      collectionName: [],
      categoryName: [],
      subTypeName: [],
      itemVersion: '',
      releaseDateFrom: '',
      releaseDateTo: '',
      isPhysical: undefined,
      isDigital: undefined,
      hasPurchaseOrder: undefined,
    });
  };

  const filterChipFields: FilterChipField[] = [
    {
      key: 'publisher',
      label: 'Publisher',
      kind: 'multi',
      options: publisherOptions,
      selected: filterValues.publisherName,
      onAdd: (value) => handleChipFiltersChange({ publisherName: [...filterValues.publisherName, value] }),
      onRemove: (value) => handleChipFiltersChange({ publisherName: filterValues.publisherName.filter((v) => v !== value) }),
    },
    {
      key: 'collection',
      label: 'Collection',
      kind: 'multi',
      options: collectionOptions,
      selected: filterValues.collectionName,
      onAdd: (value) => handleChipFiltersChange({ collectionName: [...filterValues.collectionName, value] }),
      onRemove: (value) => handleChipFiltersChange({ collectionName: filterValues.collectionName.filter((v) => v !== value) }),
    },
    {
      key: 'category',
      label: 'Category',
      kind: 'multi',
      options: categoryOptions,
      selected: filterValues.categoryName,
      onAdd: (value) => handleChipFiltersChange({ categoryName: [...filterValues.categoryName, value] }),
      onRemove: (value) => handleChipFiltersChange({ categoryName: filterValues.categoryName.filter((v) => v !== value) }),
    },
    {
      key: 'subType',
      label: 'Sub Category',
      kind: 'multi',
      options: subTypeOptions,
      selected: filterValues.subTypeName,
      onAdd: (value) => handleChipFiltersChange({ subTypeName: [...filterValues.subTypeName, value] }),
      onRemove: (value) => handleChipFiltersChange({ subTypeName: filterValues.subTypeName.filter((v) => v !== value) }),
    },
    {
      key: 'version',
      label: 'Version',
      kind: 'text',
      value: filterValues.itemVersion,
      onApply: (value) => handleChipFiltersChange({ itemVersion: value }),
      onClear: () => handleChipFiltersChange({ itemVersion: '' }),
    },
    {
      key: 'releaseDate',
      label: 'Release Date',
      kind: 'dateRange',
      from: filterValues.releaseDateFrom,
      to: filterValues.releaseDateTo,
      onApply: (from, to) => handleChipFiltersChange({ releaseDateFrom: from, releaseDateTo: to }),
      onClear: () => handleChipFiltersChange({ releaseDateFrom: '', releaseDateTo: '' }),
    },
    {
      key: 'owned',
      label: 'Owned',
      kind: 'yesNo',
      value: filterValues.hasPurchaseOrder,
      onApply: (value) => handleChipFiltersChange({ hasPurchaseOrder: value }),
    },
    {
      key: 'isPhysical',
      label: 'Is Physical',
      kind: 'yesNo',
      value: filterValues.isPhysical,
      onApply: (value) => handleChipFiltersChange({ isPhysical: value }),
    },
    {
      key: 'isDigital',
      label: 'Is Digital',
      kind: 'yesNo',
      value: filterValues.isDigital,
      onApply: (value) => handleChipFiltersChange({ isDigital: value }),
    },
  ];

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
    setPage(1);
  };

  const SortIndicator = ({ column }: { column: string }) => {
    if (sortBy !== column) {
      return <span className="ml-1 text-[var(--arcane-ink-soft)]">↕</span>;
    }
    return <span className="ml-1">{sortOrder === 'ASC' ? '↑' : '↓'}</span>;
  };

  const openBulkUpdateDialog = () => {
    if (selectedItemIds.length < 1) {
      return;
    }

    setBulkError('');
    setBulkStep('edit');
    setIsBulkUpdateOpen(true);
  };

  const openBulkDeleteDialog = () => {
    if (selectedItemIds.length < 1) {
      return;
    }

    setBulkDeleteError('');
    setBulkDeleteConfirmText('');
    setIsBulkDeleteOpen(true);
  };

  const closeBulkDeleteDialog = () => {
    setIsBulkDeleteOpen(false);
    setBulkDeleteConfirmText('');
    setBulkDeleteError('');
  };

  const handleBulkDeleteConfirm = () => {
    if (bulkDeleteConfirmText.trim() !== 'DELETE') {
      setBulkDeleteError('Type DELETE exactly to enable bulk delete.');
      return;
    }

    setBulkDeleteError('');
    bulkDeleteMutation.mutate(selectedItemIds);
  };

  const closeBulkUpdateDialog = () => {
    setIsBulkUpdateOpen(false);
    setBulkStep('edit');
    setBulkError('');
    setBulkValues({
      PublisherID: '',
      CollectionID: '',
      CategoryID: '',
      SubTypeID: '',
      ItemVersion: '',
      IsPhysical: '',
      IsDigital: '',
    });
  };

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const invoiceNumber = createOrderValues.InvoiceNumber.trim();
      if (!invoiceNumber) {
        throw new Error('Invoice Number is required.');
      }

      const storeId = parseInt(createOrderValues.StoreID, 10);
      if (!Number.isInteger(storeId) || storeId <= 0) {
        throw new Error('Store is required.');
      }

      const statusId = parseInt(createOrderValues.StatusID, 10);
      if (!Number.isInteger(statusId) || statusId <= 0) {
        throw new Error('Order Status is required.');
      }

      const purchaseDateParts = parseDateParts(createOrderValues.PurchaseDate);
      if (!purchaseDateParts) {
        throw new Error('Purchase Date is required.');
      }

      if (!createOrderDetails.length) {
        throw new Error('At least one inventory item is required.');
      }

      const normalizedDetails = createOrderDetails.map((detail, i) => {
        const itemId = parseInt(detail.ItemID, 10);
        const quantity = Number(detail.Quantity);
        const price = Number(detail.Price);
        if (!Number.isInteger(itemId) || itemId <= 0) {
          throw new Error(`Row ${i + 1}: Item Name is required.`);
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`Row ${i + 1}: Quantity must be greater than 0.`);
        }
        if (!Number.isFinite(price) || price < 0) {
          throw new Error(`Row ${i + 1}: Price must be 0 or greater.`);
        }
        return { ItemID: itemId, Quantity: quantity, Price: price };
      });

      const purchasedDate = `${purchaseDateParts.year}-${String(purchaseDateParts.month).padStart(2, '0')}-${String(
        purchaseDateParts.day
      ).padStart(2, '0')}`;

      const response = await tablesAPI.createPurchaseOrderWithDetails({
        InvoiceNumber: invoiceNumber,
        StoreID: storeId,
        StatusID: statusId,
        PurchasedDate: purchasedDate,
        details: normalizedDetails,
      });

      return response.data.PurchaseOrderID as number;
    },
    onSuccess: (newOrderId: number) => {
      const detailCount = createOrderDetails.length;
      setCreateOrderError(null);
      setIsCreateOrderModalOpen(false);
      setCreateOrderValues({
        InvoiceNumber: '',
        StoreID: '',
        StatusID: '',
        PurchaseDate: '',
      });
      setCreateOrderDetails([{ id: 1, ItemID: '', Quantity: '1', Price: '' }]);
      setNextCreateOrderDetailRowId(2);
      setSelectedItemIds([]);
      toast({
        title: 'Order Created',
        description:
          detailCount === 1
            ? `Created order #${newOrderId} with 1 line item from selected inventory.`
            : `Created order #${newOrderId} with ${detailCount} line items from selected inventory.`,
        variant: 'success',
      });
    },
    onError: (error: any) => {
      setCreateOrderError(error.response?.data?.error || error.message || 'Failed to create order');
    },
  });

  const closeCreateOrderModal = () => {
    setIsCreateOrderModalOpen(false);
    setCreateOrderError(null);
    setCreateOrderValues({
      InvoiceNumber: '',
      StoreID: '',
      StatusID: '',
      PurchaseDate: '',
    });
    setCreateOrderDetails([{ id: 1, ItemID: '', Quantity: '1', Price: '' }]);
    setNextCreateOrderDetailRowId(2);
  };

  const openCreateOrderModal = () => {
    if (!selectedCurrentPageItems.length) {
      return;
    }

    const selectedItemsHavePurchaseOrder = selectedCurrentPageItems.some((item) =>
      typeof item.HasPurchaseOrder === 'boolean'
        ? item.HasPurchaseOrder
        : Boolean(fallbackHasPurchaseOrder[item.ItemID])
    );

    if (selectedItemsHavePurchaseOrder) {
      const confirmed = window.confirm(
        'A purchase order already exists for one or more of the selected items.  Are you sure you want to continue?'
      );

      if (!confirmed) {
        return;
      }
    }

    const today = new Date();
    const initialDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;

    const initialDetails = selectedCurrentPageItems.map((item, index) => ({
      id: index + 1,
      ItemID: String(item.ItemID),
      Quantity: '1',
      Price: '',
    }));

    setCreateOrderError(null);
    setCreateOrderValues({
      InvoiceNumber: '',
      StoreID: '',
      StatusID: defaultOnOrderStatusId,
      PurchaseDate: initialDate,
    });
    setCreateOrderDetails(initialDetails.length ? initialDetails : [{ id: 1, ItemID: '', Quantity: '1', Price: '' }]);
    setNextCreateOrderDetailRowId((initialDetails.length || 1) + 1);
    setIsCreateOrderModalOpen(true);
  };

  const handleCreateOrderFieldChange = (
    field: 'InvoiceNumber' | 'StoreID' | 'StatusID' | 'PurchaseDate',
    value: string
  ) => {
    setCreateOrderValues((current) => ({ ...current, [field]: value }));
  };

  useEffect(() => {
    if (!isCreateOrderModalOpen || createOrderValues.StatusID || !defaultOnOrderStatusId) {
      return;
    }

    setCreateOrderValues((current) => ({ ...current, StatusID: defaultOnOrderStatusId }));
  }, [isCreateOrderModalOpen, createOrderValues.StatusID, defaultOnOrderStatusId]);

  const handleCreateOrderDetailChange = (rowId: number, field: 'ItemID' | 'Quantity' | 'Price', value: string) => {
    setCreateOrderDetails((current) =>
      current.map((detail) => (detail.id === rowId ? { ...detail, [field]: value } : detail))
    );
  };

  const handleCreateOrderAddDetailRow = () => {
    setCreateOrderDetails((current) => [...current, { id: nextCreateOrderDetailRowId, ItemID: '', Quantity: '1', Price: '' }]);
    setNextCreateOrderDetailRowId((current) => current + 1);
  };

  const handleCreateOrderRemoveDetailRow = (rowId: number) => {
    setCreateOrderDetails((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((detail) => detail.id !== rowId);
    });
  };

  const handleCreateOrderSubmit = () => {
    setCreateOrderError(null);
    createOrderMutation.mutate();
  };

  const toggleItemSelection = (itemId: number) => {
    setSelectedItemIds((current) =>
      current.includes(itemId) ? current.filter((selectedId) => selectedId !== itemId) : [...current, itemId]
    );
  };

  const handleBulkFieldChange = (field: 'PublisherID' | 'CollectionID' | 'CategoryID' | 'SubTypeID' | 'ItemVersion', value: string) => {
    setBulkError('');
    setBulkValues((current) => ({ ...current, [field]: value }));
  };

  const handleBulkBooleanFieldChange = (field: 'IsPhysical' | 'IsDigital', value: string) => {
    setBulkError('');
    setBulkValues((current) => ({ ...current, [field]: value }));
  };

  const buildBulkUpdatePayload = () => {
    const updates: Record<string, number | string | boolean> = {};

    if (bulkValues.PublisherID) {
      updates.PublisherID = parseInt(bulkValues.PublisherID, 10);
    }
    if (bulkValues.CollectionID) {
      updates.CollectionID = parseInt(bulkValues.CollectionID, 10);
    }
    if (bulkValues.CategoryID) {
      updates.CategoryID = parseInt(bulkValues.CategoryID, 10);
    }
    if (bulkValues.SubTypeID) {
      updates.SubTypeID = parseInt(bulkValues.SubTypeID, 10);
    }
    if (bulkValues.ItemVersion.trim()) {
      updates.ItemVersion = bulkValues.ItemVersion.trim();
    }
    if (bulkValues.IsPhysical) {
      updates.IsPhysical = bulkValues.IsPhysical === 'true';
    }
    if (bulkValues.IsDigital) {
      updates.IsDigital = bulkValues.IsDigital === 'true';
    }

    return updates;
  };

  const getBulkFieldLabel = (field: 'PublisherID' | 'CollectionID' | 'CategoryID' | 'SubTypeID' | 'ItemVersion' | 'IsPhysical' | 'IsDigital', value: string) => {
    if (!value) {
      return '';
    }

    if (field === 'ItemVersion') {
      return value;
    }

    if (field === 'IsPhysical' || field === 'IsDigital') {
      return value === 'true' ? 'Yes' : 'No';
    }

    const numericValue = parseInt(value, 10);
    const source =
      field === 'PublisherID'
        ? publisherSelectOptions
        : field === 'CollectionID'
          ? collectionSelectOptions
          : field === 'CategoryID'
            ? categorySelectOptions
            : subTypeSelectOptions;

    return source.find((option: { value: string | number; label: string }) => Number(option.value) === numericValue)?.label || value;
  };

  const handleBulkPreview = () => {
    const updates = buildBulkUpdatePayload();
    if (Object.keys(updates).length === 0) {
      setBulkError('Select at least one field to update.');
      return;
    }

    setBulkError('');
    setBulkStep('confirm');
  };

  const handleBulkConfirm = () => {
    const updates = buildBulkUpdatePayload();
    if (Object.keys(updates).length === 0) {
      setBulkError('Select at least one field to update.');
      setBulkStep('edit');
      return;
    }

    bulkUpdateMutation.mutate({
      itemIds: selectedItemIds,
      updates,
    });
  };

  const buildCleanedInventoryFilters = (filters: Record<string, any>) => {
    return Object.entries(filters).reduce((acc, [key, value]) => {
      if (Array.isArray(value)) {
        const nonEmptyValues = value.filter((entry) => typeof entry === 'string' && entry.trim().length > 0);
        if (nonEmptyValues.length > 0) {
          acc[key] = nonEmptyValues;
        }
        return acc;
      }

      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          acc[key] = trimmed;
        }
        return acc;
      }

      if (value !== null && value !== undefined) {
        acc[key] = value;
      }

      return acc;
    }, {} as Record<string, any>);
  };

  const csvEscape = (rawValue: string) => {
    // Strip null bytes and protect spreadsheet clients from interpreting formulas.
    let value = rawValue.replace(/\u0000/g, '');
    if (/^[=+\-@]/.test(value)) {
      value = `'${value}`;
    }

    if (value.includes('"')) {
      value = value.replace(/"/g, '""');
    }

    if (value.includes(',') || value.includes('\n') || value.includes('\r') || value.includes('"')) {
      return `"${value}"`;
    }

    return value;
  };

  const formatDateForCsv = (date?: string | null) => {
    const parts = parseDateParts(date || undefined);
    if (!parts) {
      return '';
    }

    return `${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}/${parts.year}`;
  };

  const buildCsvContent = (rows: InventoryExportRow[]) => {
    const headers = [
      'Publisher',
      'Collection',
      'Item',
      'Version',
      'Category',
      'SubType',
      'ProductID',
      'Release Date',
      'Is Physical',
      'Is Digital',
      'Store',
      'Invoice Number',
      'Purchase Date',
      'Price',
      'Count',
      'PO Status',
    ];

    const lines = rows.map((row) => {
      const values = [
        row.Publisher || '',
        row.Collection || '',
        row.Item || '',
        row.Version || '',
        row.Category || '',
        row.SubType || '',
        row.ProductID || '',
        formatDateForCsv(row.ReleaseDate),
        row.IsPhysical ? 'Yes' : 'No',
        row.IsDigital ? 'Yes' : 'No',
        row.Store || '',
        row.InvoiceNumber || '',
        formatDateForCsv(row.PurchaseDate),
        row.Price !== null && row.Price !== undefined ? Number(row.Price).toFixed(2) : '',
        row.Count !== null && row.Count !== undefined ? String(row.Count) : '',
        row.POStatus || '',
      ];

      return values.map((value) => csvEscape(String(value))).join(',');
    });

    return [headers.join(','), ...lines].join('\r\n');
  };

  const handleDownloadCsv = async () => {
    try {
      setIsDownloading(true);
      setDownloadError('');

      const cleanedParams = buildCleanedInventoryFilters(filterValues);
      const response = await tablesAPI.getInventoryExportRows(cleanedParams);
      const rows = (response.data?.data || []) as InventoryExportRow[];

      const csvContent = buildCsvContent(rows);
      // Prefix UTF-8 BOM so Excel preserves special characters consistently.
      const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `item-master-export-${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setDownloadError(error.response?.data?.error || error.message || 'Failed to download CSV');
    } finally {
      setIsDownloading(false);
    }
  };

  const openEditModal = (item: InventoryItem) => {
    setPendingEditNavigation(null);
    setEditingItem(item);
    setSelectedEditImageFile(null);
    setEditCropSourceFile(null);
    setEditValues({
      ItemName: item.ItemName || '',
      ItemVersion: item.ItemVersion || '',
      ProductID: item.ProductID || '',
      ReleaseDate: formatReleaseDateForModal(item.ReleaseDate),
      IsPhysical: Boolean(item.IsPhysical),
      IsDigital: Boolean(item.IsDigital),
      PublisherID: String(item.PublisherID),
      CollectionID: String(item.CollectionID),
      CategoryID: String(item.CategoryID),
      SubTypeID: String(item.SubTypeID),
    });
    setEditError('');
  };

  const originalEditValues = useMemo(() => {
    if (!editingItem) {
      return null;
    }

    return {
      ItemName: editingItem.ItemName || '',
      ItemVersion: editingItem.ItemVersion || '',
      ProductID: editingItem.ProductID || '',
      ReleaseDate: formatReleaseDateForModal(editingItem.ReleaseDate),
      IsPhysical: Boolean(editingItem.IsPhysical),
      IsDigital: Boolean(editingItem.IsDigital),
      PublisherID: String(editingItem.PublisherID),
      CollectionID: String(editingItem.CollectionID),
      CategoryID: String(editingItem.CategoryID),
      SubTypeID: String(editingItem.SubTypeID),
    };
  }, [editingItem]);

  const isEditDirty = useMemo(() => {
    if (!originalEditValues) {
      return false;
    }

    return selectedEditImageFile !== null || Object.keys(originalEditValues).some((key) => {
      const field = key as keyof typeof originalEditValues;
      return editValues[field] !== originalEditValues[field];
    });
  }, [editValues, originalEditValues, selectedEditImageFile]);

  useEffect(() => {
    if (!editingItem) {
      return;
    }

    editItemInputRef.current?.focus();
  }, [editingItem]);

  useEffect(() => {
    if (!selectedEditImageFile) {
      setSelectedEditImageUrl('');
      return;
    }

    const previewUrl = URL.createObjectURL(selectedEditImageFile);
    setSelectedEditImageUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedEditImageFile]);

  const handleOpenRelatedOrders = async (item: InventoryItem, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setSelectedItemForRelatedOrders(item);
    setRelatedOrders([]);
    setRelatedOrdersError('');
    setRelatedOrdersLoading(true);
    setIsRelatedOrdersModalOpen(true);

    try {
      const response = await tablesAPI.getPurchaseOrdersByItem(item.ItemID);
      setRelatedOrders(response.data?.data || []);
    } catch (error: any) {
      setRelatedOrdersError(error.response?.data?.error || error.message || 'Failed to load related purchase orders');
    } finally {
      setRelatedOrdersLoading(false);
    }
  };

  const handleOpenLinkedOrder = (order: LinkedPurchaseOrder) => {
    setIsRelatedOrdersModalOpen(false);
    navigate(`/home/orders?purchaseOrderId=${order.PurchaseOrderID}`);
  };

  useEffect(() => {
    if (!isRelatedOrdersModalOpen || relatedOrdersLoading) {
      return;
    }

    if (!relatedOrdersError && relatedOrders.length > 0) {
      firstRelatedOrderOpenButtonRef.current?.focus();
      return;
    }

    relatedOrdersCloseButtonRef.current?.focus();
  }, [isRelatedOrdersModalOpen, relatedOrdersLoading, relatedOrdersError, relatedOrders.length]);

  useEffect(() => {
    const currentItems: InventoryItem[] = Array.isArray(data?.data) ? data.data : [];
    const itemsMissingFlag = currentItems.filter((item) => typeof item.HasPurchaseOrder === 'undefined');

    if (!itemsMissingFlag.length) {
      return;
    }

    const itemIdsToCheck = itemsMissingFlag
      .map((item) => item.ItemID)
      .filter((itemId) => typeof fallbackHasPurchaseOrder[itemId] === 'undefined');

    if (!itemIdsToCheck.length) {
      return;
    }

    let isCancelled = false;

    const fetchFallbackAvailability = async () => {
      const results = await Promise.allSettled(
        itemIdsToCheck.map(async (itemId) => {
          const response = await tablesAPI.getPurchaseOrdersByItem(itemId);
          const hasPurchaseOrder = Array.isArray(response.data?.data) && response.data.data.length > 0;
          return { itemId, hasPurchaseOrder };
        })
      );

      if (isCancelled) {
        return;
      }

      setFallbackHasPurchaseOrder((current) => {
        const next = { ...current };
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            next[result.value.itemId] = result.value.hasPurchaseOrder;
          }
        });
        return next;
      });
    };

    fetchFallbackAvailability();

    return () => {
      isCancelled = true;
    };
  }, [data?.data, fallbackHasPurchaseOrder]);

  const handleCloseRelatedOrdersModal = () => {
    setIsRelatedOrdersModalOpen(false);
    setRelatedOrdersLoading(false);
    setRelatedOrdersError('');
    setRelatedOrders([]);
    setSelectedItemForRelatedOrders(null);
  };

  const requestCloseEditModal = () => {
    if (isEditDirty) {
      const confirmed = window.confirm('Changes have not been applied. Close without saving?');
      if (!confirmed) {
        return;
      }
    }

    closeEditModal();
  };

  const handleNavigateEditItem = (direction: 'previous' | 'next') => {
    if (!editingItem) {
      return;
    }

    if (isEditDirty) {
      const confirmed = window.confirm('Changes have not been applied. Move to another item without saving?');
      if (!confirmed) {
        return;
      }
    }

    if (direction === 'previous') {
      if (currentEditItemIndex > 0) {
        openEditModal(currentPageItems[currentEditItemIndex - 1]);
        return;
      }

      if (page > 1) {
        setPendingEditNavigation({ direction: 'previous', targetPage: page - 1 });
        setPage((current) => Math.max(1, current - 1));
      }
      return;
    }

    if (currentEditItemIndex >= 0 && currentEditItemIndex < currentPageItems.length - 1) {
      openEditModal(currentPageItems[currentEditItemIndex + 1]);
      return;
    }

    if (page < totalPages) {
      setPendingEditNavigation({ direction: 'next', targetPage: page + 1 });
      setPage((current) => current + 1);
    }
  };

  useEffect(() => {
    if (!editingItem || !pendingEditNavigation || !currentPageItems.length) {
      return;
    }

    if ((data?.page ?? 0) !== pendingEditNavigation.targetPage) {
      return;
    }

    if (pendingEditNavigation.direction === 'previous') {
      openEditModal(currentPageItems[currentPageItems.length - 1]);
      return;
    }

    openEditModal(currentPageItems[0]);
  }, [editingItem, pendingEditNavigation, currentPageItems, data?.page]);

  useEffect(() => {
    if (!editingItem) {
      return;
    }

    const handleEditModalKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      requestCloseEditModal();
    };

    window.addEventListener('keydown', handleEditModalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleEditModalKeyDown);
    };
  }, [editingItem, isEditDirty]);

  const openAddModal = () => {
    setIsAddingItem(true);
    setAddValues({
      ItemName: '',
      ItemVersion: '',
      ProductID: '',
      ReleaseDate: '',
      IsPhysical: false,
      IsDigital: false,
      PublisherID: '',
      CollectionID: '',
      CategoryID: '',
      SubTypeID: '',
    });
    setAddError('');
  };

  const closeAddModal = () => {
    setIsAddingItem(false);
    setAddValues({
      ItemName: '',
      ItemVersion: '',
      ProductID: '',
      ReleaseDate: '',
      IsPhysical: false,
      IsDigital: false,
      PublisherID: '',
      CollectionID: '',
      CategoryID: '',
      SubTypeID: '',
    });
    setAddError('');
  };

  const editMutation = useMutation({
    mutationFn: async (payload: Record<string, any> | FormData) => {
      if (!editingItem) {
        throw new Error('No item selected');
      }
      return tablesAPI.updateRecord('Item', editingItem.ItemID, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      closeEditModal();
      toast({
        title: 'Item Saved',
        description: `Saved changes for "${editingItem?.ItemName || 'selected item'}".`,
        variant: 'success',
      });
    },
    onError: (error: any) => {
      setEditError(error.response?.data?.error || 'Failed to save item');
    },
  });

  const addMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      return tablesAPI.createRecord('Item', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      closeAddModal();
      toast({
        title: 'Item Added',
        description: `Added "${addValues.ItemName}" to Item Master.`,
        variant: 'success',
      });
    },
    onError: (error: any) => {
      setAddError(error.response?.data?.error || 'Failed to create item');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem) {
        throw new Error('No item selected');
      }
      return tablesAPI.deleteRecord('Item', editingItem.ItemID);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      closeEditModal();
      toast({
        title: 'Item Deleted',
        description: `Deleted "${editingItem?.ItemName || 'selected item'}" from Item Master.`,
        variant: 'success',
      });
    },
    onError: (error: any) => {
      setEditError(error.response?.data?.error || 'Failed to delete item');
    },
  });

  const handleEditChange = (field: string, value: string) => {
    setEditValues((current) => ({ ...current, [field]: value }));
  };

  const handleEditSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setEditError('');

    if (!editingItem) {
      return;
    }

    if (!isEditDirty) {
      return;
    }

    const payload = new FormData();
    payload.append('ItemName', editValues.ItemName);
    payload.append('ItemVersion', editValues.ItemVersion.trim());
    payload.append('ProductID', editValues.ProductID);
    payload.append('ReleaseDate', editValues.ReleaseDate ? normalizeReleaseDateForSave(editValues.ReleaseDate) : '');
    payload.append('IsPhysical', String(editValues.IsPhysical));
    payload.append('IsDigital', String(editValues.IsDigital));
    payload.append('PublisherID', editValues.PublisherID);
    payload.append('CollectionID', editValues.CollectionID);
    payload.append('CategoryID', editValues.CategoryID);
    payload.append('SubTypeID', editValues.SubTypeID);
    if (selectedEditImageFile) {
      payload.append('ImageFile', selectedEditImageFile);
    }

    editMutation.mutate(payload);
  };

  const handleEditImageFileChange = (file: File | null) => {
    if (!file) {
      setSelectedEditImageFile(null);
      setEditCropSourceFile(null);
      return;
    }

    const extension = file.name.toLowerCase().match(/\.(webp|jpe?g)$/)?.[1];
    const hasValidType = !file.type || file.type === (extension === 'webp' ? 'image/webp' : 'image/jpeg');
    if (!extension || !hasValidType) {
      setSelectedEditImageFile(null);
      setEditCropSourceFile(null);
      setEditError('Image File Name must be a .webp, .jpg, or .jpeg file.');
      return;
    }

    setEditCropSourceFile(file);
    setEditError('');
  };

  const handleAddChange = (field: string, value: string) => {
    setAddValues((current) => ({ ...current, [field]: value }));
  };

  const handleAddSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAddError('');

    if (
      !addValues.ItemName.trim() ||
      !addValues.PublisherID ||
      !addValues.CollectionID ||
      !addValues.CategoryID ||
      !addValues.SubTypeID
    ) {
      setAddError('Item, Publisher, Collection, Category, and Sub Category are required.');
      return;
    }

    addMutation.mutate({
      ItemName: addValues.ItemName.trim(),
      ItemVersion: addValues.ItemVersion.trim() || null,
      ProductID: addValues.ProductID || null,
      ReleaseDate: addValues.ReleaseDate ? normalizeReleaseDateForSave(addValues.ReleaseDate) : null,
      IsPhysical: addValues.IsPhysical,
      IsDigital: addValues.IsDigital,
      PublisherID: parseInt(addValues.PublisherID, 10),
      CollectionID: parseInt(addValues.CollectionID, 10),
      CategoryID: parseInt(addValues.CategoryID, 10),
      SubTypeID: parseInt(addValues.SubTypeID, 10),
    });
  };

  const handleDeleteItem = () => {
    if (!editingItem) {
      return;
    }

    const confirmed = confirm(`Delete item "${editingItem.ItemName}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setEditError('');
    deleteMutation.mutate();
  };

  return (
    <AdminLayout
      title={
        <span className="inline-flex items-center gap-2">
          <span>Item Master</span>
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--arcane-ink-soft)] hover:text-[var(--arcane-ink-900)]"
            title="Use this screen to view, add, remove and modify the items in your collection."
            aria-label="Item Master page information"
          >
            <CircleHelp className="h-4 w-4" aria-hidden="true" />
          </span>
        </span>
      }
      subtitle={null}
    >
      <div className="max-w-[1920px] mx-auto space-y-6 px-0 2xl:px-2">
        <section className="bg-[var(--arcane-paper-raised)] shadow rounded-lg p-6">
          <div className="space-y-4">
            {selectedItemIds.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--arcane-gold-500-border)] bg-[var(--arcane-gold-soft)] px-4 py-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-semibold text-[var(--arcane-gold-700)]">{selectedItemIds.length} selected</span>
                  <button
                    type="button"
                    className="text-[var(--arcane-gold-700)] hover:text-[var(--arcane-gold-700)] underline underline-offset-2"
                    onClick={() => setSelectedItemIds([])}
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {selectedCurrentPageItems.length > 0 ? (
                    <Button
                      type="button"
                      className="border border-[var(--arcane-border-light)] !bg-[var(--arcane-paper-raised)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-paper)]"
                      onClick={openCreateOrderModal}
                      disabled={!canWrite}
                      title={canWrite ? undefined : 'Switch to Update mode to create orders'}
                    >
                      Create Order
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    className="border border-[var(--arcane-border-light)] !bg-[var(--arcane-paper-raised)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-paper)]"
                    onClick={openBulkUpdateDialog}
                    disabled={!canWrite}
                    title={canWrite ? undefined : 'Switch to Update mode to edit items'}
                  >
                    Bulk Update
                  </Button>
                  <Button
                    type="button"
                    className="border border-red-300 !bg-[var(--arcane-paper-raised)] !text-red-700 hover:!bg-red-50"
                    onClick={openBulkDeleteDialog}
                    disabled={!canWrite}
                    title={canWrite ? undefined : 'Switch to Update mode to delete items'}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onClear={() => setSearchInput('')}
                    clearable
                    clearAriaLabel="Clear item search"
                    placeholder="Search by item name or product ID..."
                    className="w-full max-w-md"
                    autoFocus
                  />
                  <div className="min-w-0 flex-1">
                    <FilterChipBar fields={filterChipFields} onClearAll={clearAllChipFilters} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-end gap-2">
                  <Button
                    type="button"
                    className="border border-[var(--arcane-border-light)] !bg-[var(--arcane-paper-raised)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-paper)]"
                    onClick={() => setIsBulkUploadOpen(true)}
                    disabled={!canWrite}
                    title={canWrite ? 'Bulk Upload' : 'Switch to Update mode to bulk upload'}
                    aria-label="Bulk Upload"
                  >
                    Bulk Upload
                  </Button>
                  <Button
                    type="button"
                    className="border border-[var(--arcane-border-light)] !bg-[var(--arcane-paper-raised)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-paper)]"
                    onClick={handleDownloadCsv}
                    disabled={isDownloading}
                    title={isDownloading ? 'Downloading...' : 'Download CSV'}
                    aria-label={isDownloading ? 'Downloading CSV' : 'Download CSV'}
                  >
                    Download
                  </Button>
                  <Button
                    type="button"
                    className="!bg-[var(--arcane-gold-500)] !text-[var(--arcane-ink-950)] hover:!bg-[var(--arcane-gold-300)]"
                    onClick={openAddModal}
                    disabled={!canWrite}
                    title={canWrite ? undefined : 'Switch to Update mode to add items'}
                  >
                    Add Item
                  </Button>
                </div>
              </div>
            )}

            {downloadError ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {downloadError}
              </div>
            ) : null}
          </div>
        </section>

        <section className="bg-[var(--arcane-paper-raised)] shadow rounded-lg p-6">
          {isLoading && <p className="text-[var(--arcane-ink-soft)]">Loading items...</p>}
          {error && <p className="text-red-600">Error loading inventory.</p>}

          {!isLoading && !error && (
            <>
                  <div className="h-[608px] overflow-hidden">
                <Table className="table-fixed [&_th]:overflow-hidden [&_th_button]:overflow-hidden [&_th_button]:whitespace-nowrap [&_tbody_tr]:h-14 [&_tbody_td]:overflow-hidden [&_tbody_td]:text-ellipsis [&_tbody_td]:whitespace-nowrap">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[4%] whitespace-nowrap px-2 text-center">
                        <SelectionScopeMenu
                          checked={areAllCurrentPageItemsSelected}
                          disabled={currentPageItems.length === 0}
                          aria-label="Select items"
                          onSelectPage={selectCurrentPageItems}
                          onSelectAll={() => {
                            void selectAllFilteredItems();
                          }}
                        />
                      </TableHead>
                      <TableHead className="w-[9%]">
                        <button onClick={() => handleSort('PublisherName')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Publisher <SortIndicator column="PublisherName" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[11%]">
                        <button onClick={() => handleSort('CollectionName')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Collection <SortIndicator column="CollectionName" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[17%]">
                        <button onClick={() => handleSort('ItemName')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Item <SortIndicator column="ItemName" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[7%] text-right">
                        <button onClick={() => handleSort('SubItemCount')} className="flex items-center justify-end w-full hover:text-[var(--arcane-gold-700)]">
                          Sub Item Count <SortIndicator column="SubItemCount" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[7%]">
                        <button onClick={() => handleSort('ItemVersion')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Version <SortIndicator column="ItemVersion" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[9%]">
                        <button onClick={() => handleSort('CategoryName')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Category <SortIndicator column="CategoryName" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[10%]">
                        <button onClick={() => handleSort('SubTypeName')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Sub Category <SortIndicator column="SubTypeName" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[8%]">
                        <button onClick={() => handleSort('ProductID')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Product ID <SortIndicator column="ProductID" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[6%] text-center">
                        <button onClick={() => handleSort('IsPhysical')} className="flex items-center justify-center w-full hover:text-[var(--arcane-gold-700)]">
                          Is Physical <SortIndicator column="IsPhysical" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[6%] text-center">
                        <button onClick={() => handleSort('IsDigital')} className="flex items-center justify-center w-full hover:text-[var(--arcane-gold-700)]">
                          Is Digital <SortIndicator column="IsDigital" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[6%] whitespace-nowrap px-2 text-center">
                        <button onClick={() => handleSort('HasPurchaseOrder')} className="flex items-center justify-center w-full hover:text-[var(--arcane-gold-700)]">
                          Is Owned <SortIndicator column="HasPurchaseOrder" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                              {Array.isArray(data?.data) && data.data.length ? (
                      data.data.map((item: InventoryItem) => {
                        return (
                          <TableRow
                            key={item.ItemID}
                            className="cursor-pointer hover:bg-[var(--arcane-paper)]"
                            onClick={() => openEditModal(item)}
                              tabIndex={0}
                            aria-label={`Edit item ${item.ItemName}`}
                            onKeyDown={(event) => {
                                if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
                                event.preventDefault();
                                openEditModal(item);
                              }
                            }}
                          >
                            <TableCell className="w-px whitespace-nowrap px-2 text-center" onClick={(event) => event.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedItemIdSet.has(item.ItemID)}
                                onChange={() => toggleItemSelection(item.ItemID)}
                                aria-label={`Select ${item.ItemName}`}
                              />
                            </TableCell>
                            <TableCell>{item.PublisherName}</TableCell>
                            <TableCell>{collectionLabelById[item.CollectionID] ?? item.CollectionName}</TableCell>
                            <TableCell>
                              {item.ImageFileName ? (
                                <a
                                  href={getItemImageUrl(item.ImageFileName)}
                                  className="font-medium text-[var(--arcane-gold-700)] underline decoration-[var(--arcane-gold-400)] underline-offset-2 hover:text-[var(--arcane-gold-600)]"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setViewingImageItem(item);
                                  }}
                                  aria-label={`View image for ${item.ItemName}`}
                                >
                                  {item.ItemName}
                                </a>
                              ) : (
                                item.ItemName
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {['miniature', 'miniatures', 'terrain'].includes(item.CategoryName.trim().toLowerCase())
                                ? Number(item.SubItemCount || 0).toLocaleString()
                                : ''}
                            </TableCell>
                            <TableCell>{item.ItemVersion || '-'}</TableCell>
                            <TableCell>{item.CategoryName}</TableCell>
                            <TableCell>{item.SubTypeName}</TableCell>
                            <TableCell>{item.ProductID || '-'}</TableCell>
                            <TableCell className="text-center" onClick={(event) => event.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={Boolean(item.IsPhysical)}
                                disabled
                                aria-label="Is Physical (read only)"
                                className="cursor-not-allowed accent-[var(--arcane-ink-soft)]"
                                tabIndex={-1}
                              />
                            </TableCell>
                            <TableCell className="text-center" onClick={(event) => event.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={Boolean(item.IsDigital)}
                                disabled
                                aria-label="Is Digital (read only)"
                                className="cursor-not-allowed accent-[var(--arcane-ink-soft)]"
                                tabIndex={-1}
                              />
                            </TableCell>
                            <TableCell className="w-px whitespace-nowrap px-2 text-center" onClick={(event) => event.stopPropagation()}>
                              {(typeof item.HasPurchaseOrder === 'boolean'
                                ? item.HasPurchaseOrder
                                : fallbackHasPurchaseOrder[item.ItemID]) ? (
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center text-[var(--arcane-gold-700)] hover:text-[var(--arcane-gold-700)]"
                                  onClick={(event) => handleOpenRelatedOrders(item, event)}
                                  title="Open related purchase orders"
                                  aria-label={`Open related purchase orders for ${item.ItemName}`}
                                >
                                  <Link2 className="w-5 h-5" />
                                </button>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-10 text-[var(--arcane-ink-soft)]">
                          No matching items found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-[var(--arcane-ink-soft)]">
                  Showing {data?.data?.length ?? 0} of {data?.total ?? 0} results
                  {data?.page && data?.totalPages ? ` — Page ${data.page} of ${data.totalPages}` : ''}
                </p>
                <div className="flex gap-2">
                  {(() => {
                    const totalPages = data?.totalPages ?? 0;
                    const hasManyPages = totalPages > 3;

                    return (
                      <>
                        <Button onClick={() => setPage(1)} disabled={!hasManyPages || page === 1} tabIndex={pagerTabIndexStart}>
                          First
                        </Button>
                        <Button
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page === 1}
                          tabIndex={pagerTabIndexStart + 1}
                        >
                          Previous
                        </Button>
                        <Button
                          onClick={() => setPage(page + 1)}
                          disabled={page >= (data?.totalPages ?? 1)}
                          tabIndex={pagerTabIndexStart + 2}
                        >
                          Next
                        </Button>
                        <Button
                          onClick={() => setPage(totalPages)}
                          disabled={!hasManyPages || page >= totalPages}
                          tabIndex={pagerTabIndexStart + 3}
                        >
                          Last
                        </Button>
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <Dialog
        open={Boolean(viewingImageItem)}
        onOpenChange={(open) => {
          if (!open) {
            setViewingImageItem(null);
          }
        }}
        title="View Item"
        contentClassName="max-w-6xl"
        showCloseButton={false}
      >
        {viewingImageItem?.ImageFileName ? (
          <div>
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-[var(--arcane-ink-900)]">Image</div>
                <div className="mt-1 text-lg font-semibold text-[var(--arcane-ink-900)]">{viewingImageItem.ItemName}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingImageItem(currentPageItemsWithImages[currentImageItemIndex - 1])}
                  disabled={currentImageItemIndex <= 0}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--arcane-border-light)] text-[var(--arcane-ink-900)] hover:bg-[var(--arcane-gold-soft-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Previous item with image"
                  title="Previous item with image"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewingImageItem(currentPageItemsWithImages[currentImageItemIndex + 1])}
                  disabled={currentImageItemIndex < 0 || currentImageItemIndex >= currentPageItemsWithImages.length - 1}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--arcane-border-light)] text-[var(--arcane-ink-900)] hover:bg-[var(--arcane-gold-soft-strong)] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Next item with image"
                  title="Next item with image"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-center overflow-hidden rounded-lg border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-4">
              <div className="relative aspect-[4/3] w-full max-w-[980px] overflow-hidden rounded-md bg-[var(--arcane-paper-raised)]">
                <img
                  src={getItemImageUrl(viewingImageItem.ImageFileName)}
                  alt={viewingImageItem.ItemName}
                  className="h-full w-full object-contain object-center"
                />
              </div>
            </div>

            <div className="mt-3 space-y-1 text-sm text-[var(--arcane-ink-soft)]">
              <div className="flex min-w-0 gap-2">
                <span className="shrink-0 font-medium text-[var(--arcane-ink-900)]">Image URL:</span>
                <a
                  href={getItemImageUrl(viewingImageItem.ImageFileName)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 truncate text-[var(--arcane-gold-700)] underline hover:text-[var(--arcane-gold-600)]"
                  title={getItemImageUrl(viewingImageItem.ImageFileName)}
                >
                  {getItemImageUrl(viewingImageItem.ImageFileName)}
                </a>
              </div>
              <div>
                <span className="font-medium text-[var(--arcane-ink-900)]">Image Upload Date:</span>{' '}
                {formatImageUploadDate(viewingImageItem.ImageUploadDate)}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button type="button" onClick={() => setViewingImageItem(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={isCreateOrderModalOpen}
        onOpenChange={setIsCreateOrderModalOpen}
        onClose={closeCreateOrderModal}
        contentClassName="max-w-6xl"
        title="Create Order"
      >
        <div className="space-y-6">
          {isOnOrderStatusMissing ? (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-md">
              <p className="text-amber-900 font-medium">Default status not found</p>
              <p className="text-amber-800 text-sm mt-1">
                The Status table does not contain an "On Order" row, so a default order status cannot be applied.
                Please choose an Order Status before creating the order.
              </p>
            </div>
          ) : null}

          {createOrderError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{createOrderError}</p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4 border-b">
            <label className="space-y-2">
              <span className="text-sm text-[var(--arcane-ink-soft)]">Invoice Number</span>
              <Input
                type="text"
                value={createOrderValues.InvoiceNumber}
                onChange={(event) => handleCreateOrderFieldChange('InvoiceNumber', event.target.value)}
                placeholder="Invoice number"
                autoComplete="off"
                spellCheck={false}
                data-lpignore="true"
              />
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Store</span>
              <ComboSelect
                options={storesData.map((store: any) => ({ value: String(store.StoreID), label: store.StoreName }))}
                value={createOrderValues.StoreID}
                onChange={(value) => handleCreateOrderFieldChange('StoreID', value)}
                placeholder="Select a store..."
                className="w-full"
              />
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Order Status</span>
              <ComboSelect
                options={statusesData.map((status: any) => ({ value: String(status.StatusID), label: status.StatusName }))}
                value={createOrderValues.StatusID}
                onChange={(value) => handleCreateOrderFieldChange('StatusID', value)}
                placeholder="Select a status..."
                className="w-full"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-[var(--arcane-ink-soft)]">Purchase Date</span>
              <Input
                type="date"
                value={createOrderValues.PurchaseDate}
                onChange={(event) => handleCreateOrderFieldChange('PurchaseDate', event.target.value)}
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Inventory Items</h3>
              <Button className="bg-[var(--arcane-success)] hover:bg-[var(--arcane-success-hover)] text-white" onClick={handleCreateOrderAddDetailRow}>
                Add Item
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Product ID</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {createOrderDetails.map((detail) => {
                    const selectedItem = detail.ItemID ? itemLookupById.get(parseInt(detail.ItemID, 10)) : null;
                    const quantity = Number(detail.Quantity) || 0;
                    const price = Number(detail.Price) || 0;

                    return (
                      <TableRow key={detail.id}>
                        <TableCell>
                          <ComboSelect
                            options={itemLookupOptions}
                            value={detail.ItemID}
                            onChange={(value) => handleCreateOrderDetailChange(detail.id, 'ItemID', value)}
                            placeholder={itemLookupLoading ? 'Loading items...' : 'Search item or Product ID...'}
                            disabled={itemLookupLoading}
                            className="min-w-[280px]"
                          />
                        </TableCell>
                        <TableCell>{selectedItem?.ProductID || '-'}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={detail.Quantity}
                            onChange={(event) => handleCreateOrderDetailChange(detail.id, 'Quantity', event.target.value)}
                            className="w-24 ml-auto text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*[.,]?[0-9]*"
                            value={detail.Price}
                            onChange={(event) => handleCreateOrderDetailChange(detail.id, 'Price', event.target.value)}
                            className="w-28 ml-auto text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(quantity * price)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white"
                            onClick={() => handleCreateOrderRemoveDetailRow(detail.id)}
                            disabled={createOrderDetails.length <= 1}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-[var(--arcane-paper)] font-semibold">
                    <TableCell colSpan={4} className="text-right">Total:</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        createOrderDetails.reduce((sum, detail) => {
                          const quantity = Number(detail.Quantity) || 0;
                          const price = Number(detail.Price) || 0;
                          return sum + quantity * price;
                        }, 0)
                      )}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white" onClick={closeCreateOrderModal} disabled={createOrderMutation.isLoading}>
              Cancel
            </Button>
            <Button
              className="bg-[var(--arcane-success)] hover:bg-[var(--arcane-success-hover)] text-white"
              onClick={handleCreateOrderSubmit}
              disabled={createOrderMutation.isLoading || (isOnOrderStatusMissing && !createOrderValues.StatusID)}
            >
              {createOrderMutation.isLoading ? 'Creating...' : 'Create Order'}
            </Button>
          </div>
        </div>
      </Dialog>

      {editingItem ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div ref={editModalRef} tabIndex={-1} className="bg-[var(--arcane-paper-raised)] rounded-xl shadow-xl max-w-4xl w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-semibold">Edit Item Detail</h2>
                <p className="text-sm text-[var(--arcane-ink-soft)]">Update item values and save changes.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  className="h-9 !bg-[var(--arcane-border-light)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-border-light)]"
                  onClick={() => handleNavigateEditItem('previous')}
                  disabled={!canNavigateToPreviousEditItem || editMutation.isLoading || deleteMutation.isLoading}
                  aria-label="Previous item"
                  title="Previous item"
                >
                  Prev
                </Button>
                <Button
                  type="button"
                  className="h-9 !bg-[var(--arcane-border-light)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-border-light)]"
                  onClick={() => handleNavigateEditItem('next')}
                  disabled={!canNavigateToNextEditItem || editMutation.isLoading || deleteMutation.isLoading}
                  aria-label="Next item"
                  title="Next item"
                >
                  Next
                </Button>
              </div>
            </div>

            {editError ? (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {editError}
              </div>
            ) : null}

            <form onSubmit={handleEditSubmit} className="space-y-5">
              <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
                <div className="min-w-0">
                  <div className="mb-1 text-sm font-medium text-[var(--arcane-ink-900)]">Image</div>
                  <div className="aspect-square overflow-hidden rounded-lg border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)]">
                    {selectedEditImageFile || editingItem.ImageFileName ? (
                      <img
                        src={selectedEditImageUrl || getItemImageUrl(editingItem.ImageFileName)}
                        alt={`${editingItem.ItemName} preview`}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-[var(--arcane-ink-soft)]">
                        No image uploaded.
                      </div>
                    )}
                  </div>
                  {editingItem.ImageFileName ? (
                    <p
                      className="mt-1 whitespace-nowrap text-xs text-[var(--arcane-ink-soft)]"
                      title={`Current: ${getItemImageUrl(editingItem.ImageFileName)}`}
                    >
                      Current: {truncateMiddle(getItemImageUrl(editingItem.ImageFileName), 31)}
                    </p>
                  ) : null}
                  <div className="mt-4">
                    <span className="mb-2 block text-sm font-medium text-[var(--arcane-ink-900)]">Image File</span>
                    <Input
                      type="file"
                      accept=".webp,.jpg,.jpeg,image/webp,image/jpeg"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        handleEditImageFileChange(file);
                        if (file) {
                          event.target.value = '';
                        }
                      }}
                    />
                    {selectedEditImageFile ? (
                      <p className="mt-1 break-all text-sm text-[var(--arcane-ink-soft)]">Selected: {selectedEditImageFile.name}</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Item</label>
                  <Input
                    ref={editItemInputRef}
                    autoFocus
                    value={editValues.ItemName}
                    onChange={(e) => handleEditChange('ItemName', e.target.value)}
                    placeholder="Item name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Version</label>
                  <Input
                    value={editValues.ItemVersion}
                    onChange={(e) => handleEditChange('ItemVersion', e.target.value)}
                    placeholder="Version"
                    maxLength={ITEM_VERSION_MAX_LENGTH}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Product ID</label>
                  <Input
                    value={editValues.ProductID}
                    onChange={(e) => handleEditChange('ProductID', e.target.value)}
                    placeholder="Product ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Release Date</label>
                  <Input
                    type="date"
                    value={editValues.ReleaseDate}
                    onChange={(e) => handleEditChange('ReleaseDate', e.target.value)}
                    placeholder="Release date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Publisher</label>
                  <ComboSelect
                    options={addPublisherSelectOptions.map((option: { value: string | number; label: string }) => ({ value: String(option.value), label: option.label }))}
                    value={editValues.PublisherID}
                    onChange={(value) => handleEditChange('PublisherID', value)}
                    placeholder="Select publisher"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Collection</label>
                  <ComboSelect
                    options={editCollectionSelectOptions.map((option: { value: string | number; label: string }) => ({ value: String(option.value), label: option.label }))}
                    value={editValues.CollectionID}
                    onChange={(value) => handleEditChange('CollectionID', value)}
                    placeholder="Select collection"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Category</label>
                  <ComboSelect
                    options={categorySelectOptions.map((option: { value: string | number; label: string }) => ({ value: String(option.value), label: option.label }))}
                    value={editValues.CategoryID}
                    onChange={(value) => handleEditChange('CategoryID', value)}
                    placeholder="Select category"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Sub Category</label>
                  <ComboSelect
                    options={editSubTypeSelectOptions.map((option: { value: string | number; label: string }) => ({ value: String(option.value), label: option.label }))}
                    value={editValues.SubTypeID}
                    onChange={(value) => handleEditChange('SubTypeID', value)}
                    placeholder="Select sub category"
                    className="w-full"
                  />
                </div>
                <label className="flex items-center gap-2 pt-2 text-sm font-medium text-[var(--arcane-ink-900)]">
                  <input
                    type="checkbox"
                    checked={editValues.IsPhysical}
                    onChange={(event) => setEditValues((current) => ({ ...current, IsPhysical: event.target.checked }))}
                  />
                  Is Physical
                </label>
                <label className="flex items-center gap-2 pt-2 text-sm font-medium text-[var(--arcane-ink-900)]">
                  <input
                    type="checkbox"
                    checked={editValues.IsDigital}
                    onChange={(event) => setEditValues((current) => ({ ...current, IsDigital: event.target.checked }))}
                  />
                  Is Digital
                </label>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  className="bg-red-600 hover:bg-red-700 sm:mr-auto"
                  onClick={handleDeleteItem}
                  disabled={!canWrite || editMutation.isLoading || deleteMutation.isLoading}
                  title={canWrite ? undefined : 'Switch to Update mode to delete items'}
                >
                  {deleteMutation.isLoading ? 'Deleting...' : 'Delete Item'}
                </Button>
                <Button
                  type="button"
                  className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white"
                  onClick={requestCloseEditModal}
                  disabled={editMutation.isLoading || deleteMutation.isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!canWrite || !isEditDirty || editMutation.isLoading || deleteMutation.isLoading}
                  title={canWrite ? undefined : 'Switch to Update mode to save changes'}
                >
                  {editMutation.isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editCropSourceFile ? (
        <ImageCropDialog
          file={editCropSourceFile}
          title="Crop Item Image"
          onApply={(croppedFile) => {
            setSelectedEditImageFile(croppedFile);
            setEditCropSourceFile(null);
            setEditError('');
          }}
          onCancel={() => setEditCropSourceFile(null)}
        />
      ) : null}

      {isAddingItem ? (
        <Dialog
          open={isAddingItem}
          onOpenChange={(open) => {
            if (open) {
              setIsAddingItem(true);
              return;
            }

            closeAddModal();
          }}
          title="Add Item"
          contentClassName="max-w-2xl"
          closeButtonTabIndex={-1}
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            addItemInputRef.current?.focus();
          }}
        >
          <div className="mb-5">
            <p className="text-sm text-[var(--arcane-ink-soft)]">Create a new item record.</p>
          </div>

          {addError ? (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {addError}
            </div>
          ) : null}

          <form onSubmit={handleAddSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Item</label>
                <Input
                  ref={addItemInputRef}
                  value={addValues.ItemName}
                  onChange={(e) => handleAddChange('ItemName', e.target.value)}
                  placeholder="Item name"
                  className="text-[var(--arcane-ink-900)]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Version</label>
                <Input
                  value={addValues.ItemVersion}
                  onChange={(e) => handleAddChange('ItemVersion', e.target.value)}
                  placeholder="Version"
                  maxLength={ITEM_VERSION_MAX_LENGTH}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Product ID</label>
                <Input
                  value={addValues.ProductID}
                  onChange={(e) => handleAddChange('ProductID', e.target.value)}
                  placeholder="Product ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Release Date</label>
                <Input
                  type="date"
                  value={addValues.ReleaseDate}
                  onChange={(e) => handleAddChange('ReleaseDate', e.target.value)}
                  placeholder="Release date"
                  className="text-[var(--arcane-ink-900)]"
                />
              </div>
              <label className="flex items-center gap-2 pt-6 text-sm font-medium text-[var(--arcane-ink-900)]">
                <input
                  type="checkbox"
                  checked={addValues.IsPhysical}
                  onChange={(event) => setAddValues((current) => ({ ...current, IsPhysical: event.target.checked }))}
                />
                Is Physical
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm font-medium text-[var(--arcane-ink-900)]">
                <input
                  type="checkbox"
                  checked={addValues.IsDigital}
                  onChange={(event) => setAddValues((current) => ({ ...current, IsDigital: event.target.checked }))}
                />
                Is Digital
              </label>
              <div>
                <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Publisher</label>
                <ComboSelect
                  options={addPublisherSelectOptions.map((option: { value: string | number; label: string }) => ({ value: String(option.value), label: option.label }))}
                  value={addValues.PublisherID}
                  onChange={(value) => handleAddChange('PublisherID', value)}
                  placeholder="Select publisher"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Collection</label>
                <ComboSelect
                  options={addCollectionSelectOptions.map((option: { value: string | number; label: string }) => ({ value: String(option.value), label: option.label }))}
                  value={addValues.CollectionID}
                  onChange={(value) => handleAddChange('CollectionID', value)}
                  placeholder="Select collection"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Category</label>
                <ComboSelect
                  options={categorySelectOptions.map((option: { value: string | number; label: string }) => ({ value: String(option.value), label: option.label }))}
                  value={addValues.CategoryID}
                  onChange={(value) => handleAddChange('CategoryID', value)}
                  placeholder="Select category"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Category</label>
                <ComboSelect
                  options={addSubTypeSelectOptions.map((option: { value: string | number; label: string }) => ({ value: String(option.value), label: option.label }))}
                  value={addValues.SubTypeID}
                  onChange={(value) => handleAddChange('SubTypeID', value)}
                  placeholder="Select sub category"
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white"
                onClick={closeAddModal}
              >
                Cancel
              </Button>
              <Button type="submit" className="bg-[var(--arcane-success)] hover:bg-[var(--arcane-success-hover)] text-white" disabled={addMutation.isLoading}>
                {addMutation.isLoading ? 'Saving...' : 'Add Item'}
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {isBulkUpdateOpen ? (
        <Dialog
          open={isBulkUpdateOpen}
          onOpenChange={(open) => {
            if (open) {
              setIsBulkUpdateOpen(true);
              return;
            }

            closeBulkUpdateDialog();
          }}
          title={bulkStep === 'confirm' ? 'Confirm Bulk Update' : 'Bulk Update Items'}
          contentClassName="max-w-3xl"
        >
          <div className="space-y-5">
            {bulkError ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {bulkError}
              </div>
            ) : null}

            {bulkStep === 'edit' ? (
              <>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
                  Bulk updates apply to {selectedItemIds.length} selected item{selectedItemIds.length === 1 ? '' : 's'}.
                  Only the fields you change will be written.
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Publisher</label>
                    <ComboSelect
                      options={publisherSelectOptions.map((option: { value: string | number; label: string }) => ({ value: String(option.value), label: option.label }))}
                      value={bulkValues.PublisherID}
                      onChange={(value) => handleBulkFieldChange('PublisherID', value)}
                      placeholder="Leave unchanged"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Collection</label>
                    <ComboSelect
                      options={collectionSelectOptions.map((option: { value: string | number; label: string }) => ({ value: String(option.value), label: option.label }))}
                      value={bulkValues.CollectionID}
                      onChange={(value) => handleBulkFieldChange('CollectionID', value)}
                      placeholder="Leave unchanged"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Category</label>
                    <ComboSelect
                      options={categorySelectOptions.map((option: { value: string | number; label: string }) => ({ value: String(option.value), label: option.label }))}
                      value={bulkValues.CategoryID}
                      onChange={(value) => handleBulkFieldChange('CategoryID', value)}
                      placeholder="Leave unchanged"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Sub Category</label>
                    <ComboSelect
                      options={subTypeSelectOptions.map((option: { value: string | number; label: string }) => ({ value: String(option.value), label: option.label }))}
                      value={bulkValues.SubTypeID}
                      onChange={(value) => handleBulkFieldChange('SubTypeID', value)}
                      placeholder="Leave unchanged"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Version</label>
                    <Input
                      value={bulkValues.ItemVersion}
                      onChange={(event) => handleBulkFieldChange('ItemVersion', event.target.value)}
                      placeholder="Leave unchanged"
                      maxLength={ITEM_VERSION_MAX_LENGTH}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Is Physical</label>
                    <ComboSelect
                      options={[
                        { value: 'true', label: 'Yes' },
                        { value: 'false', label: 'No' },
                      ]}
                      value={bulkValues.IsPhysical}
                      onChange={(value) => handleBulkBooleanFieldChange('IsPhysical', value)}
                      placeholder="Leave unchanged"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Is Digital</label>
                    <ComboSelect
                      options={[
                        { value: 'true', label: 'Yes' },
                        { value: 'false', label: 'No' },
                      ]}
                      value={bulkValues.IsDigital}
                      onChange={(value) => handleBulkBooleanFieldChange('IsDigital', value)}
                      placeholder="Leave unchanged"
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    className="bg-[var(--arcane-border-light)] text-[var(--arcane-ink-900)] hover:bg-[var(--arcane-border-light)]"
                    onClick={closeBulkUpdateDialog}
                    disabled={bulkUpdateMutation.isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={handleBulkPreview}
                    disabled={bulkUpdateMutation.isLoading}
                  >
                    Review {selectedItemIds.length} Update{selectedItemIds.length === 1 ? '' : 's'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-4 text-sm text-[var(--arcane-ink-900)]">
                  You are about to update {selectedItemIds.length} item{selectedItemIds.length === 1 ? '' : 's'}.
                  Confirm only after checking the summary below.
                </div>

                <div className="rounded-lg border border-[var(--arcane-border-light)]">
                  <div className="border-b border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] px-4 py-3 text-sm font-semibold text-[var(--arcane-ink-900)]">
                    Update Summary
                  </div>
                  <div className="space-y-2 px-4 py-3 text-sm text-[var(--arcane-ink-900)]">
                    {Object.entries(bulkValues)
                      .filter(([, value]) => value)
                      .map(([field, value]) => (
                        <div key={field} className="flex items-center justify-between gap-4">
                          <span className="font-medium text-[var(--arcane-ink-soft)]">
                            {field === 'PublisherID'
                              ? 'Publisher'
                              : field === 'CollectionID'
                                ? 'Collection'
                                : field === 'CategoryID'
                                  ? 'Category'
                                  : field === 'SubTypeID'
                                    ? 'Sub Category'
                                    : field === 'IsPhysical'
                                      ? 'Is Physical'
                                      : field === 'IsDigital'
                                        ? 'Is Digital'
                                        : 'Version'}
                          </span>
                          <span className="text-right">{getBulkFieldLabel(field as 'PublisherID' | 'CollectionID' | 'CategoryID' | 'SubTypeID' | 'ItemVersion' | 'IsPhysical' | 'IsDigital', value)}</span>
                        </div>
                      ))}
                    {!Object.values(bulkValues).some((value) => value) ? (
                      <div className="text-[var(--arcane-ink-soft)]">No fields selected for update.</div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    className="bg-[var(--arcane-border-light)] text-[var(--arcane-ink-900)] hover:bg-[var(--arcane-border-light)]"
                    onClick={() => setBulkStep('edit')}
                    disabled={bulkUpdateMutation.isLoading}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    className="bg-amber-600 hover:bg-amber-700"
                    onClick={handleBulkConfirm}
                    disabled={bulkUpdateMutation.isLoading}
                  >
                    {bulkUpdateMutation.isLoading ? 'Updating...' : `Confirm Update (${selectedItemIds.length})`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Dialog>
      ) : null}

      {isBulkDeleteOpen ? (
        <AlertDialog
          open={isBulkDeleteOpen}
          onOpenChange={(open) => {
            if (open) {
              setIsBulkDeleteOpen(true);
              return;
            }

            closeBulkDeleteDialog();
          }}
          title="Confirm Bulk Delete"
          description={`You are about to permanently delete ${selectedItemIds.length} selected item${selectedItemIds.length === 1 ? '' : 's'}. This action cannot be undone.`}
          footer={(
            <>
              <Button
                type="button"
                className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white"
                onClick={closeBulkDeleteDialog}
                disabled={bulkDeleteMutation.isLoading}
              >
                Cancel
              </Button>
              {bulkDeleteConfirmText.trim() === 'DELETE' ? (
                <Button
                  type="button"
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleBulkDeleteConfirm}
                  disabled={bulkDeleteMutation.isLoading}
                >
                  {bulkDeleteMutation.isLoading ? 'Deleting...' : `Delete ${selectedItemIds.length} Items`}
                </Button>
              ) : null}
            </>
          )}
        >
          <div className="space-y-5">
            {bulkDeleteError ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {bulkDeleteError}
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">
                Type DELETE to confirm
              </label>
              <Input
                value={bulkDeleteConfirmText}
                onChange={(event) => {
                  setBulkDeleteError('');
                  setBulkDeleteConfirmText(event.target.value);
                }}
                placeholder="DELETE"
                disabled={bulkDeleteMutation.isLoading}
              />
            </div>
          </div>
        </AlertDialog>
      ) : null}

      <Dialog
        open={isRelatedOrdersModalOpen}
        onOpenChange={setIsRelatedOrdersModalOpen}
        title={
          selectedItemForRelatedOrders
            ? `Related Purchase Orders: ${selectedItemForRelatedOrders.ItemName}`
            : 'Related Purchase Orders'
        }
        onClose={handleCloseRelatedOrdersModal}
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (firstRelatedOrderOpenButtonRef.current) {
            firstRelatedOrderOpenButtonRef.current.focus();
            return;
          }

          relatedOrdersCloseButtonRef.current?.focus();
        }}
      >
        <div className="space-y-4">
          {relatedOrdersLoading ? <p className="text-[var(--arcane-ink-soft)]">Loading related purchase orders...</p> : null}

          {!relatedOrdersLoading && relatedOrdersError ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {relatedOrdersError}
            </div>
          ) : null}

          {!relatedOrdersLoading && !relatedOrdersError && !relatedOrders.length ? (
            <p className="text-[var(--arcane-ink-soft)]">No purchase orders found for this item.</p>
          ) : null}

          {!relatedOrdersLoading && !relatedOrdersError && relatedOrders.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead>Invoice Number</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatedOrders.map((order, index) => (
                    <TableRow key={order.PurchaseOrderID}>
                      <TableCell>{formatReleaseDate(order.PurchaseDate)}</TableCell>
                      <TableCell>{order.InvoiceNumber}</TableCell>
                      <TableCell>{order.StoreName}</TableCell>
                      <TableCell>{order.StatusName || '-'}</TableCell>
                      <TableCell className="text-right">${(order.TotalAmount || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          ref={index === 0 ? firstRelatedOrderOpenButtonRef : undefined}
                          className="bg-[var(--arcane-gold-500)] hover:bg-[var(--arcane-gold-300)]"
                          onClick={() => handleOpenLinkedOrder(order)}
                        >
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button ref={relatedOrdersCloseButtonRef} className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white" onClick={handleCloseRelatedOrdersModal}>
              Close
            </Button>
          </div>
        </div>
      </Dialog>

      <LinkedOrderDetailModal
        open={isOrderDetailModalOpen}
        onOpenChange={setIsOrderDetailModalOpen}
        order={selectedLinkedOrder}
        targetItemId={detailTargetItemId}
        onClose={() => {
          setSelectedLinkedOrder(null);
          setDetailTargetItemId(null);
        }}
      />

      <BulkItemUploadDialog
        open={isBulkUploadOpen}
        onOpenChange={setIsBulkUploadOpen}
        publisherOptions={publisherSelectOptions}
        collectionOptions={collectionUploadOptions}
        categoryOptions={categorySelectOptions}
        subTypeOptions={subTypeSelectOptions}
        publisherCollectionLinks={publisherCollectionLinks}
        categorySubTypeLinks={categorySubTypeLinks}
        onItemsAdded={() => {
          queryClient.invalidateQueries({ queryKey: ['inventory'] });
        }}
      />
    </AdminLayout>
  );
}
