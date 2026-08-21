/*
  Defensive audit-column safeguards for Item, Miniature, and Terrain.
  - Adds default constraints for CreatedDate (UTC now) when missing.
  - Backfills null CreatedDate values when present.
  - Adds update triggers to stamp LastUpdatedDate when omitted on UPDATE.
*/

SET NOCOUNT ON;

/* ------------------------------
   Item
--------------------------------*/
IF COL_LENGTH('dbo.Item', 'CreatedDate') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
      ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.Item')
      AND c.name = 'CreatedDate'
  )
  BEGIN
    ALTER TABLE dbo.Item
      ADD CONSTRAINT DF_Item_CreatedDate DEFAULT (SYSUTCDATETIME()) FOR CreatedDate;
  END;

  UPDATE dbo.Item
  SET CreatedDate = SYSUTCDATETIME()
  WHERE CreatedDate IS NULL;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_Item_SetLastUpdatedDate_OnUpdate
ON dbo.Item
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;

  IF COL_LENGTH('dbo.Item', 'LastUpdatedDate') IS NULL
  BEGIN
    RETURN;
  END;

  UPDATE target
  SET LastUpdatedDate = SYSUTCDATETIME()
  FROM dbo.Item AS target
  INNER JOIN inserted AS i
    ON target.ItemID = i.ItemID
  WHERE i.LastUpdatedDate IS NULL;
END;
GO

/* ------------------------------
   Miniature
--------------------------------*/
IF COL_LENGTH('dbo.Miniature', 'CreatedDate') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
      ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.Miniature')
      AND c.name = 'CreatedDate'
  )
  BEGIN
    ALTER TABLE dbo.Miniature
      ADD CONSTRAINT DF_Miniature_CreatedDate DEFAULT (SYSUTCDATETIME()) FOR CreatedDate;
  END;

  UPDATE dbo.Miniature
  SET CreatedDate = SYSUTCDATETIME()
  WHERE CreatedDate IS NULL;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_Miniature_SetLastUpdatedDate_OnUpdate
ON dbo.Miniature
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;

  IF COL_LENGTH('dbo.Miniature', 'LastUpdatedDate') IS NULL
  BEGIN
    RETURN;
  END;

  UPDATE target
  SET LastUpdatedDate = SYSUTCDATETIME()
  FROM dbo.Miniature AS target
  INNER JOIN inserted AS i
    ON target.MiniatureID = i.MiniatureID
  WHERE i.LastUpdatedDate IS NULL;
END;
GO

/* ------------------------------
   Terrain
--------------------------------*/
IF COL_LENGTH('dbo.Terrain', 'CreatedDate') IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c
      ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID('dbo.Terrain')
      AND c.name = 'CreatedDate'
  )
  BEGIN
    ALTER TABLE dbo.Terrain
      ADD CONSTRAINT DF_Terrain_CreatedDate DEFAULT (SYSUTCDATETIME()) FOR CreatedDate;
  END;

  UPDATE dbo.Terrain
  SET CreatedDate = SYSUTCDATETIME()
  WHERE CreatedDate IS NULL;
END;
GO

CREATE OR ALTER TRIGGER dbo.TR_Terrain_SetLastUpdatedDate_OnUpdate
ON dbo.Terrain
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;

  IF COL_LENGTH('dbo.Terrain', 'LastUpdatedDate') IS NULL
  BEGIN
    RETURN;
  END;

  UPDATE target
  SET LastUpdatedDate = SYSUTCDATETIME()
  FROM dbo.Terrain AS target
  INNER JOIN inserted AS i
    ON target.TerrainID = i.TerrainID
  WHERE i.LastUpdatedDate IS NULL;
END;
GO
