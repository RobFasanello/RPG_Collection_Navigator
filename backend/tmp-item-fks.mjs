import sql from "mssql";

const config = {
  server: "FASARIG2",
  database: "TabletopInventory",
  port: 1433,
  user: "rpg_app",
  password: "Rpgapp123",
  options: { encrypt: false, trustServerCertificate: true },
};

const pool = await sql.connect(config);
const r = await pool.request().query(`
  SELECT
    fk.name AS FK_Name,
    tp.name AS ParentTable,
    cp.name AS ParentColumn,
    tr.name AS RefTable,
    cr.name AS RefColumn
  FROM sys.foreign_key_columns fkc
  JOIN sys.foreign_keys fk ON fkc.constraint_object_id = fk.object_id
  JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
  JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
  JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
  JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
  WHERE tp.name = 'Item'
  ORDER BY fk.name, fkc.constraint_column_id
`);
console.log(JSON.stringify(r.recordset, null, 2));
await pool.close();
