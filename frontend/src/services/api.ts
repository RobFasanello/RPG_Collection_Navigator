import axios from 'axios';

const API_BASE = '/api';

export const api = axios.create({
  baseURL: API_BASE,
});

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

  getRecord: (tableName: string, id: number | string) =>
    api.get(`/tables/${tableName}/${id}`),

  // Backwards-compatible convenience method used by UI pages
  getRecords: (tableName: string) => api.get(`/tables/${tableName}/data`),
  
  createRecord: (tableName: string, data: Record<string, any>) =>
    api.post(`/tables/${tableName}`, data),
  
  updateRecord: (tableName: string, id: number | string, data: Record<string, any>) =>
    api.patch(`/tables/${tableName}/${id}`, data),
  
  deleteRecord: (tableName: string, id: number | string) =>
    api.delete(`/tables/${tableName}/${id}`),
};

// Backwards-compatible alias used by UI pages
export const tableAPI = tablesAPI;
