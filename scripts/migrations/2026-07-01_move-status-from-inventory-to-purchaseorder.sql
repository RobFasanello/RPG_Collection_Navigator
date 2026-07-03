/*
  Move status ownership from Inventory to PurchaseOrder.
  Backfill rule: when a purchase order has multiple inventory statuses,
  use the highest StatusID.
*/

SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- 1) Add StatusID to PurchaseOrder if missing.
IF COL_LENGTH('dbo.PurchaseOrder', 'StatusID') IS NULL
BEGIN
  ALTER TABLE [dbo].[PurchaseOrder]
    ADD [StatusID] TINYINT NULL;
END;

-- Ensure PurchaseOrder.StatusID type matches Status.StatusID (tinyint in current schema).
IF EXISTS (
  SELECT 1
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbo'
    AND TABLE_NAME = 'PurchaseOrder'
    AND COLUMN_NAME = 'StatusID'
    AND DATA_TYPE <> 'tinyint'
)
BEGIN
  EXEC sys.sp_executesql N'
    ALTER TABLE [dbo].[PurchaseOrder]
      ALTER COLUMN [StatusID] TINYINT NULL;
  ';
END;

-- 2) Add FK from PurchaseOrder.StatusID -> Status.StatusID if missing.
IF NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = 'FK_PurchaseOrder_Status'
    AND parent_object_id = OBJECT_ID('dbo.PurchaseOrder')
)
BEGIN
  EXEC sys.sp_executesql N'
    ALTER TABLE [dbo].[PurchaseOrder]
      WITH CHECK ADD CONSTRAINT [FK_PurchaseOrder_Status]
      FOREIGN KEY ([StatusID]) REFERENCES [dbo].[Status]([StatusID]);
  ';
END;

-- 3) Add index for status filtering if missing.
IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_PurchaseOrder_StatusID'
    AND object_id = OBJECT_ID('dbo.PurchaseOrder')
)
BEGIN
  EXEC sys.sp_executesql N'
    CREATE INDEX [IX_PurchaseOrder_StatusID]
      ON [dbo].[PurchaseOrder]([StatusID]);
  ';
END;

-- 4) Backfill PurchaseOrder.StatusID from Inventory.StatusID using highest value per PurchaseOrder.
IF COL_LENGTH('dbo.Inventory', 'StatusID') IS NOT NULL
BEGIN
  EXEC sys.sp_executesql N'
    WITH Backfill AS (
      SELECT
        [Inventory].[PurchaseOrderID],
        MAX([Inventory].[StatusID]) AS [StatusID]
      FROM [dbo].[Inventory] AS [Inventory]
      WHERE [Inventory].[StatusID] IS NOT NULL
        AND [Inventory].[PurchaseOrderID] IS NOT NULL
      GROUP BY [Inventory].[PurchaseOrderID]
    )
    UPDATE [PurchaseOrder]
    SET [PurchaseOrder].[StatusID] = [Backfill].[StatusID]
    FROM [dbo].[PurchaseOrder] AS [PurchaseOrder]
    INNER JOIN [Backfill] ON [Backfill].[PurchaseOrderID] = [PurchaseOrder].[PurchaseOrderID]
    WHERE [PurchaseOrder].[StatusID] IS NULL;
  ';
END;

-- 5) Drop FK(s) that reference Inventory.StatusID.
IF COL_LENGTH('dbo.Inventory', 'StatusID') IS NOT NULL
BEGIN
  DECLARE @dropSql NVARCHAR(MAX) = N'';

  SELECT @dropSql = @dropSql +
    N'ALTER TABLE [dbo].[Inventory] DROP CONSTRAINT [' + fk.name + N'];' + CHAR(10)
  FROM sys.foreign_keys fk
  INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
  INNER JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID('dbo.Inventory')
    AND c.name = 'StatusID';

  IF LEN(@dropSql) > 0
  BEGIN
    EXEC sys.sp_executesql @dropSql;
  END;

  ALTER TABLE [dbo].[Inventory]
    DROP COLUMN [StatusID];
END;

COMMIT TRANSACTION;

-- Post-migration validation helpers:
-- SELECT TOP 100 [PurchaseOrderID], [StatusID] FROM [dbo].[PurchaseOrder] ORDER BY [PurchaseOrderID];
-- SELECT COL_LENGTH('dbo.Inventory', 'StatusID') AS InventoryStatusColumnShouldBeNull;
