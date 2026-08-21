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

function usesLastUpdatedStampColumns(tableName: string): boolean {
  return tableName === 'Item' || tableName === 'Miniature' || tableName === 'Terrain';
}

async function resolveAppUserId(
  connection: sql.Transaction | sql.ConnectionPool,
  email: string | undefined
): Promise<number | null> {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const request = 'begin' in connection
    ? new sql.Request(connection as sql.Transaction)
    : new sql.Request(connection as sql.ConnectionPool);

  const result = await request
    .input('email', sql.NVarChar(255), normalizedEmail)
    .query(`SELECT TOP 1 [UserID] FROM [User] WHERE LOWER([Email]) = @email`);

  const userId = result.recordset[0]?.UserID;
  return Number.isInteger(userId) ? Number(userId) : null;
}

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

const parseAuditBoolean = (value: unknown): boolean | null => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false;
  }
  return null;
};

const parseAuditAction = (value: unknown): AuditAction | null => {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized === 'INSERT' || normalized === 'UPDATE' || normalized === 'DELETE' ? normalized : null;
};

const parseAuditDate = (value: unknown): string | null => {
  const raw = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
};

const toAuditDayStart = (value: string): string => `${value}T00:00:00.0000000`;
const toAuditDayEnd = (value: string): string => `${value}T23:59:59.9999999`;

const addAuditLogFilters = (request: sql.Request, query: Request['query']): string => {
  const clauses: string[] = [];
  const changedAtFrom = parseAuditDate(query.changedAtFrom);
  const changedAtTo = parseAuditDate(query.changedAtTo);
  const action = parseAuditAction(query.action);
  const tableName = String(query.tableName ?? '').trim();
  const recordId = String(query.recordId ?? '').trim();
  const user = String(query.user ?? '').trim();
  const search = String(query.search ?? '').trim();
  const isUndone = parseAuditBoolean(query.isUndone);

  if (changedAtFrom) {
    request.input('changedAtFrom', sql.NVarChar(27), toAuditDayStart(changedAtFrom));
    clauses.push('[ChangedAt] >= CONVERT(datetime2(7), @changedAtFrom, 126)');
  }
  if (changedAtTo) {
    request.input('changedAtTo', sql.NVarChar(27), toAuditDayEnd(changedAtTo));
    clauses.push('[ChangedAt] <= CONVERT(datetime2(7), @changedAtTo, 126)');
  }
  if (action) {
    request.input('action', sql.NVarChar(10), action);
    clauses.push('[Action] = @action');
  }
  if (tableName) {
    request.input('tableNameFilter', sql.NVarChar(128), `%${tableName}%`);
    clauses.push('[TableName] LIKE @tableNameFilter');
  }
  if (recordId) {
    request.input('recordIdFilter', sql.NVarChar(400), `%${recordId}%`);
    clauses.push('[RecordID] LIKE @recordIdFilter');
  }
  if (user) {
    request.input('userFilter', sql.NVarChar(255), `%${user}%`);
    clauses.push('([UserName] LIKE @userFilter OR [UserEmail] LIKE @userFilter)');
  }
  if (search) {
    request.input('searchFilter', sql.NVarChar(sql.MAX), `%${search}%`);
    clauses.push('([RecordID] LIKE @searchFilter OR [UserName] LIKE @searchFilter OR [UserEmail] LIKE @searchFilter OR [OldValues] LIKE @searchFilter OR [NewValues] LIKE @searchFilter)');
  }
  if (isUndone !== null) {
    request.input('isUndone', sql.Bit, isUndone);
    clauses.push('[IsUndone] = @isUndone');
  }

  return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
};

export async function getAuditLogEntries(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 50);
    const offset = (page - 1) * pageSize;
    const sortBy = AUDIT_LOG_SORT_COLUMNS[req.query.sortBy as string] || 'ChangedAt';
    const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const pool = await getPool();

    const countRequest = pool.request();
    const countWhere = addAuditLogFilters(countRequest, req.query);
    const countResult = await countRequest.query(`SELECT COUNT(*) as total FROM [AuditLog] ${countWhere}`);

    const total = countResult.recordset[0].total;

    const listRequest = pool.request();
    const listWhere = addAuditLogFilters(listRequest, req.query);
    const result = await listRequest
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)
      .query(`
        SELECT [AuditLogID], [TableName], [RecordID], [Action], [UserEmail], [UserName], [ChangedAt], [OldValues], [NewValues], [UndoOfAuditLogID], [IsUndone]
        FROM [AuditLog]
        ${listWhere}
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
    const shouldStampLastUpdated = usesLastUpdatedStampColumns(tableName);
    const restoreTimestamp = new Date();
    let restoreUserId: number | null = null;

    if (shouldStampLastUpdated) {
      restoreUserId = await resolveAppUserId(transaction, req.appUser?.email);
      if (restoreUserId === null) {
        await safeRollback(transaction);
        res.status(403).json({ error: 'The signed-in user is not provisioned in the User table.' });
        return;
      }
    }

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

      const valuesToRestore = { ...oldValues };
      if (shouldStampLastUpdated) {
        valuesToRestore.LastUpdatedDate = restoreTimestamp;
        valuesToRestore.LastUpdatedUser = restoreUserId;
      }

      const cols = Object.keys(valuesToRestore);
      const identity = primaryKey ? await isIdentityPrimaryKey(transaction, tableName, primaryKey) : false;

      const request = new sql.Request(transaction);
      cols.forEach((col) => request.input(col, valuesToRestore[col]));
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

      const valuesToRestore = { ...oldValues };
      if (shouldStampLastUpdated) {
        valuesToRestore.LastUpdatedDate = restoreTimestamp;
        valuesToRestore.LastUpdatedUser = restoreUserId;
      }

      const cols = Object.keys(valuesToRestore);
      const request = new sql.Request(transaction);
      cols.forEach((col) => request.input(col, valuesToRestore[col]));
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

export async function deleteAuditEntry(req: Request, res: Response): Promise<void> {
  const auditLogId = parseInt(req.params.auditLogId, 10);
  if (!Number.isInteger(auditLogId)) {
    res.status(400).json({ error: 'Invalid audit log id.' });
    return;
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.BigInt, auditLogId)
      .query('DELETE FROM [AuditLog] OUTPUT DELETED.* WHERE [AuditLogID] = @id');

    if (result.recordset.length === 0) {
      res.status(404).json({ error: 'Audit entry not found.' });
      return;
    }

    res.json({ success: true, message: 'Audit entry deleted.' });
  } catch (error) {
    console.error('Error deleting audit entry:', error);
    res.status(500).json({ error: (error as any)?.message || 'Failed to delete audit entry.' });
  }
}

// Deletes many audit entries in a single statement (chunked) instead of one DELETE per row.
// Running N concurrent single-row deletes against the same table lets SQL Server
// acquire row/page locks in whatever order requests happen to arrive, which is a
// classic recipe for deadlocks. Sorting the ids and issuing DELETE ... WHERE IN (...)
// batches sequentially inside one transaction acquires locks in a single, consistent
// order and avoids opening many concurrent connections against the same rows.
const BULK_DELETE_CHUNK_SIZE = 1000;

export async function bulkDeleteAuditEntries(req: Request, res: Response): Promise<void> {
  const rawIds: unknown[] = Array.isArray(req.body?.auditLogIds) ? req.body.auditLogIds : [];
  const parsedIds: number[] = rawIds
    .map((value) => parseInt(String(value), 10))
    .filter((value): value is number => Number.isInteger(value));
  const auditLogIds = Array.from(new Set(parsedIds)).sort((a, b) => a - b);

  if (auditLogIds.length === 0) {
    res.status(400).json({ error: 'auditLogIds must be a non-empty array of audit log ids.' });
    return;
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    let deletedCount = 0;

    for (let offset = 0; offset < auditLogIds.length; offset += BULK_DELETE_CHUNK_SIZE) {
      const chunk = auditLogIds.slice(offset, offset + BULK_DELETE_CHUNK_SIZE);
      const request = new sql.Request(transaction);
      const idParams = chunk.map((id, index) => {
        const paramName = `id${index}`;
        request.input(paramName, sql.BigInt, id);
        return `@${paramName}`;
      });

      const result = await request.query(`
        DELETE FROM [AuditLog]
        OUTPUT DELETED.[AuditLogID]
        WHERE [AuditLogID] IN (${idParams.join(', ')})
      `);

      deletedCount += result.recordset.length;
    }

    await transaction.commit();
    res.json({ success: true, deletedCount, message: 'Audit entries deleted.' });
  } catch (error) {
    await safeRollback(transaction);
    console.error('Error bulk deleting audit entries:', error);
    res.status(500).json({ error: (error as any)?.message || 'Failed to bulk delete audit entries.' });
  }
}
