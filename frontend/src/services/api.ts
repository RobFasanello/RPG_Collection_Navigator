import axios from 'axios';

const API_BASE = '/api';

const parseId = (id: number | string) =>
  typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id;

export const api = axios.create({
  baseURL: API_BASE,
});

export const appAPI = {
  getBuildInfo: () => api.get('/build-info'),
};

// Tables API
export const tablesAPI = {
  getTables: () => api.get('/tables'),
  
  getTableSchema: (tableName: string) =>
    api.get(`/tables/${tableName}/schema`),
  
  getTableData: (tableName: string, page: number = 1, pageSize: number = 50) =>
    api.get(`/tables/${tableName}/data`, {
      params: { page, pageSize },
    }),

  getInventoryItems: (params: Record<string, any>) =>
    api.get('/tables/inventory', { params }),

  getInventoryExportRows: (params: Record<string, any>) =>
    api.get('/tables/inventory-export', { params }),

  getItemsForLookup: () =>
    api.get('/tables/items-for-lookup'),

  getDashboardOverview: (top: number = 10) =>
    api.get('/tables/dashboard-overview', { params: { top } }),

  getPurchaseOrders: (params: Record<string, any>) =>
    api.get('/tables/purchase-orders', { params }),
  getPurchaseOrderDetailsByPurchaseOrder: (purchaseOrderId: number) =>
    api.get('/tables/purchase-order-details-by-purchase-order', { params: { purchaseOrderId } }),
  // Backwards-compatible alias used by OrderMasterPage.
  getInventoryItemsByPurchaseOrder: (purchaseOrderId: number) =>
    api.get('/tables/purchase-order-details-by-purchase-order', { params: { purchaseOrderId } }),
  getPurchaseOrdersByItem: (itemId: number) =>
    api.get('/tables/purchase-orders-by-item', { params: { itemId } }),
  getRecord: (tableName: string, id: number | string) =>
    api.get(`/tables/${tableName}/${parseId(id)}`),

  // Backwards-compatible convenience method used by UI pages
  getRecords: (tableName: string) => api.get(`/tables/${tableName}/data`),
  
  createRecord: (tableName: string, data: Record<string, any>) =>
    api.post(`/tables/${tableName}`, data),

  createPurchaseOrderWithDetails: (data: {
    InvoiceNumber: string;
    StoreID: number;
    StatusID: number;
    PurchasedDate: string;
    details: Array<{ ItemID: number; Quantity: number; Price: number }>;
  }) => api.post('/tables/purchase-order-with-details', data),

  bulkUpdateItems: (data: {
    itemIds: number[];
    PublisherID?: number;
    CollectionID?: number;
    CategoryID?: number;
    SubTypeID?: number;
  }) => api.patch('/tables/items/bulk-update', data),
  
  updateRecord: (tableName: string, id: number | string, data: Record<string, any>) =>
    api.patch(`/tables/${tableName}/${parseId(id)}`, data),
  
  deleteRecord: (tableName: string, idOrKeys: number | string | Record<string, any>) =>
    typeof idOrKeys === 'object'
      ? api.delete(`/tables/${tableName}`, { params: idOrKeys })
      : api.delete(`/tables/${tableName}/${idOrKeys}`),
};

// Backwards-compatible alias used by UI pages
export const tableAPI = tablesAPI;
