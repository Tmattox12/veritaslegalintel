# Veritas — Secure (Confidential) Deployment Checklist

This is the **only** supported way to expose Veritas beyond your own machine. It keeps
client financial data confidential: the database and uploaded documents stay **on your
hardware**, and the app requires **Microsoft Entra (work/school) sign-in** before anyone
can reach anything.

> ⚠️ Never host the frontend publicly without `AUTH_MODE=entra` enabled. The public
> GitHub Pages site was taken down because it had no login gate. Do not re-enable it.

---

## Architecture (on-prem tunnel + Entra auth)

```
Browser → [Entra sign-in] → Static frontend (Azure SWA / internal host)
        → API request + Bearer token
        → Azure Relay Hybrid Connection (outbound-only, no inbound firewall ports)
        → On-prem Node API (:3000) verifies token against Entra
        → SQLite + uploaded documents (stay on your machine)
```

- **No inbound firewall ports** are opened; the tunnel is outbound-only.
- **Data never leaves your machine** — only authenticated API responses do.

---

## What was already built (code)

- `server/auth.js` — Entra JWT verification middleware (`requireAuth`). Enabled by `AUTH_MODE=entra`.
- `server/index.js` — gates all `/api/*` behind `requireAuth` when auth is on; adds public
  `/api/auth-status` and `/api/auth-config` endpoints.
- `veritas-auth.js` — frontend module: shows a "Sign in with Microsoft" gate when the server
  reports auth is on, acquires a token via MSAL, and attaches it to every API call.
- `server/tunnel.js` — Azure Relay Hybrid Connection listener (enabled by `TUNNEL_MODE=relay`).
- `server/services/storage.js` — originals stored locally by default; `STORAGE_MODE=azure`
  moves them to a **private** Blob container.

---

## Step 1 — Register the app in Microsoft Entra

1. Entra portal → **App registrations → New registration**.
2. Name: `Veritas` · Supported account types: **This organization only** · Redirect URI:
   **Single-page application (SPA)** = `https://<your-frontend-host>` (and `http://localhost:5502` for dev).
3. Note the **Application (client) ID** and **Directory (tenant) ID**.
4. **Expose an API** → Add a scope: `access_as_user`. The Application ID URI becomes `api://<clientId>`.
5. **API permissions** → add `openid`, `profile`, `email` (delegated) + your `access_as_user` scope.

## Step 2 — Configure the backend (`.env`)

```
AUTH_MODE=entra
ENTRA_TENANT_ID=<tenant id>
ENTRA_CLIENT_ID=<client id>
# ENTRA_API_SCOPE=api://<client id>/access_as_user   (optional; this is the default)
```

Restart: `node server/index.js`. Confirm: `GET /api/auth-status` → `{ "authEnabled": true }`.
Unsigned requests to `/api/matters` now return **401**.

## Step 3 — Turn on the tunnel (outbound-only)

```
TUNNEL_MODE=relay
RELAY_NAMESPACE=<your relay namespace>
RELAY_CONNECTION_NAME=veritas-api
RELAY_KEY_NAME=<shared access key name>
RELAY_KEY=<shared access key>
```
Also `npm install hyco-https`. The server logs the public relay URL when connected.

## Step 4 — Host the frontend behind the sign-in

- Host the static pages on **Azure Static Web Apps** with **Easy Auth (Entra)** enabled, OR
  serve them from the same authenticated path as the API.
- The frontend auto-detects auth via `/api/auth-status` and `/api/auth-config` and shows the
  Microsoft sign-in gate — no frontend config to hardcode.

## Step 5 — Verify

- [ ] Unauthenticated visit → Microsoft sign-in screen, no data.
- [ ] Signed-in firm member → app loads, API calls succeed.
- [ ] Non-firm account → sign-in fails / 401 on API.
- [ ] `nslookup`/browser confirms the old public URL no longer serves the app.

---

## Rollback / local dev

Set `AUTH_MODE=none` (and `TUNNEL_MODE=none`) to run fully locally with no login — for
development only. Never use `none` on anything reachable from the internet.
