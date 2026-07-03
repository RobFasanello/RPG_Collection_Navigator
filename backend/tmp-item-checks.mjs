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
const checks = await pool.request().query(`
  SELECT cc.name AS ConstraintName, cc.definition
  FROM sys.check_constraints cc
  JOIN sys.tables t ON cc.parent_object_id = t.object_id
  WHERE t.name = 'Item'
`);

console.log(JSON.stringify(checks.recordset, null, 2));
await pool.close();
