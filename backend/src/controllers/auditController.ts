import { Request, Response, NextFunction } from 'express';
import { getPool, sql, safeRollback } from '../db/connection.js';
import { insertAuditRow, buildRecordId, isIdentityPrimaryKey, type AuditAction } from '../audit/auditLog.js';
import { getPrimaryKeyColumn } from './tableController.js';
import { requireTableWriteMode } from '../permissions/tableAccess.js';

// Tables with no single-column primary key — their AuditLog.RecordID is a
// JSON object of these column names instead of a scalar id.
const COMPOSITE_KEY_TABLES: Record<string, [string, string]> = {
  CategorySubType: ['CategoryID', 'SubTypeID'],
  PublisherCollection: ['PublisherID', 'CollectionID'],
  CollectionRPGSystem: ['CollectionID', 'RPGSystemID'],
};

export async function getRecordHistory(req: Request, res: Response): Promise<void> {
  const tableName = req.query.tableName as string;
  const recordIdParam = req.query.recordId as string;

  if (!tableName || !recordIdParam) {
    res.status(400).json({ error: 'tableName and recordId are required.' });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('tableName', sql.NVarChar(128), tableName)
      .input('recordId', sql.NVarChar(400), buildRecordId(recordIdParam))
      .query(`
        SELECT TOP 100 *
        FROM [AuditLog]
        WHERE [TableName] = @tableName AND [RecordID] = @recordId
        ORDER BY [AuditLogID] DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching record history:', error);
    res.status(500).json({ error: 'Failed to fetch record history.' });
  }
}

const AUDIT_LOG_SORT_COLUMNS: Record<string, string> = {
  AuditLogID: 'AuditLogID',
  ChangedAt: 'ChangedAt',
  TableName: 'TableName',
  RecordID: 'RecordID',
  Action: 'Action',
  UserName: 'UserName',
  UserEmail: 'UserEmail',
  IsUndone: 'IsUndone',
};

export async function getAuditLogEntries(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 50);
    const offset = (page - 1) * pageSize;
    const sortBy = AUDIT_LOG_SORT_COLUMNS[req.query.sortBy as string] || 'ChangedAt';
    const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const pool = await getPool();

    const countResult = await pool.request().query('SELECT COUNT(*) as total FROM [AuditLog]');
    const total = countResult.recordset[0].total;

    const result = await pool.request()
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)
      .query(`
        SELECT [AuditLogID], [TableName], [RecordID], [Action], [UserEmail], [UserName], [ChangedAt], [OldValues], [NewValues], [UndoOfAuditLogID], [IsUndone]
        FROM [AuditLog]
        ORDER BY [${sortBy}] ${sortOrder}, [AuditLogID] DESC
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `);

    res.json({
      data: result.recordset,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error fetching audit log entries:', error);
    res.status(500).json({ error: 'Failed to fetch audit log entries.' });
  }
}

export async function getRecentActivity(req: Request, res: Response): Promise<void> {
  const requestedLimit = parseInt(req.query.limit as string, 10);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 50;

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('limit', sql.Int, limit)
      .query('SELECT TOP (@limit) * FROM [AuditLog] ORDER BY [AuditLogID] DESC');

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity.' });
  }
}

export async function requireUndoPermission(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auditLogId = parseInt(req.params.auditLogId, 10);
  if (!Number.isInteger(auditLogId)) {
    res.status(400).json({ error: 'Invalid audit log id.' });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.BigInt, auditLogId)
      .query('SELECT [TableName] FROM [AuditLog] WHERE [AuditLogID] = @id');

    if (result.recordset.length === 0) {
      res.status(404).json({ error: 'Audit entry not found.' });
      return;
    }

    req.params.tableName = result.recordset[0].TableName;
    requireTableWriteMode(req, res, next);
  } catch (error) {
    console.error('Error checking undo permission:', error);
    res.status(500).json({ error: 'Failed to verify permission.' });
  }
}

export async function undoAuditEntry(req: Request, res: Response): Promise<void> {
  const auditLogId = parseInt(req.params.auditLogId, 10);
  if (!Number.isInteger(auditLogId)) {
    res.status(400).json({ error: 'Invalid audit log id.' });
    return;
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const targetResult = await new sql.Request(transaction)
      .input('id', sql.BigInt, auditLogId)
      .query('SELECT * FROM [AuditLog] WHERE [AuditLogID] = @id');

    if (targetResult.recordset.length === 0) {
      await safeRollback(transaction);
      res.status(404).json({ error: 'Audit entry not found.' });
      return;
    }

    const target = targetResult.recordset[0];

    if (target.IsUndone) {
      await safeRollback(transaction);
      res.status(409).json({ error: 'This change was already undone.' });
      return;
    }

    // Optimistic concurrency guard: only the newest change to a record may be undone.
    const latestResult = await new sql.Request(transaction)
      .input('tableName', sql.NVarChar(128), target.TableName)
      .input('recordId', sql.NVarChar(400), target.RecordID)
      .query(`
        SELECT TOP 1 [AuditLogID]
        FROM [AuditLog] WITH (UPDLOCK, HOLDLOCK)
        WHERE [TableName] = @tableName AND [RecordID] = @recordId
        ORDER BY [AuditLogID] DESC
      `);

    if (!latestResult.recordset.length || Number(latestResult.recordset[0].AuditLogID) !== auditLogId) {
      await safeRollback(transaction);
      res.status(409).json({
        error: 'This change has been superseded by a more recent edit and can no longer be undone.',
      });
      return;
    }

    const tableName: string = target.TableName;
    const compositeKeyColumns = COMPOSITE_KEY_TABLES[tableName] ?? null;
    const primaryKey = compositeKeyColumns ? null : getPrimaryKeyColumn(tableName);

    const keyValues: Record<string, number | string> = compositeKeyColumns
      ? JSON.parse(target.RecordID)
      : { [primaryKey as string]: /^\d+$/.test(target.RecordID) ? Number(target.RecordID) : target.RecordID };

    const whereClause = Object.keys(keyValues).map((col) => `[${col}] = @key_${col}`).join(' AND ');
    const bindKeys = (request: sql.Request) => {
      Object.entries(keyValues).forEach(([col, val]) => {
        request.input(`key_${col}`, val);
      });
    };

    const oldValues: Record<string, unknown> | null = target.OldValues ? JSON.parse(target.OldValues) : null;
    const action: AuditAction = target.Action;

    let reversedAction: AuditAction;
    let reversedOld: Record<string, unknown> | null = null;
    let reversedNew: Record<string, unknown> | null = null;

    if (action === 'INSERT') {
      const request = new sql.Request(transaction);
      bindKeys(request);
      const result = await request.query(`
        DELETE FROM [${tableName}]
        OUTPUT DELETED.*
        WHERE ${whereClause}
      `);

      if (result.recordset.length === 0) {
        await safeRollback(transaction);
        res.status(409).json({ error: 'The record no longer exists and cannot be undone.' });
        return;
      }

      reversedAction = 'DELETE';
      reversedOld = result.recordset[0];
      reversedNew = null;
    } else if (action === 'DELETE') {
      if (!oldValues) {
        await safeRollback(transaction);
        res.status(500).json({ error: 'No captured data to restore.' });
        return;
      }

      const cols = Object.keys(oldValues);
      const identity = primaryKey ? await isIdentityPrimaryKey(transaction, tableName, primaryKey) : false;

      const request = new sql.Request(transaction);
      cols.forEach((col) => request.input(col, oldValues[col]));
      const colList = cols.map((c) => `[${c}]`).join(', ');
      const valList = cols.map((c) => `@${c}`).join(', ');

      // SET IDENTITY_INSERT must be in the same batch as the INSERT it
      // applies to — issuing it as a separate query() call does not
      // reliably carry the session setting over to the next statement.
      const insertSql = `
        INSERT INTO [${tableName}] (${colList})
        OUTPUT INSERTED.*
        VALUES (${valList})
      `;
      const result = await request.query(
        identity
          ? `SET IDENTITY_INSERT [${tableName}] ON; ${insertSql} SET IDENTITY_INSERT [${tableName}] OFF;`
          : insertSql
      );

      reversedAction = 'INSERT';
      reversedOld = null;
      reversedNew = result.recordset[0];
    } else {
      if (!oldValues) {
        await safeRollback(transaction);
        res.status(500).json({ error: 'No captured data to restore.' });
        return;
      }

      const cols = Object.keys(oldValues);
      const request = new sql.Request(transaction);
      cols.forEach((col) => request.input(col, oldValues[col]));
      bindKeys(request);

      const setClause = cols.map((c) => `[${c}] = @${c}`).join(', ');
      const outputCols = cols.map((c) => `DELETED.[${c}] AS [old_${c}], INSERTED.[${c}] AS [new_${c}]`).join(', ');

      const result = await request.query(`
        UPDATE [${tableName}]
        SET ${setClause}
        OUTPUT ${outputCols}
        WHERE ${whereClause}
      `);

      if (result.recordset.length === 0) {
        await safeRollback(transaction);
        res.status(409).json({ error: 'The record no longer exists and cannot be undone.' });
        return;
      }

      const row = result.recordset[0];
      const restoredOld: Record<string, unknown> = {};
      const restoredNew: Record<string, unknown> = {};
      cols.forEach((c) => {
        restoredOld[c] = row[`old_${c}`];
        restoredNew[c] = row[`new_${c}`];
      });

      reversedAction = 'UPDATE';
      reversedOld = restoredOld;
      reversedNew = restoredNew;
    }

    await new sql.Request(transaction)
      .input('id', sql.BigInt, auditLogId)
      .query('UPDATE [AuditLog] SET [IsUndone] = 1 WHERE [AuditLogID] = @id');

    await insertAuditRow(new sql.Request(transaction), {
      tableName,
      recordId: compositeKeyColumns ? keyValues : keyValues[primaryKey as string],
      action: reversedAction,
      user: req.appUser!,
      oldValues: reversedOld,
      newValues: reversedNew,
      undoOfAuditLogId: auditLogId,
    });

    await transaction.commit();
    res.json({ success: true, message: 'Change undone.' });
  } catch (error) {
    await safeRollback(transaction);
    console.error('Error undoing audit entry:', error);
    res.status(500).json({ error: (error as any)?.message || 'Failed to undo change.' });
  }
}
