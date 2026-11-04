/**
 * Microsoft Entra (Azure AD) token verification middleware.
 *
 * When AUTH_MODE=entra, every /api request must carry a valid Entra-issued
 * Bearer token for your app. When AUTH_MODE is anything else (default 'none'),
 * the API is open (local development only — do NOT expose publicly).
 *
 * Required env when AUTH_MODE=entra:
 *   ENTRA_TENANT_ID   - your Entra tenant ID (GUID)
 *   ENTRA_CLIENT_ID   - the app registration's Application (client) ID
 *   ENTRA_AUDIENCE    - optional; defaults to ENTRA_CLIENT_ID (api://<clientId> also accepted)
 */

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const MODE = (process.env.AUTH_MODE || 'none').toLowerCase();
const TENANT = process.env.ENTRA_TENANT_ID;
const CLIENT_ID = process.env.ENTRA_CLIENT_ID;
const AUDIENCE = process.env.ENTRA_AUDIENCE || CLIENT_ID;

let client = null;
function getJwks() {
  if (!client) {
    client = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${TENANT}/discovery/v2.0/keys`,
      cache: true,
      rateLimit: true,
    });
  }
  return client;
}

function getKey(header, cb) {
  getJwks().getSigningKey(header.kid, (err, key) => {
    if (err) return cb(err);
    cb(null, key.getPublicKey());
  });
}

function requireAuth(req, res, next) {
  // AUTH_MODE=easyauth: Azure App Service signs users in before any request reaches
  // Node and passes the signed-in user in x-ms-client-principal-* headers. Those
  // headers are only trustworthy on App Service, which strips client-sent copies.
  if (MODE === 'easyauth') {
    const id = req.headers['x-ms-client-principal-id'];
    if (!process.env.WEBSITE_SITE_NAME || !id) return res.status(401).json({ error: 'Authentication required' });
    const name = req.headers['x-ms-client-principal-name'] || '';
    req.user = { id, name, email: name };
    return next();
  }
  if (MODE !== 'entra') return next(); // open (local dev)

  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  jwt.verify(
    token,
    getKey,
    {
      audience: [AUDIENCE, `api://${CLIENT_ID}`],
      issuer: [
        `https://login.microsoftonline.com/${TENANT}/v2.0`,
        `https://sts.windows.net/${TENANT}/`,
      ],
      algorithms: ['RS256'],
    },
    (err, decoded) => {
      if (err) return res.status(401).json({ error: 'Invalid or expired token' });
      req.user = { id: decoded.oid, name: decoded.name, email: decoded.preferred_username };
      next();
    }
  );
}

// True only for the browser-side MSAL flow; with easyauth the platform handles sign-in.
function authEnabled() {
  return MODE === 'entra' && TENANT && CLIENT_ID;
}

module.exports = { requireAuth, authEnabled, MODE };
