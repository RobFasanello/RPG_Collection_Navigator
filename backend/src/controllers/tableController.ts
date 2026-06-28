import { Request, Response } from 'express';
import { getPool, sql } from '../db/connection.js';

function getPrimaryKeyColumn(tableName: string): string {
  return `${tableName}ID`;
}

// Get all table names from the database
export async function getAllTables(req: Request, res: Response): Promise<void> {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ error: 'Failed to fetch tables' });
  }
}

// Get table schema (columns and types)
export async function getTableSchema(req: Request, res: Response): Promise<void> {
  try {
    const { tableName } = req.params;
    const pool = await getPool();
    
    const result = await pool.request()
      .input('tableName', sql.NVarChar, tableName)
      .query(`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          COLUMNPROPERTY(OBJECT_ID(TABLE_NAME), COLUMN_NAME, 'IsIdentity') as IS_IDENTITY
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = @tableName
        ORDER BY ORDINAL_POSITION
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching table schema:', error);
    res.status(500).json({ error: 'Failed to fetch table schema' });
  }
}

// Get table data with pagination
export async function getTableData(req: Request, res: Response): Promise<void> {
  try {
    const { tableName } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 50);
    const offset = (page - 1) * pageSize;

    const pool = await getPool();

    // Get total count
    const countResult = await pool.request()
      .input('tableName', sql.NVarChar, tableName)
      .query(`SELECT COUNT(*) as total FROM ${tableName}`);
    
    const total = countResult.recordset[0].total;

    // Get paginated data
    const result = await pool.request()
      .input('tableName', sql.NVarChar, tableName)
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, pageSize)
      .query(`
        SELECT * FROM ${tableName}
        ORDER BY (SELECT NULL)
        OFFSET @offset ROWS
        FETCH NEXT @pageSize ROWS ONLY
      `);

    res.json({
      data: result.recordset,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error fetching table data:', error);
    res.status(500).json({ error: 'Failed to fetch table data' });
  }
}

export async function getRecord(req: Request, res: Response): Promise<void> {
  try {
    const { tableName, id } = req.params;
    const primaryKey = getPrimaryKeyColumn(tableName);
    const pool = await getPool();
    const request = pool.request();

    request.input('id', sql.Int, id);

    const result = await request.query(`
      SELECT * FROM [${tableName}]
      WHERE [${primaryKey}] = @id
    `);

    res.json(result.recordset[0] ?? null);
  } catch (error) {
    console.error('Error fetching record:', error);
    res.status(500).json({ error: 'Failed to fetch record' });
  }
}

export async function getInventoryItems(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 50);
    const offset = (page - 1) * pageSize;
    const sortBy = (req.query.sortBy as string) || 'ItemName';
    const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const validColumns = ['ItemName', 'PublisherName', 'CollectionName', 'CategoryName', 'SubTypeName', 'ProductID', 'ReleaseDate'];
    const column = validColumns.includes(sortBy) ? sortBy : 'ItemName';

    const filters: string[] = [];
    const request = (await getPool()).request();

    if (req.query.itemName) {
      request.input('itemName', sql.NVarChar(255), `%${req.query.itemName}%`);
      filters.push('[Item].[ItemName] LIKE @itemName');
    }
    if (req.query.publisherName) {
      // Support single value or multiple values (array) for publisherName
      if (Array.isArray(req.query.publisherName)) {
        const names = req.query.publisherName as string[];
        const clauses: string[] = [];
        names.forEach((name, idx) => {
          const param = `publisherName_${idx}`;
          request.input(param, sql.NVarChar(255), name);
          clauses.push(`[Publisher].[PublisherName] = @${param}`);
        });
        if (clauses.length) {
          filters.push(`(${clauses.join(' OR ')})`);
        }
      } else {
        request.input('publisherName', sql.NVarChar(255), `%${req.query.publisherName}%`);
        filters.push('[Publisher].[PublisherName] LIKE @publisherName');
      }
    }
    if (req.query.collectionName) {
      // Support single value or multiple values (array) for collectionName
      if (Array.isArray(req.query.collectionName)) {
        const names = req.query.collectionName as string[];
        const clauses: string[] = [];
        names.forEach((name, idx) => {
          const param = `collectionName_${idx}`;
          request.input(param, sql.NVarChar(255), name);
          clauses.push(`[Collection].[CollectionName] = @${param}`);
        });
        if (clauses.length) {
          filters.push(`(${clauses.join(' OR ')})`);
        }
      } else {
        request.input('collectionName', sql.NVarChar(255), `%${req.query.collectionName}%`);
        filters.push('[Collection].[CollectionName] LIKE @collectionName');
      }
    }
    if (req.query.categoryName) {
      // Support single value or multiple values (array) for categoryName
      if (Array.isArray(req.query.categoryName)) {
        const names = req.query.categoryName as string[];
        const clauses: string[] = [];
        names.forEach((name, idx) => {
          const param = `categoryName_${idx}`;
          request.input(param, sql.NVarChar(255), name);
          clauses.push(`[Category].[CategoryName] = @${param}`);
        });
        if (clauses.length) {
          filters.push(`(${clauses.join(' OR ')})`);
        }
      } else {
        request.input('categoryName', sql.NVarChar(255), `%${req.query.categoryName}%`);
        filters.push('[Category].[CategoryName] LIKE @categoryName');
      }
    }
    if (req.query.subTypeName) {
      // Support single value or multiple values (array) for subTypeName
      if (Array.isArray(req.query.subTypeName)) {
        const names = req.query.subTypeName as string[];
        const clauses: string[] = [];
        names.forEach((name, idx) => {
          const param = `subTypeName_${idx}`;
          request.input(param, sql.NVarChar(255), name);
          clauses.push(`[SubType].[SubTypeName] = @${param}`);
        });
        if (clauses.length) {
          filters.push(`(${clauses.join(' OR ')})`);
        }
      } else {
        request.input('subTypeName', sql.NVarChar(255), `%${req.query.subTypeName}%`);
        filters.push('[SubType].[SubTypeName] LIKE @subTypeName');
      }
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) as total
      FROM [Item]
      INNER JOIN [Publisher] ON [Publisher].[PublisherID] = [Item].[PublisherID]
      INNER JOIN [Collection] ON [Collection].[CollectionID] = [Item].[CollectionID]
      INNER JOIN [Category] ON [Category].[CategoryID] = [Item].[CategoryID]
      INNER JOIN [SubType] ON [SubType].[SubTypeID] = [Item].[SubTypeID]
      ${whereClause}
    `;

    const countResult = await request.query(countQuery);
    const total = countResult.recordset[0].total;

    const dataQuery = `
      SELECT
        [Item].[ItemID],
        [Item].[ItemName],
        [Item].[ProductID],
        [Item].[ReleaseDate],
        [Item].[PublisherID],
        [Item].[CollectionID],
        [Item].[CategoryID],
        [Item].[SubTypeID],
        [Publisher].[PublisherName],
        [Collection].[CollectionName],
        [Category].[CategoryName],
        [SubType].[SubTypeName]
      FROM [Item]
      INNER JOIN [Publisher] ON [Publisher].[PublisherID] = [Item].[PublisherID]
      INNER JOIN [Collection] ON [Collection].[CollectionID] = [Item].[CollectionID]
      INNER JOIN [Category] ON [Category].[CategoryID] = [Item].[CategoryID]
      INNER JOIN [SubType] ON [SubType].[SubTypeID] = [Item].[SubTypeID]
      ${whereClause}
      ORDER BY [${column === 'PublisherName' ? 'Publisher' : column === 'CollectionName' ? 'Collection' : column === 'CategoryName' ? 'Category' : column === 'SubTypeName' ? 'SubType' : 'Item'}].[${column}] ${sortOrder}
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `;

    request.input('offset', sql.Int, offset);
    request.input('pageSize', sql.Int, pageSize);

    const result = await request.query(dataQuery);

    res.json({
      data: result.recordset,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    res.status(500).json({ error: 'Failed to fetch inventory items' });
  }
}

// Create new record
export async function createRecord(req: Request, res: Response): Promise<void> {
  try {
    const { tableName } = req.params;
    const data = req.body;
    const pool = await getPool();
    const request = pool.request();

    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((col, i) => `@${col}`).join(', ');
    const columnList = columns.map(col => `[${col}]`).join(', ');

    columns.forEach((col, i) => {
      request.input(col, values[i]);
    });

    const query = `
      INSERT INTO [${tableName}] (${columnList})
      VALUES (${placeholders})
    `;

    await request.query(query);
    res.status(201).json({ success: true, message: 'Record created' });
  } catch (error) {
    console.error('Error creating record:', error);
    res.status(500).json({ error: 'Failed to create record' });
  }
}

// Update record
export async function updateRecord(req: Request, res: Response): Promise<void> {
  try {
    const { tableName, id } = req.params;
    const data = req.body;
    const pool = await getPool();
    const request = pool.request();
    const primaryKey = getPrimaryKeyColumn(tableName);

    const updates = Object.keys(data)
      .map(col => `[${col}] = @${col}`)
      .join(', ');

    Object.entries(data).forEach(([col, value]) => {
      request.input(col, value);
    });

    request.input('id', sql.Int, id);

    const query = `
      UPDATE [${tableName}]
      SET ${updates}
      WHERE [${primaryKey}] = @id
    `;

    await request.query(query);
    res.json({ success: true, message: 'Record updated' });
  } catch (error) {
    console.error('Error updating record:', error);
    res.status(500).json({ error: 'Failed to update record' });
  }
}

// Delete record
export async function deleteRecord(req: Request, res: Response): Promise<void> {
  try {
    const { tableName, id } = req.params;
    const pool = await getPool();
    const primaryKey = getPrimaryKeyColumn(tableName);

    const result = await pool.request()
      .input('id', sql.Int, id)
      .query(`DELETE FROM [${tableName}] WHERE [${primaryKey}] = @id`);

    res.json({ success: true, message: 'Record deleted' });
  } catch (error) {
    console.error('Error deleting record:', error);
    res.status(500).json({ error: 'Failed to delete record' });
  }
}
