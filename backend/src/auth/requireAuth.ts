import { Request, Response, NextFunction } from 'express';
import { getCookie, verifySessionToken, SESSION_COOKIE_NAME, type SessionUser } from './session.js';

declare global {
  namespace Express {
    interface Request {
      appUser?: SessionUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getCookie(req, SESSION_COOKIE_NAME);
  const user = token ? await verifySessionToken(token) : null;

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.appUser = user;
  next();
}
