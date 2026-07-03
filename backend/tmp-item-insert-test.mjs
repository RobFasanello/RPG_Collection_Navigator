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

const pc = await pool.request().query("SELECT TOP 1 PublisherID, CollectionID FROM PublisherCollection ORDER BY PublisherID, CollectionID");
const cs = await pool.request().query("SELECT TOP 1 CategoryID, SubTypeID FROM CategorySubType ORDER BY CategoryID, SubTypeID");

const p = pc.recordset[0];
const c = cs.recordset[0];
const itemName = `TMP Add Test ${Date.now()}`;

try {
  const ins = await pool.request()
    .input('itemName', sql.NVarChar(255), itemName)
    .input('productId', sql.NVarChar(255), 'TMP-PROD')
    .input('publisherId', sql.SmallInt, p.PublisherID)
    .input('collectionId', sql.SmallInt, p.CollectionID)
    .input('categoryId', sql.SmallInt, c.CategoryID)
    .input('subTypeId', sql.SmallInt, c.SubTypeID)
    .input('releaseDate', sql.Date, new Date())
    .query(`
      INSERT INTO [Item] ([ItemName],[ProductID],[PublisherID],[CollectionID],[CategoryID],[SubTypeID],[ReleaseDate])
      OUTPUT INSERTED.ItemID
      VALUES (@itemName,@productId,@publisherId,@collectionId,@categoryId,@subTypeId,@releaseDate)
    `);

  console.log('INSERT_OK', ins.recordset[0]);
} catch (e) {
  console.log('INSERT_ERR', e.message);
}

await pool.close();
