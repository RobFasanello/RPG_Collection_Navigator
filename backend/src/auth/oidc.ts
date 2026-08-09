import * as client from 'openid-client';
import { Request, Response } from 'express';
import { getCookie } from './session.js';

const GOOGLE_ISSUER = 'https://accounts.google.com';
const OAUTH_STATE_COOKIE = 'rpg_oauth_state';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

let configPromise: Promise<client.Configuration> | null = null;

function getConfig(): Promise<client.Configuration> {
  if (!configPromise) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not configured');
    }
    configPromise = client.discovery(new URL(GOOGLE_ISSUER), clientId, clientSecret);
  }
  return configPromise;
}

// Derived from the incoming request rather than a fixed env var, so the same
// running backend answers correctly whether it's reached directly (dev, e.g.
// http://localhost:3001) or through the IIS reverse proxy (prod, e.g.
// http://localhost) — Google only ever redirects back to whichever of these
// origins is registered as an authorized redirect URI, so trusting the Host
// header here doesn't widen what an attacker could do.
export function getRequestOrigin(req: Request): string {
  return `${req.protocol}://${req.get('host')}`;
}

function getRedirectUri(req: Request): string {
  return `${getRequestOrigin(req)}/api/auth/callback`;
}

interface OAuthState {
  state: string;
  codeVerifier: string;
}

export async function buildGoogleAuthorizationUrl(req: Request, res: Response): Promise<string> {
  const config = await getConfig();
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();

  const authorizationUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: getRedirectUri(req),
    scope: 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    // Always show Google's account chooser instead of silently reusing
    // whichever Google account the browser is already signed into — lets
    // people (including you, for testing) switch accounts without needing
    // an incognito window.
    prompt: 'select_account',
  });

  const payload: OAuthState = { state, codeVerifier };
  res.cookie(OAUTH_STATE_COOKIE, JSON.stringify(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: OAUTH_STATE_TTL_MS,
    path: '/api/auth',
  });

  return authorizationUrl.href;
}

export interface GoogleIdentity {
  email: string;
  name: string;
}

export async function handleGoogleCallback(req: Request, res: Response): Promise<GoogleIdentity> {
  const rawState = getCookie(req, OAUTH_STATE_COOKIE);
  res.clearCookie(OAUTH_STATE_COOKIE, { path: '/api/auth' });
  if (!rawState) {
    throw new Error('Missing OAuth state cookie');
  }

  const { state, codeVerifier } = JSON.parse(rawState) as OAuthState;
  const config = await getConfig();

  const currentUrl = new URL(`${getRequestOrigin(req)}${req.originalUrl}`);

  const tokens = await client.authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: codeVerifier,
    expectedState: state,
  });

  const claims = tokens.claims();
  if (!claims || typeof claims.email !== 'string') {
    throw new Error('Google did not return an email claim');
  }

  return {
    email: claims.email,
    name: typeof claims.name === 'string' ? claims.name : claims.email,
  };
}
