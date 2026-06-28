import { Router } from 'express';
import {
  getAllTables,
  getTableSchema,
  getTableData,
  getInventoryItems,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
} from '../controllers/tableController.js';

const router = Router();

// Get all tables
router.get('/', getAllTables);

// Get table schema
router.get('/:tableName/schema', getTableSchema);

// Inventory lookup
router.get('/inventory', getInventoryItems);

// Get table data with pagination
router.get('/:tableName/data', getTableData);

// Get single record by ID
router.get('/:tableName/:id', getRecord);

// Create record
router.post('/:tableName', createRecord);

// Update record
router.patch('/:tableName/:id', updateRecord);

// Delete record
router.delete('/:tableName/:id', deleteRecord);

export default router;
