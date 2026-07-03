import sql from "mssql";

const db = {
  server: "FASARIG2",
  database: "TabletopInventory",
  port: 1433,
  user: "rpg_app",
  password: "Rpgapp123",
  options: { encrypt: false, trustServerCertificate: true },
};

const apiBase = "http://localhost:3001/api/tables";

const pool = await sql.connect(db);
const itemRes = await pool.request().query("SELECT TOP 1 ItemID, ItemName, ReleaseDate FROM Item ORDER BY ItemID DESC");
const item = itemRes.recordset[0];
console.log('BEFORE', item);
await pool.close();

const payload = { ReleaseDate: "12/31/2023" };
const res = await fetch(`${apiBase}/Item/${item.ItemID}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const body = await res.json().catch(async () => ({ raw: await res.text() }));
console.log('PATCH_STATUS', res.status);
console.log('PATCH_BODY', body);

const pool2 = await sql.connect(db);
const afterRes = await pool2.request().input('id', sql.Int, item.ItemID).query("SELECT ItemID, ItemName, ReleaseDate FROM Item WHERE ItemID=@id");
console.log('AFTER', afterRes.recordset[0]);
await pool2.close();
