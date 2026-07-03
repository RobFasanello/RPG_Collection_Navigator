import { Router } from 'express';
import {
  getAllTables,
  getTableSchema,
  getTableData,
  getInventoryItems,
  getItemsForLookup,
  getDashboardOverview,
  getPurchaseOrders,
  getPurchaseOrderDetailsByPurchaseOrder,
  getPurchaseOrdersByItem,
  getRecord,
  createRecord,
  createPurchaseOrderWithDetails,
  updateRecord,
  deleteRecord,
  deleteRecordByQuery,
} from '../controllers/tableController.js';

const router = Router();

// Get all tables
router.get('/', getAllTables);

// Get table schema
router.get('/:tableName/schema', getTableSchema);

// Inventory lookup
router.get('/inventory', getInventoryItems);

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
router.post('/purchase-order-with-details', createPurchaseOrderWithDetails);

// Get table data with pagination
router.get('/:tableName/data', getTableData);

// Get single record by ID
router.get('/:tableName/:id', getRecord);

// Create record
router.post('/:tableName', createRecord);

// Delete record by query params (supports composite-key tables)
router.delete('/:tableName', deleteRecordByQuery);

// Update record
router.patch('/:tableName/:id', updateRecord);

// Delete record
router.delete('/:tableName/:id', deleteRecord);

export default router;
