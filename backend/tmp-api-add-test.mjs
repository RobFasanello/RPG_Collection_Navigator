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
const pc = await pool.request().query("SELECT TOP 1 PublisherID, CollectionID FROM PublisherCollection ORDER BY PublisherID, CollectionID");
const cs = await pool.request().query("SELECT TOP 1 CategoryID, SubTypeID FROM CategorySubType ORDER BY CategoryID, SubTypeID");
await pool.close();

const payload = {
  ItemName: `TMP API Add Test ${Date.now()}`,
  ProductID: "TMP-API",
  ReleaseDate: "2026-06-27",
  PublisherID: pc.recordset[0].PublisherID,
  CollectionID: pc.recordset[0].CollectionID,
  CategoryID: cs.recordset[0].CategoryID,
  SubTypeID: cs.recordset[0].SubTypeID,
};

console.log("PAYLOAD", payload);

try {
  const res = await fetch(`${apiBase}/Item`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(async () => ({ raw: await res.text() }));
  console.log("API_STATUS", res.status);
  console.log("API_BODY", body);
} catch (e) {
  console.error("API_ERR", e.message);
}
