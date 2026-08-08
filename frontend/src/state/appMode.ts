export type AppMode = 'read-only' | 'update' | 'administrator';

export const MODE_RANK: Record<AppMode, number> = {
  'read-only': 0,
  update: 1,
  administrator: 2,
};

export const APP_MODE_FORBIDDEN_EVENT = 'app-mode:forbidden';
export const APP_MODE_UNAUTHENTICATED_EVENT = 'app-mode:unauthenticated';
