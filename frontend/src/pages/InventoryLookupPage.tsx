import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import ComboMultiSelect from '../components/ui/ComboMultiSelect';
import ComboSelect from '../components/ui/ComboSelect';
import { Dialog } from '../components/ui/Dialog';
import LinkedOrderDetailModal, { type LinkedPurchaseOrder } from '../components/order/LinkedOrderDetailModal';
import BulkItemUploadDialog from '../components/inventory/BulkItemUploadDialog';
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
  PublisherID: number;
  CollectionID: number;
  CategoryID: number;
  SubTypeID: number;
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

export default function InventoryLookupPage() {
  const navigate = useNavigate();
  const [urlSearchParams] = useSearchParams();
  const addItemInputRef = useRef<HTMLInputElement>(null);
  const editItemInputRef = useRef<HTMLInputElement>(null);
  const firstRelatedOrderOpenButtonRef = useRef<HTMLButtonElement>(null);
  const relatedOrdersCloseButtonRef = useRef<HTMLButtonElement>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('ItemName');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [ownedFilter, setOwnedFilter] = useState<'both' | 'yes' | 'no'>('both');
  const [filterValues, setFilterValues] = useState({
    itemName: '',
    itemVersion: '',
    productID: '',
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
  const [searchParams, setSearchParams] = useState(filterValues);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
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
    () => ['inventory', searchParams, page, sortBy, sortOrder],
    [searchParams, page, sortBy, sortOrder]
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
      itemName: item,
      itemVersion: '',
      productID: '',
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

    setOwnedFilter(hasPurchaseOrder === true ? 'yes' : hasPurchaseOrder === false ? 'no' : 'both');
    setFilterValues(nextFilters);
    setSearchParams(nextFilters);
    setPage(1);
  }, [urlSearchParams]);

  useEffect(() => {
    if (filterValues.hasPurchaseOrder === true) {
      setOwnedFilter('yes');
    } else if (filterValues.hasPurchaseOrder === false) {
      setOwnedFilter('no');
    } else {
      setOwnedFilter('both');
    }
  }, [filterValues.hasPurchaseOrder]);

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

    return `${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}/${parts.year}`;
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
      const cleanedParams = buildCleanedInventoryFilters(searchParams);

      const response = await tablesAPI.getInventoryItems({
        ...cleanedParams,
        page,
        pageSize: 50,
        sortBy,
        sortOrder,
      });
      return response.data;
    },
    keepPreviousData: true,
  });

  const gridRowTabIndexStart = 33;
  const gridRowCount = Array.isArray(data?.data) ? data.data.length : 0;
  const pagerTabIndexStart = gridRowTabIndexStart + gridRowCount * 3;

  const currentPageItems: InventoryItem[] = Array.isArray(data?.data) ? data.data : [];
  const selectedItemIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const selectedCurrentPageItems = useMemo(
    () => currentPageItems.filter((item) => selectedItemIdSet.has(item.ItemID)),
    [currentPageItems, selectedItemIdSet]
  );
  const areAllCurrentPageItemsSelected = currentPageItems.length > 0 && currentPageItems.every((item) => selectedItemIdSet.has(item.ItemID));

  const bulkUpdateMutation = useMutation({
    mutationFn: async (payload: { itemIds: number[]; updates: Record<string, number | string | boolean> }) => {
      return tablesAPI.bulkUpdateItems({ itemIds: payload.itemIds, ...payload.updates });
    },
    onSuccess: () => {
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
      queryClient.invalidateQueries({ queryKey });
      setSelectedItemIds([]);
      setIsBulkDeleteOpen(false);
      setBulkDeleteConfirmText('');
      setBulkDeleteError('');
    },
    onError: (error: any) => {
      setBulkDeleteError(error.response?.data?.error || 'Failed to bulk delete selected items');
    },
  });

  const handleFilterChange = (field: string, value: string) => {
    setDownloadError('');
    setFilterValues((current) => ({ ...current, [field]: value }));
  };

  // handle multi-select change for publisherName
  const handlePublisherChange = (values: string[]) => {
    setDownloadError('');
    setFilterValues((current) => ({ ...current, publisherName: values }));
  };

  // handle multi-select change for collectionName
  const handleCollectionChange = (values: string[]) => {
    setDownloadError('');
    setFilterValues((current) => ({ ...current, collectionName: values }));
  };

  // handle multi-select change for categoryName
  const handleCategoryChange = (values: string[]) => {
    setDownloadError('');
    setFilterValues((current) => ({ ...current, categoryName: values }));
  };

  // handle multi-select change for subTypeName
  const handleSubTypeChange = (values: string[]) => {
    setDownloadError('');
    setFilterValues((current) => ({ ...current, subTypeName: values }));
  };

  const handleBooleanFilterChange = (field: 'isPhysical' | 'isDigital', checked: boolean) => {
    setDownloadError('');
    setFilterValues((current) => ({ ...current, [field]: checked }));
  };

  const handleOwnedFilterChange = (value: 'both' | 'yes' | 'no') => {
    setDownloadError('');
    setOwnedFilter(value);
    setFilterValues((current) => ({
      ...current,
      hasPurchaseOrder: value === 'yes' ? true : value === 'no' ? false : undefined,
    }));
  };

  const hasFilterCriteria =
    filterValues.itemName.trim().length > 0 ||
    filterValues.itemVersion.trim().length > 0 ||
    filterValues.productID.trim().length > 0 ||
    filterValues.releaseDateFrom.trim().length > 0 ||
    filterValues.releaseDateTo.trim().length > 0 ||
    filterValues.publisherName.length > 0 ||
    filterValues.collectionName.length > 0 ||
    filterValues.categoryName.length > 0 ||
    filterValues.subTypeName.length > 0 ||
    filterValues.isPhysical !== undefined ||
    filterValues.isDigital !== undefined ||
    ownedFilter !== 'both';

  const applyFilters = () => {
    setDownloadError('');
    setPage(1);
    setSearchParams(filterValues);
  };

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
      return <span className="ml-1 text-gray-300">↕</span>;
    }
    return <span className="ml-1">{sortOrder === 'ASC' ? '↑' : '↓'}</span>;
  };

  const clearFilters = () => {
    setDownloadError('');
    setFilterValues({
      itemName: '',
      itemVersion: '',
      productID: '',
      releaseDateFrom: '',
      releaseDateTo: '',
      publisherName: [],
      collectionName: [],
      categoryName: [],
      subTypeName: [],
      isPhysical: undefined,
      isDigital: undefined,
      hasPurchaseOrder: undefined,
    });
    setOwnedFilter('both');
    setSearchParams({
      itemName: '',
      itemVersion: '',
      productID: '',
      releaseDateFrom: '',
      releaseDateTo: '',
      publisherName: [],
      collectionName: [],
      categoryName: [],
      subTypeName: [],
      isPhysical: undefined,
      isDigital: undefined,
      hasPurchaseOrder: undefined,
    });
    setPage(1);
  };

  const openBulkUpdateDialog = () => {
    if (selectedItemIds.length < 2) {
      return;
    }

    setBulkError('');
    setBulkStep('edit');
    setIsBulkUpdateOpen(true);
  };

  const openBulkDeleteDialog = () => {
    if (selectedItemIds.length < 2) {
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

      navigate(`/home/orders?purchaseOrderId=${newOrderId}`);
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

  const toggleSelectAllCurrentPage = () => {
    if (areAllCurrentPageItemsSelected) {
      setSelectedItemIds((current) => current.filter((itemId) => !currentPageItems.some((item) => item.ItemID === itemId)));
      return;
    }

    setSelectedItemIds((current) => {
      const next = new Set(current);
      currentPageItems.forEach((item) => next.add(item.ItemID));
      return Array.from(next);
    });
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

      const cleanedParams = buildCleanedInventoryFilters(searchParams);
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
    setEditingItem(item);
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

    return Object.keys(originalEditValues).some((key) => {
      const field = key as keyof typeof originalEditValues;
      return editValues[field] !== originalEditValues[field];
    });
  }, [editValues, originalEditValues]);

  useEffect(() => {
    if (!editingItem) {
      return;
    }

    editItemInputRef.current?.focus();
  }, [editingItem]);

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

  const closeEditModal = () => {
    setEditingItem(null);
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
    mutationFn: async (payload: Record<string, any>) => {
      if (!editingItem) {
        throw new Error('No item selected');
      }
      return tablesAPI.updateRecord('Item', editingItem.ItemID, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      closeEditModal();
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

    editMutation.mutate({
      ItemName: editValues.ItemName,
      ItemVersion: editValues.ItemVersion.trim() || null,
      ProductID: editValues.ProductID || null,
      ReleaseDate: editValues.ReleaseDate ? normalizeReleaseDateForSave(editValues.ReleaseDate) : null,
      IsPhysical: editValues.IsPhysical,
      IsDigital: editValues.IsDigital,
      PublisherID: editValues.PublisherID ? parseInt(editValues.PublisherID, 10) : null,
      CollectionID: editValues.CollectionID ? parseInt(editValues.CollectionID, 10) : null,
      CategoryID: editValues.CategoryID ? parseInt(editValues.CategoryID, 10) : null,
      SubTypeID: editValues.SubTypeID ? parseInt(editValues.SubTypeID, 10) : null,
    });
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
    <AdminLayout title="Item Master" subtitle="Use this screen to view, add, remove and modify the items in your collection.">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <section className="bg-white shadow rounded-lg p-6">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Publisher</span>
                <ComboMultiSelect
                  options={publisherOptions}
                  selected={filterValues.publisherName}
                  onChange={handlePublisherChange}
                  placeholder="Publisher"
                  className="w-full"
                  autoFocus
                  tabIndex={1}
                />
              </label>
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Collection</span>
                <ComboMultiSelect
                  options={collectionOptions}
                  selected={filterValues.collectionName}
                  onChange={handleCollectionChange}
                  placeholder="Collection"
                  className="w-full"
                  tabIndex={2}
                />
              </label>
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Item</span>
                <Input
                  value={filterValues.itemName}
                  onChange={(event) => handleFilterChange('itemName', event.target.value)}
                  placeholder="Item name"
                  tabIndex={3}
                />
              </label>
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Version</span>
                <Input
                  value={filterValues.itemVersion}
                  onChange={(event) => handleFilterChange('itemVersion', event.target.value)}
                  placeholder="Version"
                  tabIndex={4}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Category</span>
                <ComboMultiSelect
                  options={categoryOptions}
                  selected={filterValues.categoryName}
                  onChange={handleCategoryChange}
                  placeholder="Category"
                  className="w-full"
                  tabIndex={5}
                />
              </label>
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Sub Category</span>
                <ComboMultiSelect
                  options={subTypeOptions}
                  selected={filterValues.subTypeName}
                  onChange={handleSubTypeChange}
                  placeholder="Sub Category"
                  className="w-full"
                  tabIndex={6}
                />
              </label>
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Product ID</span>
                <Input
                  value={filterValues.productID}
                  onChange={(event) => handleFilterChange('productID', event.target.value)}
                  placeholder="Product ID"
                  tabIndex={7}
                />
              </label>
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Release Date From</span>
                <Input
                  type="date"
                  value={filterValues.releaseDateFrom}
                  onChange={(event) => handleFilterChange('releaseDateFrom', event.target.value)}
                  tabIndex={8}
                />
              </label>
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Release Date To</span>
                <Input
                  type="date"
                  value={filterValues.releaseDateTo}
                  onChange={(event) => handleFilterChange('releaseDateTo', event.target.value)}
                  tabIndex={9}
                />
              </label>
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Owned</span>
                <ComboSelect
                  options={[
                    { value: 'both', label: 'Both' },
                    { value: 'yes', label: 'Yes' },
                    { value: 'no', label: 'No' },
                  ]}
                  value={ownedFilter}
                  onChange={(value) => handleOwnedFilterChange(value as 'both' | 'yes' | 'no')}
                  placeholder="Both"
                  className="w-full"
                  tabIndex={10}
                />
              </label>
              <label className="flex items-center gap-2 self-end min-h-10">
                <input
                  type="checkbox"
                  checked={Boolean(filterValues.isPhysical)}
                  onChange={(event) => handleBooleanFilterChange('isPhysical', event.target.checked)}
                  tabIndex={11}
                />
                <span className="text-sm font-medium text-gray-700">Is Physical</span>
              </label>
              <label className="flex items-center gap-2 self-end min-h-10">
                <input
                  type="checkbox"
                  checked={Boolean(filterValues.isDigital)}
                  onChange={(event) => handleBooleanFilterChange('isDigital', event.target.checked)}
                  tabIndex={12}
                />
                <span className="text-sm font-medium text-gray-700">Is Digital</span>
              </label>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700"
                onClick={openBulkDeleteDialog}
                disabled={selectedItemIds.length < 2}
                tabIndex={14}
              >
                Bulk Delete{selectedItemIds.length ? ` (${selectedItemIds.length})` : ''}
              </Button>
              <Button
                type="button"
                className="bg-green-600 hover:bg-green-700"
                onClick={openCreateOrderModal}
                disabled={selectedItemIds.length < 1}
                tabIndex={15}
              >
                Create Order{selectedItemIds.length ? ` (${selectedItemIds.length})` : ''}
              </Button>
              <Button
                type="button"
                className="bg-green-600 hover:bg-green-700"
                onClick={openBulkUpdateDialog}
                disabled={selectedItemIds.length < 2}
                tabIndex={16}
              >
                Bulk Update{selectedItemIds.length ? ` (${selectedItemIds.length})` : ''}
              </Button>
              <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={openAddModal} tabIndex={17}>
                + Add Item
              </Button>
              <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={() => setIsBulkUploadOpen(true)} tabIndex={18}>
                Bulk Upload
              </Button>
              <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={handleDownloadCsv} disabled={isDownloading} tabIndex={19}>
                {isDownloading ? 'Downloading...' : 'Download CSV'}
              </Button>
              <Button type="submit" disabled={!hasFilterCriteria} tabIndex={20}>Apply Filter</Button>
              <Button type="button" className="bg-gray-600 hover:bg-gray-700" onClick={clearFilters} disabled={!hasFilterCriteria} tabIndex={21}>
                Clear
              </Button>
            </div>

            {downloadError ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {downloadError}
              </div>
            ) : null}
          </form>
        </section>

        <section className="bg-white shadow rounded-lg p-6">
          {isLoading && <p className="text-gray-500">Loading items...</p>}
          {error && <p className="text-red-600">Error loading inventory.</p>}

          {!isLoading && !error && (
            <>
                  <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-px whitespace-nowrap px-2 text-center">
                        <input
                          type="checkbox"
                          checked={areAllCurrentPageItemsSelected}
                          onChange={toggleSelectAllCurrentPage}
                          aria-label="Select all items on this page"
                          tabIndex={32}
                        />
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('PublisherName')} className="flex items-center hover:text-blue-600" tabIndex={21}>
                          Publisher <SortIndicator column="PublisherName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('CollectionName')} className="flex items-center hover:text-blue-600" tabIndex={22}>
                          Collection <SortIndicator column="CollectionName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('ItemName')} className="flex items-center hover:text-blue-600" tabIndex={23}>
                          Item <SortIndicator column="ItemName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('ItemVersion')} className="flex items-center hover:text-blue-600" tabIndex={24}>
                          Version <SortIndicator column="ItemVersion" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('CategoryName')} className="flex items-center hover:text-blue-600" tabIndex={25}>
                          Category <SortIndicator column="CategoryName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('SubTypeName')} className="flex items-center hover:text-blue-600" tabIndex={26}>
                          Sub Category <SortIndicator column="SubTypeName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('ProductID')} className="flex items-center hover:text-blue-600" tabIndex={27}>
                          Product ID <SortIndicator column="ProductID" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('ReleaseDate')} className="flex items-center hover:text-blue-600" tabIndex={28}>
                          Release Date <SortIndicator column="ReleaseDate" />
                        </button>
                      </TableHead>
                      <TableHead className="text-center">
                        <button onClick={() => handleSort('IsPhysical')} className="flex items-center justify-center w-full hover:text-blue-600" tabIndex={29}>
                          Is Physical <SortIndicator column="IsPhysical" />
                        </button>
                      </TableHead>
                      <TableHead className="text-center">
                        <button onClick={() => handleSort('IsDigital')} className="flex items-center justify-center w-full hover:text-blue-600" tabIndex={30}>
                          Is Digital <SortIndicator column="IsDigital" />
                        </button>
                      </TableHead>
                      <TableHead className="w-px whitespace-nowrap px-2 text-center">
                        <button onClick={() => handleSort('HasPurchaseOrder')} className="flex items-center justify-center w-full hover:text-blue-600" tabIndex={31}>
                          Is Owned <SortIndicator column="HasPurchaseOrder" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                              {Array.isArray(data?.data) && data.data.length ? (
                      data.data.map((item: InventoryItem, rowIndex: number) => {
                        const rowTabIndex = gridRowTabIndexStart + rowIndex * 3;

                        return (
                          <TableRow
                            key={item.ItemID}
                            className="cursor-pointer hover:bg-gray-50"
                            onClick={() => openEditModal(item)}
                            tabIndex={rowTabIndex + 2}
                            aria-label={`Edit item ${item.ItemName}`}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && event.target === event.currentTarget) {
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
                                tabIndex={rowTabIndex}
                              />
                            </TableCell>
                            <TableCell>{item.PublisherName}</TableCell>
                            <TableCell>{collectionLabelById[item.CollectionID] ?? item.CollectionName}</TableCell>
                            <TableCell>{item.ItemName}</TableCell>
                            <TableCell>{item.ItemVersion || '-'}</TableCell>
                            <TableCell>{item.CategoryName}</TableCell>
                            <TableCell>{item.SubTypeName}</TableCell>
                            <TableCell>{item.ProductID || '-'}</TableCell>
                            <TableCell>{formatReleaseDate(item.ReleaseDate)}</TableCell>
                            <TableCell className="text-center" onClick={(event) => event.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={Boolean(item.IsPhysical)}
                                disabled
                                aria-label="Is Physical (read only)"
                                className="cursor-not-allowed accent-gray-400"
                                tabIndex={-1}
                              />
                            </TableCell>
                            <TableCell className="text-center" onClick={(event) => event.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={Boolean(item.IsDigital)}
                                disabled
                                aria-label="Is Digital (read only)"
                                className="cursor-not-allowed accent-gray-400"
                                tabIndex={-1}
                              />
                            </TableCell>
                            <TableCell className="w-px whitespace-nowrap px-2 text-center" onClick={(event) => event.stopPropagation()}>
                              {(typeof item.HasPurchaseOrder === 'boolean'
                                ? item.HasPurchaseOrder
                                : fallbackHasPurchaseOrder[item.ItemID]) ? (
                                <button
                                  type="button"
                                  className="inline-flex items-center justify-center text-blue-600 hover:text-blue-700"
                                  onClick={(event) => handleOpenRelatedOrders(item, event)}
                                  title="Open related purchase orders"
                                  aria-label={`Open related purchase orders for ${item.ItemName}`}
                                  tabIndex={rowTabIndex + 1}
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
                        <TableCell colSpan={12} className="text-center py-10 text-gray-500">
                          No matching items found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-gray-600">
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
              <span className="text-sm text-gray-600">Invoice Number</span>
              <Input
                type="text"
                value={createOrderValues.InvoiceNumber}
                onChange={(event) => handleCreateOrderFieldChange('InvoiceNumber', event.target.value)}
                placeholder="Invoice number"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-gray-600">Store</span>
              <select
                value={createOrderValues.StoreID}
                onChange={(event) => handleCreateOrderFieldChange('StoreID', event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a store...</option>
                {storesData.map((store: any) => (
                  <option key={store.StoreID} value={store.StoreID}>
                    {store.StoreName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm text-gray-600">Order Status</span>
              <select
                value={createOrderValues.StatusID}
                onChange={(event) => handleCreateOrderFieldChange('StatusID', event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a status...</option>
                {statusesData.map((status: any) => (
                  <option key={status.StatusID} value={status.StatusID}>
                    {status.StatusName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm text-gray-600">Purchase Date</span>
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
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleCreateOrderAddDetailRow}>
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
                            className="bg-gray-600 hover:bg-gray-700"
                            onClick={() => handleCreateOrderRemoveDetailRow(detail.id)}
                            disabled={createOrderDetails.length <= 1}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-gray-50 font-semibold">
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
            <Button className="bg-gray-600 hover:bg-gray-700" onClick={closeCreateOrderModal} disabled={createOrderMutation.isLoading}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
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
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-semibold">Edit Item Detail</h2>
                <p className="text-sm text-gray-500">Update item values and save changes.</p>
              </div>
            </div>

            {editError ? (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {editError}
              </div>
            ) : null}

            <form onSubmit={handleEditSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                  <Input
                    ref={editItemInputRef}
                    value={editValues.ItemName}
                    onChange={(e) => handleEditChange('ItemName', e.target.value)}
                    placeholder="Item name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                  <Input
                    value={editValues.ItemVersion}
                    onChange={(e) => handleEditChange('ItemVersion', e.target.value)}
                    placeholder="Version"
                    maxLength={ITEM_VERSION_MAX_LENGTH}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
                  <Input
                    value={editValues.ProductID}
                    onChange={(e) => handleEditChange('ProductID', e.target.value)}
                    placeholder="Product ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Release Date</label>
                  <Input
                    value={editValues.ReleaseDate}
                    onChange={(e) => handleEditChange('ReleaseDate', e.target.value)}
                    placeholder="Release date"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
                  <select
                    value={editValues.PublisherID}
                    onChange={(e) => handleEditChange('PublisherID', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-600 focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <option value="">Select publisher</option>
                    {addPublisherSelectOptions.map((option: { value: string | number; label: string }) => (
                      <option key={option.value} value={String(option.value)}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Collection</label>
                  <select
                    value={editValues.CollectionID}
                    onChange={(e) => handleEditChange('CollectionID', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-600 focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <option value="">Select collection</option>
                    {editCollectionSelectOptions.map((option: { value: string | number; label: string }) => (
                      <option key={option.value} value={String(option.value)}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={editValues.CategoryID}
                    onChange={(e) => handleEditChange('CategoryID', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-600 focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <option value="">Select category</option>
                    {categorySelectOptions.map((option: { value: string | number; label: string }) => (
                      <option key={option.value} value={String(option.value)}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sub Category</label>
                  <select
                    value={editValues.SubTypeID}
                    onChange={(e) => handleEditChange('SubTypeID', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-600 focus:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    <option value="">Select sub category</option>
                    {editSubTypeSelectOptions.map((option: { value: string | number; label: string }) => (
                      <option key={option.value} value={String(option.value)}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 pt-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={editValues.IsPhysical}
                    onChange={(event) => setEditValues((current) => ({ ...current, IsPhysical: event.target.checked }))}
                  />
                  Is Physical
                </label>
                <label className="flex items-center gap-2 pt-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={editValues.IsDigital}
                    onChange={(event) => setEditValues((current) => ({ ...current, IsDigital: event.target.checked }))}
                  />
                  Is Digital
                </label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  className="bg-red-600 hover:bg-red-700 sm:mr-auto"
                  onClick={handleDeleteItem}
                  disabled={editMutation.isLoading || deleteMutation.isLoading}
                >
                  {deleteMutation.isLoading ? 'Deleting...' : 'Delete Item'}
                </Button>
                <Button
                  type="button"
                  className="bg-gray-200 text-gray-800 hover:bg-gray-300"
                  onClick={closeEditModal}
                  disabled={editMutation.isLoading || deleteMutation.isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!isEditDirty || editMutation.isLoading || deleteMutation.isLoading}>
                  {editMutation.isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
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
            <p className="text-sm text-gray-500">Create a new item record.</p>
          </div>

          {addError ? (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {addError}
            </div>
          ) : null}

          <form onSubmit={handleAddSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                <Input
                  ref={addItemInputRef}
                  value={addValues.ItemName}
                  onChange={(e) => handleAddChange('ItemName', e.target.value)}
                  placeholder="Item name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                <Input
                  value={addValues.ItemVersion}
                  onChange={(e) => handleAddChange('ItemVersion', e.target.value)}
                  placeholder="Version"
                  maxLength={ITEM_VERSION_MAX_LENGTH}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
                <Input
                  value={addValues.ProductID}
                  onChange={(e) => handleAddChange('ProductID', e.target.value)}
                  placeholder="Product ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Release Date</label>
                <Input
                  type="date"
                  value={addValues.ReleaseDate}
                  onChange={(e) => handleAddChange('ReleaseDate', e.target.value)}
                  placeholder="Release date"
                />
              </div>
              <label className="flex items-center gap-2 pt-6 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={addValues.IsPhysical}
                  onChange={(event) => setAddValues((current) => ({ ...current, IsPhysical: event.target.checked }))}
                />
                Is Physical
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={addValues.IsDigital}
                  onChange={(event) => setAddValues((current) => ({ ...current, IsDigital: event.target.checked }))}
                />
                Is Digital
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Publisher Name</label>
                <select
                  value={addValues.PublisherID}
                  onChange={(e) => handleAddChange('PublisherID', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
                  required
                >
                  <option value="">Select publisher</option>
                  {addPublisherSelectOptions.map((option: { value: string | number; label: string }) => (
                    <option key={option.value} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Collection Name</label>
                <select
                  value={addValues.CollectionID}
                  onChange={(e) => handleAddChange('CollectionID', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
                  required
                >
                  <option value="">Select collection</option>
                  {addCollectionSelectOptions.map((option: { value: string | number; label: string }) => (
                    <option key={option.value} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                <select
                  value={addValues.CategoryID}
                  onChange={(e) => handleAddChange('CategoryID', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
                  required
                >
                  <option value="">Select category</option>
                  {categorySelectOptions.map((option: { value: string | number; label: string }) => (
                    <option key={option.value} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sub Category Name</label>
                <select
                  value={addValues.SubTypeID}
                  onChange={(e) => handleAddChange('SubTypeID', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
                  required
                >
                  <option value="">Select sub category</option>
                  {addSubTypeSelectOptions.map((option: { value: string | number; label: string }) => (
                    <option key={option.value} value={String(option.value)}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                className="bg-gray-200 text-gray-800 hover:bg-gray-300"
                onClick={closeAddModal}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addMutation.isLoading}>
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
                  Bulk updates apply to {selectedCurrentPageItems.length} selected item{selectedCurrentPageItems.length === 1 ? '' : 's'} on this page.
                  Only the fields you change will be written.
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
                    <select
                      value={bulkValues.PublisherID}
                      onChange={(event) => handleBulkFieldChange('PublisherID', event.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    >
                      <option value="">Leave unchanged</option>
                      {publisherSelectOptions.map((option: { value: string | number; label: string }) => (
                        <option key={option.value} value={String(option.value)}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Collection</label>
                    <select
                      value={bulkValues.CollectionID}
                      onChange={(event) => handleBulkFieldChange('CollectionID', event.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    >
                      <option value="">Leave unchanged</option>
                      {collectionSelectOptions.map((option: { value: string | number; label: string }) => (
                        <option key={option.value} value={String(option.value)}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={bulkValues.CategoryID}
                      onChange={(event) => handleBulkFieldChange('CategoryID', event.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    >
                      <option value="">Leave unchanged</option>
                      {categorySelectOptions.map((option: { value: string | number; label: string }) => (
                        <option key={option.value} value={String(option.value)}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sub Category</label>
                    <select
                      value={bulkValues.SubTypeID}
                      onChange={(event) => handleBulkFieldChange('SubTypeID', event.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    >
                      <option value="">Leave unchanged</option>
                      {subTypeSelectOptions.map((option: { value: string | number; label: string }) => (
                        <option key={option.value} value={String(option.value)}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
                    <Input
                      value={bulkValues.ItemVersion}
                      onChange={(event) => handleBulkFieldChange('ItemVersion', event.target.value)}
                      placeholder="Leave unchanged"
                      maxLength={ITEM_VERSION_MAX_LENGTH}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Is Physical</label>
                    <select
                      value={bulkValues.IsPhysical}
                      onChange={(event) => handleBulkBooleanFieldChange('IsPhysical', event.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    >
                      <option value="">Leave unchanged</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Is Digital</label>
                    <select
                      value={bulkValues.IsDigital}
                      onChange={(event) => handleBulkBooleanFieldChange('IsDigital', event.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    >
                      <option value="">Leave unchanged</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    className="bg-gray-200 text-gray-800 hover:bg-gray-300"
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
                    Review {selectedCurrentPageItems.length} Update{selectedCurrentPageItems.length === 1 ? '' : 's'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  You are about to update {selectedCurrentPageItems.length} item{selectedCurrentPageItems.length === 1 ? '' : 's'}.
                  Confirm only after checking the summary below.
                </div>

                <div className="rounded-lg border border-gray-200">
                  <div className="border-b border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700">
                    Update Summary
                  </div>
                  <div className="space-y-2 px-4 py-3 text-sm text-gray-700">
                    {Object.entries(bulkValues)
                      .filter(([, value]) => value)
                      .map(([field, value]) => (
                        <div key={field} className="flex items-center justify-between gap-4">
                          <span className="font-medium text-gray-600">
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
                      <div className="text-gray-500">No fields selected for update.</div>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    className="bg-gray-200 text-gray-800 hover:bg-gray-300"
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
                    {bulkUpdateMutation.isLoading ? 'Updating...' : `Confirm Update (${selectedCurrentPageItems.length})`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Dialog>
      ) : null}

      {isBulkDeleteOpen ? (
        <Dialog
          open={isBulkDeleteOpen}
          onOpenChange={(open) => {
            if (open) {
              setIsBulkDeleteOpen(true);
              return;
            }

            closeBulkDeleteDialog();
          }}
          title="Confirm Bulk Delete"
          contentClassName="max-w-xl"
        >
          <div className="space-y-5">
            {bulkDeleteError ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {bulkDeleteError}
              </div>
            ) : null}

            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              You are about to permanently delete {selectedItemIds.length} selected item{selectedItemIds.length === 1 ? '' : 's'}.
              This action cannot be undone.
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                className="bg-gray-200 text-gray-800 hover:bg-gray-300"
                onClick={closeBulkDeleteDialog}
                disabled={bulkDeleteMutation.isLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700"
                onClick={handleBulkDeleteConfirm}
                disabled={bulkDeleteMutation.isLoading || bulkDeleteConfirmText.trim() !== 'DELETE'}
              >
                {bulkDeleteMutation.isLoading ? 'Deleting...' : `Delete ${selectedItemIds.length} Items`}
              </Button>
            </div>
          </div>
        </Dialog>
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
          {relatedOrdersLoading ? <p className="text-gray-500">Loading related purchase orders...</p> : null}

          {!relatedOrdersLoading && relatedOrdersError ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {relatedOrdersError}
            </div>
          ) : null}

          {!relatedOrdersLoading && !relatedOrdersError && !relatedOrders.length ? (
            <p className="text-gray-500">No purchase orders found for this item.</p>
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
                          className="bg-blue-600 hover:bg-blue-700"
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
            <Button ref={relatedOrdersCloseButtonRef} className="bg-gray-600 hover:bg-gray-700" onClick={handleCloseRelatedOrdersModal}>
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
