import axios from 'axios';
import { APP_MODE_FORBIDDEN_EVENT, APP_MODE_UNAUTHENTICATED_EVENT } from '../state/appMode';

const API_BASE = '/api';

const parseId = (id: number | string) =>
  typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id;

export const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 403 && error?.response?.data?.requiredMode) {
      window.dispatchEvent(new CustomEvent(APP_MODE_FORBIDDEN_EVENT));
    } else if (status === 401 && !error?.config?.url?.includes('/auth/')) {
      window.dispatchEvent(new CustomEvent(APP_MODE_UNAUTHENTICATED_EVENT));
    }
    return Promise.reject(error);
  }
);

export const appAPI = {
  getBuildInfo: () => api.get('/build-info'),
};

export const authAPI = {
  getMe: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

const getAllTableData = async (tableName: string) => {
  const pageSize = 100;
  const firstResponse = await api.get(`/tables/${tableName}/data`, {
    params: { page: 1, pageSize },
  });
  const firstData = firstResponse.data;
  const rows = [...(firstData?.data || [])];
  const totalPages = Number(firstData?.totalPages || 1);

  for (let page = 2; page <= totalPages; page++) {
    const response = await api.get(`/tables/${tableName}/data`, {
      params: { page, pageSize },
    });
    rows.push(...(response.data?.data || []));
  }

  return rows;
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
  getAllRecords: getAllTableData,
  
  createRecord: (tableName: string, data: Record<string, any> | FormData) =>
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
    ItemVersion?: string;
    IsPhysical?: boolean;
    IsDigital?: boolean;
  }) => api.patch('/tables/items/bulk-update', data),

  bulkCreateItems: (data: {
    rows: Array<{
      RowNumber?: number;
      Publisher: string;
      Collection: string;
      ItemName: string;
      ItemVersion: string;
      Category: string;
      SubCategory: string;
      ProductID: string;
      ReleaseDate?: string | null;
      IsPhysical: boolean;
      IsDigital: boolean;
    }>;
  }) => api.post('/tables/items/bulk-create', data),
  
  updateRecord: (tableName: string, id: number | string, data: Record<string, any> | FormData) =>
    api.patch(`/tables/${tableName}/${parseId(id)}`, data),
  
  deleteRecord: (tableName: string, idOrKeys: number | string | Record<string, any>) =>
    typeof idOrKeys === 'object'
      ? api.delete(`/tables/${tableName}`, { params: idOrKeys })
      : api.delete(`/tables/${tableName}/${idOrKeys}`),

  globalSearch: (query: string) =>
    api.get('/tables/global-search', { params: { q: query } }),
};

// Backwards-compatible alias used by UI pages
export const tableAPI = tablesAPI;

export interface AuditLogEntry {
  AuditLogID: number;
  TableName: string;
  RecordID: string;
  Action: 'INSERT' | 'UPDATE' | 'DELETE';
  UserEmail: string;
  UserName: string | null;
  ChangedAt: string;
  OldValues: string | null;
  NewValues: string | null;
  UndoOfAuditLogID: number | null;
  IsUndone: boolean;
}

export interface AuditLogListResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuditLogFilters {
  search?: string;
  changedAtFrom?: string;
  changedAtTo?: string;
  action?: AuditLogEntry['Action'] | '';
  tableName?: string;
  recordId?: string;
  user?: string;
  isUndone?: boolean;
}

export type AuditLogParams = AuditLogFilters & {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
};

export const auditAPI = {
  getHistory: (tableName: string, recordId: number | string) =>
    api.get<AuditLogEntry[]>('/audit', { params: { tableName, recordId } }),

  getRecentActivity: (limit: number = 50) =>
    api.get<AuditLogEntry[]>('/audit/recent', { params: { limit } }),

  getLog: (params: AuditLogParams) =>
    api.get<AuditLogListResponse>('/audit/log', { params }),

  undo: (auditLogId: number) =>
    api.post(`/audit/${auditLogId}/undo`),
};
