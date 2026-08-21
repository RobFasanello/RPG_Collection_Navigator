import { Request, Response, NextFunction } from 'express';
import { resolveAppMode, MODE_RANK } from './appMode.js';

// Reference/setup tables (see frontend SETUP_NAV_ITEMS / ReferenceListsPage) —
// editing these requires administrator mode. Any table not listed here
// defaults to requiring only update mode.
const ADMIN_ONLY_TABLES = new Set<string>([
  'Publisher',
  'PublisherCollection',
  'Collection',
  'CollectionRPGSystem',
  'CollectionType',
  'Category',
  'SubType',
  'CategorySubType',
  'Location',
  'LocationType',
  'RPGSystem',
  'Store',
  'MiniatureSize',
  'MiniatureRarity',
  'ConditionType',
  'Status',
  'User',
]);

export function requireTableWriteMode(req: Request, res: Response, next: NextFunction): void {
  const { tableName } = req.params;
  const requiredMode = ADMIN_ONLY_TABLES.has(tableName) ? 'administrator' : 'update';
  const currentMode = resolveAppMode(req);

  if (MODE_RANK[currentMode] < MODE_RANK[requiredMode]) {
    res.status(403).json({ error: 'Forbidden', requiredMode, currentMode });
    return;
  }
  next();
}
