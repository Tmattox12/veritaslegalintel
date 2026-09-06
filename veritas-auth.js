/* Veritas auth — Microsoft Entra sign-in + token attachment.
 *
 * Behaviour:
 *  - Fetches /api/auth-status from the backend.
 *  - If auth is OFF (local dev), does nothing — app works as before.
 *  - If auth is ON (AUTH_MODE=entra on the server), the user must sign in with
 *    their Microsoft (Entra) work account. All API calls then carry the token.
 *
 * Configure via a global before this script loads (optional overrides):
 *   window.VERITAS_AUTH = { clientId, tenantId, apiScope }
 * Otherwise values come from /api/auth-config (server) or defaults below.
 */

(function () {
  const DEFAULTS = {
    clientId: window.VERITAS_AUTH?.clientId || '',
    tenantId: window.VERITAS_AUTH?.tenantId || '',
    apiScope: window.VERITAS_AUTH?.apiScope || '',
    apiBase: window.API_BASE || 'http://localhost:3000/api',
  };

  let msalApp = null;
  let account = null;
  let enabled = false;

  function loadMsal() {
    return new Promise((resolve, reject) => {
      if (window.msal) return resolve();
      const s = document.createElement('script');
      s.src = 'https://alcdn.msauth.net/browser/2.38.0/js/msal-browser.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function getToken() {
    const scope = DEFAULTS.apiScope || `api://${DEFAULTS.clientId}/access_as_user`;
    try {
      const r = await msalApp.acquireTokenSilent({ account, scopes: [scope] });
      return r.accessToken;
    } catch (e) {
      const r = await msalApp.acquireTokenPopup({ scopes: [scope] });
      return r.accessToken;
    }
  }

  // Wrap fetch so any call to the API automatically attaches the token.
  function wrapFetch() {
    const orig = window.fetch;
    window.fetch = async function (url, opts = {}) {
      if (enabled && typeof url === 'string' && url.startsWith(DEFAULTS.apiBase)) {
        const token = await getToken();
        opts.headers = Object.assign({}, opts.headers, { Authorization: `Bearer ${token}` });
      }
      return orig(url, opts);
    };
  }

  function showLoginOverlay() {
    const o = document.createElement('div');
    o.id = 'veritasAuthOverlay';
    o.style.cssText = 'position:fixed;inset:0;background:#0f2540;z-index:99999;display:flex;align-items:center;justify-content:center;';
    o.innerHTML = `
      <div style="background:#fff;border-radius:12px;padding:40px;max-width:380px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
        <div style="font-family:Fraunces,serif;font-size:22px;color:#1c3f66;margin-bottom:6px;">Veritas Financial Intelligence</div>
        <div style="font-size:13px;color:#666;margin-bottom:20px;">Confidential — sign in with your firm account to continue.</div>
        <button id="veritasSignIn" style="width:100%;padding:12px;background:#2e5b8a;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Sign in with Microsoft</button>
        <div id="veritasAuthErr" style="color:#c62828;font-size:12px;margin-top:10px;"></div>
      </div>`;
    document.body.appendChild(o);
    o.querySelector('#veritasSignIn').addEventListener('click', async () => {
      try {
        const r = await msalApp.loginPopup({ scopes: ['openid', 'profile', 'email'] });
        account = r.account;
        o.remove();
        wrapFetch();
        window.dispatchEvent(new CustomEvent('veritasAuthed', { detail: { account } }));
      } catch (e) {
        o.querySelector('#veritasAuthErr').textContent = 'Sign-in failed: ' + e.message;
      }
    });
  }

  async function init() {
    let status;
    try {
      const r = await fetch(`${DEFAULTS.apiBase}/auth-status`);
      status = await r.json();
    } catch (e) {
      return; // backend not running — stay in local mode
    }
    if (!status.authEnabled) return; // local dev, no gate

    enabled = true;

    // Pull non-secret client config from the backend if not provided inline.
    if (!DEFAULTS.clientId || !DEFAULTS.tenantId) {
      try {
        const cfg = await (await fetch(`${DEFAULTS.apiBase}/auth-config`)).json();
        DEFAULTS.clientId = cfg.clientId;
        DEFAULTS.tenantId = cfg.tenantId;
        DEFAULTS.apiScope = cfg.apiScope;
      } catch (e) {
        console.error('Could not load auth config', e);
        return;
      }
    }

    await loadMsal();
    msalApp = new msal.PublicClientApplication({
      auth: {
        clientId: DEFAULTS.clientId,
        authority: `https://login.microsoftonline.com/${DEFAULTS.tenantId}`,
        redirectUri: location.origin + location.pathname,
      },
      cache: { cacheLocation: 'sessionStorage' },
    });

    // Returning session?
    const accounts = msalApp.getAllAccounts();
    if (accounts.length) {
      account = accounts[0];
      wrapFetch();
      window.dispatchEvent(new CustomEvent('veritasAuthed', { detail: { account } }));
    } else {
      showLoginOverlay();
    }
  }

  window.VeritasAuth = { get isEnabled() { return enabled; }, get account() { return account; } };
  document.addEventListener('DOMContentLoaded', init);
})();
