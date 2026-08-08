import { Request, Response, NextFunction } from 'express';

export type AppMode = 'read-only' | 'update' | 'administrator';

export const MODE_RANK: Record<AppMode, number> = {
  'read-only': 0,
  update: 1,
  administrator: 2,
};

const VALID_MODES = new Set<AppMode>(['read-only', 'update', 'administrator']);

export function isAppMode(value: unknown): value is AppMode {
  return typeof value === 'string' && VALID_MODES.has(value as AppMode);
}

// Requires requireAuth (backend/src/auth/requireAuth.ts) to have run first
// and attached req.appUser from the verified session cookie.
export function resolveAppMode(req: Request): AppMode {
  return req.appUser?.mode ?? 'read-only';
}

export function requireMode(min: AppMode) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const currentMode = resolveAppMode(req);
    if (MODE_RANK[currentMode] < MODE_RANK[min]) {
      res.status(403).json({ error: 'Forbidden', requiredMode: min, currentMode });
      return;
    }
    next();
  };
}
