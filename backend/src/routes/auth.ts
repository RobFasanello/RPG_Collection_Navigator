import { Router } from 'express';
import { buildGoogleAuthorizationUrl, handleGoogleCallback, getRequestOrigin } from '../auth/oidc.js';
import { resolveUserMode } from '../auth/entitlements.js';
import { createSessionToken, setSessionCookie, clearSessionCookie, getCookie, verifySessionToken, SESSION_COOKIE_NAME } from '../auth/session.js';
import type { Request } from 'express';

const router = Router();

// FRONTEND_URL is only needed when the frontend is on a different origin
// than the backend (e.g. the Vite dev server on :5173 vs. the backend on
// :3001). When they're the same origin (prod, via the IIS reverse proxy),
// this falls back to wherever the request actually came in on.
function getFrontendUrl(req: Request): string {
  const url = process.env.FRONTEND_URL ?? getRequestOrigin(req);
  return url.replace(/\/$/, '');
}

router.get('/login', async (req, res) => {
  try {
    const authorizationUrl = await buildGoogleAuthorizationUrl(req, res);
    res.redirect(authorizationUrl);
  } catch (error) {
    console.error('Failed to start Google login:', error);
    res.status(500).json({ error: 'Failed to start login' });
  }
});

router.get('/callback', async (req, res) => {
  try {
    const { email, name } = await handleGoogleCallback(req, res);
    const mode = await resolveUserMode(email, name);

    if (!mode) {
      res.redirect(`${getFrontendUrl(req)}/?authError=access_denied`);
      return;
    }

    const token = await createSessionToken({ email, name, mode });
    setSessionCookie(res, token);
    res.redirect(`${getFrontendUrl(req)}/home`);
  } catch (error) {
    console.error('Google login callback failed:', error);
    res.redirect(`${getFrontendUrl(req)}/?authError=login_failed`);
  }
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  const token = getCookie(req, SESSION_COOKIE_NAME);
  const user = token ? await verifySessionToken(token) : null;

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.json(user);
});

export default router;
