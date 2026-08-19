import sql from 'mssql';
import type { SessionUser } from '../auth/session.js';

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export type RecordKey = string | number | Record<string, number | string>;

export interface AuditEntryInput {
  tableName: string;
  recordId: RecordKey;
  action: AuditAction;
  user: SessionUser;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  undoOfAuditLogId?: number;
}

/**
 * Canonical string form of a record's key, for the AuditLog.RecordID column.
 * Composite keys are serialized with sorted property names so the same
 * logical record always produces the same string.
 */
export function buildRecordId(recordId: RecordKey): string {
  if (typeof recordId === 'string' || typeof recordId === 'number') {
    return String(recordId);
  }

  const ordered: Record<string, number | string> = {};
  Object.keys(recordId)
    .sort()
    .forEach((key) => {
      ordered[key] = recordId[key];
    });

  return JSON.stringify(ordered);
}

/**
 * Inserts one AuditLog row. `request` must be a fresh sql.Request bound to
 * the SAME transaction as the data write being audited, so both commit or
 * roll back together.
 */
export async function insertAuditRow(request: sql.Request, entry: AuditEntryInput): Promise<number> {
  request.input('auditTableName', sql.NVarChar(128), entry.tableName);
  request.input('auditRecordId', sql.NVarChar(400), buildRecordId(entry.recordId));
  request.input('auditAction', sql.NVarChar(10), entry.action);
  request.input('auditUserEmail', sql.NVarChar(255), entry.user.email);
  request.input('auditUserName', sql.NVarChar(255), entry.user.name ?? null);
  request.input('auditOldValues', sql.NVarChar(sql.MAX), entry.oldValues ? JSON.stringify(entry.oldValues) : null);
  request.input('auditNewValues', sql.NVarChar(sql.MAX), entry.newValues ? JSON.stringify(entry.newValues) : null);
  request.input('auditUndoOfId', sql.BigInt, entry.undoOfAuditLogId ?? null);

  const result = await request.query(`
    INSERT INTO [AuditLog]
      ([TableName], [RecordID], [Action], [UserEmail], [UserName], [OldValues], [NewValues], [UndoOfAuditLogID])
    OUTPUT INSERTED.[AuditLogID]
    VALUES
      (@auditTableName, @auditRecordId, @auditAction, @auditUserEmail, @auditUserName, @auditOldValues, @auditNewValues, @auditUndoOfId)
  `);

  return Number(result.recordset[0].AuditLogID);
}

/**
 * True if tableName's PK column is a real SQL Server IDENTITY column
 * (as opposed to a manually-assigned or MAX+1-generated key). Needed by
 * undo-of-delete to decide whether to wrap the re-insert in
 * SET IDENTITY_INSERT so the record comes back with its original key.
 */
export async function isIdentityPrimaryKey(
  transaction: sql.Transaction,
  tableName: string,
  pkColumn: string
): Promise<boolean> {
  const result = await new sql.Request(transaction)
    .input('tableName', sql.NVarChar, tableName)
    .input('pkColumn', sql.NVarChar, pkColumn)
    .query(`
      SELECT COLUMNPROPERTY(OBJECT_ID(TABLE_NAME), COLUMN_NAME, 'IsIdentity') as IS_IDENTITY
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName AND COLUMN_NAME = @pkColumn
    `);

  return result.recordset.length > 0 && Number(result.recordset[0].IS_IDENTITY) === 1;
}
