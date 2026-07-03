/*
  Fix PurchaseOrderDetail uniqueness:
  - Remove legacy unique constraint on ItemID (UQ_Inventory_Item)
  - Enforce uniqueness per order via (PurchaseOrderID, ItemID)
*/

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.PurchaseOrderDetail', 'U') IS NULL
BEGIN
  RAISERROR('dbo.PurchaseOrderDetail not found.', 16, 1);
  ROLLBACK TRANSACTION;
  RETURN;
END;

IF EXISTS (
  SELECT 1
  FROM sys.key_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.PurchaseOrderDetail')
    AND type = 'UQ'
    AND name = 'UQ_Inventory_Item'
)
BEGIN
  ALTER TABLE dbo.PurchaseOrderDetail
    DROP CONSTRAINT UQ_Inventory_Item;
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.key_constraints
  WHERE parent_object_id = OBJECT_ID('dbo.PurchaseOrderDetail')
    AND type = 'UQ'
    AND name = 'UQ_PurchaseOrderDetail_PurchaseOrderID_ItemID'
)
BEGIN
  ALTER TABLE dbo.PurchaseOrderDetail
    ADD CONSTRAINT UQ_PurchaseOrderDetail_PurchaseOrderID_ItemID
    UNIQUE (PurchaseOrderID, ItemID);
END;

COMMIT TRANSACTION;

SELECT kc.name AS ConstraintName, c.name AS ColumnName
FROM sys.key_constraints kc
JOIN sys.index_columns ic
  ON ic.object_id = kc.parent_object_id
 AND ic.index_id = kc.unique_index_id
JOIN sys.columns c
  ON c.object_id = ic.object_id
 AND c.column_id = ic.column_id
WHERE kc.parent_object_id = OBJECT_ID('dbo.PurchaseOrderDetail')
  AND kc.type IN ('UQ', 'PK')
ORDER BY kc.name, ic.key_ordinal;
