import sql from "mssql";

const db = {
  server: "FASARIG2",
  database: "TabletopInventory",
  port: 1433,
  user: "rpg_app",
  password: "Rpgapp123",
  options: { encrypt: false, trustServerCertificate: true },
};

const pool = await sql.connect(db);

const cols = await pool.request().query(`
  SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, ORDINAL_POSITION,
         COLUMNPROPERTY(OBJECT_ID(TABLE_NAME), COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Inventory'
  ORDER BY ORDINAL_POSITION
`);

const fks = await pool.request().query(`
  SELECT
    fk.name AS FK_Name,
    cp.name AS ParentColumn,
    tr.name AS RefTable,
    cr.name AS RefColumn
  FROM sys.foreign_key_columns fkc
  JOIN sys.foreign_keys fk ON fkc.constraint_object_id = fk.object_id
  JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
  JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
  JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
  JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
  WHERE tp.name = 'Inventory'
  ORDER BY fk.name, fkc.constraint_column_id
`);

console.log('COLS', JSON.stringify(cols.recordset, null, 2));
console.log('FKS', JSON.stringify(fks.recordset, null, 2));
await pool.close();
