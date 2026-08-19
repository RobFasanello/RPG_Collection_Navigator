import { Router } from 'express';
import {
  getRecordHistory,
  getRecentActivity,
  getAuditLogEntries,
  requireUndoPermission,
  undoAuditEntry,
} from '../controllers/auditController.js';

const router = Router();

// Paginated, sortable audit log listing
router.get('/log', getAuditLogEntries);

// Recent activity feed
router.get('/recent', getRecentActivity);

// History for one record
router.get('/', getRecordHistory);

// Undo one audit entry
router.post('/:auditLogId/undo', requireUndoPermission, undoAuditEntry);

export default router;
