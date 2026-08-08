import { Request, Response } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import type { AppMode } from '../permissions/appMode.js';

export const SESSION_COOKIE_NAME = 'rpg_session';
const SESSION_TTL = '12h';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export interface SessionUser {
  email: string;
  name: string;
  mode: AppMode;
}

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, mode: user.mode })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.email !== 'string' || typeof payload.mode !== 'string') {
      return null;
    }
    return {
      email: payload.email,
      name: typeof payload.name === 'string' ? payload.name : payload.email,
      mode: payload.mode as AppMode,
    };
  } catch {
    return null;
  }
}

export function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = part.slice(0, separatorIndex).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(separatorIndex + 1).trim());
    }
  }
  return undefined;
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
}
