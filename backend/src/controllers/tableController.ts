import { Request, Response } from 'express';
import { getPool, sql } from '../db/connection.js';
import { deleteUploadedFile } from '../uploads.js';

function getPrimaryKeyColumn(tableName: string): string {
  return `${tableName}ID`;
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = parseInt(value, 10);
    return parsed > 0 ? parsed : null;
  }

  return null;
}

function parseOptionalTrimmedText(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
}

function parseOptionalBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 't', 'x'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'f'].includes(normalized)) {
    return false;
  }

  return null;
}

const ITEM_VERSION_MAX_LENGTH = 15;

function normalizeItemVersion(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function validateItemVersion(value: string | null): string | null {
  if (!value) {
    return null;
  }

  if (value.length > ITEM_VERSION_MAX_LENGTH) {
    return `ItemVersion must be ${ITEM_VERSION_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}

async function recordExists(
  transaction: sql.Transaction,
  tableName: string,
  keyColumn: string,
  id: number
): Promise<boolean> {
  const result = await new sql.Request(transaction)
    .input('id', sql.Int, id)
    .query(`SELECT TOP 1 1 AS [Exists] FROM [${tableName}] WHERE [${keyColumn}] = @id`);

  return result.recordset.length > 0;
}

async function linkExists(
  transaction: sql.Transaction,
  tableName: string,
  firstColumn: string,
  secondColumn: string,
  firstValue: number,
  secondValue: number
): Promise<boolean> {
  const result = await new sql.Request(transaction)
    .input('firstValue', sql.Int, firstValue)
    .input('secondValue', sql.Int, secondValue)
    .query(`
      SELECT TOP 1 1 AS [Exists]
      FROM [${tableName}]
      WHERE [${firstColumn}] = @firstValue
        AND [${secondColumn}] = @secondValue
    `);

  return result.recordset.length > 0;
}

export async function bulkUpdateItemRecords(req: Request, res: Response): Promise<void> {
  const rawItemIds: unknown[] = Array.isArray(req.body?.itemIds) ? req.body.itemIds : [];
  const uniqueItemIds = Array.from(
    new Set(rawItemIds.map((itemId) => parsePositiveInt(itemId)).filter((itemId): itemId is number => itemId !== null))
  );

  const publisherId = parsePositiveInt(req.body?.PublisherID);
  const collectionId = parsePositiveInt(req.body?.CollectionID);
  const categoryId = parsePositiveInt(req.body?.CategoryID);
  const subTypeId = parsePositiveInt(req.body?.SubTypeID);
  const itemVersion = parseOptionalTrimmedText(req.body?.ItemVersion);
  const isPhysical = parseOptionalBoolean(req.body?.IsPhysical);
  const isDigital = parseOptionalBoolean(req.body?.IsDigital);
  const itemVersionError = validateItemVersion(itemVersion ?? null);

  const updateFields = [
    { column: 'PublisherID', value: publisherId, type: sql.Int },
    { column: 'CollectionID', value: collectionId, type: sql.Int },
    { column: 'CategoryID', value: categoryId, type: sql.Int },
    { column: 'SubTypeID', value: subTypeId, type: sql.Int },
    { column: 'ItemVersion', value: itemVersion, type: sql.NVarChar(sql.MAX) },
    { column: 'IsPhysical', value: isPhysical, type: sql.Bit },
    { column: 'IsDigital', value: isDigital, type: sql.Bit },
  ].filter((field) => field.value !== null && field.value !== undefined);

  if (uniqueItemIds.length === 0) {
    res.status(400).json({ error: 'At least one itemId is required.' });
    return;
  }

  if (updateFields.length === 0) {
    res.status(400).json({ error: 'At least one updatable field is required.' });
    return;
  }

  if (itemVersionError) {
    res.status(400).json({ error: itemVersionError });
    return;
  }

  try {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const itemRequest = new sql.Request(transaction);
      uniqueItemIds.forEach((itemId, index) => {
        itemRequest.input(`itemId${index}`, sql.Int, itemId);
      });

      const currentItemsResult = await itemRequest.query(`
        SELECT [ItemID], [PublisherID], [CollectionID], [CategoryID], [SubTypeID]
        FROM [Item]
        WHERE [ItemID] IN (${uniqueItemIds.map((_, index) => `@itemId${index}`).join(', ')})
      `);

      if (currentItemsResult.recordset.length !== uniqueItemIds.length) {
        const foundIds = new Set(currentItemsResult.recordset.map((row) => Number(row.ItemID)));
        const missingIds = uniqueItemIds.filter((itemId: number) => !foundIds.has(itemId));
        await transaction.rollback();
        res.status(404).json({ error: `One or more items were not found: ${missingIds.join(', ')}.` });
        return;
      }

      const currentItemsById = new Map<number, { PublisherID: number; CollectionID: number; CategoryID: number; SubTypeID: number }>();
      currentItemsResult.recordset.forEach((row) => {
        currentItemsById.set(Number(row.ItemID), {
          PublisherID: Number(row.PublisherID),
          CollectionID: Number(row.CollectionID),
          CategoryID: Number(row.CategoryID),
          SubTypeID: Number(row.SubTypeID),
        });
      });

      const validationTargets: Array<{ tableName: string; keyColumn: string; id: number; label: string }> = [];
      if (publisherId !== null) {
        validationTargets.push({ tableName: 'Publisher', keyColumn: 'PublisherID', id: publisherId, label: 'PublisherID' });
      }
      if (collectionId !== null) {
        validationTargets.push({ tableName: 'Collection', keyColumn: 'CollectionID', id: collectionId, label: 'CollectionID' });
      }
      if (categoryId !== null) {
        validationTargets.push({ tableName: 'Category', keyColumn: 'CategoryID', id: categoryId, label: 'CategoryID' });
      }
      if (subTypeId !== null) {
        validationTargets.push({ tableName: 'SubType', keyColumn: 'SubTypeID', id: subTypeId, label: 'SubTypeID' });
      }

      for (const target of validationTargets) {
        const exists = await recordExists(transaction, target.tableName, target.keyColumn, target.id);
        if (!exists) {
          await transaction.rollback();
          res.status(400).json({ error: `${target.label} ${target.id} was not found.` });
          return;
        }
      }

      const publisherCollectionCache = new Map<string, boolean>();
      const categorySubTypeCache = new Map<string, boolean>();

      for (const itemId of uniqueItemIds) {
        const currentItem = currentItemsById.get(itemId);
        if (!currentItem) {
          continue;
        }

        const nextPublisherId = publisherId ?? currentItem.PublisherID;
        const nextCollectionId = collectionId ?? currentItem.CollectionID;
        const nextCategoryId = categoryId ?? currentItem.CategoryID;
        const nextSubTypeId = subTypeId ?? currentItem.SubTypeID;

        const publisherCollectionKey = `${nextPublisherId}:${nextCollectionId}`;
        if (!publisherCollectionCache.has(publisherCollectionKey)) {
          publisherCollectionCache.set(
            publisherCollectionKey,
            await linkExists(transaction, 'PublisherCollection', 'PublisherID', 'CollectionID', nextPublisherId, nextCollectionId)
          );
        }

        if (!publisherCollectionCache.get(publisherCollectionKey)) {
          await transaction.rollback();
          res.status(409).json({ error: `Item ${itemId} would not have a valid Publisher and Collection combination.` });
          return;
        }

        const categorySubTypeKey = `${nextCategoryId}:${nextSubTypeId}`;
        if (!categorySubTypeCache.has(categorySubTypeKey)) {
          categorySubTypeCache.set(
            categorySubTypeKey,
            await linkExists(transaction, 'CategorySubType', 'CategoryID', 'SubTypeID', nextCategoryId, nextSubTypeId)
          );
        }

        if (!categorySubTypeCache.get(categorySubTypeKey)) {
          await transaction.rollback();
          res.status(409).json({ error: `Item ${itemId} would not have a valid Category and Sub Category combination.` });
          return;
        }
      }

      const updateRequest = new sql.Request(transaction);
      updateFields.forEach((field) => {
        updateRequest.input(field.column, field.type as any, field.value);
      });

      uniqueItemIds.forEach((itemId, index) => {
        updateRequest.input(`itemId${index}`, sql.Int, itemId);
      });

      const updates = updateFields.map((field) => `[${field.column}] = @${field.column}`).join(', ');
      await updateRequest.query(`
        UPDATE [Item]
        SET ${updates}
        WHERE [ItemID] IN (${uniqueItemIds.map((_, index) => `@itemId${index}`).join(', ')})
      `);

      await transaction.commit();
      res.json({
        success: true,
        updatedCount: uniqueItemIds.length,
        message: `Updated ${uniqueItemIds.length} item${uniqueItemIds.length === 1 ? '' : 's'}.`,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error bulk updating item records:', error);
    res.status(500).json({ error: (error as any)?.message || 'Failed to bulk update items' });
  }
}

interface BulkCreateItemInputRow {
  RowNumber?: unknown;
  Publisher?: unknown;
  Collection?: unknown;
  ItemName?: unknown;
  ItemVersion?: unknown;
  Category?: unknown;
  SubCategory?: unknown;
  ProductID?: unknown;
  ReleaseDate?: unknown;
  IsPhysical?: unknown;
  IsDigital?: unknown;
}

interface BulkCreateItemNormalizedRow {
  rowNumber: number;
  Publisher: string;
  Collection: string;
  ItemName: string;
  ItemVersion: string;
  Category: string;
  SubCategory: string;
  ProductID: string;
  ReleaseDate: Date | null;
  IsPhysical: boolean;
  IsDigital: boolean;
}

interface BulkCreateItemRowResult {
  rowNumber: number;
  success: boolean;
  errors: string[];
}

function normalizeBulkText(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function parseBulkReleaseDate(value: unknown): { date: Date | null; error?: string } {
  if (value === null || value === undefined) {
    return { date: null };
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return { date: null, error: 'ReleaseDate is invalid.' };
    }
    return { date: value };
  }

  const raw = String(value).trim();
  if (!raw) {
    return { date: null };
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    ) {
      return { date: candidate };
    }
    return { date: null, error: 'ReleaseDate is invalid.' };
  }

  const mdyMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const month = Number(mdyMatch[1]);
    const day = Number(mdyMatch[2]);
    const year = Number(mdyMatch[3]);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day
    ) {
      return { date: candidate };
    }
    return { date: null, error: 'ReleaseDate is invalid.' };
  }

  return { date: null, error: 'ReleaseDate must be YYYY-MM-DD or MM/DD/YYYY.' };
}

function parseBulkFlag(
  value: unknown,
  label: string
): { value: boolean | null; error?: string } {
  if (value === null || value === undefined || String(value).trim() === '') {
    return { value: null };
  }

  const parsed = parseOptionalBoolean(value);
  if (parsed === null) {
    return { value: null, error: `${label} must be one of Y, Yes, T, True, X, 1, N, No, F, False, or 0.` };
  }

  return { value: parsed };
}

export async function bulkCreateItems(req: Request, res: Response): Promise<void> {
  const rawRows: BulkCreateItemInputRow[] = Array.isArray(req.body?.rows) ? req.body.rows : [];

  if (rawRows.length === 0) {
    res.status(400).json({ error: 'rows is required and must contain at least one item.' });
    return;
  }

  const rowResults: BulkCreateItemRowResult[] = rawRows.map((_, index) => ({
    rowNumber: parsePositiveInt(rawRows[index]?.RowNumber) ?? index + 1,
    success: false,
    errors: [],
  }));
  const rowResultIndexByRowNumber = new Map<number, number>();
  rowResults.forEach((result, index) => {
    if (!rowResultIndexByRowNumber.has(result.rowNumber)) {
      rowResultIndexByRowNumber.set(result.rowNumber, index);
    }
  });

  const normalizedRows: BulkCreateItemNormalizedRow[] = [];

  rawRows.forEach((row, index) => {
    const rowNumber = parsePositiveInt(row?.RowNumber) ?? index + 1;
    const publisher = normalizeBulkText(row?.Publisher);
    const collection = normalizeBulkText(row?.Collection);
    const itemName = normalizeBulkText(row?.ItemName);
    const itemVersion = normalizeBulkText(row?.ItemVersion);
    const category = normalizeBulkText(row?.Category);
    const subCategory = normalizeBulkText(row?.SubCategory);
    const productId = normalizeBulkText(row?.ProductID);
    const isPhysicalParse = parseBulkFlag(row?.IsPhysical, 'Is Physical');
    const isDigitalParse = parseBulkFlag(row?.IsDigital, 'Is Digital');

    if (!publisher) {
      rowResults[index].errors.push('Publisher is required.');
    }
    if (!collection) {
      rowResults[index].errors.push('Collection is required.');
    }
    if (!itemName) {
      rowResults[index].errors.push('ItemName is required.');
    }
    if (!itemVersion) {
      rowResults[index].errors.push('ItemVersion is required.');
    }
    if (!category) {
      rowResults[index].errors.push('Category is required.');
    }
    if (!subCategory) {
      rowResults[index].errors.push('SubCategory is required.');
    }
    if (!productId) {
      rowResults[index].errors.push('ProductID is required.');
    }

    const releaseDateParse = parseBulkReleaseDate(row?.ReleaseDate);
    if (releaseDateParse.error) {
      rowResults[index].errors.push(releaseDateParse.error);
    }

    if (isPhysicalParse.error) {
      rowResults[index].errors.push(isPhysicalParse.error);
    }

    if (isDigitalParse.error) {
      rowResults[index].errors.push(isDigitalParse.error);
    }

    if (isPhysicalParse.value !== true && isDigitalParse.value !== true) {
      rowResults[index].errors.push('At least one of Is Physical or Is Digital must be positive.');
    }

    const itemVersionError = validateItemVersion(itemVersion || null);
    if (itemVersionError) {
      rowResults[index].errors.push(itemVersionError);
    }

    if (rowResults[index].errors.length === 0) {
      normalizedRows.push({
        rowNumber,
        Publisher: publisher,
        Collection: collection,
        ItemName: itemName,
        ItemVersion: itemVersion,
        Category: category,
        SubCategory: subCategory,
        ProductID: productId,
        ReleaseDate: releaseDateParse.date,
        IsPhysical: isPhysicalParse.value === true,
        IsDigital: isDigitalParse.value === true,
      });
    }
  });

  try {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const request = new sql.Request(transaction);

      const publishersResult = await request.query('SELECT [PublisherID], [PublisherName] FROM [Publisher]');
      const collectionsResult = await request.query('SELECT [CollectionID], [CollectionName] FROM [Collection]');
      const categoriesResult = await request.query('SELECT [CategoryID], [CategoryName] FROM [Category]');
      const subTypesResult = await request.query('SELECT [SubTypeID], [SubTypeName] FROM [SubType]');
      const publisherCollectionResult = await request.query('SELECT [PublisherID], [CollectionID] FROM [PublisherCollection]');
      const categorySubTypeResult = await request.query('SELECT [CategoryID], [SubTypeID] FROM [CategorySubType]');
      const existingItemsResult = await request.query('SELECT [ItemName], [ProductID] FROM [Item]');

      const publisherByName = new Map<string, number>();
      publishersResult.recordset.forEach((row) => {
        publisherByName.set(String(row.PublisherName).trim().toLowerCase(), Number(row.PublisherID));
      });

      const collectionByName = new Map<string, number>();
      const collectionById = new Set<number>();
      collectionsResult.recordset.forEach((row) => {
        const collectionId = Number(row.CollectionID);
        collectionByName.set(String(row.CollectionName).trim().toLowerCase(), collectionId);
        collectionById.add(collectionId);
      });

      const categoryByName = new Map<string, number>();
      categoriesResult.recordset.forEach((row) => {
        categoryByName.set(String(row.CategoryName).trim().toLowerCase(), Number(row.CategoryID));
      });

      const subTypeByName = new Map<string, number>();
      subTypesResult.recordset.forEach((row) => {
        subTypeByName.set(String(row.SubTypeName).trim().toLowerCase(), Number(row.SubTypeID));
      });

      const publisherCollectionLinks = new Set<string>();
      publisherCollectionResult.recordset.forEach((row) => {
        publisherCollectionLinks.add(`${Number(row.PublisherID)}:${Number(row.CollectionID)}`);
      });

      const categorySubTypeLinks = new Set<string>();
      categorySubTypeResult.recordset.forEach((row) => {
        categorySubTypeLinks.add(`${Number(row.CategoryID)}:${Number(row.SubTypeID)}`);
      });

      const existingItemKeys = new Set<string>();
      existingItemsResult.recordset.forEach((row) => {
        const existingName = String(row.ItemName ?? '').trim().toLowerCase();
        const existingProduct = String(row.ProductID ?? '').trim().toLowerCase();
        existingItemKeys.add(`${existingName}::${existingProduct}`);
      });

      const fileItemKeys = new Set<string>();
      type PreparedInsert = {
        rowNumber: number;
        ItemName: string;
        ItemVersion: string;
        ProductID: string;
        ReleaseDate: Date | null;
        PublisherID: number;
        CollectionID: number;
        CategoryID: number;
        SubTypeID: number;
        IsPhysical: boolean;
        IsDigital: boolean;
      };

      const preparedRows: PreparedInsert[] = [];

      normalizedRows.forEach((row) => {
        const rowIndex = rowResultIndexByRowNumber.get(row.rowNumber);
        if (rowIndex === undefined) {
          return;
        }
        const publisherId = publisherByName.get(row.Publisher.toLowerCase());
        const collectionRaw = row.Collection.trim();
        let collectionId: number | undefined;
        if (/^\d+$/.test(collectionRaw)) {
          const parsedCollectionId = parseInt(collectionRaw, 10);
          if (collectionById.has(parsedCollectionId)) {
            collectionId = parsedCollectionId;
          }
        } else {
          collectionId = collectionByName.get(collectionRaw.toLowerCase());
        }
        const categoryId = categoryByName.get(row.Category.toLowerCase());
        const subTypeId = subTypeByName.get(row.SubCategory.toLowerCase());

        if (!publisherId) {
          rowResults[rowIndex].errors.push(`Publisher "${row.Publisher}" was not found.`);
        }
        if (!collectionId) {
          rowResults[rowIndex].errors.push(`Collection "${row.Collection}" was not found.`);
        }
        if (!categoryId) {
          rowResults[rowIndex].errors.push(`Category "${row.Category}" was not found.`);
        }
        if (!subTypeId) {
          rowResults[rowIndex].errors.push(`SubCategory "${row.SubCategory}" was not found.`);
        }

        if (publisherId && collectionId && !publisherCollectionLinks.has(`${publisherId}:${collectionId}`)) {
          rowResults[rowIndex].errors.push('Publisher and Collection are not a valid combination.');
        }

        if (categoryId && subTypeId && !categorySubTypeLinks.has(`${categoryId}:${subTypeId}`)) {
          rowResults[rowIndex].errors.push('Category and SubCategory are not a valid combination.');
        }

        const itemKey = `${row.ItemName.toLowerCase()}::${row.ProductID.toLowerCase()}`;

        if (existingItemKeys.has(itemKey)) {
          rowResults[rowIndex].errors.push('An item with the same ItemName and ProductID already exists.');
        }

        if (fileItemKeys.has(itemKey)) {
          rowResults[rowIndex].errors.push('Duplicate ItemName and ProductID exists in this upload file.');
        }

        if (rowResults[rowIndex].errors.length === 0) {
          fileItemKeys.add(itemKey);
          preparedRows.push({
            rowNumber: row.rowNumber,
            ItemName: row.ItemName,
            ItemVersion: row.ItemVersion,
            ProductID: row.ProductID,
            ReleaseDate: row.ReleaseDate,
            PublisherID: publisherId as number,
            CollectionID: collectionId as number,
            CategoryID: categoryId as number,
            SubTypeID: subTypeId as number,
            IsPhysical: row.IsPhysical,
            IsDigital: row.IsDigital,
          });
        }
      });

      let insertedCount = 0;

      for (const row of preparedRows) {
        const insertRequest = new sql.Request(transaction);
        insertRequest.input('ItemName', sql.NVarChar(255), row.ItemName);
        insertRequest.input('ItemVersion', sql.NVarChar(sql.MAX), row.ItemVersion || null);
        insertRequest.input('ProductID', sql.NVarChar(255), row.ProductID);
        insertRequest.input('ReleaseDate', sql.Date, row.ReleaseDate);
        insertRequest.input('PublisherID', sql.Int, row.PublisherID);
        insertRequest.input('CollectionID', sql.Int, row.CollectionID);
        insertRequest.input('CategoryID', sql.Int, row.CategoryID);
        insertRequest.input('SubTypeID', sql.Int, row.SubTypeID);
        insertRequest.input('IsPhysical', sql.Bit, row.IsPhysical);
        insertRequest.input('IsDigital', sql.Bit, row.IsDigital);

        await insertRequest.query(`
          INSERT INTO [Item] ([ItemName], [ItemVersion], [ProductID], [ReleaseDate], [PublisherID], [CollectionID], [CategoryID], [SubTypeID], [IsPhysical], [IsDigital])
          VALUES (@ItemName, @ItemVersion, @ProductID, @ReleaseDate, @PublisherID, @CollectionID, @CategoryID, @SubTypeID, @IsPhysical, @IsDigital)
        `);

        const rowIndex = rowResultIndexByRowNumber.get(row.rowNumber);
        if (rowIndex !== undefined) {
          rowResults[rowIndex].success = true;
        }
        insertedCount += 1;
      }

      await transaction.commit();

      res.json({
        insertedCount,
        totalRows: rawRows.length,
        rowResults,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error('Error bulk creating items:', error);
    res.status(500).json({ error: (error as any)?.message || 'Failed to bulk create items' });
  }
}

// Check if a store has any purchase orders (referential integrity check)
async function checkStoreHasPurchaseOrders(storeId: number): Promise<boolean> {
  try {
    const pool = await getPool();
    const request = pool.request();
    const result = await request
      .input('storeId', sql.Int, storeId)
      .query('SELECT COUNT(*) as count FROM PurchaseOrder WHERE StoreID = @storeId');
    return result.recordset[0].count > 0;
  } catch (error) {
    console.error('Error checking store references:', error);
    throw error;
  }
}

// Check if a PurchaseOrder with the same (StoreID, InvoiceNumber) already exists
async function checkPurchaseOrderUniqueConstraint(
  storeId: number,
  invoiceNumber: string,
  excludePurchaseOrderId: number
): Promise<{ exists: boolean; storeName?: string }> {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('storeId', sql.Int, storeId)
      .input('invoiceNumber', sql.NVarChar, invoiceNumber)
      .input('excludeId', sql.Int, excludePurchaseOrderId)
      .query(`
        SELECT TOP 1 [Store].[StoreName]
        FROM [PurchaseOrder]
        INNER JOIN [Store] ON [Store].[StoreID] = [PurchaseOrder].[StoreID]
        WHERE [PurchaseOrder].[StoreID] = @storeId
          AND [PurchaseOrder].[InvoiceNumber] = @invoiceNumber
          AND [PurchaseOrder].[PurchaseOrderID] != @excludeId
      `);
    
    if (result.recordset.length > 0) {
      return { exists: true, storeName: result.recordset[0].StoreName };
    }
    return { exists: false };
  } catch (error) {
    console.error('Error checking purchase order unique constraint:', error);
    throw error;
  }
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

    const validColumns = [
      'ItemName',
      'ItemVersion',
      'PublisherName',
      'CollectionName',
      'CategoryName',
      'SubTypeName',
      'ProductID',
      'ReleaseDate',
      'IsPhysical',
      'IsDigital',
      'HasPurchaseOrder',
    ];
    const column = validColumns.includes(sortBy) ? sortBy : 'ItemName';

    const filters: string[] = [];
    const pool = await getPool();
    const request = pool.request();

    const sortColumn = column;

    const sortSource =
      sortColumn === 'PublisherName'
        ? 'Publisher'
        : sortColumn === 'CollectionName'
          ? 'Collection'
          : sortColumn === 'CategoryName'
            ? 'Category'
            : sortColumn === 'SubTypeName'
              ? 'SubType'
              : 'Item';

    const sortExpression =
      sortColumn === 'IsPhysical'
        ? '[Item].[IsPhysical]'
        : sortColumn === 'IsDigital'
          ? '[Item].[IsDigital]'
          : sortColumn === 'HasPurchaseOrder'
            ? `CASE
                WHEN EXISTS (
                  SELECT 1
                  FROM [PurchaseOrderDetail] AS [pod]
                  INNER JOIN [PurchaseOrder] AS [po]
                    ON [po].[PurchaseOrderID] = [pod].[PurchaseOrderID]
                  WHERE [pod].[ItemID] = [Item].[ItemID]
                ) THEN CAST(1 AS bit)
                ELSE CAST(0 AS bit)
              END`
            : `[${sortSource}].[${sortColumn}]`;
    const secondarySortExpression = sortColumn === 'ItemName' ? '' : ', [Item].[ItemName] ASC';

    if (req.query.itemName) {
      request.input('itemName', sql.NVarChar(255), `%${req.query.itemName}%`);
      filters.push('[Item].[ItemName] LIKE @itemName');
    }
    if (req.query.productID) {
      request.input('productID', sql.NVarChar(255), `%${req.query.productID}%`);
      filters.push('[Item].[ProductID] LIKE @productID');
    }
    if (req.query.itemVersion) {
      request.input('itemVersion', sql.NVarChar(255), `%${req.query.itemVersion}%`);
      filters.push('[Item].[ItemVersion] LIKE @itemVersion');
    }
    if (req.query.releaseDateFrom) {
      request.input('releaseDateFrom', sql.Date, req.query.releaseDateFrom);
      filters.push('[Item].[ReleaseDate] >= @releaseDateFrom');
    }
    if (req.query.releaseDateTo) {
      request.input('releaseDateTo', sql.Date, req.query.releaseDateTo);
      filters.push('[Item].[ReleaseDate] <= @releaseDateTo');
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
          const trimmed = String(name).trim();
          if (/^\d+$/.test(trimmed)) {
            const param = `collectionId_${idx}`;
            request.input(param, sql.Int, parseInt(trimmed, 10));
            clauses.push(`[Item].[CollectionID] = @${param}`);
          } else {
            const param = `collectionName_${idx}`;
            request.input(param, sql.NVarChar(255), trimmed);
            clauses.push(`[Collection].[CollectionName] = @${param}`);
          }
        });
        if (clauses.length) {
          filters.push(`(${clauses.join(' OR ')})`);
        }
      } else {
        const singleValue = String(req.query.collectionName).trim();
        if (/^\d+$/.test(singleValue)) {
          request.input('collectionId', sql.Int, parseInt(singleValue, 10));
          filters.push('[Item].[CollectionID] = @collectionId');
        } else {
          request.input('collectionName', sql.NVarChar(255), `%${singleValue}%`);
          filters.push('[Collection].[CollectionName] LIKE @collectionName');
        }
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

    const isPhysical = parseOptionalBoolean(req.query.isPhysical);
    if (isPhysical !== null) {
      request.input('isPhysical', sql.Bit, isPhysical);
      filters.push('[Item].[IsPhysical] = @isPhysical');
    }

    const isDigital = parseOptionalBoolean(req.query.isDigital);
    if (isDigital !== null) {
      request.input('isDigital', sql.Bit, isDigital);
      filters.push('[Item].[IsDigital] = @isDigital');
    }

    const hasPurchaseOrder = parseOptionalBoolean(req.query.hasPurchaseOrder);
    if (hasPurchaseOrder !== null) {
      if (hasPurchaseOrder) {
        filters.push(`EXISTS (
          SELECT 1
          FROM [PurchaseOrderDetail] AS [pod]
          INNER JOIN [PurchaseOrder] AS [po]
            ON [po].[PurchaseOrderID] = [pod].[PurchaseOrderID]
          WHERE [pod].[ItemID] = [Item].[ItemID]
        )`);
      } else {
        filters.push(`NOT EXISTS (
          SELECT 1
          FROM [PurchaseOrderDetail] AS [pod]
          INNER JOIN [PurchaseOrder] AS [po]
            ON [po].[PurchaseOrderID] = [pod].[PurchaseOrderID]
          WHERE [pod].[ItemID] = [Item].[ItemID]
        )`);
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
        [Item].[ItemVersion],
        [Item].[ProductID],
        [Item].[ReleaseDate],
        [Item].[IsPhysical],
        [Item].[IsDigital],
        [Item].[PublisherID],
        [Item].[CollectionID],
        [Item].[CategoryID],
        [Item].[SubTypeID],
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM [PurchaseOrderDetail] AS [pod]
            INNER JOIN [PurchaseOrder] AS [po]
              ON [po].[PurchaseOrderID] = [pod].[PurchaseOrderID]
            WHERE [pod].[ItemID] = [Item].[ItemID]
          ) THEN CAST(1 AS bit)
          ELSE CAST(0 AS bit)
        END AS [HasPurchaseOrder],
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
      ORDER BY ${sortExpression} ${sortOrder}${secondarySortExpression}
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

// Lightweight item list for dropdown/lookup — returns all items, no pagination
export async function getItemsForLookup(req: Request, res: Response): Promise<void> {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT [Item].[ItemID], [Item].[ItemName], [Item].[ProductID]
      FROM [Item]
      ORDER BY [Item].[ItemName] ASC
    `);
    res.json({ data: result.recordset });
  } catch (error) {
    console.error('Error fetching items for lookup:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
}

// Export inventory rows with optional linked purchase order details
export async function getInventoryExportRows(req: Request, res: Response): Promise<void> {
  try {
    const filters: string[] = [];
    const pool = await getPool();
    const request = pool.request();

    if (req.query.itemName) {
      request.input('itemName', sql.NVarChar(255), `%${req.query.itemName}%`);
      filters.push('[Item].[ItemName] LIKE @itemName');
    }

    if (req.query.productID) {
      request.input('productID', sql.NVarChar(255), `%${req.query.productID}%`);
      filters.push('[Item].[ProductID] LIKE @productID');
    }

    if (req.query.itemVersion) {
      request.input('itemVersion', sql.NVarChar(255), `%${req.query.itemVersion}%`);
      filters.push('[Item].[ItemVersion] LIKE @itemVersion');
    }

    if (req.query.releaseDateFrom) {
      request.input('releaseDateFrom', sql.Date, req.query.releaseDateFrom);
      filters.push('[Item].[ReleaseDate] >= @releaseDateFrom');
    }

    if (req.query.releaseDateTo) {
      request.input('releaseDateTo', sql.Date, req.query.releaseDateTo);
      filters.push('[Item].[ReleaseDate] <= @releaseDateTo');
    }

    if (req.query.publisherName) {
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
      if (Array.isArray(req.query.collectionName)) {
        const names = req.query.collectionName as string[];
        const clauses: string[] = [];
        names.forEach((name, idx) => {
          const trimmed = String(name).trim();
          if (/^\d+$/.test(trimmed)) {
            const param = `collectionId_${idx}`;
            request.input(param, sql.Int, parseInt(trimmed, 10));
            clauses.push(`[Item].[CollectionID] = @${param}`);
          } else {
            const param = `collectionName_${idx}`;
            request.input(param, sql.NVarChar(255), trimmed);
            clauses.push(`[Collection].[CollectionName] = @${param}`);
          }
        });
        if (clauses.length) {
          filters.push(`(${clauses.join(' OR ')})`);
        }
      } else {
        const singleValue = String(req.query.collectionName).trim();
        if (/^\d+$/.test(singleValue)) {
          request.input('collectionId', sql.Int, parseInt(singleValue, 10));
          filters.push('[Item].[CollectionID] = @collectionId');
        } else {
          request.input('collectionName', sql.NVarChar(255), `%${singleValue}%`);
          filters.push('[Collection].[CollectionName] LIKE @collectionName');
        }
      }
    }

    if (req.query.categoryName) {
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

    const isPhysical = parseOptionalBoolean(req.query.isPhysical);
    if (isPhysical !== null) {
      request.input('isPhysical', sql.Bit, isPhysical);
      filters.push('[Item].[IsPhysical] = @isPhysical');
    }

    const isDigital = parseOptionalBoolean(req.query.isDigital);
    if (isDigital !== null) {
      request.input('isDigital', sql.Bit, isDigital);
      filters.push('[Item].[IsDigital] = @isDigital');
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const query = `
      SELECT
        [Publisher].[PublisherName] AS [Publisher],
        [Collection].[CollectionName] AS [Collection],
        [Item].[ItemName] AS [Item],
        [Item].[ItemVersion] AS [Version],
        [Category].[CategoryName] AS [Category],
        [SubType].[SubTypeName] AS [SubType],
        [Item].[ProductID] AS [ProductID],
        [Item].[ReleaseDate] AS [ReleaseDate],
        [Item].[IsPhysical] AS [IsPhysical],
        [Item].[IsDigital] AS [IsDigital],
        [ExportPO].[StoreName] AS [Store],
        [ExportPO].[InvoiceNumber] AS [InvoiceNumber],
        [ExportPO].[PurchaseDate] AS [PurchaseDate],
        [ExportPO].[Price] AS [Price],
        [ExportPO].[Count] AS [Count],
        [ExportPO].[POStatus] AS [POStatus]
      FROM [Item]
      INNER JOIN [Publisher] ON [Publisher].[PublisherID] = [Item].[PublisherID]
      INNER JOIN [Collection] ON [Collection].[CollectionID] = [Item].[CollectionID]
      INNER JOIN [Category] ON [Category].[CategoryID] = [Item].[CategoryID]
      INNER JOIN [SubType] ON [SubType].[SubTypeID] = [Item].[SubTypeID]
      LEFT JOIN (
        SELECT
          [PurchaseOrderDetail].[ItemID],
          [PurchaseOrderDetail].[PurchaseOrderDetailID],
          [PurchaseOrder].[PurchaseOrderID],
          [Store].[StoreName],
          [PurchaseOrder].[InvoiceNumber],
          [PurchaseOrder].[PurchasedDate] AS [PurchaseDate],
          [PurchaseOrderDetail].[Price],
          [PurchaseOrderDetail].[Quantity] AS [Count],
          [Status].[StatusName] AS [POStatus]
        FROM [PurchaseOrderDetail]
        INNER JOIN [PurchaseOrder]
          ON [PurchaseOrder].[PurchaseOrderID] = [PurchaseOrderDetail].[PurchaseOrderID]
        LEFT JOIN [Store]
          ON [Store].[StoreID] = [PurchaseOrder].[StoreID]
        LEFT JOIN [Status]
          ON [Status].[StatusID] = [PurchaseOrder].[StatusID]
      ) AS [ExportPO] ON [ExportPO].[ItemID] = [Item].[ItemID]
      ${whereClause}
      ORDER BY
        [Publisher].[PublisherName] ASC,
        [Collection].[CollectionName] ASC,
        [Item].[ItemName] ASC,
        [ExportPO].[PurchaseDate] DESC,
        [ExportPO].[PurchaseOrderID] DESC,
        [ExportPO].[PurchaseOrderDetailID] DESC
    `;

    const result = await request.query(query);
    res.json({ data: result.recordset, total: result.recordset.length });
  } catch (error) {
    console.error('Error exporting inventory rows:', error);
    res.status(500).json({ error: 'Failed to export inventory rows' });
  }
}

// Get purchase orders with filtering and sorting
export async function getPurchaseOrders(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 50);
    const offset = (page - 1) * pageSize;
    const sortBy = (req.query.sortBy as string) || 'PurchasedDate';
    const sortOrder = (req.query.sortOrder as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const validColumns = ['StoreName', 'InvoiceNumber', 'PurchasedDate', 'StatusName', 'ItemCount', 'TotalAmount'];
    const column = validColumns.includes(sortBy) ? sortBy : 'PurchasedDate';

    const filters: string[] = [];
    const pool = await getPool();
    const request = pool.request();

    // Map sort column to correct table/alias
    let sortClause = `[PurchaseOrder].[${column}]`;
    if (column === 'StoreName') {
      sortClause = `[Store].[StoreName]`;
    } else if (column === 'StatusName') {
      sortClause = `[Status].[StatusName]`;
    } else if (column === 'ItemCount' || column === 'TotalAmount') {
      sortClause = `${column}`;
    }

    // Filter by store names (multi-select, OR logic)
    if (req.query.storeNames) {
      if (Array.isArray(req.query.storeNames)) {
        const names = req.query.storeNames as string[];
        const clauses: string[] = [];
        names.forEach((name, idx) => {
          const param = `storeName_${idx}`;
          request.input(param, sql.NVarChar(255), name);
          clauses.push(`[Store].[StoreName] = @${param}`);
        });
        if (clauses.length) {
          filters.push(`(${clauses.join(' OR ')})`);
        }
      } else {
        request.input('storeName', sql.NVarChar(255), `%${req.query.storeNames}%`);
        filters.push('[Store].[StoreName] LIKE @storeName');
      }
    }

    // Filter by invoice number (substring match)
    if (req.query.invoiceNumber) {
      request.input('invoiceNumber', sql.NVarChar(255), `%${req.query.invoiceNumber}%`);
      filters.push('[PurchaseOrder].[InvoiceNumber] LIKE @invoiceNumber');
    }

    if (req.query.purchaseOrderId) {
      request.input('purchaseOrderId', sql.Int, req.query.purchaseOrderId);
      filters.push('[PurchaseOrder].[PurchaseOrderID] = @purchaseOrderId');
    }

    // Filter by purchase date range
    if (req.query.purchaseDateStart) {
      request.input('purchaseDateStart', sql.Date, req.query.purchaseDateStart);
      filters.push('[PurchaseOrder].[PurchasedDate] >= @purchaseDateStart');
    }
    if (req.query.purchaseDateEnd) {
      request.input('purchaseDateEnd', sql.Date, req.query.purchaseDateEnd);
      filters.push('[PurchaseOrder].[PurchasedDate] <= @purchaseDateEnd');
    }

    const rawStatusFilter = req.query.statusNames ?? req.query.statusName;
    if (rawStatusFilter) {
      if (Array.isArray(rawStatusFilter)) {
        const names = rawStatusFilter as string[];
        const clauses: string[] = [];
        names.forEach((name, idx) => {
          const param = `statusName_${idx}`;
          request.input(param, sql.NVarChar(255), name);
          clauses.push(`[Status].[StatusName] = @${param}`);
        });
        if (clauses.length) {
          filters.push(`(${clauses.join(' OR ')})`);
        }
      } else {
        request.input('statusName', sql.NVarChar(255), `%${rawStatusFilter}%`);
        filters.push('[Status].[StatusName] LIKE @statusName');
      }
    }

    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) as total
      FROM [PurchaseOrder]
      INNER JOIN [Store] ON [Store].[StoreID] = [PurchaseOrder].[StoreID]
      LEFT JOIN [Status] ON [Status].[StatusID] = [PurchaseOrder].[StatusID]
      ${whereClause}
    `;

    const countResult = await request.query(countQuery);
    const total = countResult.recordset[0].total;

    const dataQuery = `
      SELECT
        [PurchaseOrder].[PurchaseOrderID],
        [PurchaseOrder].[InvoiceNumber],
        [PurchaseOrder].[PurchasedDate] AS PurchaseDate,
        [PurchaseOrder].[StatusID],
        [Status].[StatusName],
        [Store].[StoreName],
        COUNT(DISTINCT [PurchaseOrderDetail].[PurchaseOrderDetailID]) as ItemCount,
        SUM([PurchaseOrderDetail].[Quantity] * [PurchaseOrderDetail].[Price]) as TotalAmount
      FROM [PurchaseOrder]
      INNER JOIN [Store] ON [Store].[StoreID] = [PurchaseOrder].[StoreID]
      LEFT JOIN [Status] ON [Status].[StatusID] = [PurchaseOrder].[StatusID]
      LEFT JOIN [PurchaseOrderDetail] ON [PurchaseOrderDetail].[PurchaseOrderID] = [PurchaseOrder].[PurchaseOrderID]
      ${whereClause}
      GROUP BY [PurchaseOrder].[PurchaseOrderID], [PurchaseOrder].[InvoiceNumber], [PurchaseOrder].[PurchasedDate], [PurchaseOrder].[StatusID], [Status].[StatusName], [Store].[StoreName]
      ORDER BY ${sortClause} ${sortOrder}
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
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
}

// Get purchase order details for a specific purchase order
export async function getPurchaseOrderDetailsByPurchaseOrder(req: Request, res: Response): Promise<void> {
  try {
    const { purchaseOrderId } = req.query;

    if (!purchaseOrderId) {
      res.status(400).json({ error: 'purchaseOrderId is required' });
      return;
    }

    const pool = await getPool();
    const request = pool.request();

    const query = `
      SELECT
        [PurchaseOrderDetail].[PurchaseOrderDetailID],
        [PurchaseOrderDetail].[ItemID],
        [Item].[ItemName],
        [Item].[ProductID],
        [PurchaseOrderDetail].[Quantity],
        [PurchaseOrderDetail].[Price],
        ([PurchaseOrderDetail].[Quantity] * [PurchaseOrderDetail].[Price]) as LineTotal,
        [PurchaseOrder].[StatusID],
        [Status].[StatusName]
      FROM [PurchaseOrderDetail]
      LEFT JOIN [Item] ON [Item].[ItemID] = [PurchaseOrderDetail].[ItemID]
      INNER JOIN [PurchaseOrder] ON [PurchaseOrder].[PurchaseOrderID] = [PurchaseOrderDetail].[PurchaseOrderID]
      LEFT JOIN [Status] ON [Status].[StatusID] = [PurchaseOrder].[StatusID]
      WHERE [PurchaseOrderDetail].[PurchaseOrderID] = @purchaseOrderId
      ORDER BY COALESCE([Item].[ItemName], '')
    `;

    request.input('purchaseOrderId', sql.Int, parseInt(purchaseOrderId as string));

    const result = await request.query(query);

    res.json({
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (error) {
    console.error('Error fetching purchase order details:', error);
    res.status(500).json({ error: 'Failed to fetch purchase order details' });
  }
}

// Get purchase orders that contain a specific item
export async function getPurchaseOrdersByItem(req: Request, res: Response): Promise<void> {
  try {
    const { itemId } = req.query;

    if (!itemId) {
      res.status(400).json({ error: 'itemId is required' });
      return;
    }

    const parsedItemId = parseInt(itemId as string, 10);
    if (!Number.isInteger(parsedItemId) || parsedItemId <= 0) {
      res.status(400).json({ error: 'itemId must be a positive integer' });
      return;
    }

    const pool = await getPool();
    const request = pool.request();

    const query = `
      SELECT
        [PurchaseOrder].[PurchaseOrderID],
        [PurchaseOrder].[InvoiceNumber],
        [PurchaseOrder].[PurchasedDate] AS PurchaseDate,
        [PurchaseOrder].[StatusID],
        [Status].[StatusName],
        [Store].[StoreName],
        MIN([MatchedDetail].[PurchaseOrderDetailID]) AS PurchaseOrderDetailID,
        COUNT(DISTINCT [AllDetails].[PurchaseOrderDetailID]) AS ItemCount,
        ISNULL(SUM([AllDetails].[Quantity] * [AllDetails].[Price]), 0) AS TotalAmount
      FROM [PurchaseOrder]
      INNER JOIN [Store] ON [Store].[StoreID] = [PurchaseOrder].[StoreID]
      LEFT JOIN [Status] ON [Status].[StatusID] = [PurchaseOrder].[StatusID]
      INNER JOIN [PurchaseOrderDetail] AS [MatchedDetail]
        ON [MatchedDetail].[PurchaseOrderID] = [PurchaseOrder].[PurchaseOrderID]
       AND [MatchedDetail].[ItemID] = @itemId
      LEFT JOIN [PurchaseOrderDetail] AS [AllDetails]
        ON [AllDetails].[PurchaseOrderID] = [PurchaseOrder].[PurchaseOrderID]
      GROUP BY
        [PurchaseOrder].[PurchaseOrderID],
        [PurchaseOrder].[InvoiceNumber],
        [PurchaseOrder].[PurchasedDate],
        [PurchaseOrder].[StatusID],
        [Status].[StatusName],
        [Store].[StoreName]
      ORDER BY [PurchaseOrder].[PurchasedDate] DESC, [PurchaseOrder].[PurchaseOrderID] DESC
    `;

    request.input('itemId', sql.Int, parsedItemId);

    const result = await request.query(query);

    res.json({
      data: result.recordset,
      total: result.recordset.length,
    });
  } catch (error) {
    console.error('Error fetching purchase orders by item:', error);
    res.status(500).json({ error: 'Failed to fetch purchase orders for item' });
  }
}

// Dashboard overview metrics and top-10 lists
export async function getDashboardOverview(req: Request, res: Response): Promise<void> {
  try {
    const topN = Math.max(1, Math.min(50, parseInt(req.query.top as string, 10) || 10));
    const pool = await getPool();

    const totalsQuery = `
      SELECT
        (SELECT COUNT(*) FROM [Publisher]) AS PublishersTotal,
        (SELECT COUNT(*) FROM [Collection]) AS CollectionsTotal,
        (SELECT COUNT(*) FROM [Item]) AS ItemsTotal,
        (SELECT COUNT(*) FROM [PurchaseOrder]) AS OrdersTotal
    `;

    const topPublishersQuery = `
      SELECT TOP (@topN)
        [Publisher].[PublisherName],
        COUNT(*) AS [ItemCount]
      FROM [Item]
      INNER JOIN [Publisher] ON [Publisher].[PublisherID] = [Item].[PublisherID]
      GROUP BY [Publisher].[PublisherName]
      ORDER BY [ItemCount] DESC, [Publisher].[PublisherName] ASC
    `;

    const topCollectionsQuery = `
      SELECT TOP (@topN)
        [Collection].[CollectionName],
        COUNT(*) AS [ItemCount]
      FROM [Item]
      INNER JOIN [Collection] ON [Collection].[CollectionID] = [Item].[CollectionID]
      GROUP BY [Collection].[CollectionName]
      ORDER BY [ItemCount] DESC, [Collection].[CollectionName] ASC
    `;

    const topItemsByPriceQuery = `
      SELECT TOP (@topN)
        [Item].[ItemID],
        [Item].[ItemName],
        [Item].[ProductID],
        MAX([PurchaseOrderDetail].[Price]) AS [MaxPrice]
      FROM [PurchaseOrderDetail]
      INNER JOIN [Item] ON [Item].[ItemID] = [PurchaseOrderDetail].[ItemID]
      GROUP BY [Item].[ItemID], [Item].[ItemName], [Item].[ProductID]
      ORDER BY [MaxPrice] DESC, [Item].[ItemName] ASC
    `;

    const topOrdersByAmountQuery = `
      SELECT TOP (@topN)
        [PurchaseOrder].[PurchaseOrderID],
        [PurchaseOrder].[InvoiceNumber],
        [Store].[StoreName],
        [PurchaseOrder].[PurchasedDate] AS [PurchaseDate],
        ISNULL(SUM([PurchaseOrderDetail].[Quantity] * [PurchaseOrderDetail].[Price]), 0) AS [TotalAmount]
      FROM [PurchaseOrder]
      INNER JOIN [Store] ON [Store].[StoreID] = [PurchaseOrder].[StoreID]
      LEFT JOIN [PurchaseOrderDetail] ON [PurchaseOrderDetail].[PurchaseOrderID] = [PurchaseOrder].[PurchaseOrderID]
      GROUP BY
        [PurchaseOrder].[PurchaseOrderID],
        [PurchaseOrder].[InvoiceNumber],
        [Store].[StoreName],
        [PurchaseOrder].[PurchasedDate]
      ORDER BY [TotalAmount] DESC, [PurchaseOrder].[PurchaseOrderID] DESC
    `;

    const publisherDashboardQuery = `
      SELECT
        [Publisher].[PublisherID],
        [Publisher].[PublisherName],
        COUNT(DISTINCT [Item].[ItemID]) AS [TotalItems],
        COUNT(DISTINCT CASE WHEN [PurchaseOrder].[PurchaseOrderID] IS NOT NULL THEN [Item].[ItemID] END) AS [ItemsInPurchaseOrder],
        CAST(
          CASE
            WHEN COUNT(DISTINCT [Item].[ItemID]) = 0 THEN 0
            ELSE (
              100.0 *
              COUNT(DISTINCT CASE WHEN [PurchaseOrder].[PurchaseOrderID] IS NOT NULL THEN [Item].[ItemID] END)
            ) / COUNT(DISTINCT [Item].[ItemID])
          END AS DECIMAL(5,2)
        ) AS [CoveragePercent]
      FROM [Publisher]
      LEFT JOIN [Item] ON [Item].[PublisherID] = [Publisher].[PublisherID]
      LEFT JOIN [PurchaseOrderDetail] ON [PurchaseOrderDetail].[ItemID] = [Item].[ItemID]
      LEFT JOIN [PurchaseOrder] ON [PurchaseOrder].[PurchaseOrderID] = [PurchaseOrderDetail].[PurchaseOrderID]
      GROUP BY [Publisher].[PublisherID], [Publisher].[PublisherName]
      ORDER BY [Publisher].[PublisherName] ASC
    `;

    const collectionDashboardQuery = `
      SELECT
        [Collection].[CollectionID],
        [Collection].[CollectionName],
        COUNT(DISTINCT [Item].[ItemID]) AS [TotalItems],
        COUNT(DISTINCT CASE WHEN [PurchaseOrder].[PurchaseOrderID] IS NOT NULL THEN [Item].[ItemID] END) AS [ItemsInPurchaseOrder],
        CAST(
          CASE
            WHEN COUNT(DISTINCT [Item].[ItemID]) = 0 THEN 0
            ELSE (
              100.0 *
              COUNT(DISTINCT CASE WHEN [PurchaseOrder].[PurchaseOrderID] IS NOT NULL THEN [Item].[ItemID] END)
            ) / COUNT(DISTINCT [Item].[ItemID])
          END AS DECIMAL(5,2)
        ) AS [CoveragePercent]
      FROM [Collection]
      LEFT JOIN [Item] ON [Item].[CollectionID] = [Collection].[CollectionID]
      LEFT JOIN [PurchaseOrderDetail] ON [PurchaseOrderDetail].[ItemID] = [Item].[ItemID]
      LEFT JOIN [PurchaseOrder] ON [PurchaseOrder].[PurchaseOrderID] = [PurchaseOrderDetail].[PurchaseOrderID]
      GROUP BY [Collection].[CollectionID], [Collection].[CollectionName]
      ORDER BY [Collection].[CollectionName] ASC
    `;

    const totalsResult = await pool.request().query(totalsQuery);

    const topPublishersResult = await pool
      .request()
      .input('topN', sql.Int, topN)
      .query(topPublishersQuery);

    const topCollectionsResult = await pool
      .request()
      .input('topN', sql.Int, topN)
      .query(topCollectionsQuery);

    const topItemsByPriceResult = await pool
      .request()
      .input('topN', sql.Int, topN)
      .query(topItemsByPriceQuery);

    const topOrdersByAmountResult = await pool
      .request()
      .input('topN', sql.Int, topN)
      .query(topOrdersByAmountQuery);

    const publisherDashboardResult = await pool
      .request()
      .query(publisherDashboardQuery);

    const collectionDashboardResult = await pool
      .request()
      .query(collectionDashboardQuery);

    const totals = totalsResult.recordset[0] || {
      PublishersTotal: 0,
      CollectionsTotal: 0,
      ItemsTotal: 0,
      OrdersTotal: 0,
    };

    res.json({
      totals: {
        publishers: Number(totals.PublishersTotal || 0),
        collections: Number(totals.CollectionsTotal || 0),
        items: Number(totals.ItemsTotal || 0),
        orders: Number(totals.OrdersTotal || 0),
      },
      topPublishers: topPublishersResult.recordset,
      topCollections: topCollectionsResult.recordset,
      topItemsByPrice: topItemsByPriceResult.recordset,
      topOrdersByAmount: topOrdersByAmountResult.recordset,
      publisherDashboard: publisherDashboardResult.recordset.map((row) => ({
        PublisherID: Number(row.PublisherID || 0),
        PublisherName: String(row.PublisherName || ''),
        TotalItems: Number(row.TotalItems || 0),
        ItemsInPurchaseOrder: Number(row.ItemsInPurchaseOrder || 0),
        CoveragePercent: Number(row.CoveragePercent || 0),
      })),
      collectionDashboard: collectionDashboardResult.recordset.map((row) => ({
        CollectionID: Number(row.CollectionID || 0),
        CollectionName: String(row.CollectionName || ''),
        TotalItems: Number(row.TotalItems || 0),
        ItemsInPurchaseOrder: Number(row.ItemsInPurchaseOrder || 0),
        CoveragePercent: Number(row.CoveragePercent || 0),
      })),
    });
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
}

// Create new record
export async function createRecord(req: Request, res: Response): Promise<void> {
  const { tableName } = req.params;
  try {
    const data = { ...req.body };
    const pool = await getPool();

    if (tableName === 'Item' && Object.prototype.hasOwnProperty.call(data, 'StatusID')) {
      res.status(400).json({
        error: 'StatusID can no longer be set on Item. Update PurchaseOrder.StatusID instead.',
      });
      return;
    }

    if (tableName === 'Item') {
      const normalizedItemVersion = normalizeItemVersion(data.ItemVersion);
      const itemVersionError = validateItemVersion(normalizedItemVersion);
      if (itemVersionError) {
        res.status(400).json({ error: itemVersionError });
        return;
      }
      data.ItemVersion = normalizedItemVersion;
    }

    if (tableName === 'RPGSystem') {
      const rpgSystemName = normalizeBulkText(data.RPGSystemName);
      const rpgSystemUrl = normalizeItemVersion(data.RPGSystemURL);
      const rpgSystemDescription = normalizeItemVersion(data.RPGSystemDescription);

      if (!rpgSystemName) {
        res.status(400).json({ error: 'RPGSystemName is required.' });
        return;
      }

      const request = pool.request();
      request.input('RPGSystemName', sql.NVarChar(255), rpgSystemName);
      request.input('RPGSystemURL', sql.NVarChar(sql.MAX), rpgSystemUrl);
      request.input('RPGSystemDescription', sql.NVarChar(sql.MAX), rpgSystemDescription);

      await request.query(`
        INSERT INTO [RPGSystem] ([RPGSystemID], [RPGSystemName], [RPGSystemURL], [RPGSystemDescription])
        SELECT ISNULL(MAX([RPGSystemID]), 0) + 1, @RPGSystemName, @RPGSystemURL, @RPGSystemDescription
        FROM [RPGSystem] WITH (UPDLOCK, HOLDLOCK)
      `);

      res.status(201).json({ success: true, message: 'Record created' });
      return;
    }

    const request = pool.request();

    if (tableName === 'Collection') {
      delete data.ImageUploadDate;
      delete data.ImageFileName;

      if (Object.prototype.hasOwnProperty.call(data, 'CollectionTypeID')) {
        const collectionTypeId = parseInt(data.CollectionTypeID, 10);
        if (!Number.isInteger(collectionTypeId)) {
          await deleteUploadedFile(req.file);
          res.status(400).json({ error: 'Collection Type is required.' });
          return;
        }
        data.CollectionTypeID = collectionTypeId;
      }

      if (req.file) {
        data.ImageFileName = req.file.filename;
      }
    }

    const columns = Object.keys(data);
    const values = Object.values(data);
    const insertColumns = tableName === 'Collection' ? [...columns, 'ImageUploadDate'] : columns;
    const placeholders = [
      ...columns.map((col) => `@${col}`),
      ...(tableName === 'Collection' ? ['GETDATE()'] : []),
    ].join(', ');
    const columnList = insertColumns.map(col => `[${col}]`).join(', ');

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
    if (tableName === 'Collection') {
      await deleteUploadedFile(req.file);
    }

    console.error('Error creating record:', error);

    const dbError = error as any;
    if (
      tableName === 'PurchaseOrderDetail' &&
      (dbError?.number === 2627 || dbError?.number === 2601)
    ) {
      res.status(409).json({
        error: 'This item already exists in the selected purchase order. Edit the existing row instead of adding a duplicate item.',
      });
      return;
    }

    res.status(500).json({
      error: dbError?.message || 'Failed to create record',
    });
  }
}

// Create a PurchaseOrder and its PurchaseOrderDetail rows inside one transaction
export async function createPurchaseOrderWithDetails(req: Request, res: Response): Promise<void> {
  const { InvoiceNumber, StoreID, PurchasedDate, StatusID, details } = req.body;

  // --- input validation ---
  if (!InvoiceNumber || typeof InvoiceNumber !== 'string' || !InvoiceNumber.trim()) {
    res.status(400).json({ error: 'InvoiceNumber is required.' });
    return;
  }
  const storeId = parseInt(StoreID, 10);
  if (!Number.isInteger(storeId) || storeId <= 0) {
    res.status(400).json({ error: 'StoreID must be a positive integer.' });
    return;
  }
  if (!PurchasedDate || typeof PurchasedDate !== 'string') {
    res.status(400).json({ error: 'PurchasedDate is required.' });
    return;
  }

  let statusId: number | null = null;
  if (StatusID !== undefined && StatusID !== null && `${StatusID}` !== '') {
    const parsedStatusId = parseInt(StatusID, 10);
    if (!Number.isInteger(parsedStatusId) || parsedStatusId <= 0) {
      res.status(400).json({ error: 'StatusID must be a positive integer.' });
      return;
    }
    statusId = parsedStatusId;
  }

  if (!Array.isArray(details) || details.length === 0) {
    res.status(400).json({ error: 'At least one detail row is required.' });
    return;
  }
  for (let i = 0; i < details.length; i++) {
    const d = details[i];
    const itemId = parseInt(d.ItemID, 10);
    const qty = Number(d.Quantity);
    const price = Number(d.Price);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      res.status(400).json({ error: `Detail row ${i + 1}: ItemID must be a positive integer.` });
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      res.status(400).json({ error: `Detail row ${i + 1}: Quantity must be greater than 0.` });
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      res.status(400).json({ error: `Detail row ${i + 1}: Price must be 0 or greater.` });
      return;
    }
  }

  const pool = await getPool();

  if (statusId === null) {
    const defaultStatusResult = await pool.request()
      .input('defaultStatusName', sql.NVarChar(255), 'On Order')
      .query(`
        SELECT TOP 1 [StatusID]
        FROM [Status]
        WHERE LOWER(LTRIM(RTRIM([StatusName]))) = LOWER(LTRIM(RTRIM(@defaultStatusName)))
      `);

    if (!defaultStatusResult.recordset.length) {
      res.status(500).json({ error: 'Default order status "On Order" was not found.' });
      return;
    }

    statusId = defaultStatusResult.recordset[0].StatusID;
  }

  // Check unique constraint (StoreID + InvoiceNumber) — pass 0 to exclude nothing
  const constraint = await checkPurchaseOrderUniqueConstraint(storeId, InvoiceNumber.trim(), 0);
  if (constraint.exists) {
    res.status(409).json({
      error: `A purchase order with invoice number "${InvoiceNumber.trim()}" already exists for store "${constraint.storeName}". Each store can only have one purchase order per invoice number.`,
    });
    return;
  }

  const transaction = new sql.Transaction(pool);
  try {
    await transaction.begin();

    // Insert PurchaseOrder and capture generated ID
    const headerRequest = new sql.Request(transaction);
    headerRequest.input('InvoiceNumber', sql.NVarChar(255), InvoiceNumber.trim());
    headerRequest.input('StoreID', sql.Int, storeId);
    headerRequest.input('PurchasedDate', sql.Date, PurchasedDate);
    headerRequest.input('StatusID', sql.Int, statusId);

    const headerResult = await headerRequest.query(`
      INSERT INTO [PurchaseOrder] ([InvoiceNumber], [StoreID], [PurchasedDate], [StatusID])
      OUTPUT INSERTED.[PurchaseOrderID]
      VALUES (@InvoiceNumber, @StoreID, @PurchasedDate, @StatusID)
    `);

    const newOrderId: number = headerResult.recordset[0].PurchaseOrderID;

    // Insert each detail row
    for (const d of details) {
      const detailRequest = new sql.Request(transaction);
      detailRequest.input('PurchaseOrderID', sql.Int, newOrderId);
      detailRequest.input('ItemID', sql.Int, parseInt(d.ItemID, 10));
      detailRequest.input('Quantity', sql.Int, Math.round(Number(d.Quantity)));
      detailRequest.input('Price', sql.Decimal(18, 2), Number(d.Price));

      await detailRequest.query(`
        INSERT INTO [PurchaseOrderDetail] ([PurchaseOrderID], [ItemID], [Quantity], [Price])
        VALUES (@PurchaseOrderID, @ItemID, @Quantity, @Price)
      `);
    }

    await transaction.commit();
    res.status(201).json({ success: true, PurchaseOrderID: newOrderId });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating purchase order with details:', error);
    const dbError = error as any;
    if (dbError?.number === 2627 || dbError?.number === 2601) {
      res.status(409).json({
        error: 'One or more items already exist in this purchase order. Each item may only appear once per order.',
      });
      return;
    }
    res.status(500).json({ error: dbError?.message || 'Failed to create purchase order' });
  }
}

// Delete record by query params (supports composite-key tables)
export async function deleteRecordByQuery(req: Request, res: Response): Promise<void> {
  try {
    const { tableName } = req.params;
    const pool = await getPool();
    const request = pool.request();

    if (req.query.id) {
      request.input('id', sql.Int, req.query.id as string);
      await request.query(`DELETE FROM [${tableName}] WHERE [${getPrimaryKeyColumn(tableName)}] = @id`);
      res.json({ success: true, message: 'Record deleted' });
      return;
    }

    if (tableName === 'PurchaseOrderDetail') {
      const purchaseOrderId = parseInt(req.query.purchaseOrderId as string, 10);

      if (!Number.isInteger(purchaseOrderId)) {
        res.status(400).json({ error: 'purchaseOrderId is required' });
        return;
      }

      request.input('purchaseOrderId', sql.Int, purchaseOrderId);
      await request.query('DELETE FROM [PurchaseOrderDetail] WHERE [PurchaseOrderID] = @purchaseOrderId');
      res.json({ success: true, message: 'Purchase order details deleted' });
      return;
    }

    if (tableName === 'CategorySubType') {
      const categoryId = parseInt(req.query.categoryId as string, 10);
      const subTypeId = parseInt(req.query.subTypeId as string, 10);

      if (!Number.isInteger(categoryId) || !Number.isInteger(subTypeId)) {
        res.status(400).json({ error: 'categoryId and subTypeId are required' });
        return;
      }

      request.input('categoryId', sql.Int, categoryId);
      request.input('subTypeId', sql.Int, subTypeId);
      await request.query(`DELETE FROM [${tableName}] WHERE [CategoryID] = @categoryId AND [SubTypeID] = @subTypeId`);
      res.json({ success: true, message: 'Record deleted' });
      return;
    }

    if (tableName === 'PublisherCollection') {
      const publisherId = parseInt(req.query.publisherId as string, 10);
      const collectionId = parseInt(req.query.collectionId as string, 10);

      if (!Number.isInteger(publisherId) || !Number.isInteger(collectionId)) {
        res.status(400).json({ error: 'publisherId and collectionId are required' });
        return;
      }

      request.input('publisherId', sql.Int, publisherId);
      request.input('collectionId', sql.Int, collectionId);
      await request.query(`DELETE FROM [${tableName}] WHERE [PublisherID] = @publisherId AND [CollectionID] = @collectionId`);
      res.json({ success: true, message: 'Record deleted' });
      return;
    }

    if (tableName === 'CollectionRPGSystem') {
      const collectionId = parseInt(req.query.collectionId as string, 10);
      const rpgSystemId = parseInt(req.query.rpgSystemId as string, 10);

      if (!Number.isInteger(collectionId) || !Number.isInteger(rpgSystemId)) {
        res.status(400).json({ error: 'collectionId and rpgSystemId are required' });
        return;
      }

      request.input('collectionId', sql.Int, collectionId);
      request.input('rpgSystemId', sql.Int, rpgSystemId);
      await request.query(`DELETE FROM [${tableName}] WHERE [CollectionID] = @collectionId AND [RPGSystemID] = @rpgSystemId`);
      res.json({ success: true, message: 'Record deleted' });
      return;
    }

    res.status(400).json({ error: 'Invalid delete parameters' });
  } catch (error) {
    console.error('Error deleting record by query:', error);

    const dbError = error as any;
    const dbMessage = String(dbError?.message || dbError?.originalError?.message || '').toLowerCase();
    const isConstraintViolation =
      dbError?.number === 547 ||
      dbMessage.includes('reference constraint') ||
      dbMessage.includes('foreign key') ||
      dbMessage.includes('conflicted with the reference');

    if (req.params.tableName === 'PublisherCollection' && isConstraintViolation) {
      res.status(409).json({
        error:
          'Delete failed. This publisher/collection pair is still referenced by one or more items. Reassign or remove the linked items first, then try again.',
      });
      return;
    }

    if (req.params.tableName === 'CategorySubType' && isConstraintViolation) {
      res.status(409).json({
        error:
          'Delete failed. The category/sub-category pair is still references by one or more items. Reassign or remove the linked items first, then try again.',
      });
      return;
    }

    res.status(500).json({ error: dbError?.message || 'Failed to delete record' });
  }
}

// Update record
export async function updateRecord(req: Request, res: Response): Promise<void> {
  try {
    const { tableName, id } = req.params;
    const data = { ...req.body };
    const pool = await getPool();
    const primaryKey = getPrimaryKeyColumn(tableName);

    if (tableName === 'Item') {
      if (Object.prototype.hasOwnProperty.call(data, 'StatusID')) {
        res.status(400).json({
          error: 'StatusID can no longer be set on Item. Update PurchaseOrder.StatusID instead.',
        });
        return;
      }

      const request = pool.request();
      const updates: string[] = [];

      if (Object.prototype.hasOwnProperty.call(data, 'ItemName')) {
        request.input('ItemName', sql.NVarChar(255), data.ItemName);
        updates.push('[ItemName] = @ItemName');
      }

      if (Object.prototype.hasOwnProperty.call(data, 'ItemVersion')) {
        const normalizedItemVersion = normalizeItemVersion(data.ItemVersion);
        const itemVersionError = validateItemVersion(normalizedItemVersion);
        if (itemVersionError) {
          res.status(400).json({ error: itemVersionError });
          return;
        }
        request.input('ItemVersion', sql.NVarChar(sql.MAX), normalizedItemVersion);
        updates.push('[ItemVersion] = @ItemVersion');
      }

      if (Object.prototype.hasOwnProperty.call(data, 'ProductID')) {
        request.input('ProductID', sql.NVarChar(50), data.ProductID ?? null);
        updates.push('[ProductID] = @ProductID');
      }

      if (Object.prototype.hasOwnProperty.call(data, 'ReleaseDate')) {
        request.input('ReleaseDate', sql.Date, data.ReleaseDate ?? null);
        updates.push('[ReleaseDate] = @ReleaseDate');
      }

      if (Object.prototype.hasOwnProperty.call(data, 'IsPhysical')) {
        request.input('IsPhysical', sql.Bit, parseOptionalBoolean(data.IsPhysical));
        updates.push('[IsPhysical] = @IsPhysical');
      }

      if (Object.prototype.hasOwnProperty.call(data, 'IsDigital')) {
        request.input('IsDigital', sql.Bit, parseOptionalBoolean(data.IsDigital));
        updates.push('[IsDigital] = @IsDigital');
      }

      if (Object.prototype.hasOwnProperty.call(data, 'PublisherID')) {
        request.input('PublisherID', sql.Int, data.PublisherID ?? null);
        updates.push('[PublisherID] = @PublisherID');
      }

      if (Object.prototype.hasOwnProperty.call(data, 'CollectionID')) {
        request.input('CollectionID', sql.Int, data.CollectionID ?? null);
        updates.push('[CollectionID] = @CollectionID');
      }

      if (Object.prototype.hasOwnProperty.call(data, 'CategoryID')) {
        request.input('CategoryID', sql.Int, data.CategoryID ?? null);
        updates.push('[CategoryID] = @CategoryID');
      }

      if (Object.prototype.hasOwnProperty.call(data, 'SubTypeID')) {
        request.input('SubTypeID', sql.Int, data.SubTypeID ?? null);
        updates.push('[SubTypeID] = @SubTypeID');
      }

      if (updates.length === 0) {
        res.status(400).json({ error: 'At least one updatable field is required.' });
        return;
      }

      request.input('id', sql.Int, id);

      await request.query(`
        UPDATE [Item]
        SET ${updates.join(', ')}
        WHERE [${primaryKey}] = @id
      `);

      res.json({ success: true, message: 'Record updated' });
      return;
    } else if (tableName === 'PurchaseOrder' && (data.StoreID || data.InvoiceNumber)) {
      // Validate unique constraint for StoreID + InvoiceNumber combination
      const currentOrder = await pool.request()
        .input('id', sql.Int, id)
        .query('SELECT StoreID, InvoiceNumber FROM PurchaseOrder WHERE PurchaseOrderID = @id');
      
      if (currentOrder.recordset.length === 0) {
        res.status(404).json({ error: 'Purchase order not found' });
        return;
      }

      const current = currentOrder.recordset[0];
      const newStoreId = data.StoreID ?? current.StoreID;
      const newInvoiceNumber = data.InvoiceNumber ?? current.InvoiceNumber;

      // Check if the new combination already exists
      const constraint = await checkPurchaseOrderUniqueConstraint(newStoreId, newInvoiceNumber, parseInt(id as string));
      if (constraint.exists) {
        res.status(409).json({
          error: `A purchase order with invoice number "${newInvoiceNumber}" already exists for store "${constraint.storeName}". Each store can only have one purchase order per invoice number.`
        });
        return;
      }

      // If validation passes, proceed with update
      const request = pool.request();
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
      return;
    } else {
      if (tableName === 'Collection') {
        delete data.ImageUploadDate;
        delete data.ImageFileName;

        if (Object.prototype.hasOwnProperty.call(data, 'CollectionTypeID')) {
          const collectionTypeId = parseInt(data.CollectionTypeID, 10);
          if (!Number.isInteger(collectionTypeId)) {
            await deleteUploadedFile(req.file);
            res.status(400).json({ error: 'Collection Type is required.' });
            return;
          }
          data.CollectionTypeID = collectionTypeId;
        }

        if (req.file) {
          data.ImageFileName = req.file.filename;
        }
      }

      const request = pool.request();
      const updateColumns = Object.keys(data);
      const updates = [
        ...updateColumns.map(col => `[${col}] = @${col}`),
        ...(tableName === 'Collection' ? ['[ImageUploadDate] = GETDATE()'] : []),
      ]
        .join(', ');

      updateColumns.forEach((col) => {
        const value = data[col];
        request.input(col, value);
      });

      request.input('id', sql.Int, id);

      const query = `
        UPDATE [${tableName}]
        SET ${updates}
        WHERE [${primaryKey}] = @id
      `;

      await request.query(query);
    }

    res.json({ success: true, message: 'Record updated' });
  } catch (error) {
    if (req.params.tableName === 'Collection') {
      await deleteUploadedFile(req.file);
    }

    console.error('Error updating record:', error);
    res.status(500).json({
      error: (error as any)?.message || 'Failed to update record',
    });
  }
}

// Delete record
export async function deleteRecord(req: Request, res: Response): Promise<void> {
  try {
    const { tableName, id } = req.params;
    const pool = await getPool();
    const primaryKey = getPrimaryKeyColumn(tableName);

    // Prevent deletion of stores with purchase orders
    if (tableName === 'Store') {
      const hasPurchaseOrders = await checkStoreHasPurchaseOrders(parseInt(id as string));
      if (hasPurchaseOrders) {
        res.status(409).json({ 
          error: 'Cannot delete this store because it has associated purchase orders. Please delete or reassign the related orders first.' 
        });
        return;
      }
    }

    if (tableName === 'Item') {
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        const request = new sql.Request(transaction);
        request.input('id', sql.Int, id);

        // Remove child purchase order detail rows first to satisfy FK constraints.
        await request.query(`
          IF OBJECT_ID('dbo.PurchaseOrderDetail', 'U') IS NOT NULL
            DELETE FROM [PurchaseOrderDetail] WHERE [ItemID] = @id
        `);
        await request.query(`DELETE FROM [Item] WHERE [ItemID] = @id`);

        await transaction.commit();
      } catch (txError) {
        await transaction.rollback();
        throw txError;
      }
    } else if (tableName === 'Publisher') {
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        const request = new sql.Request(transaction);
        request.input('id', sql.Int, id);

        // Remove PublisherCollection links first so a publisher with no remaining items can be deleted.
        await request.query(`DELETE FROM [PublisherCollection] WHERE [PublisherID] = @id`);
        await request.query(`DELETE FROM [Publisher] WHERE [PublisherID] = @id`);

        await transaction.commit();
      } catch (txError) {
        await transaction.rollback();
        throw txError;
      }
    } else {
      await pool.request()
        .input('id', sql.Int, id)
        .query(`DELETE FROM [${tableName}] WHERE [${primaryKey}] = @id`);
    }

    res.json({ success: true, message: 'Record deleted' });
  } catch (error) {
    console.error('Error deleting record:', error);
    res.status(500).json({
      error: (error as any)?.message || 'Failed to delete record',
    });
  }
}
