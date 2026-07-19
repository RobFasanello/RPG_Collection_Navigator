IF COL_LENGTH('dbo.Miniature', 'LocationID') IS NOT NULL
   AND EXISTS (
     SELECT 1
     FROM sys.columns
     WHERE object_id = OBJECT_ID('dbo.Miniature')
       AND name = 'LocationID'
       AND is_nullable = 0
   )
BEGIN
  ALTER TABLE dbo.Miniature
    ALTER COLUMN LocationID int NULL;
END;
