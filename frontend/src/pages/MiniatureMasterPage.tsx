import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ComboMultiSelect from '../components/ui/ComboMultiSelect';
import ComboSelect from '../components/ui/ComboSelect';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import { Input } from '../components/ui/Input';
import SetupTablePagination from '../components/SetupTablePagination';
import AdminLayout from '../components/AdminLayout';
import BulkMiniatureUploadDialog from '../components/miniatures/BulkMiniatureUploadDialog';
import useSetupPagination from '../hooks/useSetupPagination';
import { tablesAPI } from '../services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';

type SortOrder = 'ASC' | 'DESC';
type SortColumn = 'CollectionName' | 'SubTypeName' | 'ItemName' | 'MiniatureName' | 'MiniatureQuantity' | 'LocationName';

type MiniatureRecord = {
  MiniatureID: number;
  ItemID?: number;
  MiniatureName: string;
  MiniatureQuantity: number;
  LocationID?: number | null;
};

type ItemRecord = {
  ItemID: number;
  ItemName: string;
  CollectionID: number;
  SubTypeID: number;
};

type LookupRecord = Record<string, any>;

type MiniatureRow = MiniatureRecord & {
  ItemName: string;
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
  miniatureName: string;
  locationName: string[];
};

const EMPTY_FILTERS: FilterValues = {
  collectionName: [],
  subTypeName: [],
  itemId: '',
  miniatureName: '',
  locationName: [],
};

const csvEscape = (value: string) => {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

export default function MiniatureMasterPage() {
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<SortColumn>('MiniatureName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');
  const [filterValues, setFilterValues] = useState<FilterValues>(EMPTY_FILTERS);
  const [searchParams, setSearchParams] = useState<FilterValues>(EMPTY_FILTERS);
  const [selectedMiniatureIds, setSelectedMiniatureIds] = useState<number[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addValues, setAddValues] = useState({ ItemID: '', Item: '', MiniatureName: '', MiniatureQuantity: '1', LocationID: '' });
  const [addError, setAddError] = useState('');
  const [editingMiniature, setEditingMiniature] = useState<MiniatureRow | null>(null);
  const [editValues, setEditValues] = useState({ ItemID: '', Item: '', MiniatureName: '', MiniatureQuantity: '1', LocationID: '' });
  const [editError, setEditError] = useState('');
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [bulkValues, setBulkValues] = useState({ MiniatureQuantity: '', LocationID: '' });
  const [bulkError, setBulkError] = useState('');
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const [bulkDeleteError, setBulkDeleteError] = useState('');
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const { data: miniatureRecords = [], isLoading, error } = useQuery<MiniatureRecord[], Error>({
    queryKey: ['table', 'Miniature'],
    queryFn: async () => tablesAPI.getAllRecords('Miniature'),
  });

  const { data: itemRecords = [] } = useQuery<ItemRecord[], Error>({
    queryKey: ['table', 'Item', 'all-for-miniatures'],
    queryFn: async () => tablesAPI.getAllRecords('Item'),
  });

  const { data: collectionRecords = [] } = useQuery<LookupRecord[], Error>({
    queryKey: ['table', 'Collection', 'all-for-miniatures'],
    queryFn: async () => tablesAPI.getAllRecords('Collection'),
  });

  const { data: collectionTypeRecords = [] } = useQuery<LookupRecord[], Error>({
    queryKey: ['table', 'CollectionType', 'all-for-miniatures'],
    queryFn: async () => tablesAPI.getAllRecords('CollectionType'),
  });

  const { data: subTypeRecords = [] } = useQuery<LookupRecord[], Error>({
    queryKey: ['table', 'SubType', 'all-for-miniatures'],
    queryFn: async () => tablesAPI.getAllRecords('SubType'),
  });

  const { data: categoryRecords = [] } = useQuery<LookupRecord[], Error>({
    queryKey: ['table', 'Category', 'all-for-miniatures'],
    queryFn: async () => tablesAPI.getAllRecords('Category'),
  });

  const { data: categorySubTypeRecords = [] } = useQuery<LookupRecord[], Error>({
    queryKey: ['table', 'CategorySubType', 'all-for-miniatures'],
    queryFn: async () => tablesAPI.getAllRecords('CategorySubType'),
  });

  const { data: locationRecords = [] } = useQuery<LookupRecord[], Error>({
    queryKey: ['table', 'Location', 'all-for-miniatures'],
    queryFn: async () => tablesAPI.getAllRecords('Location'),
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

  const miniatureCollectionRecords = useMemo(() => {
    return collectionRecords.filter((collection) => {
      const collectionTypeName = collectionTypeNameById[Number(collection.CollectionTypeID)] || String(collection.CollectionTypeName ?? '');
      return collectionTypeName.trim().toLowerCase() === 'miniature';
    });
  }, [collectionRecords, collectionTypeNameById]);

  const subTypeNameById = useMemo(() => {
    return subTypeRecords.reduce((map: Record<number, string>, subType) => {
      map[Number(subType.SubTypeID)] = String(subType.SubTypeName ?? '').trim();
      return map;
    }, {});
  }, [subTypeRecords]);

  const miniatureCategoryIdSet = useMemo(() => {
    return new Set(
      categoryRecords
        .filter((category) => String(category.CategoryName ?? '').trim().toLowerCase() === 'miniature')
        .map((category) => Number(category.CategoryID))
        .filter((categoryId) => Number.isInteger(categoryId))
    );
  }, [categoryRecords]);

  const miniatureSubTypeIdSet = useMemo(() => {
    const linkedSubTypeIds = categorySubTypeRecords
      .filter((link) => miniatureCategoryIdSet.has(Number(link.CategoryID)))
      .map((link) => Number(link.SubTypeID))
      .filter((subTypeId) => Number.isInteger(subTypeId));

    if (linkedSubTypeIds.length > 0) {
      return new Set(linkedSubTypeIds);
    }

    return new Set(
      subTypeRecords
        .filter((subType) => miniatureCategoryIdSet.has(Number(subType.CategoryID)))
        .map((subType) => Number(subType.SubTypeID))
        .filter((subTypeId) => Number.isInteger(subTypeId))
    );
  }, [categorySubTypeRecords, miniatureCategoryIdSet, subTypeRecords]);

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

  const resolveMiniatureItem = (miniature: MiniatureRecord) => {
    const itemId = Number(miniature.ItemID);

    if (Number.isInteger(itemId) && itemById[itemId]) {
      return itemById[itemId];
    }

    return itemById[Number(miniature.MiniatureID)];
  };

  const miniatureRows = useMemo<MiniatureRow[]>(() => {
    return miniatureRecords.map((miniature) => {
      const item = resolveMiniatureItem(miniature);

      return {
        ...miniature,
        ItemName: String(item?.ItemName || '').trim(),
        CollectionID: item?.CollectionID,
        CollectionName: item ? collectionNameById[Number(item.CollectionID)] || 'Unknown' : 'Unknown',
        SubTypeID: item?.SubTypeID,
        SubTypeName: item ? subTypeNameById[Number(item.SubTypeID)] || 'Unknown' : 'Unknown',
        LocationName: locationNameById[Number(miniature.LocationID)] || 'Unknown',
      };
    });
  }, [collectionNameById, itemById, locationNameById, miniatureRecords, subTypeNameById]);

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
    return miniatureCollectionRecords
      .map((collection) => ({ value: Number(collection.CollectionID), label: String(collection.CollectionName ?? '').trim() }))
      .filter((option) => Number.isFinite(option.value) && option.label)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [miniatureCollectionRecords]);

  const subTypeLookupOptions = useMemo(() => {
    return subTypeRecords
      .filter((subType) => miniatureSubTypeIdSet.has(Number(subType.SubTypeID)))
      .map((subType) => ({ value: Number(subType.SubTypeID), label: String(subType.SubTypeName ?? '').trim() }))
      .filter((option) => Number.isFinite(option.value) && option.label)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [miniatureSubTypeIdSet, subTypeRecords]);

  const collectionOptions = useMemo(
    () => collectionLookupOptions.map((option) => ({ value: option.label, label: option.label })),
    [collectionLookupOptions]
  );

  const miniatureCollectionIdSet = useMemo(
    () => new Set(miniatureCollectionRecords.map((collection) => Number(collection.CollectionID))),
    [miniatureCollectionRecords]
  );

  const subTypeOptions = useMemo(
    () => subTypeLookupOptions.map((option) => ({ value: option.label, label: option.label })),
    [subTypeLookupOptions]
  );

  const locationFilterOptions = useMemo(() => {
    return locationRecords
      .map((location) => ({ value: String(location.LocationName ?? '').trim(), label: String(location.LocationName ?? '').trim() }))
      .filter((option) => option.value && option.label)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [locationRecords]);

  const itemOptions = useMemo(() => {
    return itemRecords
      .filter((item) => miniatureCollectionIdSet.has(Number(item.CollectionID)) && miniatureSubTypeIdSet.has(Number(item.SubTypeID)))
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
  }, [collectionNameById, itemRecords, miniatureCollectionIdSet, miniatureSubTypeIdSet, subTypeNameById]);

  const itemFilterOptions = useMemo(() => {
    const selectedSubTypeIds = new Set(
      filterValues.subTypeName
        .map((subTypeName) => subTypeIdByName[subTypeName])
        .filter((subTypeId) => Number.isInteger(subTypeId))
    );

    return itemRecords
      .filter((item) => miniatureCollectionIdSet.has(Number(item.CollectionID)))
      .filter((item) => miniatureSubTypeIdSet.has(Number(item.SubTypeID)))
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
  }, [collectionNameById, filterValues.subTypeName, itemRecords, miniatureCollectionIdSet, miniatureSubTypeIdSet, subTypeIdByName, subTypeNameById]);

  const miniatureItemRecords = useMemo(
    () => itemRecords.filter((item) => miniatureCollectionIdSet.has(Number(item.CollectionID)) && miniatureSubTypeIdSet.has(Number(item.SubTypeID))),
    [itemRecords, miniatureCollectionIdSet, miniatureSubTypeIdSet]
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

  const filteredRows = useMemo(() => {
    const itemFilterId = parseInt(searchParams.itemId, 10);
    const miniatureFilter = searchParams.miniatureName.trim().toLowerCase();

    const filtered = miniatureRows.filter((row) => {
      const collectionMatches = !searchParams.collectionName.length || searchParams.collectionName.includes(row.CollectionName);
      const subTypeMatches = !searchParams.subTypeName.length || searchParams.subTypeName.includes(row.SubTypeName);
      const itemMatches = !Number.isInteger(itemFilterId) || Number(row.ItemID) === itemFilterId;
      const nameMatches = !miniatureFilter || String(row.MiniatureName || '').toLowerCase().includes(miniatureFilter);
      const locationMatches = !searchParams.locationName.length || searchParams.locationName.includes(row.LocationName);
      return collectionMatches && subTypeMatches && itemMatches && nameMatches && locationMatches;
    });

    return [...filtered].sort((a, b) => {
      const valueA = sortBy === 'MiniatureQuantity' ? Number(a.MiniatureQuantity) : String(a[sortBy] ?? '').toLowerCase();
      const valueB = sortBy === 'MiniatureQuantity' ? Number(b.MiniatureQuantity) : String(b[sortBy] ?? '').toLowerCase();

      if (valueA < valueB) return sortOrder === 'ASC' ? -1 : 1;
      if (valueA > valueB) return sortOrder === 'ASC' ? 1 : -1;
      return String(a.MiniatureName || '').localeCompare(String(b.MiniatureName || ''), undefined, { sensitivity: 'base' });
    });
  }, [miniatureRows, searchParams, sortBy, sortOrder]);

  const pagination = useSetupPagination(filteredRows, [searchParams, sortBy, sortOrder]);
  const currentPageRows = pagination.paginatedRows;
  const selectedMiniatureIdSet = useMemo(() => new Set(selectedMiniatureIds), [selectedMiniatureIds]);
  const areAllCurrentPageRowsSelected = currentPageRows.length > 0 && currentPageRows.every((row) => selectedMiniatureIdSet.has(row.MiniatureID));

  const filtersChanged =
    filterValues.itemId !== searchParams.itemId ||
    filterValues.miniatureName !== searchParams.miniatureName ||
    filterValues.collectionName.join('\u0000') !== searchParams.collectionName.join('\u0000') ||
    filterValues.subTypeName.join('\u0000') !== searchParams.subTypeName.join('\u0000') ||
    filterValues.locationName.join('\u0000') !== searchParams.locationName.join('\u0000');

  const hasAnyFilter =
    filterValues.itemId.trim().length > 0 ||
    filterValues.miniatureName.trim().length > 0 ||
    filterValues.collectionName.length > 0 ||
    filterValues.subTypeName.length > 0 ||
    filterValues.locationName.length > 0 ||
    searchParams.itemId.trim().length > 0 ||
    searchParams.miniatureName.trim().length > 0 ||
    searchParams.collectionName.length > 0 ||
    searchParams.subTypeName.length > 0 ||
    searchParams.locationName.length > 0;

  const queryKey = ['table', 'Miniature'];

  const addMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => tablesAPI.createRecord('Miniature', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      closeAddModal();
    },
    onError: (error: any) => {
      setAddError(error.response?.data?.error || 'Failed to create miniature');
    },
  });

  const editMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      if (!editingMiniature) {
        throw new Error('No miniature is selected for editing.');
      }

      return tablesAPI.updateRecord('Miniature', editingMiniature.MiniatureID, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      closeEditModal();
    },
    onError: (error: any) => {
      setEditError(error.response?.data?.error || 'Failed to update miniature');
    },
  });

  const editDeleteMutation = useMutation({
    mutationFn: async () => {
      if (!editingMiniature) {
        throw new Error('No miniature is selected for deletion.');
      }

      return tablesAPI.deleteRecord('Miniature', editingMiniature.MiniatureID);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setSelectedMiniatureIds((current) => current.filter((id) => id !== editingMiniature?.MiniatureID));
      closeEditModal();
    },
    onError: (error: any) => {
      setEditError(error.response?.data?.error || 'Failed to delete miniature');
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      await Promise.all(selectedMiniatureIds.map((miniatureId) => tablesAPI.updateRecord('Miniature', miniatureId, payload)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setSelectedMiniatureIds([]);
      closeBulkUpdateDialog();
    },
    onError: (error: any) => {
      setBulkError(error.response?.data?.error || 'Failed to bulk update miniatures');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (miniatureIds: number[]) => {
      await Promise.all(miniatureIds.map((miniatureId) => tablesAPI.deleteRecord('Miniature', miniatureId)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setSelectedMiniatureIds([]);
      closeBulkDeleteDialog();
    },
    onError: (error: any) => {
      setBulkDeleteError(error.response?.data?.error || 'Failed to bulk delete miniatures');
    },
  });

  const handleFilterChange = <K extends keyof FilterValues>(field: K, value: FilterValues[K]) => {
    setFilterValues((current) => ({
      ...current,
      [field]: value,
      ...(field === 'subTypeName' ? { itemId: '' } : {}),
    }));
  };

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

  const applyFilters = () => {
    setDownloadError('');
    setSearchParams({
      collectionName: [...filterValues.collectionName],
      subTypeName: [...filterValues.subTypeName],
      itemId: filterValues.itemId,
      miniatureName: filterValues.miniatureName,
      locationName: [...filterValues.locationName],
    });
    setSelectedMiniatureIds([]);
  };

  const clearFilters = () => {
    setDownloadError('');
    setFilterValues(EMPTY_FILTERS);
    setSearchParams(EMPTY_FILTERS);
    setSelectedMiniatureIds([]);
  };

  const toggleMiniatureSelection = (miniatureId: number) => {
    setSelectedMiniatureIds((current) =>
      current.includes(miniatureId) ? current.filter((id) => id !== miniatureId) : [...current, miniatureId]
    );
  };

  const toggleSelectAllCurrentPage = () => {
    if (areAllCurrentPageRowsSelected) {
      setSelectedMiniatureIds((current) => current.filter((id) => !currentPageRows.some((row) => row.MiniatureID === id)));
      return;
    }

    setSelectedMiniatureIds((current) => {
      const combined = new Set(current);
      currentPageRows.forEach((row) => combined.add(row.MiniatureID));
      return Array.from(combined);
    });
  };

  const openAddModal = () => {
    setAddValues({ ItemID: '', Item: '', MiniatureName: '', MiniatureQuantity: '1', LocationID: '' });
    setAddError('');
    setIsAddOpen(true);
  };

  const openEditModal = (miniature: MiniatureRow) => {
    setEditingMiniature(miniature);
    setEditValues({
      ItemID: miniature.ItemID != null ? String(miniature.ItemID) : '',
      Item: miniature.ItemName || '',
      MiniatureName: miniature.MiniatureName || '',
      MiniatureQuantity: String(miniature.MiniatureQuantity ?? 0),
      LocationID: miniature.LocationID != null ? String(miniature.LocationID) : '',
    });
    setEditError('');
  };

  const closeAddModal = () => {
    setIsAddOpen(false);
    setAddError('');
    setAddValues({ ItemID: '', Item: '', MiniatureName: '', MiniatureQuantity: '1', LocationID: '' });
  };

  const closeEditModal = () => {
    setEditingMiniature(null);
    setEditError('');
    setEditValues({ ItemID: '', Item: '', MiniatureName: '', MiniatureQuantity: '1', LocationID: '' });
  };

  const openBulkUpdateDialog = () => {
    if (selectedMiniatureIds.length < 2) {
      return;
    }

    setBulkValues({ MiniatureQuantity: '', LocationID: '' });
    setBulkError('');
    setIsBulkUpdateOpen(true);
  };

  const closeBulkUpdateDialog = () => {
    setIsBulkUpdateOpen(false);
    setBulkError('');
    setBulkValues({ MiniatureQuantity: '', LocationID: '' });
  };

  const openBulkDeleteDialog = () => {
    if (selectedMiniatureIds.length < 2) {
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
    const quantity = parseInt(addValues.MiniatureQuantity, 10);
    const itemName = addValues.Item.trim();
    const miniatureName = addValues.MiniatureName.trim();

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

    if (!miniatureName) {
      setAddError('Miniature Name is required.');
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      setAddError('Miniature Quantity must be zero or greater.');
      return;
    }

    if (addValues.LocationID && (!Number.isInteger(locationId) || locationId <= 0)) {
      setAddError('Location is invalid.');
      return;
    }

    const payload: Record<string, any> = {
      ItemID: itemId,
      MiniatureName: miniatureName,
      MiniatureQuantity: quantity,
    };

    if (Number.isInteger(locationId) && locationId > 0) {
      payload.LocationID = locationId;
    }

    addMutation.mutate(payload);
  };

  const originalEditValues = useMemo(() => {
    if (!editingMiniature) {
      return null;
    }

    return {
      ItemID: editingMiniature.ItemID != null ? String(editingMiniature.ItemID) : '',
      Item: editingMiniature.ItemName || '',
      MiniatureName: editingMiniature.MiniatureName || '',
      MiniatureQuantity: String(editingMiniature.MiniatureQuantity ?? 0),
      LocationID: editingMiniature.LocationID != null ? String(editingMiniature.LocationID) : '',
    };
  }, [editingMiniature]);

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

    if (!editingMiniature || !isEditDirty) {
      return;
    }

    const itemId = parseInt(editValues.ItemID, 10);
    const locationId = parseInt(editValues.LocationID, 10);
    const quantity = parseInt(editValues.MiniatureQuantity, 10);
    const miniatureName = editValues.MiniatureName.trim();

    if (!Number.isInteger(itemId) || itemId <= 0) {
      setEditError('Item is required.');
      return;
    }

    if (!itemById[itemId]) {
      setEditError('Item must match an Item in the Item table.');
      return;
    }

    if (!miniatureName) {
      setEditError('Miniature Name is required.');
      return;
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      setEditError('Miniature Quantity must be zero or greater.');
      return;
    }

    if (editValues.LocationID && (!Number.isInteger(locationId) || locationId <= 0)) {
      setEditError('Location is invalid.');
      return;
    }

    editMutation.mutate({
      ItemID: itemId,
      MiniatureName: miniatureName,
      MiniatureQuantity: quantity,
      LocationID: Number.isInteger(locationId) && locationId > 0 ? locationId : null,
    });
  };

  const handleDeleteMiniature = () => {
    if (!editingMiniature) {
      return;
    }

    const confirmed = confirm(`Delete miniature "${editingMiniature.MiniatureName}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    editDeleteMutation.mutate();
  };

  const handleBulkUpdateSubmit = (event: FormEvent) => {
    event.preventDefault();
    setBulkError('');

    const updates: Record<string, any> = {};
    if (bulkValues.MiniatureQuantity.trim()) {
      const quantity = parseInt(bulkValues.MiniatureQuantity, 10);
      if (!Number.isInteger(quantity) || quantity < 0) {
        setBulkError('Miniature Quantity must be zero or greater.');
        return;
      }
      updates.MiniatureQuantity = quantity;
    }

    if (bulkValues.LocationID) {
      const locationId = parseInt(bulkValues.LocationID, 10);
      if (!Number.isInteger(locationId) || locationId <= 0) {
        setBulkError('Location is invalid.');
        return;
      }
      updates.LocationID = locationId;
    }

    if (!Object.keys(updates).length) {
      setBulkError('Choose at least one field to update.');
      return;
    }

    bulkUpdateMutation.mutate(updates);
  };

  const handleBulkDeleteConfirm = () => {
    if (bulkDeleteConfirmText.trim() !== 'DELETE') {
      setBulkDeleteError('Type DELETE exactly to enable bulk delete.');
      return;
    }

    bulkDeleteMutation.mutate(selectedMiniatureIds);
  };

  const buildCsvContent = (rows: MiniatureRow[]) => {
    const headers = ['Collection Name', 'Sub Category', 'Item', 'Miniature Name', 'Miniature Quantity', 'Location'];
    const lines = rows.map((row) => [
      row.CollectionName,
      row.SubTypeName,
      row.ItemName,
      row.MiniatureName,
      String(row.MiniatureQuantity ?? ''),
      row.LocationName,
    ].map((value) => csvEscape(String(value))).join(','));

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
      link.download = `miniature-master-export-${timestamp}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      setDownloadError(error.message || 'Failed to download CSV');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AdminLayout title="Miniature Master" subtitle="Use this screen to view, add, remove and modify miniatures in your collection.">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <section className="bg-white shadow rounded-lg p-6">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Collection Name</span>
                <ComboMultiSelect
                  options={collectionOptions}
                  selected={filterValues.collectionName}
                  onChange={(value) => handleFilterChange('collectionName', value)}
                  placeholder="Collection"
                  className="w-full"
                  autoFocus
                  tabIndex={1}
                />
              </label>
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Sub Category</span>
                <ComboMultiSelect
                  options={subTypeOptions}
                  selected={filterValues.subTypeName}
                  onChange={(value) => handleFilterChange('subTypeName', value)}
                  placeholder="Sub Category"
                  className="w-full"
                  tabIndex={2}
                />
              </label>
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Item</span>
                <ComboSelect
                  options={itemFilterOptions}
                  value={filterValues.itemId}
                  onChange={(value) => handleFilterChange('itemId', value)}
                  placeholder="Item"
                  className="w-full"
                  tabIndex={3}
                />
              </label>
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Miniature Name</span>
                <Input
                  value={filterValues.miniatureName}
                  onChange={(event) => handleFilterChange('miniatureName', event.target.value)}
                  placeholder="Miniature name"
                  tabIndex={4}
                />
              </label>
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Location</span>
                <ComboMultiSelect
                  options={locationFilterOptions}
                  selected={filterValues.locationName}
                  onChange={(value) => handleFilterChange('locationName', value)}
                  placeholder="Location"
                  className="w-full"
                  tabIndex={5}
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 flex-wrap">
              <Button type="button" className="bg-red-600 hover:bg-red-700" onClick={openBulkDeleteDialog} disabled={selectedMiniatureIds.length < 2} tabIndex={6}>
                Bulk Delete{selectedMiniatureIds.length ? ` (${selectedMiniatureIds.length})` : ''}
              </Button>
              <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={openBulkUpdateDialog} disabled={selectedMiniatureIds.length < 2} tabIndex={7}>
                Bulk Update{selectedMiniatureIds.length ? ` (${selectedMiniatureIds.length})` : ''}
              </Button>
              <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={openAddModal} tabIndex={8}>
                + Add Item
              </Button>
              <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={() => setIsBulkUploadOpen(true)} tabIndex={9}>
                ++ Bulk Upload
              </Button>
              <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={handleDownloadCsv} disabled={isDownloading} tabIndex={10}>
                {isDownloading ? 'Downloading...' : 'Download CSV'}
              </Button>
              <Button type="submit" disabled={!filtersChanged} tabIndex={11}>Apply Filter</Button>
              <Button type="button" className="bg-gray-600 hover:bg-gray-700" onClick={clearFilters} disabled={!filtersChanged && !hasAnyFilter} tabIndex={12}>
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
          {isLoading && <p className="text-gray-500">Loading miniatures...</p>}
          {error && <p className="text-red-600">Error loading miniatures.</p>}

          {!isLoading && !error ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-px whitespace-nowrap px-2 text-center">
                        <input
                          type="checkbox"
                          checked={areAllCurrentPageRowsSelected}
                          onChange={toggleSelectAllCurrentPage}
                          aria-label="Select all miniatures on this page"
                          tabIndex={13}
                        />
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('CollectionName')} className="flex items-center hover:text-blue-600" tabIndex={14}>
                          Collection Name <SortIndicator column="CollectionName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('SubTypeName')} className="flex items-center hover:text-blue-600" tabIndex={15}>
                          Sub Category <SortIndicator column="SubTypeName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('ItemName')} className="flex items-center hover:text-blue-600" tabIndex={16}>
                          Item <SortIndicator column="ItemName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('MiniatureName')} className="flex items-center hover:text-blue-600" tabIndex={17}>
                          Miniature Name <SortIndicator column="MiniatureName" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button onClick={() => handleSort('MiniatureQuantity')} className="flex items-center justify-end w-full hover:text-blue-600" tabIndex={18}>
                          Miniature Quantity <SortIndicator column="MiniatureQuantity" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('LocationName')} className="flex items-center hover:text-blue-600" tabIndex={19}>
                          Location <SortIndicator column="LocationName" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPageRows.length ? (
                      currentPageRows.map((miniature, rowIndex) => (
                        <TableRow
                          key={miniature.MiniatureID}
                          className="cursor-pointer hover:bg-blue-50"
                          onClick={() => openEditModal(miniature)}
                        >
                          <TableCell className="w-px whitespace-nowrap px-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedMiniatureIdSet.has(miniature.MiniatureID)}
                              onClick={(event) => event.stopPropagation()}
                              onChange={() => toggleMiniatureSelection(miniature.MiniatureID)}
                              aria-label={`Select ${miniature.MiniatureName}`}
                              tabIndex={20 + rowIndex}
                            />
                          </TableCell>
                          <TableCell>{miniature.CollectionName}</TableCell>
                          <TableCell>{miniature.SubTypeName}</TableCell>
                          <TableCell>{miniature.ItemName}</TableCell>
                          <TableCell>{miniature.MiniatureName}</TableCell>
                          <TableCell className="text-right">{Number(miniature.MiniatureQuantity || 0).toLocaleString()}</TableCell>
                          <TableCell>{miniature.LocationName}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                          No matching miniatures found.
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

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen} onClose={closeAddModal} title="Add Miniature" showCloseButton={false} contentClassName="max-w-2xl">
        <form className="space-y-4" onSubmit={handleAddSubmit}>
          {addError ? <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{addError}</div> : null}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Miniature Name</span>
            <Input autoFocus tabIndex={1} value={addValues.MiniatureName} onChange={(event) => setAddValues((current) => ({ ...current, MiniatureName: event.target.value }))} placeholder="Miniature name" />
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
              tabIndex={2}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Miniature Quantity</span>
            <Input tabIndex={3} type="number" min="0" value={addValues.MiniatureQuantity} onChange={(event) => setAddValues((current) => ({ ...current, MiniatureQuantity: event.target.value }))} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Location</span>
            <ComboSelect options={locationOptions} value={addValues.LocationID} onChange={(value) => setAddValues((current) => ({ ...current, LocationID: value }))} placeholder="Select location" className="w-full" tabIndex={4} />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" className="bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={closeAddModal} tabIndex={5}>Cancel</Button>
            <Button type="submit" disabled={addMutation.isLoading} tabIndex={6}>{addMutation.isLoading ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={Boolean(editingMiniature)} onOpenChange={(open) => { if (!open) closeEditModal(); }} onClose={closeEditModal} title="Edit Miniature Detail" showCloseButton={false} contentClassName="max-w-2xl">
        <form className="space-y-4" onSubmit={handleEditSubmit}>
          <p className="text-sm text-gray-500">Update miniature values and save changes.</p>
          {editError ? <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{editError}</div> : null}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Miniature Name</span>
            <Input autoFocus tabIndex={1} value={editValues.MiniatureName} onChange={(event) => setEditValues((current) => ({ ...current, MiniatureName: event.target.value }))} placeholder="Miniature name" />
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
              tabIndex={2}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Miniature Quantity</span>
            <Input tabIndex={3} type="number" min="0" value={editValues.MiniatureQuantity} onChange={(event) => setEditValues((current) => ({ ...current, MiniatureQuantity: event.target.value }))} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Location</span>
            <ComboSelect options={locationOptions} value={editValues.LocationID} onChange={(value) => setEditValues((current) => ({ ...current, LocationID: value }))} placeholder="Select location" className="w-full" disablePortal tabIndex={4} />
          </label>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" className="bg-red-600 hover:bg-red-700 sm:mr-auto" onClick={handleDeleteMiniature} disabled={editMutation.isLoading || editDeleteMutation.isLoading} tabIndex={5}>
              {editDeleteMutation.isLoading ? 'Deleting...' : 'Delete Miniature'}
            </Button>
            <Button type="button" className="bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={closeEditModal} disabled={editMutation.isLoading || editDeleteMutation.isLoading} tabIndex={6}>Cancel</Button>
            <Button type="submit" disabled={!isEditDirty || editMutation.isLoading || editDeleteMutation.isLoading} tabIndex={7}>{editMutation.isLoading ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={isBulkUpdateOpen} onOpenChange={setIsBulkUpdateOpen} onClose={closeBulkUpdateDialog} title="Bulk Update Miniatures" showCloseButton={false} contentClassName="max-w-2xl">
        <form className="space-y-4" onSubmit={handleBulkUpdateSubmit}>
          {bulkError ? <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{bulkError}</div> : null}
          <p className="text-sm text-gray-600">Bulk updates apply to {selectedMiniatureIds.length} selected miniatures.</p>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Miniature Quantity</span>
            <Input autoFocus type="number" min="0" value={bulkValues.MiniatureQuantity} onChange={(event) => setBulkValues((current) => ({ ...current, MiniatureQuantity: event.target.value }))} placeholder="Leave blank to keep current quantity" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Location</span>
            <ComboSelect options={locationOptions} value={bulkValues.LocationID} onChange={(value) => setBulkValues((current) => ({ ...current, LocationID: value }))} placeholder="Leave blank to keep current location" className="w-full" />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" className="bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={closeBulkUpdateDialog}>Cancel</Button>
            <Button type="submit" disabled={bulkUpdateMutation.isLoading}>{bulkUpdateMutation.isLoading ? 'Updating...' : `Update ${selectedMiniatureIds.length} Miniatures`}</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={isBulkDeleteOpen} onOpenChange={setIsBulkDeleteOpen} onClose={closeBulkDeleteDialog} title="Confirm Bulk Delete" showCloseButton={false} contentClassName="max-w-2xl">
        <div className="space-y-4">
          {bulkDeleteError ? <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{bulkDeleteError}</div> : null}
          <p className="text-sm text-gray-700">You are about to permanently delete {selectedMiniatureIds.length} selected miniature records.</p>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-gray-700">Type DELETE to confirm</span>
            <Input autoFocus value={bulkDeleteConfirmText} onChange={(event) => setBulkDeleteConfirmText(event.target.value)} />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" className="bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={closeBulkDeleteDialog}>Cancel</Button>
            <Button type="button" className="bg-red-600 hover:bg-red-700" onClick={handleBulkDeleteConfirm} disabled={bulkDeleteMutation.isLoading || bulkDeleteConfirmText.trim() !== 'DELETE'}>
              {bulkDeleteMutation.isLoading ? 'Deleting...' : `Delete ${selectedMiniatureIds.length} Miniatures`}
            </Button>
          </div>
        </div>
      </Dialog>

      <BulkMiniatureUploadDialog
        open={isBulkUploadOpen}
        onOpenChange={setIsBulkUploadOpen}
        collectionOptions={collectionLookupOptions}
        subTypeOptions={subTypeLookupOptions}
        locationOptions={locationOptions}
        itemRecords={miniatureItemRecords}
        miniatureRecords={miniatureRecords}
        onMiniaturesAdded={() => queryClient.invalidateQueries({ queryKey })}
      />
    </AdminLayout>
  );
}
