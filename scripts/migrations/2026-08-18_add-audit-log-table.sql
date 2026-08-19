/*
  Add dbo.AuditLog table to record every INSERT/UPDATE/DELETE (and undo)
  made through the generic table CRUD chokepoints, for history display and undo.
*/

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.AuditLog', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.AuditLog (
    AuditLogID        BIGINT IDENTITY(1,1) NOT NULL,
    TableName         NVARCHAR(128)  NOT NULL,
    RecordID          NVARCHAR(400)  NOT NULL,
    Action            NVARCHAR(10)   NOT NULL,
    UserEmail         NVARCHAR(255)  NOT NULL,
    UserName          NVARCHAR(255)  NULL,
    ChangedAt         DATETIME2      NOT NULL CONSTRAINT DF_AuditLog_ChangedAt DEFAULT (SYSUTCDATETIME()),
    OldValues         NVARCHAR(MAX)  NULL,
    NewValues         NVARCHAR(MAX)  NULL,
    UndoOfAuditLogID  BIGINT         NULL,
    IsUndone          BIT            NOT NULL CONSTRAINT DF_AuditLog_IsUndone DEFAULT (0),
    CONSTRAINT PK_AuditLog PRIMARY KEY (AuditLogID),
    CONSTRAINT CK_AuditLog_Action CHECK (Action IN ('INSERT', 'UPDATE', 'DELETE')),
    CONSTRAINT FK_AuditLog_UndoOf FOREIGN KEY (UndoOfAuditLogID) REFERENCES dbo.AuditLog(AuditLogID)
  );

  -- "History for record X of table Y", newest first
  CREATE INDEX IX_AuditLog_Table_Record ON dbo.AuditLog (TableName, RecordID, AuditLogID DESC);

  -- "Recent activity" feed
  CREATE INDEX IX_AuditLog_ChangedAt ON dbo.AuditLog (ChangedAt DESC);
END;

COMMIT TRANSACTION;

SELECT OBJECT_ID('dbo.AuditLog', 'U') AS AuditLogObjectId;
