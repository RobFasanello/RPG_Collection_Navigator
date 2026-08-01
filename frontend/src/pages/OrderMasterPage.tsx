import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import ComboMultiSelect from '../components/ui/ComboMultiSelect';
import ComboSelect from '../components/ui/ComboSelect';
import { Dialog } from '../components/ui/Dialog';
import { tablesAPI } from '../services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Edit2, Trash2 } from 'lucide-react';

interface PurchaseOrder {
  PurchaseOrderID: number;
  StoreName: string;
  InvoiceNumber: string;
  PurchaseDate: string;
  StatusID?: number | null;
  StatusName?: string | null;
  ItemCount: number;
  TotalAmount: number;
}

interface InventoryItem {
  PurchaseOrderDetailID: number;
  ItemID: number;
  ItemName: string;
  ProductID: string;
  Quantity: number;
  Price: number;
  LineTotal: number;
}

interface ItemLookup {
  ItemID: number;
  ItemName: string;
  ProductID: string;
}

interface AddOrderDetailDraft {
  id: number;
  ItemID: string;
  Quantity: string;
  Price: string;
}

interface OrderDetailDraft {
  ItemID: string;
  Quantity: string;
  Price: string;
}

export default function OrderMasterPage() {
  const [urlSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<string>('PurchaseDate');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [filterValues, setFilterValues] = useState({
    storeNames: [] as string[],
    invoiceNumber: '',
    statusNames: [] as string[],
    purchaseDateStart: '',
    purchaseDateEnd: '',
  });
  const [searchParams, setSearchParams] = useState(filterValues);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState<'edit' | 'confirm'>('edit');
  const [bulkValues, setBulkValues] = useState({
    InvoiceNumber: '',
    StoreID: '',
    StatusID: '',
    PurchaseDate: '',
  });
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedOrder, setEditedOrder] = useState<{
    InvoiceNumber: string;
    StoreName: string;
    PurchaseDate: string;
    StatusName: string;
  } | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addOrderError, setAddOrderError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [addOrderValues, setAddOrderValues] = useState({
    InvoiceNumber: '',
    StoreID: '',
    StatusID: '',
    PurchaseDate: '',
  });
  const [addOrderDetails, setAddOrderDetails] = useState<AddOrderDetailDraft[]>([
    { id: 1, ItemID: '', Quantity: '1', Price: '' },
  ]);
  const [nextDetailRowId, setNextDetailRowId] = useState(2);
  const [editingDetailId, setEditingDetailId] = useState<number | null>(null);
  const [editingDetailDraft, setEditingDetailDraft] = useState<OrderDetailDraft | null>(null);
  const [newDetailDraft, setNewDetailDraft] = useState<AddOrderDetailDraft | null>(null);
  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () => ['purchaseOrders', searchParams, page, sortBy, sortOrder],
    [searchParams, page, sortBy, sortOrder]
  );

  useEffect(() => {
    setSelectedOrderIds([]);
    setIsBulkUpdateOpen(false);
    setBulkStep('edit');
    setBulkValues({
      InvoiceNumber: '',
      StoreID: '',
      StatusID: '',
      PurchaseDate: '',
    });
    setBulkError(null);
    setIsBulkDeleteOpen(false);
    setBulkDeleteError(null);
    setBulkDeleteConfirmText('');
  }, [queryKey]);

  useEffect(() => {
    const invoice = (urlSearchParams.get('invoice') || '').trim();
    const store = (urlSearchParams.get('store') || '').trim();

    if (urlSearchParams.get('purchaseOrderId')) {
      return;
    }

    if (!invoice && !store) {
      return;
    }

    const nextFilters = {
      storeNames: store ? [store] : [],
      invoiceNumber: invoice,
      statusNames: [],
      purchaseDateStart: '',
      purchaseDateEnd: '',
    };

    setFilterValues(nextFilters);
    setSearchParams(nextFilters);
    setPage(1);
  }, [urlSearchParams]);

  useEffect(() => {
    const purchaseOrderIdParam = (urlSearchParams.get('purchaseOrderId') || '').trim();

    if (!purchaseOrderIdParam) {
      return;
    }

    let isCancelled = false;

    const openPurchaseOrder = async () => {
      try {
        const response = await tablesAPI.getPurchaseOrders({
          purchaseOrderId: purchaseOrderIdParam,
          page: 1,
          pageSize: 1,
          sortBy: 'PurchasedDate',
          sortOrder: 'DESC',
        });

        if (isCancelled) {
          return;
        }

        const order = response.data?.data?.[0] as PurchaseOrder | undefined;
        if (!order) {
          throw new Error('Purchase order not found');
        }

        setIsEditMode(false);
        setEditedOrder(null);
        setEditingDetailId(null);
        setEditingDetailDraft(null);
        setNewDetailDraft(null);
        setDeleteError(null);
        setUpdateError(null);
        setSelectedOrder(order);
        setIsModalOpen(true);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        setUpdateError((error as any)?.response?.data?.error || (error as any)?.message || 'Failed to load order');
      }
    };

    openPurchaseOrder();

    return () => {
      isCancelled = true;
    };
  }, [urlSearchParams]);

  // Load store options for the multi-select
  const { data: storesResp } = useQuery(['stores'], async () => {
    const resp = await tablesAPI.getTableData('Store', 1, 100);
    return resp.data;
  });

  const { data: statusesResp } = useQuery(['statuses'], async () => {
    const resp = await tablesAPI.getTableData('Status', 1, 100);
    return resp.data;
  });

  const storesData = storesResp?.data || [];
  const statusesData = statusesResp?.data || [];

  const { data: itemLookupResp, isLoading: itemLookupLoading } = useQuery([
    'itemLookupForAddOrder',
  ], async () => {
    // Try the dedicated no-pagination endpoint first
    try {
      const response = await tablesAPI.getItemsForLookup();
      const items = response.data?.data;
      if (Array.isArray(items) && items.length > 0) {
        return { data: items };
      }
    } catch {
      // Fall through to paginated fallback
    }

    // Fallback: walk all pages of the inventory endpoint so nothing is missed
    const allItems: ItemLookup[] = [];
    let page = 1;
    while (true) {
      const response = await tablesAPI.getInventoryItems({
        page,
        pageSize: 100,
        sortBy: 'ItemName',
        sortOrder: 'ASC',
      });
      const rows: any[] = response.data?.data || [];
      rows.forEach((item) =>
        allItems.push({ ItemID: item.ItemID, ItemName: item.ItemName, ProductID: item.ProductID })
      );
      if (page >= (response.data?.totalPages ?? 1)) break;
      page++;
    }
    return { data: allItems };
  });

  const itemLookupData = (itemLookupResp?.data || []) as ItemLookup[];

  const storeOptions = useMemo(() => {
    return storesData.map((s: any) => ({ value: s.StoreName, label: s.StoreName }));
  }, [storesData]);

  const statusOptions = useMemo(() => {
    return statusesData.map((s: any) => ({ value: s.StatusName, label: s.StatusName }));
  }, [statusesData]);

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

  const formatCurrency = (amount?: number) => {
    if (amount === null || amount === undefined) {
      return '-';
    }
    return `$${amount.toFixed(2)}`;
  };

  const { data, isLoading, error } = useQuery<
    {
      data: PurchaseOrder[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    },
    Error
  >({
    queryKey,
    queryFn: async () => {
      const response = await tablesAPI.getPurchaseOrders({
        ...searchParams,
        page,
        pageSize: 50,
        sortBy,
        sortOrder,
      });
      return response.data;
    },
    keepPreviousData: true,
  });

  // Fetch inventory items for selected order
  const { data: inventoryData, isLoading: inventoryLoading } = useQuery<
    { data: InventoryItem[]; total: number },
    Error
  >({
    queryKey: ['inventoryByPurchaseOrder', selectedOrder?.PurchaseOrderID],
    queryFn: async () => {
      if (!selectedOrder) return { data: [], total: 0 };
      const response = await tablesAPI.getInventoryItemsByPurchaseOrder(selectedOrder.PurchaseOrderID);
      return response.data;
    },
    enabled: !!selectedOrder && isModalOpen,
  });

  // Update purchase order mutation
  const updateMutation = useMutation({
    mutationFn: async (data: {
      InvoiceNumber: string;
      StoreID: number;
      PurchasedDate: string;
      StatusID: number;
      StoreName: string;
      StatusName: string;
    }) => {
      if (!selectedOrder) throw new Error('No order selected');
      return await tablesAPI.updateRecord('PurchaseOrder', selectedOrder.PurchaseOrderID, {
        InvoiceNumber: data.InvoiceNumber,
        StoreID: data.StoreID,
        PurchasedDate: data.PurchasedDate,
        StatusID: data.StatusID,
      });
    },
    onSuccess: (_response, variables) => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setUpdateError(null);
      setIsEditMode(false);
      setEditedOrder(null);

      // Immediately refresh modal header fields with saved values.
      setSelectedOrder((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          InvoiceNumber: variables.InvoiceNumber,
          StoreName: variables.StoreName,
          PurchaseDate: variables.PurchasedDate,
          StatusID: variables.StatusID,
          StatusName: variables.StatusName,
        };
      });
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to update order';
      setUpdateError(errorMsg);
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrder) throw new Error('No order selected');
      // Delete all detail rows first (FK constraint), then the order header
      await tablesAPI.deleteRecord('PurchaseOrderDetail', { purchaseOrderId: selectedOrder.PurchaseOrderID });
      await tablesAPI.deleteRecord('PurchaseOrder', selectedOrder.PurchaseOrderID);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setIsConfirmDeleteOpen(false);
      handleCloseModal();
    },
    onError: (error: any) => {
      setDeleteError(error.response?.data?.error || error.message || 'Failed to delete order');
      setIsConfirmDeleteOpen(false);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      if (bulkDeleteConfirmText.trim() !== 'DELETE') {
        throw new Error('Type DELETE exactly to enable bulk delete.');
      }

      if (selectedOrderIds.length < 2) throw new Error('Select at least 2 orders to delete.');

      await Promise.all(
        selectedOrderIds.map(async (orderId) => {
          await tablesAPI.deleteRecord('PurchaseOrderDetail', { purchaseOrderId: orderId });
        })
      );

      await Promise.all(
        selectedOrderIds.map(async (orderId) => {
          await tablesAPI.deleteRecord('PurchaseOrder', orderId);
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setSelectedOrderIds([]);
      setIsBulkDeleteOpen(false);
      setBulkDeleteError(null);
      setBulkDeleteConfirmText('');
    },
    onError: (error: any) => {
      setBulkDeleteError(error.response?.data?.error || error.message || 'Failed to delete selected orders');
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (payload: { orderIds: number[]; updates: Record<string, any> }) => {
      if (payload.orderIds.length < 2) {
        throw new Error('Select at least 2 orders to update.');
      }

      await Promise.all(
        payload.orderIds.map(async (orderId) => {
          await tablesAPI.updateRecord('PurchaseOrder', orderId, payload.updates);
        })
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setSelectedOrderIds([]);
      closeBulkUpdateDialog();
    },
    onError: (error: any) => {
      setBulkError(error.response?.data?.error || error.message || 'Failed to bulk update purchase orders');
    },
  });

  const addOrderMutation = useMutation({
    mutationFn: async () => {
      const invoiceNumber = addOrderValues.InvoiceNumber.trim();
      if (!invoiceNumber) throw new Error('Invoice Number is required.');

      const storeId = parseInt(addOrderValues.StoreID, 10);
      if (!Number.isInteger(storeId) || storeId <= 0) throw new Error('Store is required.');

      const statusId = parseInt(addOrderValues.StatusID, 10);
      if (!Number.isInteger(statusId) || statusId <= 0) throw new Error('Order Status is required.');

      const purchaseDateParts = parseDateParts(addOrderValues.PurchaseDate);
      if (!purchaseDateParts) throw new Error('Purchase Date is required.');

      const purchasedDate = `${purchaseDateParts.year}-${String(purchaseDateParts.month).padStart(2, '0')}-${String(
        purchaseDateParts.day
      ).padStart(2, '0')}`;

      if (!addOrderDetails.length) throw new Error('At least one inventory item is required.');

      const normalizedDetails = addOrderDetails.map((detail, i) => {
        const itemId = parseInt(detail.ItemID, 10);
        const quantity = Number(detail.Quantity);
        const price = Number(detail.Price);
        if (!Number.isInteger(itemId) || itemId <= 0)
          throw new Error(`Row ${i + 1}: Item Name is required.`);
        if (!Number.isFinite(quantity) || quantity <= 0)
          throw new Error(`Row ${i + 1}: Quantity must be greater than 0.`);
        if (!Number.isFinite(price) || price < 0)
          throw new Error(`Row ${i + 1}: Price must be 0 or greater.`);
        return { ItemID: itemId, Quantity: quantity, Price: price };
      });

      // Single atomic call — order header + all detail rows committed together
      const response = await tablesAPI.createPurchaseOrderWithDetails({
        InvoiceNumber: invoiceNumber,
        StoreID: storeId,
        StatusID: statusId,
        PurchasedDate: purchasedDate,
        details: normalizedDetails,
      });

      return response.data.PurchaseOrderID as number;
    },
    onSuccess: async (newOrderId: number) => {
      // Fetch the newly created order row so we can open it in the detail modal
      const listResponse = await tablesAPI.getPurchaseOrders({
        page: 1,
        pageSize: 25,
        sortBy: 'PurchasedDate',
        sortOrder: 'DESC',
      });
      const createdOrder: PurchaseOrder | undefined = (listResponse.data?.data || []).find(
        (order: PurchaseOrder) => order.PurchaseOrderID === newOrderId
      );

      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setAddOrderError(null);
      setIsAddModalOpen(false);
      setAddOrderValues({ InvoiceNumber: '', StoreID: '', StatusID: '', PurchaseDate: '' });
      setAddOrderDetails([{ id: 1, ItemID: '', Quantity: '1', Price: '' }]);
      setNextDetailRowId(2);

      if (createdOrder) {
        setSelectedOrder(createdOrder);
        setIsModalOpen(true);
      }
    },
    onError: (error: any) => {
      setAddOrderError(error.response?.data?.error || error.message || 'Failed to create order');
    },
  });

  const updateDetailMutation = useMutation({
    mutationFn: async (payload: { detailId: number; ItemID: number; Quantity: number; Price: number }) => {
      return tablesAPI.updateRecord('PurchaseOrderDetail', payload.detailId, {
        ItemID: payload.ItemID,
        Quantity: payload.Quantity,
        Price: payload.Price,
      });
    },
    onSuccess: () => {
      if (selectedOrder) {
        queryClient.invalidateQueries({ queryKey: ['inventoryByPurchaseOrder', selectedOrder.PurchaseOrderID] });
      }
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setUpdateError(null);
      setEditingDetailId(null);
      setEditingDetailDraft(null);
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to update inventory item row';
      setUpdateError(errorMsg);
    },
  });

  const deleteDetailMutation = useMutation({
    mutationFn: async (detailId: number) => {
      return tablesAPI.deleteRecord('PurchaseOrderDetail', detailId);
    },
    onSuccess: (_response, detailId) => {
      if (selectedOrder) {
        queryClient.invalidateQueries({ queryKey: ['inventoryByPurchaseOrder', selectedOrder.PurchaseOrderID] });
      }
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });

      if (editingDetailId === detailId) {
        setEditingDetailId(null);
        setEditingDetailDraft(null);
      }
      setDeleteError(null);
    },
    onError: (error: any) => {
      setDeleteError(error.response?.data?.error || error.message || 'Failed to delete inventory item row');
    },
  });

  const addDetailMutation = useMutation({
    mutationFn: async (payload: { ItemID: number; Quantity: number; Price: number }) => {
      if (!selectedOrder) {
        throw new Error('No order selected');
      }

      return tablesAPI.createRecord('PurchaseOrderDetail', {
        PurchaseOrderID: selectedOrder.PurchaseOrderID,
        ItemID: payload.ItemID,
        Quantity: payload.Quantity,
        Price: payload.Price,
      });
    },
    onSuccess: () => {
      if (selectedOrder) {
        queryClient.invalidateQueries({ queryKey: ['inventoryByPurchaseOrder', selectedOrder.PurchaseOrderID] });
      }
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setUpdateError(null);
      setNewDetailDraft(null);
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to add inventory item row';
      setUpdateError(errorMsg);
    },
  });

  const handleOrderRowClick = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedOrder(null);
    setIsEditMode(false);
    setEditedOrder(null);
    setUpdateError(null);
    setDeleteError(null);
    setIsConfirmDeleteOpen(false);
    setEditingDetailId(null);
    setEditingDetailDraft(null);
    setNewDetailDraft(null);
  };

  const closeAddOrderModal = () => {
    setIsAddModalOpen(false);
    setAddOrderError(null);
    setAddOrderValues({
      InvoiceNumber: '',
      StoreID: '',
      StatusID: '',
      PurchaseDate: '',
    });
    setAddOrderDetails([{ id: 1, ItemID: '', Quantity: '1', Price: '' }]);
    setNextDetailRowId(2);
  };

  const handleEditClick = () => {
    if (selectedOrder) {
      setEditedOrder({
        InvoiceNumber: selectedOrder.InvoiceNumber,
        StoreName: selectedOrder.StoreName,
        PurchaseDate: selectedOrder.PurchaseDate,
        StatusName: selectedOrder.StatusName || '',
      });
      setIsEditMode(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditedOrder(null);
    setUpdateError(null);
  };

  const handleEditFieldChange = (
    field: 'InvoiceNumber' | 'StoreName' | 'PurchaseDate' | 'StatusName',
    value: string
  ) => {
    if (editedOrder) {
      setEditedOrder((prev) => prev ? { ...prev, [field]: value } : null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editedOrder || !selectedOrder) return;

    // Find the store ID for the selected store name
    const selectedStore = storesData.find((s: any) => s.StoreName === editedOrder.StoreName);
    if (!selectedStore) {
      setUpdateError('Selected store not found');
      return;
    }

    const selectedStatus = statusesData.find((s: any) => s.StatusName === editedOrder.StatusName);
    if (!selectedStatus) {
      setUpdateError('Selected order status not found');
      return;
    }

    // Convert date format from MM/DD/YYYY or YYYY-MM-DD to YYYY-MM-DD for the database
    let purchasedDate = editedOrder.PurchaseDate;
    const dateParts = parseDateParts(editedOrder.PurchaseDate);
    if (dateParts) {
      purchasedDate = `${dateParts.year}-${String(dateParts.month).padStart(2, '0')}-${String(dateParts.day).padStart(2, '0')}`;
    }

    updateMutation.mutate({
      InvoiceNumber: editedOrder.InvoiceNumber,
      StoreID: selectedStore.StoreID,
      PurchasedDate: purchasedDate,
      StatusID: selectedStatus.StatusID,
      StoreName: editedOrder.StoreName,
      StatusName: selectedStatus.StatusName,
    });
  };

  const handleStoreChange = (values: string[]) => {
    setFilterValues((current) => ({ ...current, storeNames: values }));
  };

  const handleInvoiceNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterValues((current) => ({ ...current, invoiceNumber: e.target.value }));
  };

  const handleStatusFilterChange = (values: string[]) => {
    setFilterValues((current) => ({ ...current, statusNames: values }));
  };

  const handleDateStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterValues((current) => ({ ...current, purchaseDateStart: e.target.value }));
  };

  const handleDateEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterValues((current) => ({ ...current, purchaseDateEnd: e.target.value }));
  };

  const hasFilterCriteria =
    filterValues.storeNames.length > 0 ||
    filterValues.invoiceNumber.trim().length > 0 ||
    filterValues.statusNames.length > 0 ||
    filterValues.purchaseDateStart.trim().length > 0 ||
    filterValues.purchaseDateEnd.trim().length > 0;

  const applyFilters = () => {
    setPage(1);
    setSearchParams(filterValues);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder(column === 'PurchaseDate' ? 'DESC' : 'ASC');
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
    setFilterValues({
      storeNames: [],
      invoiceNumber: '',
      statusNames: [],
      purchaseDateStart: '',
      purchaseDateEnd: '',
    });
    setSearchParams({
      storeNames: [],
      invoiceNumber: '',
      statusNames: [],
      purchaseDateStart: '',
      purchaseDateEnd: '',
    });
    setPage(1);
  };

  const csvEscape = (value: string | number | null | undefined) => {
    const stringValue = String(value ?? '').replace(/"/g, '""');
    return /[",\n]/.test(stringValue) ? `"${stringValue}"` : stringValue;
  };

  const buildCsvContent = (rows: PurchaseOrder[]) => {
    const header = ['Purchase Date', 'Invoice Number', 'Store Name', 'Order Status', 'Item Count', 'Total Amount'];
    const body = rows.map((order) => [
      formatPurchaseDate(order.PurchaseDate),
      order.InvoiceNumber,
      order.StoreName,
      order.StatusName || '-',
      order.ItemCount,
      formatCurrency(order.TotalAmount).replace('$', ''),
    ]);

    return [header, ...body]
      .map((row) => row.map((cell) => csvEscape(cell)).join(','))
      .join('\n');
  };

  const handleDownloadCsv = async () => {
    try {
      setIsDownloading(true);
      setDownloadError(null);

      const rows: PurchaseOrder[] = [];
      const pageSize = 100;
      let exportPage = 1;

      while (true) {
        const response = await tablesAPI.getPurchaseOrders({
          ...searchParams,
          page: exportPage,
          pageSize,
          sortBy,
          sortOrder,
        });

        const pageRows = (response.data?.data || []) as PurchaseOrder[];
        rows.push(...pageRows);

        const totalPages = Number(response.data?.totalPages || 1);
        if (exportPage >= totalPages) {
          break;
        }

        exportPage += 1;
      }

      const csvContent = buildCsvContent(rows);
      const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      link.href = url;
      link.download = `order-master-export-${timestamp}.csv`;
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

  const openAddOrder = () => {
    const today = new Date();
    const initialDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate()
    ).padStart(2, '0')}`;

    setAddOrderValues({
      InvoiceNumber: '',
      StoreID: '',
      StatusID: defaultOnOrderStatusId,
      PurchaseDate: initialDate,
    });
    setAddOrderDetails([{ id: 1, ItemID: '', Quantity: '1', Price: '' }]);
    setNextDetailRowId(2);
    setAddOrderError(null);
    setIsAddModalOpen(true);
  };

  const openBulkDeleteDialog = () => {
    if (selectedOrderIds.length < 2) {
      return;
    }

    setBulkDeleteError(null);
    setBulkDeleteConfirmText('');
    setIsBulkDeleteOpen(true);
  };

  const closeBulkDeleteDialog = () => {
    setIsBulkDeleteOpen(false);
    setBulkDeleteError(null);
    setBulkDeleteConfirmText('');
  };

  const openBulkUpdateDialog = () => {
    if (selectedOrderIds.length < 2) {
      return;
    }

    setBulkValues({
      InvoiceNumber: '',
      StoreID: '',
      StatusID: '',
      PurchaseDate: '',
    });
    setBulkError(null);
    setBulkStep('edit');
    setIsBulkUpdateOpen(true);
  };

  const closeBulkUpdateDialog = () => {
    setIsBulkUpdateOpen(false);
    setBulkStep('edit');
    setBulkError(null);
    setBulkValues({
      InvoiceNumber: '',
      StoreID: '',
      StatusID: '',
      PurchaseDate: '',
    });
  };

  const toggleOrderSelection = (orderId: number, event: React.ChangeEvent<HTMLInputElement>) => {
    event.stopPropagation();
    setSelectedOrderIds((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId]
    );
  };

  const handleAddOrderFieldChange = (
    field: 'InvoiceNumber' | 'StoreID' | 'StatusID' | 'PurchaseDate',
    value: string
  ) => {
    setAddOrderValues((current) => ({ ...current, [field]: value }));
  };

  const handleBulkFieldChange = (field: 'InvoiceNumber' | 'StoreID' | 'StatusID' | 'PurchaseDate', value: string) => {
    setBulkError(null);
    setBulkValues((current) => ({ ...current, [field]: value }));
  };

  const buildBulkUpdatePayload = () => {
    const updates: Record<string, number | string> = {};

    if (bulkValues.InvoiceNumber.trim()) {
      updates.InvoiceNumber = bulkValues.InvoiceNumber.trim();
    }

    if (bulkValues.StoreID) {
      const storeId = parseInt(bulkValues.StoreID, 10);
      if (!Number.isInteger(storeId) || storeId <= 0) {
        throw new Error('Store is invalid.');
      }
      updates.StoreID = storeId;
    }

    if (bulkValues.StatusID) {
      const statusId = parseInt(bulkValues.StatusID, 10);
      if (!Number.isInteger(statusId) || statusId <= 0) {
        throw new Error('Order Status is invalid.');
      }
      updates.StatusID = statusId;
    }

    if (bulkValues.PurchaseDate.trim()) {
      const purchaseDateParts = parseDateParts(bulkValues.PurchaseDate);
      if (!purchaseDateParts) {
        throw new Error('Purchase Date is invalid.');
      }

      updates.PurchasedDate = `${purchaseDateParts.year}-${String(purchaseDateParts.month).padStart(2, '0')}-${String(
        purchaseDateParts.day
      ).padStart(2, '0')}`;
    }

    return updates;
  };

  const getBulkFieldLabel = (field: 'InvoiceNumber' | 'StoreID' | 'StatusID' | 'PurchaseDate', value: string) => {
    if (!value) {
      return '';
    }

    if (field === 'InvoiceNumber') {
      return value;
    }

    if (field === 'PurchaseDate') {
      return formatPurchaseDate(value);
    }

    const numericValue = parseInt(value, 10);
    if (field === 'StoreID') {
      return storesData.find((entry: any) => Number(entry.StoreID) === numericValue)?.StoreName || value;
    }

    return statusesData.find((entry: any) => Number(entry.StatusID) === numericValue)?.StatusName || value;
  };

  const handleBulkPreview = () => {
    try {
      const updates = buildBulkUpdatePayload();
      if (Object.keys(updates).length === 0) {
        setBulkError('Select at least one field to update.');
        return;
      }

      setBulkError(null);
      setBulkStep('confirm');
    } catch (error: any) {
      setBulkError(error.message || 'Unable to build bulk update payload.');
    }
  };

  const handleBulkConfirm = () => {
    try {
      const updates = buildBulkUpdatePayload();
      if (Object.keys(updates).length === 0) {
        setBulkError('Select at least one field to update.');
        setBulkStep('edit');
        return;
      }

      bulkUpdateMutation.mutate({ orderIds: selectedOrderIds, updates });
    } catch (error: any) {
      setBulkError(error.message || 'Unable to build bulk update payload.');
      setBulkStep('edit');
    }
  };

  useEffect(() => {
    if (!isAddModalOpen || addOrderValues.StatusID || !defaultOnOrderStatusId) {
      return;
    }

    setAddOrderValues((current) => ({ ...current, StatusID: defaultOnOrderStatusId }));
  }, [isAddModalOpen, addOrderValues.StatusID, defaultOnOrderStatusId]);

  const handleAddDetailChange = (rowId: number, field: 'ItemID' | 'Quantity' | 'Price', value: string) => {
    setAddOrderDetails((current) =>
      current.map((detail) => (detail.id === rowId ? { ...detail, [field]: value } : detail))
    );
  };

  const handleAddDetailRow = () => {
    setAddOrderDetails((current) => [...current, { id: nextDetailRowId, ItemID: '', Quantity: '1', Price: '' }]);
    setNextDetailRowId((current) => current + 1);
  };

  const handleRemoveDetailRow = (rowId: number) => {
    setAddOrderDetails((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((detail) => detail.id !== rowId);
    });
  };

  const handleCreateOrder = () => {
    setAddOrderError(null);
    addOrderMutation.mutate();
  };

  const validateDetailDraft = (draft: OrderDetailDraft | AddOrderDetailDraft, rowLabel: string) => {
    const itemId = parseInt(draft.ItemID, 10);
    const quantity = Number(draft.Quantity);
    const price = Number(draft.Price);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      throw new Error(`${rowLabel}: Item Name is required.`);
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`${rowLabel}: Quantity must be greater than 0.`);
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`${rowLabel}: Price must be 0 or greater.`);
    }

    return { ItemID: itemId, Quantity: quantity, Price: price };
  };

  const startEditDetail = (item: InventoryItem) => {
    setUpdateError(null);
    setEditingDetailId(item.PurchaseOrderDetailID);
    setEditingDetailDraft({
      ItemID: String(item.ItemID),
      Quantity: String(item.Quantity),
      Price: String(item.Price),
    });
  };

  const cancelEditDetail = () => {
    setEditingDetailId(null);
    setEditingDetailDraft(null);
  };

  const saveEditDetail = () => {
    if (!editingDetailDraft || !editingDetailId) {
      return;
    }

    try {
      setUpdateError(null);
      const normalized = validateDetailDraft(editingDetailDraft, 'Edit row');
      updateDetailMutation.mutate({ detailId: editingDetailId, ...normalized });
    } catch (error: any) {
      setUpdateError(error.message || 'Invalid row values');
    }
  };

  const addNewDetailRow = () => {
    setUpdateError(null);
    if (!newDetailDraft) {
      setNewDetailDraft({ id: -1, ItemID: '', Quantity: '1', Price: '' });
    }
  };

  const cancelNewDetailRow = () => {
    setNewDetailDraft(null);
  };

  const saveNewDetailRow = () => {
    if (!newDetailDraft) {
      return;
    }

    try {
      setUpdateError(null);
      const normalized = validateDetailDraft(newDetailDraft, 'New row');
      addDetailMutation.mutate(normalized);
    } catch (error: any) {
      setUpdateError(error.message || 'Invalid row values');
    }
  };

  return (
    <AdminLayout title="Order Master" subtitle="Use this screen to view, add, remove and modify the purchase orders associated with your collection.">
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="bg-white shadow rounded-lg p-6">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Store Name</span>
                <ComboMultiSelect
                  options={storeOptions}
                  selected={filterValues.storeNames}
                  onChange={handleStoreChange}
                  placeholder="Select stores..."
                  className="w-full"
                  autoFocus
                  tabIndex={1}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">Invoice Number</span>
                <Input
                  type="text"
                  value={filterValues.invoiceNumber}
                  onChange={handleInvoiceNumberChange}
                  placeholder="Search invoices..."
                  tabIndex={2}
                />
              </label>
              <label className="space-y-2 min-w-0">
                <span className="text-sm font-medium text-gray-700">Order Status</span>
                <ComboMultiSelect
                  options={statusOptions}
                  selected={filterValues.statusNames}
                  onChange={handleStatusFilterChange}
                  placeholder="Select statuses..."
                  className="w-full"
                  tabIndex={3}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">From</span>
                <Input
                  type="date"
                  value={filterValues.purchaseDateStart}
                  onChange={handleDateStartChange}
                  placeholder="Start date"
                  className="w-full"
                  tabIndex={4}
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-gray-700">To</span>
                <Input
                  type="date"
                  value={filterValues.purchaseDateEnd}
                  onChange={handleDateEndChange}
                  placeholder="End date"
                  className="w-full"
                  tabIndex={5}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                {selectedOrderIds.length >= 2 ? (
                  <Button type="button" className="bg-red-600 hover:bg-red-700" onClick={openBulkDeleteDialog} tabIndex={6}>
                    Bulk Delete{selectedOrderIds.length ? ` (${selectedOrderIds.length})` : ''}
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                {selectedOrderIds.length >= 2 ? (
                  <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={openBulkUpdateDialog} tabIndex={7}>
                    Bulk Update{selectedOrderIds.length ? ` (${selectedOrderIds.length})` : ''}
                  </Button>
                ) : null}
                <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={openAddOrder} tabIndex={8}>
                  Add Order
                </Button>
                <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={handleDownloadCsv} disabled={isDownloading} tabIndex={9}>
                  {isDownloading ? 'Downloading...' : 'Download'}
                </Button>
                <Button type="submit" disabled={!hasFilterCriteria} tabIndex={10}>
                  Apply Filter
                </Button>
                <Button type="button" className="bg-gray-600 hover:bg-gray-700" onClick={clearFilters} disabled={!hasFilterCriteria} tabIndex={11}>
                  Clear
                </Button>
              </div>
            </div>
            {downloadError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{downloadError}</div>
            ) : null}
          </form>
        </section>

        <section className="bg-white shadow rounded-lg p-6">
          {isLoading && <p className="text-gray-500">Loading purchase orders...</p>}
          {error && <p className="text-red-600">Error loading purchase orders.</p>}

          {!isLoading && !error && (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          checked={data?.data?.length ? data.data.every((order: PurchaseOrder) => selectedOrderIds.includes(order.PurchaseOrderID)) : false}
                          onChange={(event) => {
                            if (!data?.data?.length) {
                              return;
                            }

                            if (event.target.checked) {
                              setSelectedOrderIds((current) => {
                                const next = new Set(current);
                                data.data.forEach((order: PurchaseOrder) => next.add(order.PurchaseOrderID));
                                return Array.from(next);
                              });
                              return;
                            }

                            setSelectedOrderIds((current) => current.filter((id) => !data.data.some((order: PurchaseOrder) => order.PurchaseOrderID === id)));
                          }}
                          onClick={(event) => event.stopPropagation()}
                          aria-label="Select all visible orders"
                        />
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('PurchaseDate')} className="flex items-center hover:text-blue-600" tabIndex={11}>
                          Purchase Date <SortIndicator column="PurchaseDate" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('InvoiceNumber')} className="flex items-center hover:text-blue-600" tabIndex={12}>
                          Invoice Number <SortIndicator column="InvoiceNumber" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('StoreName')} className="flex items-center hover:text-blue-600" tabIndex={13}>
                          Store Name <SortIndicator column="StoreName" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <button onClick={() => handleSort('StatusName')} className="flex items-center hover:text-blue-600" tabIndex={14}>
                          Order Status <SortIndicator column="StatusName" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button onClick={() => handleSort('ItemCount')} className="flex items-center justify-end hover:text-blue-600 w-full" tabIndex={15}>
                          Item Count <SortIndicator column="ItemCount" />
                        </button>
                      </TableHead>
                      <TableHead className="text-right">
                        <button onClick={() => handleSort('TotalAmount')} className="flex items-center justify-end hover:text-blue-600 w-full" tabIndex={16}>
                          Total Amount <SortIndicator column="TotalAmount" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(data?.data) && data.data.length ? (
                      data.data.map((order: PurchaseOrder) => (
                        <TableRow
                          key={order.PurchaseOrderID}
                          className={`hover:bg-gray-50 cursor-pointer ${selectedOrderIds.includes(order.PurchaseOrderID) ? 'bg-blue-50' : ''}`}
                          onClick={() => handleOrderRowClick(order)}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedOrderIds.includes(order.PurchaseOrderID)}
                              onChange={(event) => toggleOrderSelection(order.PurchaseOrderID, event)}
                              onClick={(event) => event.stopPropagation()}
                              aria-label={`Select order ${order.InvoiceNumber}`}
                            />
                          </TableCell>
                          <TableCell>{formatPurchaseDate(order.PurchaseDate)}</TableCell>
                          <TableCell>{order.InvoiceNumber}</TableCell>
                          <TableCell>{order.StoreName}</TableCell>
                          <TableCell>{order.StatusName || '-'}</TableCell>
                          <TableCell className="text-right">{order.ItemCount}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(order.TotalAmount)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                          No matching orders found.
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
                        <Button onClick={() => setPage(1)} disabled={!hasManyPages || page === 1} tabIndex={17}>
                          First
                        </Button>
                        <Button
                          onClick={() => setPage(Math.max(1, page - 1))}
                          disabled={page === 1}
                          tabIndex={18}
                        >
                          Previous
                        </Button>
                        <Button
                          onClick={() => setPage(page + 1)}
                          disabled={page >= (data?.totalPages ?? 1)}
                          tabIndex={19}
                        >
                          Next
                        </Button>
                        <Button
                          onClick={() => setPage(totalPages)}
                          disabled={!hasManyPages || page >= totalPages}
                          tabIndex={20}
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
        open={isBulkDeleteOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsBulkDeleteOpen(true);
            return;
          }

            closeBulkDeleteDialog();
        }}
        onClose={closeBulkDeleteDialog}
        title="Confirm Bulk Delete"
        showCloseButton={false}
        contentClassName="max-w-xl"
      >
        <div className="space-y-5">
          {bulkDeleteError ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {bulkDeleteError}
            </div>
          ) : null}

          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            You are about to permanently delete {selectedOrderIds.length} selected purchase orders and their associated detail rows.
            This action cannot be undone.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type DELETE to confirm
            </label>
            <Input
              value={bulkDeleteConfirmText}
              onChange={(event) => {
                setBulkDeleteError(null);
                setBulkDeleteConfirmText(event.target.value);
              }}
              placeholder="DELETE"
              disabled={bulkDeleteMutation.isPending}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" className="bg-gray-600 hover:bg-gray-700" onClick={closeBulkDeleteDialog} disabled={bulkDeleteMutation.isPending}>
              Cancel
            </Button>
            {bulkDeleteConfirmText.trim() === 'DELETE' ? (
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700"
                onClick={() => bulkDeleteMutation.mutate()}
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? 'Deleting...' : `Delete ${selectedOrderIds.length} Orders`}
              </Button>
            ) : null}
          </div>
        </div>
      </Dialog>

      <Dialog
        open={isBulkUpdateOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsBulkUpdateOpen(true);
            return;
          }

          closeBulkUpdateDialog();
        }}
        title={bulkStep === 'confirm' ? 'Confirm Bulk Update' : 'Bulk Update Orders'}
        showCloseButton={false}
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
                Bulk updates apply to {selectedOrderIds.length} selected purchase order{selectedOrderIds.length === 1 ? '' : 's'} on this page.
                Only the fields you change will be written.
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                  <Input
                    value={bulkValues.InvoiceNumber}
                    onChange={(event) => handleBulkFieldChange('InvoiceNumber', event.target.value)}
                    placeholder="Leave unchanged"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Store</label>
                  <select
                    value={bulkValues.StoreID}
                    onChange={(event) => handleBulkFieldChange('StoreID', event.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
                  >
                    <option value="">Leave unchanged</option>
                    {storesData.map((store: any) => (
                      <option key={store.StoreID} value={String(store.StoreID)}>
                        {store.StoreName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order Status</label>
                  <select
                    value={bulkValues.StatusID}
                    onChange={(event) => handleBulkFieldChange('StatusID', event.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
                  >
                    <option value="">Leave unchanged</option>
                    {statusesData.map((status: any) => (
                      <option key={status.StatusID} value={String(status.StatusID)}>
                        {status.StatusName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                  <Input
                    type="date"
                    value={bulkValues.PurchaseDate}
                    onChange={(event) => handleBulkFieldChange('PurchaseDate', event.target.value)}
                    placeholder="Leave unchanged"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  className="bg-gray-600 hover:bg-gray-700"
                  onClick={closeBulkUpdateDialog}
                  disabled={bulkUpdateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={handleBulkPreview}
                  disabled={bulkUpdateMutation.isPending}
                >
                  Review {selectedOrderIds.length} Update{selectedOrderIds.length === 1 ? '' : 's'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                You are about to update {selectedOrderIds.length} purchase order{selectedOrderIds.length === 1 ? '' : 's'}.
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
                          {field === 'InvoiceNumber'
                            ? 'Invoice Number'
                            : field === 'StoreID'
                              ? 'Store'
                              : field === 'StatusID'
                                ? 'Order Status'
                                : 'Purchase Date'}
                        </span>
                        <span className="text-right">{getBulkFieldLabel(field as 'InvoiceNumber' | 'StoreID' | 'StatusID' | 'PurchaseDate', value)}</span>
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
                  disabled={bulkUpdateMutation.isPending}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  className="bg-amber-600 hover:bg-amber-700"
                  onClick={handleBulkConfirm}
                  disabled={bulkUpdateMutation.isPending}
                >
                  {bulkUpdateMutation.isPending ? 'Updating...' : `Confirm Update (${selectedOrderIds.length})`}
                </Button>
              </div>
            </>
          )}
        </div>
      </Dialog>

      {/* Order Details Modal */}
      <Dialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title="Edit Order"
        onClose={handleCloseModal}
        showCloseButton={false}
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Error messages */}
            {updateError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800">{updateError}</p>
              </div>
            )}
            {deleteError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800">{deleteError}</p>
              </div>
            )}

            {/* Order Summary / Edit Form */}
            <div className={`grid gap-4 pb-4 border-b ${isEditMode ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-5'}`}>
              {/* Invoice Number */}
              <div>
                <p className="text-sm text-gray-600">Invoice Number</p>
                {isEditMode ? (
                  <Input
                    type="text"
                    value={editedOrder?.InvoiceNumber || ''}
                    onChange={(e) => handleEditFieldChange('InvoiceNumber', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <p className="font-semibold">{selectedOrder.InvoiceNumber}</p>
                )}
              </div>

              {/* Store */}
              <div>
                <p className="text-sm text-gray-600">Store</p>
                {isEditMode ? (
                  <select
                    value={editedOrder?.StoreName || ''}
                    onChange={(e) => handleEditFieldChange('StoreName', e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a store...</option>
                    {storesData.map((store: any) => (
                      <option key={store.StoreID} value={store.StoreName}>
                        {store.StoreName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="font-semibold">{selectedOrder.StoreName}</p>
                )}
              </div>

              {/* Purchase Date */}
              <div>
                <p className="text-sm text-gray-600">Purchase Date</p>
                {isEditMode ? (
                  <Input
                    type="date"
                    value={
                      editedOrder?.PurchaseDate
                        ? (() => {
                            const parts = parseDateParts(editedOrder.PurchaseDate);
                            if (parts) {
                              return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
                            }
                            return editedOrder.PurchaseDate;
                          })()
                        : ''
                    }
                    onChange={(e) => handleEditFieldChange('PurchaseDate', e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <p className="font-semibold">{formatPurchaseDate(selectedOrder.PurchaseDate)}</p>
                )}
              </div>

              {/* Order Status */}
              <div>
                <p className="text-sm text-gray-600">Order Status</p>
                {isEditMode ? (
                  <select
                    value={editedOrder?.StatusName || ''}
                    onChange={(e) => handleEditFieldChange('StatusName', e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a status...</option>
                    {statusesData.map((status: any) => (
                      <option key={status.StatusID} value={status.StatusName}>
                        {status.StatusName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="font-semibold">{selectedOrder.StatusName || '-'}</p>
                )}
              </div>

              {/* Total Amount (read-only) */}
              {!isEditMode && (
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="font-semibold text-blue-600">{formatCurrency(selectedOrder.TotalAmount)}</p>
                </div>
              )}
            </div>

            {/* Edit/Save/Cancel/Delete Buttons */}
            <div className="flex gap-2 justify-between mb-4">
              {/* Delete lives on the left so it's visually separated from the edit actions */}
              {!isEditMode && (
                <Button
                  onClick={() => { setDeleteError(null); setIsConfirmDeleteOpen(true); }}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={deleteOrderMutation.isPending}
                >
                  Delete Order
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
              {!isEditMode ? (
                <Button
                  onClick={handleEditClick}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Edit
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleCancelEdit}
                    className="bg-gray-600 hover:bg-gray-700"
                    disabled={updateMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </>
              )}
              </div>
            </div>

            {/* Confirm Delete dialog */}
            {isConfirmDeleteOpen && (
              <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-md space-y-3">
                <p className="font-semibold text-yellow-900">
                  Delete order #{selectedOrder.InvoiceNumber} from {selectedOrder.StoreName}?
                </p>
                <p className="text-sm text-yellow-800">
                  This will permanently remove the purchase order and all {selectedOrder.ItemCount} associated detail
                  {selectedOrder.ItemCount === 1 ? ' row' : ' rows'}. This action cannot be undone.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    className="bg-gray-600 hover:bg-gray-700"
                    onClick={() => setIsConfirmDeleteOpen(false)}
                    disabled={deleteOrderMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => deleteOrderMutation.mutate()}
                    disabled={deleteOrderMutation.isPending}
                  >
                    {deleteOrderMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                  </Button>
                </div>
              </div>
            )}

            {/* Inventory Items Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Inventory Items</h3>
                <Button
                  type="button"
                  onClick={addNewDetailRow}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={!!newDetailDraft || addDetailMutation.isPending}
                >
                  Add Item
                </Button>
              </div>
              {inventoryLoading ? (
                <p className="text-gray-500">Loading inventory items...</p>
              ) : (
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
                      {newDetailDraft && (
                        <TableRow className="bg-green-50/40">
                          <TableCell>
                            <ComboSelect
                              options={itemLookupOptions}
                              value={newDetailDraft.ItemID}
                              onChange={(value) => setNewDetailDraft((current) => current ? { ...current, ItemID: value } : current)}
                              placeholder={itemLookupLoading ? 'Loading items...' : 'Search item or Product ID...'}
                              disabled={itemLookupLoading || addDetailMutation.isPending}
                              className="min-w-[280px]"
                            />
                          </TableCell>
                          <TableCell>
                            {newDetailDraft.ItemID
                              ? itemLookupById.get(parseInt(newDetailDraft.ItemID, 10))?.ProductID || '-'
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={newDetailDraft.Quantity}
                              onChange={(e) => setNewDetailDraft((current) => current ? { ...current, Quantity: e.target.value } : current)}
                              className="w-24 ml-auto text-right"
                              disabled={addDetailMutation.isPending}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]*[.,]?[0-9]*"
                              value={newDetailDraft.Price}
                              onChange={(e) => setNewDetailDraft((current) => current ? { ...current, Price: e.target.value } : current)}
                              className="w-28 ml-auto text-right"
                              disabled={addDetailMutation.isPending}
                            />
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency((Number(newDetailDraft.Quantity) || 0) * (Number(newDetailDraft.Price) || 0))}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                className="bg-green-600 hover:bg-green-700"
                                onClick={saveNewDetailRow}
                                disabled={addDetailMutation.isPending}
                              >
                                {addDetailMutation.isPending ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                className="bg-gray-600 hover:bg-gray-700"
                                onClick={cancelNewDetailRow}
                                disabled={addDetailMutation.isPending}
                              >
                                Cancel
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      {Array.isArray(inventoryData?.data) && inventoryData.data.length ? (
                        <>
                          {inventoryData.data.map((item: InventoryItem) => (
                            <TableRow key={item.PurchaseOrderDetailID}>
                              {editingDetailId === item.PurchaseOrderDetailID && editingDetailDraft ? (
                                <>
                                  <TableCell>
                                    <ComboSelect
                                      options={itemLookupOptions}
                                      value={editingDetailDraft.ItemID}
                                      onChange={(value) => setEditingDetailDraft((current) => current ? { ...current, ItemID: value } : current)}
                                      placeholder={itemLookupLoading ? 'Loading items...' : 'Search item or Product ID...'}
                                      disabled={itemLookupLoading || updateDetailMutation.isPending}
                                      className="min-w-[280px]"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {editingDetailDraft.ItemID
                                      ? itemLookupById.get(parseInt(editingDetailDraft.ItemID, 10))?.ProductID || '-'
                                      : '-'}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={editingDetailDraft.Quantity}
                                      onChange={(e) => setEditingDetailDraft((current) => current ? { ...current, Quantity: e.target.value } : current)}
                                      className="w-24 ml-auto text-right"
                                      disabled={updateDetailMutation.isPending}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      pattern="[0-9]*[.,]?[0-9]*"
                                      value={editingDetailDraft.Price}
                                      onChange={(e) => setEditingDetailDraft((current) => current ? { ...current, Price: e.target.value } : current)}
                                      className="w-28 ml-auto text-right"
                                      disabled={updateDetailMutation.isPending}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {formatCurrency((Number(editingDetailDraft.Quantity) || 0) * (Number(editingDetailDraft.Price) || 0))}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        className="bg-green-600 hover:bg-green-700"
                                        onClick={saveEditDetail}
                                        disabled={updateDetailMutation.isPending}
                                      >
                                        {updateDetailMutation.isPending ? 'Saving...' : 'Save'}
                                      </Button>
                                      <Button
                                        className="bg-gray-600 hover:bg-gray-700"
                                        onClick={cancelEditDetail}
                                        disabled={updateDetailMutation.isPending}
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell>{item.ItemName}</TableCell>
                                  <TableCell>{item.ProductID || '-'}</TableCell>
                                  <TableCell className="text-right">{item.Quantity}</TableCell>
                                  <TableCell className="text-right">{formatCurrency(item.Price)}</TableCell>
                                  <TableCell className="text-right font-semibold">{formatCurrency(item.LineTotal)}</TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => startEditDetail(item)}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                                        title="Edit row"
                                        disabled={!!editingDetailId || updateDetailMutation.isPending || addDetailMutation.isPending}
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => { setDeleteError(null); deleteDetailMutation.mutate(item.PurchaseOrderDetailID); }}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                        title="Delete row"
                                        disabled={deleteDetailMutation.isPending || updateDetailMutation.isPending || addDetailMutation.isPending}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          ))}
                          <TableRow className="bg-gray-50 font-semibold">
                            <TableCell colSpan={4} className="text-right">Total:</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(
                                inventoryData.data.reduce((sum: number, item: InventoryItem) => sum + item.LineTotal, 0)
                              )}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        </>
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                            No inventory items found for this order.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onClose={closeAddOrderModal}
        contentClassName="max-w-6xl"
        title="Add Order"
        showCloseButton={false}
      >
        <div className="space-y-6">
          {isOnOrderStatusMissing && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-md">
              <p className="text-amber-900 font-medium">Default status not found</p>
              <p className="text-amber-800 text-sm mt-1">
                The Status table does not contain an "On Order" row, so a default order status cannot be applied.
                Please choose an Order Status before creating the order.
              </p>
            </div>
          )}

          {addOrderError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{addOrderError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-4 border-b">
            <label className="space-y-2">
              <span className="text-sm text-gray-600">Invoice Number</span>
              <Input
                type="text"
                value={addOrderValues.InvoiceNumber}
                onChange={(e) => handleAddOrderFieldChange('InvoiceNumber', e.target.value)}
                placeholder="Invoice number"
              />
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-medium text-gray-700 mb-1">Store</span>
              <select
                value={addOrderValues.StoreID}
                onChange={(e) => handleAddOrderFieldChange('StoreID', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
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
              <span className="block text-sm font-medium text-gray-700 mb-1">Order Status</span>
              <select
                value={addOrderValues.StatusID}
                onChange={(e) => handleAddOrderFieldChange('StatusID', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 bg-white py-2 px-3 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white"
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
                value={addOrderValues.PurchaseDate}
                onChange={(e) => handleAddOrderFieldChange('PurchaseDate', e.target.value)}
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Inventory Items</h3>
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleAddDetailRow}>
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
                  {addOrderDetails.map((detail) => {
                    const selectedItem = detail.ItemID ? itemLookupById.get(parseInt(detail.ItemID, 10)) : null;
                    const quantity = Number(detail.Quantity) || 0;
                    const price = Number(detail.Price) || 0;

                    return (
                      <TableRow key={detail.id}>
                        <TableCell>
                          <ComboSelect
                            options={itemLookupOptions}
                            value={detail.ItemID}
                            onChange={(value) => handleAddDetailChange(detail.id, 'ItemID', value)}
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
                            onChange={(e) => handleAddDetailChange(detail.id, 'Quantity', e.target.value)}
                            className="w-24 ml-auto text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="text"
                            inputMode="decimal"
                            pattern="[0-9]*[.,]?[0-9]*"
                            value={detail.Price}
                            onChange={(e) => handleAddDetailChange(detail.id, 'Price', e.target.value)}
                            className="w-28 ml-auto text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(quantity * price)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => handleRemoveDetailRow(detail.id)}
                            disabled={addOrderDetails.length <= 1}
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
                        addOrderDetails.reduce((sum, detail) => {
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
            <Button className="bg-gray-600 hover:bg-gray-700" onClick={closeAddOrderModal} disabled={addOrderMutation.isPending}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleCreateOrder}
              disabled={addOrderMutation.isPending || (isOnOrderStatusMissing && !addOrderValues.StatusID)}
            >
              {addOrderMutation.isPending ? 'Creating...' : 'Add Order'}
            </Button>
          </div>
        </div>
      </Dialog>
    </AdminLayout>
  );
}
