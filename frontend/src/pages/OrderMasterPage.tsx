import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import AdminLayout from '../components/AdminLayout';
import MasterTablePagination from '../components/MasterTablePagination';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import ComboSelect from '../components/ui/ComboSelect';
import FilterChipBar, { type FilterChipField } from '../components/inventory/FilterChipBar';
import { Dialog } from '../components/ui/Dialog';
import AlertDialog from '../components/ui/AlertDialog';
import SelectionScopeMenu from '../components/ui/SelectionScopeMenu';
import { useToast } from '../components/ui/ToastProvider';
import { useAppMode } from '../context/AppModeContext';
import { tablesAPI } from '../services/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { CircleHelp, Edit2, Trash2 } from 'lucide-react';

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
  const { toast } = useToast();
  const { canWrite } = useAppMode();
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
  const [searchInput, setSearchInput] = useState('');
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
  const [isEditInvoiceUnlocked, setIsEditInvoiceUnlocked] = useState(false);
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
  const [pendingOrderNavigation, setPendingOrderNavigation] = useState<
    { direction: 'previous' | 'next'; targetPage: number } | null
  >(null);
  const editOrderInvoiceInputRef = useRef<HTMLInputElement | null>(null);
  const queryClient = useQueryClient();

  const queryKey = useMemo(
    () => ['purchaseOrders', filterValues, page, sortBy, sortOrder],
    [filterValues, page, sortBy, sortOrder]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilterValues((current) => (current.invoiceNumber === searchInput ? current : { ...current, invoiceNumber: searchInput }));
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [filterValues]);

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
    const status = (urlSearchParams.get('status') || '').trim();

    if (urlSearchParams.get('purchaseOrderId')) {
      return;
    }

    if (!invoice && !store && !status) {
      return;
    }

    const nextFilters = {
      storeNames: store ? [store] : [],
      invoiceNumber: invoice,
      statusNames: status ? [status] : [],
      purchaseDateStart: '',
      purchaseDateEnd: '',
    };

    setFilterValues(nextFilters);
    setSearchInput(invoice);
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

        setEditedOrder({
          InvoiceNumber: order.InvoiceNumber,
          StoreName: order.StoreName,
          PurchaseDate: order.PurchaseDate,
          StatusName: order.StatusName || '',
        });
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
        ...filterValues,
        page,
        pageSize: 10,
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
      setEditedOrder({
        InvoiceNumber: variables.InvoiceNumber,
        StoreName: variables.StoreName,
        PurchaseDate: variables.PurchasedDate,
        StatusName: variables.StatusName,
      });

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
      handleCloseModal();
      toast({
        title: 'Order Saved',
        description: `Saved invoice ${variables.InvoiceNumber} for ${variables.StoreName}.`,
        variant: 'success',
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
      const deletedInvoice = selectedOrder?.InvoiceNumber;
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setIsConfirmDeleteOpen(false);
      handleCloseModal();
      toast({
        title: 'Order Deleted',
        description: deletedInvoice
          ? `Deleted invoice ${deletedInvoice} and all associated detail rows.`
          : 'Deleted selected order and all associated detail rows.',
        variant: 'success',
      });
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

      if (selectedOrderIds.length < 1) throw new Error('Select at least 1 order to delete.');

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
      const deletedCount = selectedOrderIds.length;
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setSelectedOrderIds([]);
      setIsBulkDeleteOpen(false);
      setBulkDeleteError(null);
      setBulkDeleteConfirmText('');
      toast({
        title: deletedCount === 1 ? 'Order Deleted' : 'Orders Deleted',
        description:
          deletedCount === 1
            ? 'Deleted 1 selected order and its detail rows.'
            : `Deleted ${deletedCount} selected orders and their detail rows.`,
        variant: 'success',
      });
    },
    onError: (error: any) => {
      setBulkDeleteError(error.response?.data?.error || error.message || 'Failed to delete selected orders');
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (payload: { orderIds: number[]; updates: Record<string, any> }) => {
      if (payload.orderIds.length < 1) {
        throw new Error('Select at least 1 order to update.');
      }

      await Promise.all(
        payload.orderIds.map(async (orderId) => {
          await tablesAPI.updateRecord('PurchaseOrder', orderId, payload.updates);
        })
      );
    },
    onSuccess: () => {
      const updatedCount = selectedOrderIds.length;
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setSelectedOrderIds([]);
      closeBulkUpdateDialog();
      toast({
        title: updatedCount === 1 ? 'Order Updated' : 'Orders Updated',
        description:
          updatedCount === 1
            ? 'Applied bulk updates to 1 selected order.'
            : `Applied bulk updates to ${updatedCount} selected orders.`,
        variant: 'success',
      });
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
      const detailCount = addOrderDetails.length;
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

      toast({
        title: 'Order Created',
        description:
          detailCount === 1
            ? `Created order #${newOrderId} with 1 detail row.`
            : `Created order #${newOrderId} with ${detailCount} detail rows.`,
        variant: 'success',
      });
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
      toast({
        title: 'Order Detail Updated',
        description: 'Saved changes to the selected purchase-order detail row.',
        variant: 'success',
      });
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
      toast({
        title: 'Order Detail Deleted',
        description: 'Removed the selected purchase-order detail row.',
        variant: 'success',
      });
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
      toast({
        title: 'Order Detail Added',
        description: 'Added a new purchase-order detail row to the current order.',
        variant: 'success',
      });
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.error || error.message || 'Failed to add inventory item row';
      setUpdateError(errorMsg);
    },
  });

  const handleOrderRowClick = (order: PurchaseOrder) => {
    setPendingOrderNavigation(null);
    setEditedOrder({
      InvoiceNumber: order.InvoiceNumber,
      StoreName: order.StoreName,
      PurchaseDate: order.PurchaseDate,
      StatusName: order.StatusName || '',
    });
    setSelectedOrder(order);
    setUpdateError(null);
    setDeleteError(null);
    setIsConfirmDeleteOpen(false);
    setIsEditInvoiceUnlocked(false);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setPendingOrderNavigation(null);
    setIsModalOpen(false);
    setSelectedOrder(null);
    setEditedOrder(null);
    setUpdateError(null);
    setDeleteError(null);
    setIsConfirmDeleteOpen(false);
    setEditingDetailId(null);
    setEditingDetailDraft(null);
    setNewDetailDraft(null);
    setIsEditInvoiceUnlocked(false);
  };

  const isOrderEditDirty = useMemo(() => {
    if (!selectedOrder || !editedOrder) {
      return false;
    }

    return (
      editedOrder.InvoiceNumber !== selectedOrder.InvoiceNumber
      || editedOrder.StoreName !== selectedOrder.StoreName
      || editedOrder.PurchaseDate !== selectedOrder.PurchaseDate
      || editedOrder.StatusName !== (selectedOrder.StatusName || '')
    );
  }, [selectedOrder, editedOrder]);

  const requestCloseModal = () => {
    if (isOrderEditDirty) {
      const confirmed = window.confirm('Changes have not been applied. Close without saving?');
      if (!confirmed) {
        return;
      }
    }

    handleCloseModal();
  };

  const currentPageOrders: PurchaseOrder[] = Array.isArray(data?.data) ? data.data : [];
  const currentEditOrderIndex = useMemo(() => {
    if (!selectedOrder) {
      return -1;
    }

    return currentPageOrders.findIndex((order) => order.PurchaseOrderID === selectedOrder.PurchaseOrderID);
  }, [currentPageOrders, selectedOrder]);
  const orderTotalPages = data?.totalPages ?? 1;
  const canNavigateToPreviousOrder = Boolean(
    selectedOrder && (currentEditOrderIndex > 0 || page > 1)
  );
  const canNavigateToNextOrder = Boolean(
    selectedOrder && ((currentEditOrderIndex >= 0 && currentEditOrderIndex < currentPageOrders.length - 1) || page < orderTotalPages)
  );

  const handleNavigateOrder = (direction: 'previous' | 'next') => {
    if (!selectedOrder) {
      return;
    }

    if (isOrderEditDirty) {
      const confirmed = window.confirm('Changes have not been applied. Move to another order without saving?');
      if (!confirmed) {
        return;
      }
    }

    if (direction === 'previous') {
      if (currentEditOrderIndex > 0) {
        handleOrderRowClick(currentPageOrders[currentEditOrderIndex - 1]);
        return;
      }

      if (page > 1) {
        setPendingOrderNavigation({ direction: 'previous', targetPage: page - 1 });
        setPage((current) => Math.max(1, current - 1));
      }
      return;
    }

    if (currentEditOrderIndex >= 0 && currentEditOrderIndex < currentPageOrders.length - 1) {
      handleOrderRowClick(currentPageOrders[currentEditOrderIndex + 1]);
      return;
    }

    if (page < orderTotalPages) {
      setPendingOrderNavigation({ direction: 'next', targetPage: page + 1 });
      setPage((current) => current + 1);
    }
  };

  useEffect(() => {
    if (!selectedOrder || !pendingOrderNavigation || !currentPageOrders.length) {
      return;
    }

    if ((data?.page ?? 0) !== pendingOrderNavigation.targetPage) {
      return;
    }

    if (pendingOrderNavigation.direction === 'previous') {
      handleOrderRowClick(currentPageOrders[currentPageOrders.length - 1]);
      return;
    }

    handleOrderRowClick(currentPageOrders[0]);
  }, [selectedOrder, pendingOrderNavigation, currentPageOrders, data?.page]);

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

  const handleChipFiltersChange = (patch: Partial<typeof filterValues>) => {
    setDownloadError(null);
    setFilterValues((current) => ({ ...current, ...patch }));
  };

  const clearAllChipFilters = () => {
    handleChipFiltersChange({
      storeNames: [],
      statusNames: [],
      purchaseDateStart: '',
      purchaseDateEnd: '',
    });
  };

  const filterChipFields: FilterChipField[] = [
    {
      key: 'store',
      label: 'Store',
      kind: 'multi',
      options: storeOptions,
      selected: filterValues.storeNames,
      onAdd: (value) => handleChipFiltersChange({ storeNames: [...filterValues.storeNames, value] }),
      onRemove: (value) => handleChipFiltersChange({ storeNames: filterValues.storeNames.filter((v) => v !== value) }),
    },
    {
      key: 'status',
      label: 'Order Status',
      kind: 'multi',
      options: statusOptions,
      selected: filterValues.statusNames,
      onAdd: (value) => handleChipFiltersChange({ statusNames: [...filterValues.statusNames, value] }),
      onRemove: (value) => handleChipFiltersChange({ statusNames: filterValues.statusNames.filter((v) => v !== value) }),
    },
    {
      key: 'purchaseDate',
      label: 'Purchase Date',
      kind: 'dateRange',
      from: filterValues.purchaseDateStart,
      to: filterValues.purchaseDateEnd,
      onApply: (from, to) => handleChipFiltersChange({ purchaseDateStart: from, purchaseDateEnd: to }),
      onClear: () => handleChipFiltersChange({ purchaseDateStart: '', purchaseDateEnd: '' }),
    },
  ];

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
      return <span className="ml-1 text-[var(--arcane-ink-soft)]">↕</span>;
    }
    return <span className="ml-1">{sortOrder === 'ASC' ? '↑' : '↓'}</span>;
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
          ...filterValues,
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
    if (selectedOrderIds.length < 1) {
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
    if (selectedOrderIds.length < 1) {
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

  const selectCurrentPageOrders = () => {
    if (!data?.data?.length) {
      setSelectedOrderIds([]);
      return;
    }

    setSelectedOrderIds(data.data.map((order: PurchaseOrder) => order.PurchaseOrderID));
  };

  const selectAllFilteredOrders = async () => {
    const allIds: number[] = [];
    let nextPage = 1;
    let totalPages = 1;

    while (nextPage <= totalPages) {
      const response = await tablesAPI.getPurchaseOrders({
        ...filterValues,
        page: nextPage,
        pageSize: 100,
        sortBy,
        sortOrder,
      });

      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      rows.forEach((order: PurchaseOrder) => allIds.push(order.PurchaseOrderID));
      totalPages = Number(response.data?.totalPages || 1);
      nextPage += 1;
    }

    setSelectedOrderIds(allIds);
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
    <AdminLayout
      title={
        <span className="inline-flex items-center gap-2">
          <span>Order Master</span>
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--arcane-ink-soft)] hover:text-[var(--arcane-ink-900)]"
            title="Use this screen to view, add, remove and modify the purchase orders associated with your collection."
            aria-label="Order Master page information"
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
            {selectedOrderIds.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--arcane-gold-500-border)] bg-[var(--arcane-gold-soft)] px-4 py-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-semibold text-[var(--arcane-gold-700)]">{selectedOrderIds.length} selected</span>
                  <button
                    type="button"
                    className="text-[var(--arcane-gold-700)] hover:text-[var(--arcane-gold-700)] underline underline-offset-2"
                    onClick={() => setSelectedOrderIds([])}
                    tabIndex={2}
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {selectedOrderIds.length > 1 ? (
                    <Button
                      type="button"
                      className="border border-[var(--arcane-border-light)] !bg-[var(--arcane-paper-raised)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-paper)]"
                      onClick={openBulkUpdateDialog}
                      disabled={!canWrite}
                      title={canWrite ? undefined : 'Switch to Update mode to edit orders'}
                      tabIndex={3}
                    >
                      Bulk Update
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    className="border border-red-300 !bg-[var(--arcane-paper-raised)] !text-red-700 hover:!bg-red-50"
                    onClick={openBulkDeleteDialog}
                    disabled={!canWrite}
                    title={canWrite ? undefined : 'Switch to Update mode to delete orders'}
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
                    clearAriaLabel="Clear invoice search"
                    placeholder="Search by invoice number..."
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
                    className="border border-[var(--arcane-border-light)] !bg-[var(--arcane-paper-raised)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-paper)]"
                    onClick={handleDownloadCsv}
                    disabled={isDownloading}
                    tabIndex={5}
                  >
                    Download
                  </Button>
                  <Button
                    type="button"
                    className="!bg-[var(--arcane-gold-500)] !text-[var(--arcane-ink-950)] hover:!bg-[var(--arcane-gold-300)]"
                    onClick={openAddOrder}
                    disabled={!canWrite}
                    title={canWrite ? undefined : 'Switch to Update mode to add orders'}
                    tabIndex={6}
                  >
                    Add Order
                  </Button>
                </div>
              </div>
            )}
            {downloadError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{downloadError}</div>
            ) : null}
          </div>
        </section>

        <section className="bg-[var(--arcane-paper-raised)] shadow rounded-lg p-6">
          {isLoading && <p className="text-[var(--arcane-ink-soft)]">Loading purchase orders...</p>}
          {error && <p className="text-red-600">Error loading purchase orders.</p>}

          {!isLoading && !error && (
            <>
              <div className="h-[608px] overflow-hidden">
                <Table className="table-fixed [&_th]:overflow-hidden [&_th_button]:overflow-hidden [&_th_button]:whitespace-nowrap [&_tbody_tr]:h-14 [&_tbody_td]:overflow-hidden [&_tbody_td]:text-ellipsis [&_tbody_td]:whitespace-nowrap">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[4%]">
                        <SelectionScopeMenu
                          checked={data?.data?.length ? data.data.every((order: PurchaseOrder) => selectedOrderIds.includes(order.PurchaseOrderID)) : false}
                          disabled={!data?.data?.length}
                          aria-label="Select orders"
                          onSelectPage={selectCurrentPageOrders}
                          onSelectAll={() => {
                            void selectAllFilteredOrders();
                          }}
                        />
                      </TableHead>
                      <TableHead className="w-[15%]">
                        <button onClick={() => handleSort('PurchaseDate')} className="flex items-center hover:text-[var(--arcane-gold-700)]" tabIndex={11}>
                          Purchase Date <SortIndicator column="PurchaseDate" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[20%]">
                        <button onClick={() => handleSort('InvoiceNumber')} className="flex items-center hover:text-[var(--arcane-gold-700)]" tabIndex={12}>
                          Invoice Number <SortIndicator column="InvoiceNumber" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[25%]">
                        <button onClick={() => handleSort('StoreName')} className="flex items-center hover:text-[var(--arcane-gold-700)]" tabIndex={13}>
                          Store Name <SortIndicator column="StoreName" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[16%]">
                        <button onClick={() => handleSort('StatusName')} className="flex items-center hover:text-[var(--arcane-gold-700)]" tabIndex={14}>
                          Order Status <SortIndicator column="StatusName" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[9%] text-right">
                        <button onClick={() => handleSort('ItemCount')} className="flex items-center justify-end hover:text-[var(--arcane-gold-700)] w-full" tabIndex={15}>
                          Item Count <SortIndicator column="ItemCount" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[11%] text-right">
                        <button onClick={() => handleSort('TotalAmount')} className="flex items-center justify-end hover:text-[var(--arcane-gold-700)] w-full" tabIndex={16}>
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
                          className={`hover:bg-[var(--arcane-paper)] cursor-pointer ${selectedOrderIds.includes(order.PurchaseOrderID) ? 'bg-[var(--arcane-gold-soft)]' : ''}`}
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
                        <TableCell colSpan={6} className="text-center py-10 text-[var(--arcane-ink-soft)]">
                          No matching orders found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <MasterTablePagination
                currentCount={data?.data?.length ?? 0}
                total={data?.total ?? 0}
                page={data?.page ?? page}
                totalPages={data?.totalPages ?? 1}
                onPageChange={setPage}
                tabIndexStart={17}
              />
            </>
          )}
        </section>
      </div>

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
        description={`You are about to permanently delete ${selectedOrderIds.length} selected purchase orders and their associated detail rows. This action cannot be undone.`}
        footer={(
          <>
            <Button type="button" className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white" onClick={closeBulkDeleteDialog} disabled={bulkDeleteMutation.isPending}>
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
                setBulkDeleteError(null);
                setBulkDeleteConfirmText(event.target.value);
              }}
              placeholder="DELETE"
              disabled={bulkDeleteMutation.isPending}
            />
          </div>
        </div>
      </AlertDialog>

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
                  <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Invoice Number</label>
                  <Input
                    value={bulkValues.InvoiceNumber}
                    onChange={(event) => handleBulkFieldChange('InvoiceNumber', event.target.value)}
                    placeholder="Leave unchanged"
                    autoComplete="off"
                    spellCheck={false}
                    data-lpignore="true"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Store</label>
                  <ComboSelect
                    options={storesData.map((store: any) => ({ value: String(store.StoreID), label: store.StoreName }))}
                    value={bulkValues.StoreID}
                    onChange={(value) => handleBulkFieldChange('StoreID', value)}
                    placeholder="Leave unchanged"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Order Status</label>
                  <ComboSelect
                    options={statusesData.map((status: any) => ({ value: String(status.StatusID), label: status.StatusName }))}
                    value={bulkValues.StatusID}
                    onChange={(value) => handleBulkFieldChange('StatusID', value)}
                    placeholder="Leave unchanged"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Purchase Date</label>
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
                  className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white"
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
              <div className="rounded-lg border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-4 text-sm text-[var(--arcane-ink-900)]">
                You are about to update {selectedOrderIds.length} purchase order{selectedOrderIds.length === 1 ? '' : 's'}.
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
                    <div className="text-[var(--arcane-ink-soft)]">No fields selected for update.</div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  className="bg-[var(--arcane-border-light)] text-[var(--arcane-ink-900)] hover:bg-[var(--arcane-border-light)]"
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
        onOpenChange={(open) => {
          if (open) {
            setIsModalOpen(true);
            return;
          }

          requestCloseModal();
        }}
        title="Edit Order Detail"
        onClose={requestCloseModal}
        showCloseButton={false}
        contentClassName="max-w-6xl h-[min(760px,90vh)] overflow-hidden flex flex-col [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          editOrderInvoiceInputRef.current?.focus();
        }}
      >
        {selectedOrder && (
          <div className="flex h-full min-h-0 flex-col gap-6">
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                className="h-9 !bg-[var(--arcane-border-light)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-border-light)]"
                onClick={() => handleNavigateOrder('previous')}
                disabled={!canNavigateToPreviousOrder || updateMutation.isPending || deleteOrderMutation.isPending}
                aria-label="Previous order"
                title="Previous order"
              >
                Prev
              </Button>
              <Button
                type="button"
                className="h-9 !bg-[var(--arcane-border-light)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-border-light)]"
                onClick={() => handleNavigateOrder('next')}
                disabled={!canNavigateToNextOrder || updateMutation.isPending || deleteOrderMutation.isPending}
                aria-label="Next order"
                title="Next order"
              >
                Next
              </Button>
            </div>

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
            <div className="grid gap-4 pb-4 border-b grid-cols-1 md:grid-cols-4">
              {/* Invoice Number */}
              <div>
                <p className="text-sm text-[var(--arcane-ink-soft)]">Invoice Number</p>
                <Input
                  ref={editOrderInvoiceInputRef}
                  type="text"
                  id="order-reference"
                  name="orderReference"
                  value={editedOrder?.InvoiceNumber || ''}
                  onChange={(e) => handleEditFieldChange('InvoiceNumber', e.target.value)}
                  onFocus={() => setIsEditInvoiceUnlocked(true)}
                  className="mt-1"
                  autoComplete="new-password"
                  readOnly={!isEditInvoiceUnlocked}
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                />
              </div>

              {/* Store */}
              <div>
                <p className="text-sm text-[var(--arcane-ink-soft)]">Store</p>
                <ComboSelect
                  options={storesData.map((store: any) => ({ value: store.StoreName, label: store.StoreName }))}
                  value={editedOrder?.StoreName || ''}
                  onChange={(value) => handleEditFieldChange('StoreName', value)}
                  placeholder="Select a store..."
                  className="w-full mt-1"
                />
              </div>

              {/* Purchase Date */}
              <div>
                <p className="text-sm text-[var(--arcane-ink-soft)]">Purchase Date</p>
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
              </div>

              {/* Order Status */}
              <div>
                <p className="text-sm text-[var(--arcane-ink-soft)]">Order Status</p>
                <ComboSelect
                  options={statusesData.map((status: any) => ({ value: status.StatusName, label: status.StatusName }))}
                  value={editedOrder?.StatusName || ''}
                  onChange={(value) => handleEditFieldChange('StatusName', value)}
                  placeholder="Select a status..."
                  className="w-full mt-1"
                />
              </div>

            </div>

            <AlertDialog
              open={isConfirmDeleteOpen}
              onOpenChange={setIsConfirmDeleteOpen}
              title={`Delete order #${selectedOrder.InvoiceNumber} from ${selectedOrder.StoreName}?`}
              description={`This will permanently remove the purchase order and all ${selectedOrder.ItemCount} associated detail${selectedOrder.ItemCount === 1 ? ' row' : ' rows'}. This action cannot be undone.`}
              footer={(
                <>
                  <Button
                    type="button"
                    className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white"
                    onClick={() => setIsConfirmDeleteOpen(false)}
                    disabled={deleteOrderMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => deleteOrderMutation.mutate()}
                    disabled={deleteOrderMutation.isPending}
                  >
                    {deleteOrderMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
                  </Button>
                </>
              )}
            />

            {/* Inventory Items Grid */}
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--arcane-ink-900)]">Inventory Items</h3>
                <Button
                  type="button"
                  onClick={addNewDetailRow}
                  className="bg-[var(--arcane-success)] hover:bg-[var(--arcane-success-hover)] text-white"
                  disabled={!!newDetailDraft || addDetailMutation.isPending}
                >
                  Add Item
                </Button>
              </div>
              {inventoryLoading ? (
                <p className="text-[var(--arcane-ink-soft)]">Loading inventory items...</p>
              ) : (
                <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden rounded-lg border border-[var(--arcane-border-light)]">
                  <div className="flex h-full min-w-[960px] flex-col">
                    <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] [&>div]:overflow-visible">
                  <Table className="table-fixed">
                    <colgroup>
                      <col className="w-[34%]" />
                      <col className="w-[14%]" />
                      <col className="w-[12%]" />
                      <col className="w-[12%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                    </colgroup>
                    <TableHeader className="sticky top-0 z-10">
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
                        <TableRow className="bg-[var(--arcane-success-soft)]">
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
                                className="bg-[var(--arcane-success)] hover:bg-[var(--arcane-success-hover)] text-white"
                                onClick={saveNewDetailRow}
                                disabled={addDetailMutation.isPending}
                              >
                                {addDetailMutation.isPending ? 'Saving...' : 'Save'}
                              </Button>
                              <Button
                                className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white"
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
                                        className="bg-[var(--arcane-success)] hover:bg-[var(--arcane-success-hover)] text-white"
                                        onClick={saveEditDetail}
                                        disabled={updateDetailMutation.isPending}
                                      >
                                        {updateDetailMutation.isPending ? 'Saving...' : 'Save'}
                                      </Button>
                                      <Button
                                        className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white"
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
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--arcane-gold-500-border)] text-[var(--arcane-gold-700)] hover:bg-[var(--arcane-gold-soft)] disabled:opacity-50"
                                        title={canWrite ? 'Edit row' : 'Switch to Update mode to edit rows'}
                                        disabled={!canWrite || !!editingDetailId || updateDetailMutation.isPending || addDetailMutation.isPending}
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => { setDeleteError(null); deleteDetailMutation.mutate(item.PurchaseOrderDetailID); }}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                                        title={canWrite ? 'Delete row' : 'Switch to Update mode to delete rows'}
                                        disabled={!canWrite || deleteDetailMutation.isPending || updateDetailMutation.isPending || addDetailMutation.isPending}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          ))}
                        </>
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-10 text-[var(--arcane-ink-soft)]">
                            No inventory items found for this order.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                    </div>
                    <div className="shrink-0 overflow-y-auto border-t-2 border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] [scrollbar-gutter:stable] [&>div]:overflow-visible">
                      <Table className="table-fixed">
                        <colgroup>
                          <col className="w-[34%]" />
                          <col className="w-[14%]" />
                          <col className="w-[12%]" />
                          <col className="w-[12%]" />
                          <col className="w-[14%]" />
                          <col className="w-[14%]" />
                        </colgroup>
                        <TableBody>
                          <TableRow className="bg-[var(--arcane-paper-raised)] font-semibold hover:bg-[var(--arcane-paper-raised)]">
                            <TableCell colSpan={4} className="text-right">Total:</TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(
                                (inventoryData?.data || []).reduce((sum: number, item: InventoryItem) => sum + item.LineTotal, 0)
                              )}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700 sm:mr-auto"
                onClick={() => {
                  setDeleteError(null);
                  setIsConfirmDeleteOpen(true);
                }}
                disabled={!canWrite || deleteOrderMutation.isPending || updateMutation.isPending}
                title={canWrite ? undefined : 'Switch to Update mode to delete orders'}
              >
                Delete Order
              </Button>
              <Button
                type="button"
                className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white"
                onClick={requestCloseModal}
                disabled={deleteOrderMutation.isPending || updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveEdit}
                disabled={!canWrite || !isOrderEditDirty || updateMutation.isPending || deleteOrderMutation.isPending}
                title={canWrite ? undefined : 'Switch to Update mode to save changes'}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
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
              <span className="text-sm text-[var(--arcane-ink-soft)]">Invoice Number</span>
              <Input
                type="text"
                value={addOrderValues.InvoiceNumber}
                onChange={(e) => handleAddOrderFieldChange('InvoiceNumber', e.target.value)}
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
                value={addOrderValues.StoreID}
                onChange={(value) => handleAddOrderFieldChange('StoreID', value)}
                placeholder="Select a store..."
                className="w-full"
              />
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Order Status</span>
              <ComboSelect
                options={statusesData.map((status: any) => ({ value: String(status.StatusID), label: status.StatusName }))}
                value={addOrderValues.StatusID}
                onChange={(value) => handleAddOrderFieldChange('StatusID', value)}
                placeholder="Select a status..."
                className="w-full"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-[var(--arcane-ink-soft)]">Purchase Date</span>
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
              <Button className="bg-[var(--arcane-success)] hover:bg-[var(--arcane-success-hover)] text-white" onClick={handleAddDetailRow}>
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
                  <TableRow className="bg-[var(--arcane-paper)] font-semibold">
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
            <Button className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white" onClick={closeAddOrderModal} disabled={addOrderMutation.isPending}>
              Cancel
            </Button>
            <Button
              className="bg-[var(--arcane-success)] hover:bg-[var(--arcane-success-hover)] text-white"
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
