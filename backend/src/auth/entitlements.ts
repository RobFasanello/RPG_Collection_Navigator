import { getPool, sql } from '../db/connection.js';
import { isAppMode, type AppMode } from '../permissions/appMode.js';

function getBootstrapAdminEmails(): Set<string> {
  const raw = process.env.BOOTSTRAP_ADMIN_EMAILS?.trim() ?? '';
  const emails = raw
    ? raw.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)
    : [];
  return new Set(emails);
}

export async function resolveUserMode(email: string, name: string): Promise<AppMode | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const pool = await getPool();

  if (getBootstrapAdminEmails().has(normalizedEmail)) {
    await pool
      .request()
      .input('email', sql.NVarChar, normalizedEmail)
      .input('name', sql.NVarChar, name)
      .query(`
        MERGE dbo.[User] AS target
        USING (SELECT @email AS Email) AS source
        ON target.Email = source.Email
        WHEN MATCHED THEN
          UPDATE SET DisplayName = @name, AppMode = 'administrator', LastLoginDate = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (Email, DisplayName, AppMode, LastLoginDate)
          VALUES (@email, @name, 'administrator', SYSUTCDATETIME());
      `);
    return 'administrator';
  }

  const result = await pool
    .request()
    .input('email', sql.NVarChar, normalizedEmail)
    .query('SELECT UserID, AppMode FROM dbo.[User] WHERE LOWER(Email) = @email');

  const row = result.recordset[0];
  if (!row || !isAppMode(row.AppMode)) {
    return null;
  }

  await pool
    .request()
    .input('id', sql.Int, row.UserID)
    .input('name', sql.NVarChar, name)
    .query('UPDATE dbo.[User] SET DisplayName = @name, LastLoginDate = SYSUTCDATETIME() WHERE UserID = @id');

  return row.AppMode as AppMode;
}
