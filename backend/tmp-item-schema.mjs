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
  SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, ORDINAL_POSITION
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Item'
  ORDER BY ORDINAL_POSITION
`);
console.log(JSON.stringify(result.recordset, null, 2));
await pool.close();
