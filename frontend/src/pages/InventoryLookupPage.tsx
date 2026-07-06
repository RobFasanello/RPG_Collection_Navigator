import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import ComboMultiSelect from '../components/ui/ComboMultiSelect';
import { Dialog } from '../components/ui/Dialog';
import LinkedOrderDetailModal, { type LinkedPurchaseOrder } from '../components/order/LinkedOrderDetailModal';
import BulkItemUploadDialog from '../components/inventory/BulkItemUploadDialog';
import { tablesAPI } from '../services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';

interface InventoryItem {
  ItemID: number;
  ItemName: string;
  ProductID?: string;
  ReleaseDate?: string;
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
  Category?: string | null;
  SubType?: string | null;
  ProductID?: string | null;
  ReleaseDate?: string | null;
  Store?: string | null;
  InvoiceNumber?: string | null;
  PurchaseDate?: string | null;
  Price?: number | null;
  Count?: number | null;
  POStatus?: string | null;
}

export default function InventoryLookupPage() {
  const [urlSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('ItemName');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [filterValues, setFilterValues] = useState({
    itemName: '',
    productID: '',
    // publisherName is now an array of selected publisher names
    publisherName: [] as string[],
    collectionName: [] as string[],
    categoryName: [] as string[],
    subTypeName: [] as string[],
  });
  const [searchParams, setSearchParams] = useState(filterValues);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editValues, setEditValues] = useState({
    ItemName: '',
    ProductID: '',
    ReleaseDate: '',
    PublisherID: '',
    CollectionID: '',
    CategoryID: '',
    SubTypeID: '',
  });
  const [editError, setEditError] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [addValues, setAddValues] = useState({
    ItemName: '',
    ProductID: '',
    ReleaseDate: '',
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

    if (!publisher && !collection && !item) {
      return;
    }

    const nextFilters = {
      itemName: item,
      productID: '',
      publisherName: publisher ? [publisher] : [],
      collectionName: collection ? [collection] : [],
      categoryName: [] as string[],
      subTypeName: [] as string[],
    };

    setFilterValues(nextFilters);
    setSearchParams(nextFilters);
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

  // Load collection options for the multi-select
  const { data: collectionResp } = useQuery(['collections'], async () => {
    const resp = await tablesAPI.getTableData('Collection', 1, 500);
    return resp.data;
  });

  // Load publisher-collection relationships for dependent filter options
  const { data: publisherCollectionResp } = useQuery(['publisherCollections'], async () => {
    const resp = await tablesAPI.getTableData('PublisherCollection', 1, 5000);
    return resp.data;
  });

  const publishersData = publisherResp?.data || [];
  const collectionsData = collectionResp?.data || [];
  const publisherCollectionLinks = publisherCollectionResp?.data || [];

  const publisherIdByName = useMemo(() => {
    return publishersData.reduce((map: Record<string, number>, item: any) => {
      if (item?.PublisherName != null && item?.PublisherID != null) {
        map[item.PublisherName] = item.PublisherID;
      }
      return map;
    }, {});
  }, [publishersData]);

  const collectionIdByName = useMemo(() => {
    return collectionsData.reduce((map: Record<string, number>, item: any) => {
      if (item?.CollectionName != null && item?.CollectionID != null) {
        map[item.CollectionName] = item.CollectionID;
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
    return (filterValues.collectionName || [])
      .map((name) => collectionIdByName[name])
      .filter((id): id is number => typeof id === 'number');
  }, [filterValues.collectionName, collectionIdByName]);

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
      .map((c: any) => ({ value: c.CollectionName, label: c.CollectionName }));
  }, [collectionsData, allowedCollectionIds]);

  const publisherSelectOptions = publishersData.map((p: any) => ({ value: p.PublisherID, label: p.PublisherName }));
  const collectionSelectOptions = collectionsData.map((c: any) => ({ value: c.CollectionID, label: c.CollectionName }));

  useEffect(() => {
    if (!allowedCollectionIds) {
      return;
    }

    setFilterValues((current) => {
      const nextCollectionNames = current.collectionName.filter((name) => {
        const id = collectionIdByName[name];
        return typeof id === 'number' && allowedCollectionIds.has(id);
      });

      if (nextCollectionNames.length === current.collectionName.length) {
        return current;
      }

      return {
        ...current,
        collectionName: nextCollectionNames,
      };
    });
  }, [allowedCollectionIds, collectionIdByName]);

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

  const currentPageItems: InventoryItem[] = Array.isArray(data?.data) ? data.data : [];
  const selectedItemIdSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const selectedCurrentPageItems = useMemo(
    () => currentPageItems.filter((item) => selectedItemIdSet.has(item.ItemID)),
    [currentPageItems, selectedItemIdSet]
  );
  const areAllCurrentPageItemsSelected = currentPageItems.length > 0 && currentPageItems.every((item) => selectedItemIdSet.has(item.ItemID));

  const bulkUpdateMutation = useMutation({
    mutationFn: async (payload: { itemIds: number[]; updates: Record<string, number> }) => {
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

  const hasFilterCriteria =
    filterValues.itemName.trim().length > 0 ||
    filterValues.productID.trim().length > 0 ||
    filterValues.publisherName.length > 0 ||
    filterValues.collectionName.length > 0 ||
    filterValues.categoryName.length > 0 ||
    filterValues.subTypeName.length > 0;

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
      productID: '',
      publisherName: [],
      collectionName: [],
      categoryName: [],
      subTypeName: [],
    });
    setSearchParams({
      itemName: '',
      productID: '',
      publisherName: [],
      collectionName: [],
      categoryName: [],
      subTypeName: [],
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
    });
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

  const handleBulkFieldChange = (field: 'PublisherID' | 'CollectionID' | 'CategoryID' | 'SubTypeID', value: string) => {
    setBulkError('');
    setBulkValues((current) => ({ ...current, [field]: value }));
  };

  const buildBulkUpdatePayload = () => {
    const updates: Record<string, number> = {};

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

    return updates;
  };

  const getBulkFieldLabel = (field: 'PublisherID' | 'CollectionID' | 'CategoryID' | 'SubTypeID', value: string) => {
    if (!value) {
      return '';
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
      'Category',
      'SubType',
      'ProductID',
      'Release Date',
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
        row.Category || '',
        row.SubType || '',
        row.ProductID || '',
        formatDateForCsv(row.ReleaseDate),
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
      ProductID: item.ProductID || '',
      ReleaseDate: formatReleaseDateForModal(item.ReleaseDate),
      PublisherID: String(item.PublisherID),
      CollectionID: String(item.CollectionID),
      CategoryID: String(item.CategoryID),
      SubTypeID: String(item.SubTypeID),
    });
    setEditError('');
  };

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
    setDetailTargetItemId(selectedItemForRelatedOrders?.ItemID ?? null);
    setSelectedLinkedOrder(order);
    setIsRelatedOrdersModalOpen(false);
    setIsOrderDetailModalOpen(true);
  };

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
      ProductID: '',
      ReleaseDate: '',
      PublisherID: '',
      CollectionID: '',
      CategoryID: '',
      SubTypeID: '',
    });
    setEditError('');
  };

  const openAddModal = () => {
    setIsAddingItem(true);
    setAddValues({
      ItemName: '',
      ProductID: '',
      ReleaseDate: '',
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
      ProductID: '',
      ReleaseDate: '',
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

    editMutation.mutate({
      ItemName: editValues.ItemName,
      ProductID: editValues.ProductID || null,
      ReleaseDate: editValues.ReleaseDate ? normalizeReleaseDateForSave(editValues.ReleaseDate) : null,
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
      ProductID: addValues.ProductID || null,
      ReleaseDate: addValues.ReleaseDate ? normalizeReleaseDateForSave(addValues.ReleaseDate) : null,
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
    <AdminLayout title="Item Master" subtitle="Manage your collection items">
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="bg-white shadow rounded-lg p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
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
                <span className="text-sm font-medium text-gray-700">Product ID</span>
                <Input
                  value={filterValues.productID}
                  onChange={(event) => handleFilterChange('productID', event.target.value)}
                  placeholder="Product ID"
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
            </div>

            <div className="flex justify-end gap-3">
              <Button
                className="bg-amber-600 hover:bg-amber-700"
                onClick={openBulkUpdateDialog}
                disabled={selectedItemIds.length < 2}
                tabIndex={7}
              >
                Bulk Update{selectedItemIds.length ? ` (${selectedItemIds.length})` : ''}
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={openBulkDeleteDialog}
                disabled={selectedItemIds.length < 2}
                tabIndex={8}
              >
                Bulk Delete{selectedItemIds.length ? ` (${selectedItemIds.length})` : ''}
              </Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={openAddModal} tabIndex={8}>
                Add Item
              </Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => setIsBulkUploadOpen(true)} tabIndex={9}>
                Bulk Upload
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleDownloadCsv} disabled={isDownloading} tabIndex={10}>
                {isDownloading ? 'Downloading...' : 'Download CSV'}
              </Button>
              <Button onClick={applyFilters} disabled={!hasFilterCriteria} tabIndex={11}>Apply Filters</Button>
              <Button className="bg-gray-600 hover:bg-gray-700" onClick={clearFilters} disabled={!hasFilterCriteria} tabIndex={12}>
                Clear
              </Button>
            </div>

            {downloadError ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {downloadError}
              </div>
            ) : null}
          </div>
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
                        />
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('PublisherName')} className="flex items-center hover:text-blue-600" tabIndex={12}>
                          Publisher <SortIndicator column="PublisherName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('CollectionName')} className="flex items-center hover:text-blue-600" tabIndex={13}>
                          Collection <SortIndicator column="CollectionName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('ItemName')} className="flex items-center hover:text-blue-600" tabIndex={14}>
                          Item <SortIndicator column="ItemName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('CategoryName')} className="flex items-center hover:text-blue-600" tabIndex={15}>
                          Category <SortIndicator column="CategoryName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('SubTypeName')} className="flex items-center hover:text-blue-600" tabIndex={16}>
                          Sub Category <SortIndicator column="SubTypeName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('ProductID')} className="flex items-center hover:text-blue-600" tabIndex={17}>
                          Product ID <SortIndicator column="ProductID" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('ReleaseDate')} className="flex items-center hover:text-blue-600" tabIndex={18}>
                          Release Date <SortIndicator column="ReleaseDate" />
                        </button>
                      </TableHead>
                      <TableHead className="w-px whitespace-nowrap px-2 text-center">PO Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(data?.data) && data.data.length ? (
                      data.data.map((item: InventoryItem) => (
                        <TableRow
                          key={item.ItemID}
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => openEditModal(item)}
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
                          <TableCell>{item.CollectionName}</TableCell>
                          <TableCell>{item.ItemName}</TableCell>
                          <TableCell>{item.CategoryName}</TableCell>
                          <TableCell>{item.SubTypeName}</TableCell>
                          <TableCell>{item.ProductID || '-'}</TableCell>
                          <TableCell>{formatReleaseDate(item.ReleaseDate)}</TableCell>
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
                                tabIndex={0}
                              >
                                <Link2 className="w-5 h-5" />
                              </button>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-10 text-gray-500">
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
                        <Button onClick={() => setPage(1)} disabled={!hasManyPages || page === 1}>
                          First
                        </Button>
                        <Button
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          onClick={() => setPage(page + 1)}
                          disabled={page >= (data?.totalPages ?? 1)}
                        >
                          Next
                        </Button>
                        <Button
                          onClick={() => setPage(totalPages)}
                          disabled={!hasManyPages || page >= totalPages}
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

      {editingItem ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-semibold">Edit Item Detail</h2>
                <p className="text-sm text-gray-500">Update item values and save changes.</p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-700"
              >
                Close
              </button>
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
                    value={editValues.ItemName}
                    onChange={(e) => handleEditChange('ItemName', e.target.value)}
                    placeholder="Item name"
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
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="">Select publisher</option>
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
                    value={editValues.CollectionID}
                    onChange={(e) => handleEditChange('CollectionID', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="">Select sub category</option>
                    {editSubTypeSelectOptions.map((option: { value: string | number; label: string }) => (
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
                <Button type="submit" disabled={editMutation.isLoading || deleteMutation.isLoading}>
                  {editMutation.isLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isAddingItem ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-semibold">Add Item</h2>
                <p className="text-sm text-gray-500">Create a new item record.</p>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                className="text-gray-400 hover:text-gray-700"
              >
                Close
              </button>
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
                    value={addValues.ItemName}
                    onChange={(e) => handleAddChange('ItemName', e.target.value)}
                    placeholder="Item name"
                    required
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Publisher Name</label>
                  <select
                    value={addValues.PublisherID}
                    onChange={(e) => handleAddChange('PublisherID', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    required
                  >
                    <option value="">Select publisher</option>
                    {publisherSelectOptions.map((option: { value: string | number; label: string }) => (
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
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
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
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
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
          </div>
        </div>
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
                            {field === 'PublisherID' ? 'Publisher' : field === 'CollectionID' ? 'Collection' : field === 'CategoryID' ? 'Category' : 'Sub Category'}
                          </span>
                          <span className="text-right">{getBulkFieldLabel(field as 'PublisherID' | 'CollectionID' | 'CategoryID' | 'SubTypeID', value)}</span>
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
                  {relatedOrders.map((order) => (
                    <TableRow key={order.PurchaseOrderID}>
                      <TableCell>{formatReleaseDate(order.PurchaseDate)}</TableCell>
                      <TableCell>{order.InvoiceNumber}</TableCell>
                      <TableCell>{order.StoreName}</TableCell>
                      <TableCell>{order.StatusName || '-'}</TableCell>
                      <TableCell className="text-right">${(order.TotalAmount || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <Button
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
            <Button className="bg-gray-600 hover:bg-gray-700" onClick={handleCloseRelatedOrdersModal}>
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
        collectionOptions={collectionSelectOptions}
        categoryOptions={categorySelectOptions}
        subTypeOptions={subTypeSelectOptions}
        onItemsAdded={() => {
          queryClient.invalidateQueries({ queryKey: ['inventory'] });
        }}
      />
    </AdminLayout>
  );
}
