/*
  Rename table dbo.Inventory -> dbo.PurchaseOrderDetail
  Rename primary key column InventoryID -> PurchaseOrderDetailID
  Keep data intact.
*/

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.PurchaseOrderDetail', 'U') IS NULL
   AND OBJECT_ID('dbo.Inventory', 'U') IS NOT NULL
BEGIN
  EXEC sp_rename 'dbo.Inventory', 'PurchaseOrderDetail';
END;

IF OBJECT_ID('dbo.PurchaseOrderDetail', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.PurchaseOrderDetail', 'PurchaseOrderDetailID') IS NULL
   AND COL_LENGTH('dbo.PurchaseOrderDetail', 'InventoryID') IS NOT NULL
BEGIN
  EXEC sp_rename 'dbo.PurchaseOrderDetail.InventoryID', 'PurchaseOrderDetailID', 'COLUMN';
END;

DECLARE @pkName SYSNAME;
SELECT @pkName = kc.name
FROM sys.key_constraints kc
WHERE kc.parent_object_id = OBJECT_ID('dbo.PurchaseOrderDetail')
  AND kc.type = 'PK';

IF @pkName IS NOT NULL AND @pkName <> 'PK_PurchaseOrderDetail'
BEGIN
  EXEC sp_rename @pkName, 'PK_PurchaseOrderDetail', 'OBJECT';
END;

IF EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Inventory_Item'
)
BEGIN
  EXEC sp_rename 'FK_Inventory_Item', 'FK_PurchaseOrderDetail_Item', 'OBJECT';
END;

IF EXISTS (
  SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Inventory_PurchaseOrder'
)
BEGIN
  EXEC sp_rename 'FK_Inventory_PurchaseOrder', 'FK_PurchaseOrderDetail_PurchaseOrder', 'OBJECT';
END;

IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.PurchaseOrderDetail')
    AND name = 'IX_Inventory_PurchaseOrderID'
)
BEGIN
  EXEC sp_rename 'dbo.PurchaseOrderDetail.IX_Inventory_PurchaseOrderID', 'IX_PurchaseOrderDetail_PurchaseOrderID', 'INDEX';
END;

COMMIT TRANSACTION;

SELECT
  OBJECT_ID('dbo.PurchaseOrderDetail', 'U') AS PurchaseOrderDetailObjectId,
  COL_LENGTH('dbo.PurchaseOrderDetail', 'PurchaseOrderDetailID') AS PurchaseOrderDetailIDLength,
  COL_LENGTH('dbo.PurchaseOrderDetail', 'InventoryID') AS LegacyInventoryIDLength;
