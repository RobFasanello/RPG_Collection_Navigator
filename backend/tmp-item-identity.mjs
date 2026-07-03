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
const result = await pool.request().query(`
  SELECT
    c.COLUMN_NAME,
    COLUMNPROPERTY(OBJECT_ID(c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY
  FROM INFORMATION_SCHEMA.COLUMNS c
  WHERE c.TABLE_NAME = 'Item'
  ORDER BY c.ORDINAL_POSITION
`);
console.log(JSON.stringify(result.recordset, null, 2));
await pool.close();
