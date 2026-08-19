/*
  Grant rpg_app ALTER permission on the dbo schema.

  Needed by the audit-log undo feature: restoring a deleted row with its
  original identity-column value requires SET IDENTITY_INSERT, which SQL
  Server gates behind ALTER permission on the table. The app's runtime
  login previously had only CRUD (SELECT/INSERT/UPDATE/DELETE) rights.
*/

SET XACT_ABORT ON;
BEGIN TRANSACTION;

GRANT ALTER ON SCHEMA::dbo TO rpg_app;

COMMIT TRANSACTION;
