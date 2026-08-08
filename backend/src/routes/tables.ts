import { Router } from 'express';
import {
  getAllTables,
  getTableSchema,
  getTableData,
  getInventoryItems,
  getInventoryExportRows,
  getItemsForLookup,
  getDashboardOverview,
  getPurchaseOrders,
  getPurchaseOrderDetailsByPurchaseOrder,
  getPurchaseOrdersByItem,
  getRecord,
  createRecord,
  createPurchaseOrderWithDetails,
  bulkUpdateItemRecords,
  bulkCreateItems,
  updateRecord,
  deleteRecord,
  deleteRecordByQuery,
  globalSearch,
} from '../controllers/tableController.js';
import { uploadCollectionImageIfNeeded } from '../uploads.js';
import { requireMode } from '../permissions/appMode.js';
import { requireTableWriteMode } from '../permissions/tableAccess.js';

const router = Router();

// Get all tables
router.get('/', getAllTables);

// Get table schema
router.get('/:tableName/schema', getTableSchema);

// Inventory lookup
router.get('/inventory', getInventoryItems);

// Inventory export rows (for CSV download)
router.get('/inventory-export', getInventoryExportRows);

// Lightweight item list for dropdowns (no pagination)
router.get('/items-for-lookup', getItemsForLookup);

// Home dashboard metrics and top-10 lists
router.get('/dashboard-overview', getDashboardOverview);

// Purchase Orders lookup
router.get('/purchase-orders', getPurchaseOrders);

// Purchase order details by Purchase Order lookup
router.get('/purchase-order-details-by-purchase-order', getPurchaseOrderDetailsByPurchaseOrder);

// Purchase orders by Item lookup
router.get('/purchase-orders-by-item', getPurchaseOrdersByItem);

// Create purchase order with details in one transaction
router.post('/purchase-order-with-details', requireMode('update'), createPurchaseOrderWithDetails);

// Bulk update Item foreign-key fields
router.patch('/items/bulk-update', requireMode('update'), bulkUpdateItemRecords);

// Bulk create Item records from validated upload rows
router.post('/items/bulk-create', requireMode('update'), bulkCreateItems);

// Cross-table keyword search
router.get('/global-search', globalSearch);

// Get table data with pagination
router.get('/:tableName/data', getTableData);

// Get single record by ID
router.get('/:tableName/:id', getRecord);

// Create record
router.post('/:tableName', requireTableWriteMode, uploadCollectionImageIfNeeded, createRecord);

// Delete record by query params (supports composite-key tables)
router.delete('/:tableName', requireTableWriteMode, deleteRecordByQuery);

// Update record
router.patch('/:tableName/:id', requireTableWriteMode, uploadCollectionImageIfNeeded, updateRecord);

// Delete record
router.delete('/:tableName/:id', requireTableWriteMode, deleteRecord);

export default router;
