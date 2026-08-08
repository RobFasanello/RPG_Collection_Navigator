import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleHelp, Link2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import ComboSelect from '../components/ui/ComboSelect';
import FilterChipBar, { type FilterChipField } from '../components/inventory/FilterChipBar';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import AlertDialog from '../components/ui/AlertDialog';
import SelectionScopeMenu from '../components/ui/SelectionScopeMenu';
import { useToast } from '../components/ui/ToastProvider';
import { Input } from '../components/ui/Input';
import SetupTablePagination from '../components/SetupTablePagination';
import AdminLayout from '../components/AdminLayout';
import BulkTerrainUploadDialog from '../components/terrain/BulkTerrainUploadDialog';
import { type LinkedPurchaseOrder } from '../components/order/LinkedOrderDetailModal';
import useSetupPagination from '../hooks/useSetupPagination';
import { useAppMode } from '../context/AppModeContext';
import { tablesAPI } from '../services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';

type SortOrder = 'ASC' | 'DESC';
type SortColumn =
  | 'CollectionName'
  | 'SubTypeName'
  | 'ItemName'
  | 'TerrainName'
  | 'TerrainCode'
  | 'TerrainQuantity'
  | 'LocationName'
  | 'HasPurchaseOrder';

type TerrainRecord = {
  TerrainID: number;
  ItemID?: number;
  TerrainName: string;
  TerrainCode?: string | null;
  TerrainQuantity: number;
  LocationID?: number | null;
};

type ItemRecord = {
  ItemID: number;
  ItemName: string;
  CollectionID: number;
  SubTypeID: number;
};

type LookupRecord = Record<string, any>;

type TerrainRow = TerrainRecord & {
  ItemName: string;
  ResolvedItemID?: number;
  CollectionID?: number;
  CollectionName: string;
  SubTypeID?: number;
  SubTypeName: string;
  LocationName: string;
};

type FilterValues = {
  collectionName: string[];
  subTypeName: string[];
  itemId: string;
  terrainName: string;
  locationName: string[];
  hasPurchaseOrder: boolean | undefined;
};

const EMPTY_FILTERS: FilterValues = {
  collectionName: [],
  subTypeName: [],
  itemId: '',
  terrainName: '',
  locationName: [],
  hasPurchaseOrder: undefined,
};

const csvEscape = (value: string) => {
  if (/[\",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

export default function TerrainMasterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canWrite } = useAppMode();
  const [urlSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<SortColumn>('TerrainName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');
  const [filterValues, setFilterValues] = useState<FilterValues>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [selectedTerrainIds, setSelectedTerrainIds] = useState<number[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addValues, setAddValues] = useState({
    ItemID: '',
    Item: '',
    TerrainName: '',
    TerrainCode: '',
    TerrainQuantity: '1',
    LocationID: '',
  });
  const [addError, setAddError] = useState('');
  const [editingTerrain, setEditingTerrain] = useState<TerrainRow | null>(null);
  const [pendingEditNavigation, setPendingEditNavigation] = useState<
    { direction: 'previous' | 'next'; targetPage: number } | null
  >(null);
  const [editValues, setEditValues] = useState({
    ItemID: '',
    Item: '',
    TerrainName: '',
    TerrainCode: '',
    TerrainQuantity: '1',
    LocationID: '',
  });
  const [editError, setEditError] = useState('');
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState<'edit' | 'confirm'>('edit');
  const [bulkValues, setBulkValues] = useState({ TerrainCode: '', TerrainQuantity: '', LocationID: '' });
  const [bulkError, setBulkError] = useState('');
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const [bulkDeleteError, setBulkDeleteError] = useState('');
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [isRelatedOrdersModalOpen, setIsRelatedOrdersModalOpen] = useState(false);
  const [selectedTerrainForRelatedOrders, setSelectedTerrainForRelatedOrders] = useState<TerrainRow | null>(null);
  const [relatedOrdersLoading, setRelatedOrdersLoading] = useState(false);
  const [relatedOrdersError, setRelatedOrdersError] = useState('');
  const [relatedOrders, setRelatedOrders] = useState<LinkedPurchaseOrder[]>([]);
  const [hasPurchaseOrderByItemId, setHasPurchaseOrderByItemId] = useState<Record<number, boolean>>({});
  const addTerrainNameInputRef = useRef<HTMLInputElement | null>(null);
  const editTerrainNameInputRef = useRef<HTMLInputElement | null>(null);
  const firstRelatedOrderOpenButtonRef = useRef<HTMLButtonElement | null>(null);
  const relatedOrdersCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  const { data: terrainRecords = [], isLoading, error } = useQuery<TerrainRecord[], Error>({
    queryKey: ['table', 'Terrain'],
    queryFn: async () => tablesAPI.getAllRecords('Terrain'),
  });

  const { data: itemRecords = [] } = useQuery<ItemRecord[], Error>({
    queryKey: ['table', 'Item', 'all-for-terrain'],
    queryFn: async () => tablesAPI.getAllRecords('Item'),
  });

  const { data: collectionRecords = [] } = useQuery<LookupRecord[], Error>({
    queryKey: ['table', 'Collection', 'all-for-terrain'],
    queryFn: async () => tablesAPI.getAllRecords('Collection'),
  });

  const { data: collectionTypeRecords = [] } = useQuery<LookupRecord[], Error>({
    queryKey: ['table', 'CollectionType', 'all-for-terrain'],
    queryFn: async () => tablesAPI.getAllRecords('CollectionType'),
  });

  const { data: subTypeRecords = [] } = useQuery<LookupRecord[], Error>({
    queryKey: ['table', 'SubType', 'all-for-terrain'],
    queryFn: async () => tablesAPI.getAllRecords('SubType'),
  });

  const { data: categoryRecords = [] } = useQuery<LookupRecord[], Error>({
    queryKey: ['table', 'Category', 'all-for-terrain'],
    queryFn: async () => tablesAPI.getAllRecords('Category'),
  });

  const { data: categorySubTypeRecords = [] } = useQuery<LookupRecord[], Error>({
    queryKey: ['table', 'CategorySubType', 'all-for-terrain'],
    queryFn: async () => tablesAPI.getAllRecords('CategorySubType'),
  });

  const { data: locationRecords = [] } = useQuery<LookupRecord[], Error>({
    queryKey: ['table', 'Location', 'all-for-terrain'],
    queryFn: async () => tablesAPI.getAllRecords('Location'),
  });

  useQuery<Record<number, boolean>, Error>({
    queryKey: ['inventory', 'owned-map-for-terrain'],
    queryFn: async () => {
      const ownedMap: Record<number, boolean> = {};
      let page = 1;
      const pageSize = 100;

      while (true) {
        const response = await tablesAPI.getInventoryItems({
          page,
          pageSize,
          sortBy: 'ItemName',
          sortOrder: 'ASC',
        });

        const rows: any[] = response.data?.data || [];
        rows.forEach((row) => {
          const itemId = Number(row?.ItemID);
          if (!Number.isInteger(itemId) || itemId <= 0) {
            return;
          }

          if (typeof row?.HasPurchaseOrder === 'boolean') {
            ownedMap[itemId] = row.HasPurchaseOrder;
          }
        });

        const totalPages = Number(response.data?.totalPages || 1);
        if (page >= totalPages) {
          break;
        }

        page += 1;
      }

      return ownedMap;
    },
    onSuccess: (ownedMap) => {
      setHasPurchaseOrderByItemId((current) => ({
        ...ownedMap,
        ...current,
      }));
    },
  });

  const collectionNameById = useMemo(() => {
    return collectionRecords.reduce((map: Record<number, string>, collection) => {
      map[Number(collection.CollectionID)] = String(collection.CollectionName ?? '').trim();
      return map;
    }, {});
  }, [collectionRecords]);

  const collectionTypeNameById = useMemo(() => {
    return collectionTypeRecords.reduce((map: Record<number, string>, collectionType) => {
      map[Number(collectionType.CollectionTypeID)] = String(collectionType.CollectionTypeName ?? '').trim();
      return map;
    }, {});
  }, [collectionTypeRecords]);

  const terrainCollectionRecords = useMemo(() => {
    return collectionRecords.filter((collection) => {
      const collectionTypeName =
        collectionTypeNameById[Number(collection.CollectionTypeID)] || String(collection.CollectionTypeName ?? '');
      return collectionTypeName.trim().toLowerCase() === 'terrain';
    });
  }, [collectionRecords, collectionTypeNameById]);

  const subTypeNameById = useMemo(() => {
    return subTypeRecords.reduce((map: Record<number, string>, subType) => {
      map[Number(subType.SubTypeID)] = String(subType.SubTypeName ?? '').trim();
      return map;
    }, {});
  }, [subTypeRecords]);

  const terrainCategoryIdSet = useMemo(() => {
    return new Set(
      categoryRecords
        .filter((category) => String(category.CategoryName ?? '').trim().toLowerCase() === 'terrain')
        .map((category) => Number(category.CategoryID))
        .filter((categoryId) => Number.isInteger(categoryId))
    );
  }, [categoryRecords]);

  const terrainSubTypeIdSet = useMemo(() => {
    const linkedSubTypeIds = categorySubTypeRecords
      .filter((link) => terrainCategoryIdSet.has(Number(link.CategoryID)))
      .map((link) => Number(link.SubTypeID))
      .filter((subTypeId) => Number.isInteger(subTypeId));

    if (linkedSubTypeIds.length > 0) {
      return new Set(linkedSubTypeIds);
    }

    return new Set(
      subTypeRecords
        .filter((subType) => terrainCategoryIdSet.has(Number(subType.CategoryID)))
        .map((subType) => Number(subType.SubTypeID))
        .filter((subTypeId) => Number.isInteger(subTypeId))
    );
  }, [categorySubTypeRecords, terrainCategoryIdSet, subTypeRecords]);

  const locationNameById = useMemo(() => {
    return locationRecords.reduce((map: Record<number, string>, location) => {
      map[Number(location.LocationID)] = String(location.LocationName ?? '').trim();
      return map;
    }, {});
  }, [locationRecords]);

  const itemById = useMemo(() => {
    return itemRecords.reduce((map: Record<number, ItemRecord>, item) => {
      map[Number(item.ItemID)] = item;
      return map;
    }, {});
  }, [itemRecords]);

  const resolveTerrainItem = (terrain: TerrainRecord) => {
    const itemId = Number(terrain.ItemID);

    if (Number.isInteger(itemId) && itemById[itemId]) {
      return itemById[itemId];
    }

    return itemById[Number(terrain.TerrainID)];
  };

  const terrainRows = useMemo<TerrainRow[]>(() => {
    return terrainRecords.map((terrain) => {
      const item = resolveTerrainItem(terrain);

      return {
        ...terrain,
        ItemName: String(item?.ItemName || '').trim(),
        ResolvedItemID: Number.isInteger(Number(item?.ItemID)) ? Number(item?.ItemID) : undefined,
        CollectionID: item?.CollectionID,
        CollectionName: item ? collectionNameById[Number(item.CollectionID)] || 'Unknown' : 'Unknown',
        SubTypeID: item?.SubTypeID,
        SubTypeName: item ? subTypeNameById[Number(item.SubTypeID)] || 'Unknown' : 'Unknown',
        LocationName: locationNameById[Number(terrain.LocationID)] || 'Unknown',
      };
    });
  }, [collectionNameById, itemById, locationNameById, subTypeNameById, terrainRecords]);

  const subTypeIdByName = useMemo(() => {
    return subTypeRecords.reduce((map: Record<string, number>, subType) => {
      const name = String(subType.SubTypeName ?? '').trim();
      const id = Number(subType.SubTypeID);
      if (name && Number.isInteger(id)) {
        map[name] = id;
      }
      return map;
    }, {});
  }, [subTypeRecords]);

  const collectionLookupOptions = useMemo(() => {
    return terrainCollectionRecords
      .map((collection) => ({ value: Number(collection.CollectionID), label: String(collection.CollectionName ?? '').trim() }))
      .filter((option) => Number.isFinite(option.value) && option.label)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [terrainCollectionRecords]);

  const subTypeLookupOptions = useMemo(() => {
    return subTypeRecords
      .filter((subType) => terrainSubTypeIdSet.has(Number(subType.SubTypeID)))
      .map((subType) => ({ value: Number(subType.SubTypeID), label: String(subType.SubTypeName ?? '').trim() }))
      .filter((option) => Number.isFinite(option.value) && option.label)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [terrainSubTypeIdSet, subTypeRecords]);

  const collectionOptions = useMemo(
    () => collectionLookupOptions.map((option) => ({ value: option.label, label: option.label })),
    [collectionLookupOptions]
  );

  const terrainCollectionIdSet = useMemo(
    () => new Set(terrainCollectionRecords.map((collection) => Number(collection.CollectionID))),
    [terrainCollectionRecords]
  );

  const subTypeOptions = useMemo(
    () => subTypeLookupOptions.map((option) => ({ value: option.label, label: option.label })),
    [subTypeLookupOptions]
  );

  const locationFilterOptions = useMemo(() => {
    return locationRecords
      .map((location) => ({
        value: String(location.LocationName ?? '').trim(),
        label: String(location.LocationName ?? '').trim(),
      }))
      .filter((option) => option.value && option.label)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [locationRecords]);

  const itemOptions = useMemo(() => {
    return itemRecords
      .filter(
        (item) =>
          terrainCollectionIdSet.has(Number(item.CollectionID)) && terrainSubTypeIdSet.has(Number(item.SubTypeID))
      )
      .map((item) => {
        const collectionName = collectionNameById[Number(item.CollectionID)] || 'Unknown Collection';
        const subTypeName = subTypeNameById[Number(item.SubTypeID)] || 'Unknown Sub Category';
        const itemName = String(item.ItemName ?? '').trim();
        return {
          value: String(item.ItemID),
          label: `${collectionName} - ${subTypeName} - ${itemName}`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [collectionNameById, itemRecords, subTypeNameById, terrainCollectionIdSet, terrainSubTypeIdSet]);

  const itemFilterOptions = useMemo(() => {
    const selectedSubTypeIds = new Set(
      filterValues.subTypeName
        .map((subTypeName) => subTypeIdByName[subTypeName])
        .filter((subTypeId) => Number.isInteger(subTypeId))
    );

    return itemRecords
      .filter((item) => terrainCollectionIdSet.has(Number(item.CollectionID)))
      .filter((item) => terrainSubTypeIdSet.has(Number(item.SubTypeID)))
      .filter((item) => selectedSubTypeIds.size === 0 || selectedSubTypeIds.has(Number(item.SubTypeID)))
      .map((item) => {
        const collectionName = collectionNameById[Number(item.CollectionID)] || 'Unknown Collection';
        const subTypeName = subTypeNameById[Number(item.SubTypeID)] || 'Unknown Sub Category';
        const itemName = String(item.ItemName ?? '').trim();
        return {
          value: String(item.ItemID),
          label: `${collectionName} - ${subTypeName} - ${itemName}`,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [collectionNameById, filterValues.subTypeName, itemRecords, subTypeIdByName, subTypeNameById, terrainCollectionIdSet, terrainSubTypeIdSet]);

  const terrainItemRecords = useMemo(
    () =>
      itemRecords.filter(
        (item) => terrainCollectionIdSet.has(Number(item.CollectionID)) && terrainSubTypeIdSet.has(Number(item.SubTypeID))
      ),
    [itemRecords, terrainCollectionIdSet, terrainSubTypeIdSet]
  );

  const locationOptions = useMemo(() => {
    return locationRecords
      .map((location) => ({
        value: String(location.LocationID ?? ''),
        label: String(location.LocationName ?? '').trim(),
      }))
      .filter((option) => option.value && option.label)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [locationRecords]);

  useEffect(() => {
    const itemId = (urlSearchParams.get('itemId') || '').trim();
    const terrainName = (urlSearchParams.get('terrainName') || '').trim();
    const location = (urlSearchParams.get('location') || '').trim();

    if (!itemId && !terrainName && !location) {
      return;
    }

    const nextFilters = {
      collectionName: [],
      subTypeName: [],
      itemId,
      terrainName,
      locationName: location ? [location] : [],
      hasPurchaseOrder: undefined,
    };

    setFilterValues(nextFilters);
    setSearchInput(terrainName);
  }, [urlSearchParams]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilterValues((current) =>
        current.terrainName === searchInput ? current : { ...current, terrainName: searchInput }
      );
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const filteredRows = useMemo(() => {
    const itemFilterId = parseInt(filterValues.itemId, 10);
    const terrainFilter = filterValues.terrainName.trim().toLowerCase();

    const filtered = terrainRows.filter((row) => {
      const collectionMatches =
        !filterValues.collectionName.length || filterValues.collectionName.includes(row.CollectionName);
      const subTypeMatches = !filterValues.subTypeName.length || filterValues.subTypeName.includes(row.SubTypeName);
      const itemMatches = !Number.isInteger(itemFilterId) || Number(row.ItemID) === itemFilterId;
      const nameMatches = !terrainFilter || String(row.TerrainName || '').toLowerCase().includes(terrainFilter);
      const locationMatches = !filterValues.locationName.length || filterValues.locationName.includes(row.LocationName);
      const isOwned = hasPurchaseOrderByItemId[Number(row.ResolvedItemID)] === true;
      const ownedMatches =
        typeof filterValues.hasPurchaseOrder === 'undefined' ||
        (filterValues.hasPurchaseOrder === true ? isOwned : !isOwned);

      return collectionMatches && subTypeMatches && itemMatches && nameMatches && locationMatches && ownedMatches;
    });

    return [...filtered].sort((a, b) => {
      const valueA =
        sortBy === 'TerrainQuantity'
          ? Number(a.TerrainQuantity)
          : sortBy === 'HasPurchaseOrder'
          ? hasPurchaseOrderByItemId[Number(a.ResolvedItemID)]
            ? 1
            : 0
          : String(a[sortBy] ?? '').toLowerCase();
      const valueB =
        sortBy === 'TerrainQuantity'
          ? Number(b.TerrainQuantity)
          : sortBy === 'HasPurchaseOrder'
          ? hasPurchaseOrderByItemId[Number(b.ResolvedItemID)]
            ? 1
            : 0
          : String(b[sortBy] ?? '').toLowerCase();

      if (valueA < valueB) return sortOrder === 'ASC' ? -1 : 1;
      if (valueA > valueB) return sortOrder === 'ASC' ? 1 : -1;
      return String(a.TerrainName || '').localeCompare(String(b.TerrainName || ''), undefined, {
        sensitivity: 'base',
      });
    });
  }, [terrainRows, filterValues, sortBy, sortOrder, hasPurchaseOrderByItemId]);

  const pagination = useSetupPagination(filteredRows, [filterValues, sortBy, sortOrder]);
  const currentPageRows = pagination.paginatedRows;
  const currentEditTerrainIndex = useMemo(() => {
    if (!editingTerrain) {
      return -1;
    }

    return currentPageRows.findIndex((row) => row.TerrainID === editingTerrain.TerrainID);
  }, [currentPageRows, editingTerrain]);
  const canNavigateToPreviousEditTerrain = Boolean(
    editingTerrain && (currentEditTerrainIndex > 0 || pagination.page > 1)
  );
  const canNavigateToNextEditTerrain = Boolean(
    editingTerrain
      && ((currentEditTerrainIndex >= 0 && currentEditTerrainIndex < currentPageRows.length - 1) || pagination.page < pagination.totalPages)
  );
  const selectedTerrainIdSet = useMemo(() => new Set(selectedTerrainIds), [selectedTerrainIds]);
  const areAllCurrentPageRowsSelected =
    currentPageRows.length > 0 && currentPageRows.every((row) => selectedTerrainIdSet.has(row.TerrainID));

  const selectCurrentPageRows = () => {
    setSelectedTerrainIds(currentPageRows.map((row) => row.TerrainID));
  };

  const selectAllFilteredRows = () => {
    setSelectedTerrainIds(filteredRows.map((row) => row.TerrainID));
  };

  useEffect(() => {
    setSelectedTerrainIds([]);
  }, [filterValues]);

  const queryKey = ['table', 'Terrain'];

  const addMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => tablesAPI.createRecord('Terrain', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      closeAddModal();
      toast({
        title: 'Terrain Added',
        description: `Added "${addValues.TerrainName}" with quantity ${addValues.TerrainQuantity}.`,
        variant: 'success',
      });
    },
    onError: (mutationError: any) => {
      setAddError(mutationError.response?.data?.error || 'Failed to create terrain record');
    },
  });

  const editMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      if (!editingTerrain) {
        throw new Error('No terrain is selected for editing.');
      }

      return tablesAPI.updateRecord('Terrain', editingTerrain.TerrainID, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      closeEditModal();
      toast({
        title: 'Terrain Saved',
        description: `Saved changes for "${editingTerrain?.TerrainName || 'selected terrain'}".`,
        variant: 'success',
      });
    },
    onError: (mutationError: any) => {
      setEditError(mutationError.response?.data?.error || 'Failed to update terrain');
    },
  });

  const editDeleteMutation = useMutation({
    mutationFn: async () => {
      if (!editingTerrain) {
        throw new Error('No terrain is selected for deletion.');
      }

      return tablesAPI.deleteRecord('Terrain', editingTerrain.TerrainID);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setSelectedTerrainIds((current) => current.filter((id) => id !== editingTerrain?.TerrainID));
      closeEditModal();
      toast({
        title: 'Terrain Deleted',
        description: `Deleted "${editingTerrain?.TerrainName || 'selected terrain'}" from Terrain Master.`,
        variant: 'success',
      });
    },
    onError: (mutationError: any) => {
      setEditError(mutationError.response?.data?.error || 'Failed to delete terrain');
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      await Promise.all(selectedTerrainIds.map((terrainId) => tablesAPI.updateRecord('Terrain', terrainId, payload)));
    },
    onSuccess: () => {
      const updatedCount = selectedTerrainIds.length;
      queryClient.invalidateQueries({ queryKey });
      setSelectedTerrainIds([]);
      closeBulkUpdateDialog();
      toast({
        title: updatedCount === 1 ? 'Terrain Updated' : 'Terrain Updated',
        description:
          updatedCount === 1
            ? 'Applied bulk changes to 1 selected terrain record.'
            : `Applied bulk changes to ${updatedCount} selected terrain records.`,
        variant: 'success',
      });
    },
    onError: (mutationError: any) => {
      setBulkError(mutationError.response?.data?.error || 'Failed to bulk update terrain records');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (terrainIds: number[]) => {
      await Promise.all(terrainIds.map((terrainId) => tablesAPI.deleteRecord('Terrain', terrainId)));
    },
    onSuccess: () => {
      const deletedCount = selectedTerrainIds.length;
      queryClient.invalidateQueries({ queryKey });
      setSelectedTerrainIds([]);
      closeBulkDeleteDialog();
      toast({
        title: deletedCount === 1 ? 'Terrain Deleted' : 'Terrain Deleted',
        description:
          deletedCount === 1
            ? 'Removed 1 selected terrain record from Terrain Master.'
            : `Removed ${deletedCount} selected terrain records from Terrain Master.`,
        variant: 'success',
      });
    },
    onError: (mutationError: any) => {
      setBulkDeleteError(mutationError.response?.data?.error || 'Failed to bulk delete terrain records');
    },
  });

  const handleChipFiltersChange = (patch: Partial<FilterValues>) => {
    setDownloadError('');
    setFilterValues((current) => ({ ...current, ...patch }));
  };

  const clearAllChipFilters = () => {
    handleChipFiltersChange({
      collectionName: [],
      subTypeName: [],
      itemId: '',
      locationName: [],
      hasPurchaseOrder: undefined,
    });
  };

  const filterChipFields: FilterChipField[] = [
    {
      key: 'collection',
      label: 'Collection',
      kind: 'multi',
      options: collectionOptions,
      selected: filterValues.collectionName,
      onAdd: (value) => handleChipFiltersChange({ collectionName: [...filterValues.collectionName, value] }),
      onRemove: (value) =>
        handleChipFiltersChange({ collectionName: filterValues.collectionName.filter((v) => v !== value) }),
    },
    {
      key: 'subType',
      label: 'Sub Category',
      kind: 'multi',
      options: subTypeOptions,
      selected: filterValues.subTypeName,
      onAdd: (value) => handleChipFiltersChange({ subTypeName: [...filterValues.subTypeName, value], itemId: '' }),
      onRemove: (value) =>
        handleChipFiltersChange({ subTypeName: filterValues.subTypeName.filter((v) => v !== value), itemId: '' }),
    },
    {
      key: 'item',
      label: 'Item',
      kind: 'singleSelect',
      options: itemFilterOptions,
      value: filterValues.itemId,
      onApply: (value) => handleChipFiltersChange({ itemId: value }),
      onClear: () => handleChipFiltersChange({ itemId: '' }),
    },
    {
      key: 'location',
      label: 'Location',
      kind: 'multi',
      options: locationFilterOptions,
      selected: filterValues.locationName,
      onAdd: (value) => handleChipFiltersChange({ locationName: [...filterValues.locationName, value] }),
      onRemove: (value) =>
        handleChipFiltersChange({ locationName: filterValues.locationName.filter((v) => v !== value) }),
    },
    {
      key: 'owned',
      label: 'Owned',
      kind: 'yesNo',
      value: filterValues.hasPurchaseOrder,
      onApply: (value) => handleChipFiltersChange({ hasPurchaseOrder: value }),
    },
  ];

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortOrder((current) => (current === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
  };

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) {
      return <span className="ml-1 text-gray-300">↕</span>;
    }

    return <span className="ml-1">{sortOrder === 'ASC' ? '↑' : '↓'}</span>;
  };

  const toggleTerrainSelection = (terrainId: number) => {
    setSelectedTerrainIds((current) =>
      current.includes(terrainId) ? current.filter((id) => id !== terrainId) : [...current, terrainId]
    );
  };

  const openAddModal = () => {
    setAddValues({ ItemID: '', Item: '', TerrainName: '', TerrainCode: '', TerrainQuantity: '1', LocationID: '' });
    setAddError('');
    setIsAddOpen(true);
  };

  const openEditModal = (terrain: TerrainRow) => {
    setPendingEditNavigation(null);
    setEditingTerrain(terrain);
    setEditValues({
      ItemID: terrain.ItemID != null ? String(terrain.ItemID) : '',
      Item: terrain.ItemName || '',
      TerrainName: terrain.TerrainName || '',
      TerrainCode: String(terrain.TerrainCode ?? ''),
      TerrainQuantity: String(terrain.TerrainQuantity ?? 0),
      LocationID: terrain.LocationID != null ? String(terrain.LocationID) : '',
    });
    setEditError('');
  };

  const closeAddModal = () => {
    setIsAddOpen(false);
    setAddError('');
    setAddValues({ ItemID: '', Item: '', TerrainName: '', TerrainCode: '', TerrainQuantity: '1', LocationID: '' });
  };

  const closeEditModal = () => {
    setPendingEditNavigation(null);
    setEditingTerrain(null);
    setEditError('');
    setEditValues({ ItemID: '', Item: '', TerrainName: '', TerrainCode: '', TerrainQuantity: '1', LocationID: '' });
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

  const handleNavigateEditTerrain = (direction: 'previous' | 'next') => {
    if (!editingTerrain) {
      return;
    }

    if (isEditDirty) {
      const confirmed = window.confirm('Changes have not been applied. Move to another terrain record without saving?');
      if (!confirmed) {
        return;
      }
    }

    if (direction === 'previous') {
      if (currentEditTerrainIndex > 0) {
        openEditModal(currentPageRows[currentEditTerrainIndex - 1]);
        return;
      }

      if (pagination.page > 1) {
        setPendingEditNavigation({ direction: 'previous', targetPage: pagination.page - 1 });
        pagination.setPage((current) => Math.max(1, current - 1));
      }
      return;
    }

    if (currentEditTerrainIndex >= 0 && currentEditTerrainIndex < currentPageRows.length - 1) {
      openEditModal(currentPageRows[currentEditTerrainIndex + 1]);
      return;
    }

    if (pagination.page < pagination.totalPages) {
      setPendingEditNavigation({ direction: 'next', targetPage: pagination.page + 1 });
      pagination.setPage((current) => current + 1);
    }
  };

  useEffect(() => {
    if (!editingTerrain || !pendingEditNavigation || !currentPageRows.length) {
      return;
    }

    if (pagination.page !== pendingEditNavigation.targetPage) {
      return;
    }

    if (pendingEditNavigation.direction === 'previous') {
      openEditModal(currentPageRows[currentPageRows.length - 1]);
      return;
    }

    openEditModal(currentPageRows[0]);
  }, [editingTerrain, pendingEditNavigation, currentPageRows, pagination.page]);

  const openBulkUpdateDialog = () => {
    if (selectedTerrainIds.length < 1) {
      return;
    }

    setBulkValues({ TerrainCode: '', TerrainQuantity: '', LocationID: '' });
    setBulkError('');
    setBulkStep('edit');
    setIsBulkUpdateOpen(true);
  };

  const closeBulkUpdateDialog = () => {
    setIsBulkUpdateOpen(false);
    setBulkStep('edit');
    setBulkError('');
    setBulkValues({ TerrainCode: '', TerrainQuantity: '', LocationID: '' });
  };

  const openBulkDeleteDialog = () => {
    if (selectedTerrainIds.length < 1) {
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

  const handleAddSubmit = (event: FormEvent) => {
    event.preventDefault();
    setAddError('');

    const itemId = parseInt(addValues.ItemID, 10);
    const locationId = parseInt(addValues.LocationID, 10);
    const quantity = parseInt(addValues.TerrainQuantity, 10);
    const itemName = addValues.Item.trim();
    const terrainName = addValues.TerrainName.trim();
    const terrainCode = addValues.TerrainCode.trim();

    if (!Number.isInteger(itemId) || itemId <= 0) {
      setAddError('Item is required.');
      return;
    }

    if (!itemName) {
      setAddError('Item is required.');
      return;
    }

    const selectedItem = itemById[itemId];
    if (!selectedItem || String(selectedItem.ItemName ?? '').trim().toLowerCase() !== itemName.toLowerCase()) {
      setAddError('Item must match an Item in the Item table.');
      return;
    }

    if (!terrainName) {
      setAddError('Terrain Name is required.');
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      setAddError('Terrain Quantity must be zero or greater.');
      return;
    }

    if (addValues.LocationID && (!Number.isInteger(locationId) || locationId <= 0)) {
      setAddError('Location is invalid.');
      return;
    }

    const payload: Record<string, any> = {
      ItemID: itemId,
      TerrainName: terrainName,
      TerrainQuantity: quantity,
    };

    if (Number.isInteger(locationId) && locationId > 0) {
      payload.LocationID = locationId;
    }

    if (terrainCode) {
      payload.TerrainCode = terrainCode;
    }

    addMutation.mutate(payload);
  };

  const originalEditValues = useMemo(() => {
    if (!editingTerrain) {
      return null;
    }

    return {
      ItemID: editingTerrain.ItemID != null ? String(editingTerrain.ItemID) : '',
      Item: editingTerrain.ItemName || '',
      TerrainName: editingTerrain.TerrainName || '',
      TerrainCode: String(editingTerrain.TerrainCode ?? ''),
      TerrainQuantity: String(editingTerrain.TerrainQuantity ?? 0),
      LocationID: editingTerrain.LocationID != null ? String(editingTerrain.LocationID) : '',
    };
  }, [editingTerrain]);

  const isEditDirty = useMemo(() => {
    if (!originalEditValues) {
      return false;
    }

    return Object.keys(originalEditValues).some((key) => {
      const field = key as keyof typeof originalEditValues;
      return editValues[field] !== originalEditValues[field];
    });
  }, [editValues, originalEditValues]);

  const handleEditSubmit = (event: FormEvent) => {
    event.preventDefault();
    setEditError('');

    if (!editingTerrain || !isEditDirty) {
      return;
    }

    const itemId = parseInt(editValues.ItemID, 10);
    const locationId = parseInt(editValues.LocationID, 10);
    const quantity = parseInt(editValues.TerrainQuantity, 10);
    const terrainName = editValues.TerrainName.trim();
    const terrainCode = editValues.TerrainCode.trim();

    if (!Number.isInteger(itemId) || itemId <= 0) {
      setEditError('Item is required.');
      return;
    }

    if (!itemById[itemId]) {
      setEditError('Item must match an Item in the Item table.');
      return;
    }

    if (!terrainName) {
      setEditError('Terrain Name is required.');
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      setEditError('Terrain Quantity must be zero or greater.');
      return;
    }

    if (editValues.LocationID && (!Number.isInteger(locationId) || locationId <= 0)) {
      setEditError('Location is invalid.');
      return;
    }

    editMutation.mutate({
      ItemID: itemId,
      TerrainName: terrainName,
      TerrainCode: terrainCode || null,
      TerrainQuantity: quantity,
      LocationID: Number.isInteger(locationId) && locationId > 0 ? locationId : null,
    });
  };

  const handleDeleteTerrain = () => {
    if (!editingTerrain) {
      return;
    }

    const confirmed = confirm(`Delete terrain "${editingTerrain.TerrainName}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    editDeleteMutation.mutate();
  };

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

  const formatPurchaseDate = (date?: string) => {
    const parts = parseDateParts(date);
    if (!parts) {
      return date || '-';
    }

    return `${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}/${parts.year}`;
  };

  const handleOpenRelatedOrders = async (terrain: TerrainRow, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const itemId = Number(terrain.ResolvedItemID);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      return;
    }

    setSelectedTerrainForRelatedOrders(terrain);
    setRelatedOrders([]);
    setRelatedOrdersError('');
    setRelatedOrdersLoading(true);
    setIsRelatedOrdersModalOpen(true);

    try {
      const response = await tablesAPI.getPurchaseOrdersByItem(itemId);
      setRelatedOrders(response.data?.data || []);
      setHasPurchaseOrderByItemId((current) => ({
        ...current,
        [itemId]: Array.isArray(response.data?.data) && response.data.data.length > 0,
      }));
    } catch (apiError: any) {
      setRelatedOrdersError(apiError.response?.data?.error || apiError.message || 'Failed to load related purchase orders');
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
    const itemIdsToCheck = Array.from(
      new Set(
        currentPageRows
          .map((row) => Number(row.ResolvedItemID))
          .filter((itemId) => Number.isInteger(itemId) && itemId > 0)
      )
    ).filter((itemId) => typeof hasPurchaseOrderByItemId[itemId] === 'undefined');

    if (!itemIdsToCheck.length) {
      return;
    }

    let isCancelled = false;

    const fetchHasPurchaseOrderFlags = async () => {
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

      setHasPurchaseOrderByItemId((current) => {
        const next = { ...current };
        results.forEach((result) => {
          if (result.status === 'fulfilled') {
            next[result.value.itemId] = result.value.hasPurchaseOrder;
          }
        });
        return next;
      });
    };

    fetchHasPurchaseOrderFlags();

    return () => {
      isCancelled = true;
    };
  }, [currentPageRows, hasPurchaseOrderByItemId]);

  const handleCloseRelatedOrdersModal = () => {
    setIsRelatedOrdersModalOpen(false);
    setRelatedOrdersLoading(false);
    setRelatedOrdersError('');
    setRelatedOrders([]);
    setSelectedTerrainForRelatedOrders(null);
  };

  const buildBulkUpdatePayload = () => {
    const updates: Record<string, string | number> = {};

    if (bulkValues.TerrainCode.trim()) {
      updates.TerrainCode = bulkValues.TerrainCode.trim();
    }

    if (bulkValues.TerrainQuantity.trim()) {
      const quantity = parseInt(bulkValues.TerrainQuantity, 10);
      if (!Number.isInteger(quantity) || quantity < 0) {
        throw new Error('Terrain Quantity must be zero or greater.');
      }
      updates.TerrainQuantity = quantity;
    }

    if (bulkValues.LocationID) {
      const locationId = parseInt(bulkValues.LocationID, 10);
      if (!Number.isInteger(locationId) || locationId <= 0) {
        throw new Error('Location is invalid.');
      }
      updates.LocationID = locationId;
    }

    return updates;
  };

  const getBulkFieldLabel = (field: 'TerrainCode' | 'TerrainQuantity' | 'LocationID', value: string) => {
    if (!value) {
      return '';
    }

    if (field === 'TerrainCode' || field === 'TerrainQuantity') {
      return value;
    }

    const numericValue = parseInt(value, 10);
    return locationOptions.find((option) => Number(option.value) === numericValue)?.label || value;
  };

  const handleBulkPreview = () => {
    try {
      const updates = buildBulkUpdatePayload();
      if (!Object.keys(updates).length) {
        setBulkError('Choose at least one field to update.');
        return;
      }

      setBulkError('');
      setBulkStep('confirm');
    } catch (payloadError: any) {
      setBulkError(payloadError.message || 'Unable to build bulk update payload.');
    }
  };

  const handleBulkConfirm = () => {
    try {
      const updates = buildBulkUpdatePayload();
      if (!Object.keys(updates).length) {
        setBulkError('Choose at least one field to update.');
        setBulkStep('edit');
        return;
      }

      bulkUpdateMutation.mutate(updates);
    } catch (payloadError: any) {
      setBulkError(payloadError.message || 'Unable to build bulk update payload.');
      setBulkStep('edit');
    }
  };

  const handleBulkUpdateSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (bulkStep === 'confirm') {
      handleBulkConfirm();
      return;
    }

    handleBulkPreview();
  };

  const handleBulkDeleteConfirm = () => {
    if (bulkDeleteConfirmText.trim() !== 'DELETE') {
      setBulkDeleteError('Type DELETE exactly to enable bulk delete.');
      return;
    }

    bulkDeleteMutation.mutate(selectedTerrainIds);
  };

  const buildCsvContent = (rows: TerrainRow[]) => {
    const headers = ['Collection Name', 'Sub Category', 'Item', 'Terrain Name', 'Terrain Code', 'Terrain Quantity', 'Location'];
    const lines = rows.map((row) =>
      [
        row.CollectionName,
        row.SubTypeName,
        row.ItemName,
        row.TerrainName,
        String(row.TerrainCode ?? ''),
        String(row.TerrainQuantity ?? ''),
        row.LocationName,
      ]
        .map((value) => csvEscape(String(value)))
        .join(',')
    );

    return [headers.join(','), ...lines].join('\r\n');
  };

  const handleDownloadCsv = () => {
    try {
      setIsDownloading(true);
      setDownloadError('');
      const csvContent = buildCsvContent(filteredRows);
      const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `terrain-master-export-${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (csvError: any) {
      setDownloadError(csvError.message || 'Failed to download CSV');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AdminLayout
      title={
        <span className="inline-flex items-center gap-2">
          <span>Terrain Master</span>
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:text-gray-600"
            title="Use this screen to view, add, remove and modify terrain records in your collection."
            aria-label="Terrain Master page information"
          >
            <CircleHelp className="h-4 w-4" aria-hidden="true" />
          </span>
        </span>
      }
      subtitle={null}
    >
      <div className="max-w-[1600px] mx-auto space-y-6">
        <section className="bg-white shadow rounded-lg p-6">
          <div className="space-y-4">
            {selectedTerrainIds.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-semibold text-blue-900">{selectedTerrainIds.length} selected</span>
                  <button
                    type="button"
                    className="text-blue-700 hover:text-blue-900 underline underline-offset-2"
                    onClick={() => setSelectedTerrainIds([])}
                    tabIndex={2}
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    className="border border-gray-300 !bg-white !text-gray-800 hover:!bg-gray-50"
                    onClick={openBulkUpdateDialog}
                    disabled={!canWrite}
                    title={canWrite ? undefined : 'Switch to Update mode to edit terrain'}
                    tabIndex={3}
                  >
                    Bulk Update
                  </Button>
                  <Button
                    type="button"
                    className="border border-red-300 !bg-white !text-red-700 hover:!bg-red-50"
                    onClick={openBulkDeleteDialog}
                    disabled={!canWrite}
                    title={canWrite ? undefined : 'Switch to Update mode to delete terrain'}
                    tabIndex={4}
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
                    clearAriaLabel="Clear terrain search"
                    placeholder="Search by terrain name..."
                    className="w-full max-w-md"
                    autoFocus
                    tabIndex={1}
                  />
                  <div className="min-w-0 flex-1">
                    <FilterChipBar fields={filterChipFields} onClearAll={clearAllChipFilters} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    className="border border-gray-300 !bg-white !text-gray-700 hover:!bg-gray-50"
                    onClick={() => setIsBulkUploadOpen(true)}
                    disabled={!canWrite}
                    title={canWrite ? undefined : 'Switch to Update mode to bulk upload'}
                    tabIndex={5}
                  >
                    Bulk Upload
                  </Button>
                  <Button
                    type="button"
                    className="border border-gray-300 !bg-white !text-gray-700 hover:!bg-gray-50"
                    onClick={handleDownloadCsv}
                    disabled={isDownloading}
                    tabIndex={6}
                  >
                    Download
                  </Button>
                  <Button
                    type="button"
                    className="!bg-blue-600 !text-white hover:!bg-blue-700"
                    onClick={openAddModal}
                    disabled={!canWrite}
                    title={canWrite ? undefined : 'Switch to Update mode to add terrain'}
                    tabIndex={7}
                  >
                    Add Terrain
                  </Button>
                </div>
              </div>
            )}

            {downloadError ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{downloadError}</div>
            ) : null}
          </div>
        </section>

        <section className="bg-white shadow rounded-lg p-6">
          {isLoading && <p className="text-gray-500">Loading terrain records...</p>}
          {error && <p className="text-red-600">Error loading terrain records.</p>}

          {!isLoading && !error ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-px whitespace-nowrap px-2 text-center">
                        <SelectionScopeMenu
                          checked={areAllCurrentPageRowsSelected}
                          disabled={currentPageRows.length === 0}
                          aria-label="Select terrain rows"
                          tabIndex={15}
                          onSelectPage={selectCurrentPageRows}
                          onSelectAll={selectAllFilteredRows}
                        />
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('CollectionName')} className="flex items-center hover:text-blue-600" tabIndex={16}>
                          Collection Name <SortIndicator column="CollectionName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('SubTypeName')} className="flex items-center hover:text-blue-600" tabIndex={17}>
                          Sub Category <SortIndicator column="SubTypeName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('ItemName')} className="flex items-center hover:text-blue-600" tabIndex={18}>
                          Item <SortIndicator column="ItemName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('TerrainName')} className="flex items-center hover:text-blue-600" tabIndex={19}>
                          Terrain Name <SortIndicator column="TerrainName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('TerrainCode')} className="flex items-center hover:text-blue-600" tabIndex={20}>
                          Terrain Code <SortIndicator column="TerrainCode" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          onClick={() => handleSort('TerrainQuantity')}
                          className="flex items-center justify-end w-full hover:text-blue-600"
                          tabIndex={21}
                        >
                          Terrain Quantity <SortIndicator column="TerrainQuantity" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('LocationName')} className="flex items-center hover:text-blue-600" tabIndex={22}>
                          Location <SortIndicator column="LocationName" />
                        </button>
                      </TableHead>
                      <TableHead className="w-px whitespace-nowrap px-2 text-center">
                        <button
                          onClick={() => handleSort('HasPurchaseOrder')}
                          className="flex items-center justify-center w-full hover:text-blue-600"
                          tabIndex={23}
                        >
                          Is Owned <SortIndicator column="HasPurchaseOrder" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPageRows.length ? (
                      currentPageRows.map((terrain, rowIndex) => (
                        <TableRow
                          key={terrain.TerrainID}
                          className="cursor-pointer hover:bg-blue-50"
                          onClick={() => openEditModal(terrain)}
                        >
                          <TableCell className="w-px whitespace-nowrap px-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedTerrainIdSet.has(terrain.TerrainID)}
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => toggleTerrainSelection(terrain.TerrainID)}
                              aria-label={`Select ${terrain.TerrainName}`}
                              tabIndex={23 + rowIndex}
                            />
                          </TableCell>
                          <TableCell>{terrain.CollectionName}</TableCell>
                          <TableCell>{terrain.SubTypeName}</TableCell>
                          <TableCell>{terrain.ItemName}</TableCell>
                          <TableCell>{terrain.TerrainName}</TableCell>
                          <TableCell>{String(terrain.TerrainCode ?? '-')}</TableCell>
                          <TableCell className="text-right">{Number(terrain.TerrainQuantity || 0).toLocaleString()}</TableCell>
                          <TableCell>{terrain.LocationName}</TableCell>
                          <TableCell className="w-px whitespace-nowrap px-2 text-center" onClick={(event) => event.stopPropagation()}>
                            {hasPurchaseOrderByItemId[Number(terrain.ResolvedItemID)] ? (
                              <button
                                type="button"
                                className="inline-flex items-center justify-center text-blue-600 hover:text-blue-700"
                                onClick={(event) => handleOpenRelatedOrders(terrain, event)}
                                title="Open related purchase orders"
                                aria-label={`Open related purchase orders for ${terrain.ItemName || terrain.TerrainName}`}
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
                          No matching terrain records found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <SetupTablePagination
                currentCount={currentPageRows.length}
                total={pagination.total}
                page={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={pagination.setPage}
              />
            </>
          ) : null}
        </section>
      </div>

      <Dialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onClose={closeAddModal}
        title="Add Terrain"
        showCloseButton={false}
        contentClassName="max-w-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          addTerrainNameInputRef.current?.focus();
        }}
      >
        <form className="space-y-4" onSubmit={handleAddSubmit}>
          {addError ? <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{addError}</div> : null}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Terrain Name</span>
            <Input
              ref={addTerrainNameInputRef}
              autoFocus
              value={addValues.TerrainName}
              onChange={(event) => setAddValues((current) => ({ ...current, TerrainName: event.target.value }))}
              placeholder="Terrain name"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Terrain Code</span>
            <Input
              value={addValues.TerrainCode}
              onChange={(event) => setAddValues((current) => ({ ...current, TerrainCode: event.target.value }))}
              placeholder="Optional code"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Terrain Quantity</span>
            <Input
              type="number"
              min="0"
              className="appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={addValues.TerrainQuantity}
              onChange={(event) => setAddValues((current) => ({ ...current, TerrainQuantity: event.target.value }))}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Item</span>
            <ComboSelect
              options={itemOptions}
              value={addValues.ItemID}
              onChange={(value) => {
                const selectedItem = itemById[Number(value)];
                setAddValues((current) => ({
                  ...current,
                  ItemID: value,
                  Item: String(selectedItem?.ItemName ?? '').trim(),
                }));
              }}
              placeholder="Select item"
              className="w-full"
              disablePortal
              openOnFocus={false}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Location (Optional)</span>
            <ComboSelect
              options={locationOptions}
              value={addValues.LocationID}
              onChange={(value) => setAddValues((current) => ({ ...current, LocationID: value }))}
              placeholder="Select location (optional)"
              className="w-full"
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" className="bg-gray-600 hover:bg-gray-700" onClick={closeAddModal}>
              Cancel
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={addMutation.isLoading}>
              {addMutation.isLoading ? 'Saving...' : 'Add Terrain'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(editingTerrain)}
        onOpenChange={(open) => {
          if (open) {
            return;
          }

          requestCloseEditModal();
        }}
        onClose={requestCloseEditModal}
        title="Edit Terrain Detail"
        showCloseButton={false}
        contentClassName="max-w-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          editTerrainNameInputRef.current?.focus();
        }}
      >
        <form className="space-y-4" onSubmit={handleEditSubmit}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-gray-500">Update terrain values and save changes.</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className="h-9 !bg-gray-200 !text-gray-800 hover:!bg-gray-300"
                onClick={() => handleNavigateEditTerrain('previous')}
                disabled={!canNavigateToPreviousEditTerrain || editMutation.isLoading || editDeleteMutation.isLoading}
                aria-label="Previous terrain"
                title="Previous terrain"
              >
                Prev
              </Button>
              <Button
                type="button"
                className="h-9 !bg-gray-200 !text-gray-800 hover:!bg-gray-300"
                onClick={() => handleNavigateEditTerrain('next')}
                disabled={!canNavigateToNextEditTerrain || editMutation.isLoading || editDeleteMutation.isLoading}
                aria-label="Next terrain"
                title="Next terrain"
              >
                Next
              </Button>
            </div>
          </div>
          {editError ? <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{editError}</div> : null}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Terrain Name</span>
            <Input
              ref={editTerrainNameInputRef}
              autoFocus
              value={editValues.TerrainName}
              onChange={(event) => setEditValues((current) => ({ ...current, TerrainName: event.target.value }))}
              placeholder="Terrain name"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Terrain Code</span>
            <Input
              value={editValues.TerrainCode}
              onChange={(event) => setEditValues((current) => ({ ...current, TerrainCode: event.target.value }))}
              placeholder="Optional code"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Terrain Quantity</span>
            <Input
              type="number"
              min="0"
              className="appearance-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={editValues.TerrainQuantity}
              onChange={(event) => setEditValues((current) => ({ ...current, TerrainQuantity: event.target.value }))}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Item</span>
            <ComboSelect
              options={itemOptions}
              value={editValues.ItemID}
              onChange={(value) => {
                const selectedItem = itemById[Number(value)];
                setEditValues((current) => ({
                  ...current,
                  ItemID: value,
                  Item: String(selectedItem?.ItemName ?? '').trim(),
                }));
              }}
              placeholder="Select item"
              className="w-full"
              disablePortal
              openOnFocus={false}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Location (Optional)</span>
            <ComboSelect
              options={locationOptions}
              value={editValues.LocationID}
              onChange={(value) => setEditValues((current) => ({ ...current, LocationID: value }))}
              placeholder="Select location (optional)"
              className="w-full"
              disablePortal
            />
          </label>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700 sm:mr-auto"
              onClick={handleDeleteTerrain}
              disabled={!canWrite || editMutation.isLoading || editDeleteMutation.isLoading}
              title={canWrite ? undefined : 'Switch to Update mode to delete terrain'}
            >
              {editDeleteMutation.isLoading ? 'Deleting...' : 'Delete Terrain'}
            </Button>
            <Button
              type="button"
              className="bg-slate-600 hover:bg-slate-700"
              onClick={requestCloseEditModal}
              disabled={editMutation.isLoading || editDeleteMutation.isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canWrite || !isEditDirty || editMutation.isLoading || editDeleteMutation.isLoading} title={canWrite ? undefined : 'Switch to Update mode to save changes'}>
              {editMutation.isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={isBulkUpdateOpen}
        onOpenChange={setIsBulkUpdateOpen}
        onClose={closeBulkUpdateDialog}
        title={bulkStep === 'confirm' ? 'Confirm Bulk Update' : 'Bulk Update Terrain'}
        showCloseButton={false}
        contentClassName="max-w-2xl"
      >
        <form className="space-y-4" onSubmit={handleBulkUpdateSubmit}>
          {bulkError ? <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{bulkError}</div> : null}

          {bulkStep === 'edit' ? (
            <>
              <p className="text-sm text-gray-600">Bulk updates apply to {selectedTerrainIds.length} selected terrain records.</p>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-gray-700">Terrain Code</span>
                <Input
                  autoFocus
                  value={bulkValues.TerrainCode}
                  onChange={(event) => setBulkValues((current) => ({ ...current, TerrainCode: event.target.value }))}
                  placeholder="Leave blank to keep current code"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-gray-700">Terrain Quantity</span>
                <Input
                  type="number"
                  min="0"
                  value={bulkValues.TerrainQuantity}
                  onChange={(event) => setBulkValues((current) => ({ ...current, TerrainQuantity: event.target.value }))}
                  placeholder="Leave blank to keep current quantity"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-gray-700">Location</span>
                <ComboSelect
                  options={locationOptions}
                  value={bulkValues.LocationID}
                  onChange={(value) => setBulkValues((current) => ({ ...current, LocationID: value }))}
                  placeholder="Leave blank to keep current location"
                  className="w-full"
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" className="bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={closeBulkUpdateDialog}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700" disabled={bulkUpdateMutation.isLoading}>
                  {bulkUpdateMutation.isLoading
                    ? 'Updating...'
                    : `Review ${selectedTerrainIds.length} Update${selectedTerrainIds.length === 1 ? '' : 's'}`}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                You are about to update {selectedTerrainIds.length} terrain record{selectedTerrainIds.length === 1 ? '' : 's'}.
                Confirm only after checking the summary below.
              </div>

              <div className="rounded-lg border border-gray-200">
                <div className="border-b border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700">Update Summary</div>
                <div className="space-y-2 px-4 py-3 text-sm text-gray-700">
                  {Object.entries(bulkValues)
                    .filter(([, value]) => value)
                    .map(([field, value]) => (
                      <div key={field} className="flex items-center justify-between gap-4">
                        <span className="font-medium text-gray-600">
                          {field === 'TerrainCode' ? 'Terrain Code' : field === 'TerrainQuantity' ? 'Terrain Quantity' : 'Location'}
                        </span>
                        <span className="text-right">{getBulkFieldLabel(field as 'TerrainCode' | 'TerrainQuantity' | 'LocationID', value)}</span>
                      </div>
                    ))}
                  {!Object.values(bulkValues).some((value) => value) ? (
                    <div className="text-gray-500">No fields selected for update.</div>
                  ) : null}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
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
                  {bulkUpdateMutation.isLoading ? 'Updating...' : `Confirm Update (${selectedTerrainIds.length})`}
                </Button>
              </div>
            </>
          )}
        </form>
      </Dialog>

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
        description={`You are about to permanently delete ${selectedTerrainIds.length} selected terrain record${selectedTerrainIds.length === 1 ? '' : 's'}. This action cannot be undone.`}
        footer={(
          <>
            <Button
              type="button"
              className="bg-gray-600 hover:bg-gray-700"
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
                {bulkDeleteMutation.isLoading ? 'Deleting...' : `Delete ${selectedTerrainIds.length} Terrain Rows`}
              </Button>
            ) : null}
          </>
        )}
      >
        <div className="space-y-5">
          {bulkDeleteError ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{bulkDeleteError}</div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type DELETE to confirm</label>
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

      <Dialog
        open={isRelatedOrdersModalOpen}
        onOpenChange={setIsRelatedOrdersModalOpen}
        title={
          selectedTerrainForRelatedOrders
            ? `Related Purchase Orders: ${selectedTerrainForRelatedOrders.ItemName || selectedTerrainForRelatedOrders.TerrainName}`
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
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{relatedOrdersError}</div>
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
                      <TableCell>{formatPurchaseDate(order.PurchaseDate)}</TableCell>
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
            <Button
              ref={relatedOrdersCloseButtonRef}
              className="bg-gray-600 hover:bg-gray-700"
              onClick={handleCloseRelatedOrdersModal}
            >
              Close
            </Button>
          </div>
        </div>
      </Dialog>

      <BulkTerrainUploadDialog
        open={isBulkUploadOpen}
        onOpenChange={setIsBulkUploadOpen}
        locationOptions={locationOptions}
        itemRecords={terrainItemRecords}
        terrainRecords={terrainRecords}
        onTerrainsAdded={() => queryClient.invalidateQueries({ queryKey })}
      />
    </AdminLayout>
  );
}
