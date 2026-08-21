import { Router } from 'express';
import {
  getRecordHistory,
  getRecentActivity,
  getAuditLogEntries,
  requireUndoPermission,
  undoAuditEntry,
  deleteAuditEntry,
  bulkDeleteAuditEntries,
} from '../controllers/auditController.js';
import { requireMode } from '../permissions/appMode.js';

const router = Router();

// Paginated, sortable audit log listing
router.get('/log', getAuditLogEntries);

// Recent activity feed
router.get('/recent', getRecentActivity);

// History for one record
router.get('/', getRecordHistory);

// Undo one audit entry
router.post('/:auditLogId/undo', requireUndoPermission, undoAuditEntry);

// Permanently delete many audit entries in one request
router.post('/bulk-delete', requireMode('administrator'), bulkDeleteAuditEntries);

// Permanently delete one audit entry
router.delete('/:auditLogId', requireMode('administrator'), deleteAuditEntry);

export default router;
