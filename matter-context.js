// Matter context — one client at a time, never mixed.
// Load FIRST in <head> on every page, before any other script.
//
// 1. Every localStorage key a page uses is silently namespaced to the active
//    matter ("matter:<id>:<key>"), so client A's drafts / imports / AFI lines
//    can never be read or overwritten while client B is open.
// 2. Keys that already embed a matter id are allowed only for the active
//    matter; any other matter's id is blocked.
// 3. Switching clients always does a full page reload so no in-memory state
//    from the previous client survives. Another tab switching clients reloads
//    this tab too.
// 4. Pages refuse to work until a client is selected (picker overlay).
(function () {
  const API = 'http://localhost:3000/api';
  const ACTIVE_KEY = 'currentMatterId';
  const NAME_KEY = 'currentMatterName';
  const MIGRATED_KEY = 'veritas.scopedStorage.v1';
  // Keys shared by all matters: who is logged in and which matter is open.
  const GLOBAL_KEYS = new Set([ACTIVE_KEY, NAME_KEY, MIGRATED_KEY, 'currentUserId', 'veritas_user_name']);
  const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  // Pages usable without a selected client.
  const PAGE = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const NO_GATE = new Set(['case-intake.html', 'cases.html', 'auth.html', 'admin-reset.html', 'sidebar.html']);

  let store;
  try { store = window.localStorage; } catch (e) { return; }
  const raw = {
    get: Storage.prototype.getItem,
    set: Storage.prototype.setItem,
    remove: Storage.prototype.removeItem,
    key: Storage.prototype.key,
  };
  const rawLength = () => Object.getOwnPropertyDescriptor(Storage.prototype, 'length').get.call(store);

  // A ?matter= link must agree with the stored selection, or a page could show
  // one client's documents next to another client's saved data.
  const urlMatter = new URLSearchParams(location.search).get('matter');
  if (urlMatter && urlMatter !== raw.get.call(store, ACTIVE_KEY)) {
    raw.set.call(store, ACTIVE_KEY, urlMatter);
    raw.remove.call(store, NAME_KEY);
  }
  let activeId = raw.get.call(store, ACTIVE_KEY) || null;

  // One-time move of pre-isolation (unscoped) data into the matter that was
  // open when it was written.
  if (activeId && !raw.get.call(store, MIGRATED_KEY)) {
    const legacy = [];
    for (let i = 0; i < rawLength(); i++) {
      const k = raw.key.call(store, i);
      if (!GLOBAL_KEYS.has(k) && !k.startsWith('matter:') && !k.match(UUID_RE)) legacy.push(k);
    }
    legacy.forEach((k) => {
      const scoped = `matter:${activeId}:${k}`;
      if (raw.get.call(store, scoped) === null) raw.set.call(store, scoped, raw.get.call(store, k));
      raw.remove.call(store, k);
    });
    raw.set.call(store, MIGRATED_KEY, activeId);
  }

  // Returns the real key to use, or null if access must be blocked.
  function scopedKey(key) {
    key = String(key);
    if (GLOBAL_KEYS.has(key) || key.startsWith('matter:')) return key.startsWith('matter:') && !key.startsWith(`matter:${activeId}:`) ? null : key;
    const ids = key.match(UUID_RE);
    if (ids) return activeId && ids.every((id) => id.toLowerCase() === activeId.toLowerCase()) ? key : null;
    return `matter:${activeId || '_new'}:${key}`;
  }

  Storage.prototype.getItem = function (key) {
    if (this !== store) return raw.get.call(this, key);
    const k = scopedKey(key);
    if (k === null) { console.warn(`[matter] blocked read of "${key}" — belongs to another matter`); return null; }
    return raw.get.call(this, k);
  };
  Storage.prototype.setItem = function (key, value) {
    if (this !== store) return raw.set.call(this, key, value);
    if (key === ACTIVE_KEY) {
      // Same-tab change (e.g. case intake just created a matter): re-scope now.
      if (value !== activeId) raw.remove.call(this, NAME_KEY);
      activeId = value || null;
      return raw.set.call(this, key, value);
    }
    const k = scopedKey(key);
    if (k === null) { console.warn(`[matter] blocked write of "${key}" — belongs to another matter`); return; }
    return raw.set.call(this, k, value);
  };
  Storage.prototype.removeItem = function (key) {
    if (this !== store) return raw.remove.call(this, key);
    if (key === ACTIVE_KEY) { activeId = null; raw.remove.call(this, NAME_KEY); }
    const k = scopedKey(key);
    if (k !== null) raw.remove.call(this, k);
  };

  // Another tab switched clients: this tab's screen and memory are now wrong.
  window.addEventListener('storage', (e) => {
    if (e.key === ACTIVE_KEY && e.newValue !== activeId) location.reload();
  });

  // ===== UI: header, picker, gate =====

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function fetchMatters() {
    const r = await fetch(`${API}/matters`);
    if (!r.ok) throw new Error(`API ${r.status}`);
    return (await r.json()).filter((m) => !m.deleted_at && m.status !== 'archived');
  }

  function switchTo(id) {
    if (id === activeId) return;
    raw.set.call(store, ACTIVE_KEY, id);
    raw.remove.call(store, NAME_KEY);
    // Drop any ?matter= so the URL can't pull the old client back in.
    const url = new URL(location.href);
    url.searchParams.delete('matter');
    location.replace(url.toString());
  }

  function newClient() {
    raw.remove.call(store, ACTIVE_KEY);
    raw.remove.call(store, NAME_KEY);
    location.href = 'case-intake.html';
  }

  function renderHeader(matter) {
    const btn = document.querySelector('.matter-btn');
    if (!btn) return;
    const name = matter ? (matter.name || matter.client_name || 'Untitled matter') : 'No client selected';
    const sub = matter
      ? [matter.case_no ? `No. ${matter.case_no}` : null, [matter.county, matter.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Click to switch client'
      : 'Click to choose a client';
    btn.innerHTML = `<strong>${esc(name)}</strong><span class="case-no">${esc(sub)}</span><span class="chev">▾</span>`;
    if (matter) document.title = `${name} — ${document.title.split(' — ').pop()}`;
  }

  function openPicker({ required = false, offline = false, matters = [] } = {}) {
    document.getElementById('matterPicker')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'matterPicker';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(15,32,53,.72);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit;';
    const rows = matters.map((m) => `
      <button data-id="${esc(m.id)}" style="display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:8px;border:1px solid ${m.id === activeId ? '#1c3f66' : '#dde3ea'};background:${m.id === activeId ? '#eef4fb' : '#fff'};border-radius:8px;cursor:pointer;font-size:14px;">
        <div style="font-weight:700;color:#1c3f66;">${esc(m.name || m.client_name || 'Untitled matter')}${m.id === activeId ? ' <span style="font-weight:600;color:#1c6b52;font-size:12px;">✓ open now</span>' : ''}</div>
        <div style="font-size:12px;color:#667;margin-top:2px;">${esc([m.client_name, m.case_no && `No. ${m.case_no}`, [m.county, m.state].filter(Boolean).join(', ')].filter(Boolean).join(' · '))}</div>
      </button>`).join('');
    const body = offline
      ? `<div style="color:#a33;font-weight:600;margin-bottom:8px;">Backend offline</div>
         <div style="font-size:13px;color:#445;margin-bottom:14px;">Double-click <strong>start-veritas.bat</strong> (or run <code>node server/index.js</code>) and leave that window open, then click Retry.</div>
         <button data-act="retry" style="padding:10px 16px;background:#1c3f66;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;">Retry</button>`
      : `${rows || '<div style="font-size:13px;color:#667;margin-bottom:12px;">No clients yet.</div>'}
         <button data-act="new" style="width:100%;padding:11px;margin-top:4px;background:#1c3f66;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;">+ New client (Case Intake)</button>`;
    wrap.innerHTML = `
      <div style="background:#fff;border-radius:12px;max-width:460px;width:100%;max-height:85vh;overflow:auto;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.3);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <div style="font-size:18px;font-weight:700;color:#1c3f66;">${required ? 'Choose a client to work on' : 'Switch client'}</div>
          ${required ? '' : '<button data-act="close" style="border:none;background:none;font-size:20px;cursor:pointer;color:#667;">×</button>'}
        </div>
        <div style="font-size:12px;color:#667;margin-bottom:14px;">Everything in Veritas shows only the selected client. Switching reloads the page.</div>
        ${body}
      </div>`;
    wrap.addEventListener('click', (e) => {
      const t = e.target.closest('button');
      if (!t) { if (!required && e.target === wrap) wrap.remove(); return; }
      if (t.dataset.id) switchTo(t.dataset.id);
      else if (t.dataset.act === 'new') newClient();
      else if (t.dataset.act === 'close') wrap.remove();
      else if (t.dataset.act === 'retry') location.reload();
    });
    document.body.appendChild(wrap);
  }

  function partyLabelsOf(matter) {
    let details = matter.details;
    if (typeof details === 'string') { try { details = JSON.parse(details); } catch (e) { details = null; } }
    const l = (details && details.partyLabels) || {};
    return { a: l.a || 'Petitioner', b: l.b || 'Respondent' };
  }

  // Party names come from the matter (Case Intake or the party box), never from
  // per-page inputs: data-party="a"|"b" gets the name, data-party-role="a"|"b"
  // the role label (Petitioner/Respondent, Plaintiff/Defendant, ...).
  function announceMatter(matter) {
    const labels = partyLabelsOf(matter);
    const names = {
      a: (matter.petitioner || '').trim() || labels.a,
      b: (matter.respondent || '').trim() || labels.b,
    };
    document.querySelectorAll('[data-party]').forEach((el) => {
      if (names[el.dataset.party]) el.textContent = names[el.dataset.party];
    });
    document.querySelectorAll('[data-party-role]').forEach((el) => {
      if (labels[el.dataset.partyRole]) el.textContent = labels[el.dataset.partyRole];
    });
    window.VeritasMatter.matter = matter;
    window.VeritasMatter.partyNames = names;
    window.VeritasMatter.partyLabels = labels;
    window.dispatchEvent(new CustomEvent('veritas:matter', { detail: { matter, partyNames: names, partyLabels: labels } }));
  }

  // Saves names/labels to the matter, then refreshes every party label on the page.
  async function saveParties({ petitioner, respondent, partyLabels }) {
    if (!activeId) throw new Error('No client selected');
    const r = await fetch(`${API}/matters/${encodeURIComponent(activeId)}/parties`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ petitioner, respondent, partyLabels }),
    });
    if (!r.ok) throw new Error(`Save failed (${r.status})`);
    const matter = await r.json();
    announceMatter(matter);
    return matter;
  }

  async function showSwitcher() {
    try { openPicker({ matters: await fetchMatters() }); } catch (e) { openPicker({ offline: true }); }
  }

  async function init() {
    document.querySelectorAll('.matter-btn').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showSwitcher(); }, true));

    // Show the cached name immediately so the header never shows another client's placeholder.
    const cached = raw.get.call(store, NAME_KEY);
    renderHeader(activeId ? { name: cached || 'Loading client…' } : null);

    let matters;
    try { matters = await fetchMatters(); } catch (e) {
      if (activeId) { renderHeader({ name: cached || 'Client (offline)', county: 'backend offline' }); return; }
      if (!NO_GATE.has(PAGE)) openPicker({ required: true, offline: true });
      return;
    }

    const current = activeId && matters.find((m) => m.id === activeId);
    if (activeId && !current) {
      // Selected matter no longer exists — never fall through to "whatever is first".
      raw.remove.call(store, ACTIVE_KEY);
      raw.remove.call(store, NAME_KEY);
      activeId = null;
    }
    if (current) raw.set.call(store, NAME_KEY, current.name || current.client_name || '');
    renderHeader(current || null);
    if (current) announceMatter(current);
    if (!current && !NO_GATE.has(PAGE)) openPicker({ required: true, matters });
  }

  window.VeritasMatter = {
    get id() { return activeId; },
    switchTo,
    newClient,
    showSwitcher,
    saveParties,
  };
  // Names older pages/sidebar already call.
  window.showMatterDropdownFromSidebar = showSwitcher;
  window.navigateToDiscoveryIntake = () => { location.href = 'discovery-intake.html'; };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Billing time capture runs on every page this script is on.
  const tracker = document.createElement('script');
  tracker.src = 'time-tracker.js';
  document.head.appendChild(tracker);
})();
