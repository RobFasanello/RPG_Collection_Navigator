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
const triggers = await pool.request().query(`
  SELECT t.name AS TriggerName, OBJECT_DEFINITION(t.object_id) AS TriggerDefinition
  FROM sys.triggers t
  JOIN sys.tables tb ON t.parent_id = tb.object_id
  WHERE tb.name = 'Item'
`);

console.log(JSON.stringify(triggers.recordset, null, 2));
await pool.close();
