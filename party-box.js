// Party box — shows who the parties are for the active matter and lets them be
// corrected in place. Drop <div data-party-box></div> on any template page and
// load this after matter-context.js. Names and role labels are stored on the
// matter (same fields Case Intake fills), so every page updates together.
(function () {
  const ROLE_PAIRS = [
    ['Petitioner', 'Respondent'],
    ['Plaintiff', 'Defendant'],
    ['Party A', 'Party B'],
  ];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const css = `
    .pbox { background:#fff; border:1px solid #d7e0ec; border-radius:8px; padding:14px 16px; margin:0 0 20px; font-family:inherit; }
    .pbox-head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px; }
    .pbox-title { font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; color:#1c3f66; }
    .pbox-src { font-size:11px; color:#7a8a9a; font-weight:500; text-transform:none; letter-spacing:0; margin-left:6px; }
    .pbox-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    @media (max-width:700px) { .pbox-grid { grid-template-columns:1fr; } }
    .pbox-party { border-left:4px solid #1c3f66; padding:6px 10px; background:#f7f9fc; border-radius:4px; }
    .pbox-party.b { border-left-color:#2f7d5b; }
    .pbox-role { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.05em; color:#7a8a9a; }
    .pbox-name { font-size:15px; font-weight:700; color:#1c3f66; margin-top:2px; }
    .pbox-name.missing { color:#b45309; font-weight:600; font-size:13px; }
    .pbox input, .pbox select { width:100%; padding:7px 8px; border:1px solid #cdd8e7; border-radius:4px; font:inherit; font-size:13px; margin-top:4px; }
    .pbox-btn { padding:6px 12px; border:1px solid #cdd8e7; background:#fff; border-radius:4px; cursor:pointer; font-size:12px; font-weight:600; color:#1c3f66; }
    .pbox-btn.primary { background:#1c3f66; color:#fff; border-color:#1c3f66; }
    .pbox-actions { display:flex; gap:8px; align-items:center; margin-top:12px; }
    .pbox-msg { font-size:12px; color:#7a8a9a; }
    .pbox-msg.err { color:#b91c1c; }`;

  function injectCss() {
    if (document.getElementById('pboxCss')) return;
    const s = document.createElement('style');
    s.id = 'pboxCss';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function current() {
    const VM = window.VeritasMatter || {};
    const m = VM.matter || {};
    const labels = VM.partyLabels || { a: 'Petitioner', b: 'Respondent' };
    return { a: (m.petitioner || '').trim(), b: (m.respondent || '').trim(), labels };
  }

  function partyView(side, role, name) {
    return `<div class="pbox-party ${side}">
      <div class="pbox-role">${esc(role)}</div>
      <div class="pbox-name ${name ? '' : 'missing'}">${name ? esc(name) : 'Name not set — click Edit'}</div>
    </div>`;
  }

  function renderView(box) {
    const p = current();
    box.innerHTML = `
      <div class="pbox-head">
        <div class="pbox-title">Parties<span class="pbox-src">from Case Intake · applies to every page for this client</span></div>
        <button class="pbox-btn" data-act="edit" type="button">Edit</button>
      </div>
      <div class="pbox-grid">${partyView('a', p.labels.a, p.a)}${partyView('b', p.labels.b, p.b)}</div>`;
    box.querySelector('[data-act="edit"]').onclick = () => renderEdit(box);
  }

  function renderEdit(box) {
    const p = current();
    const pairIdx = Math.max(0, ROLE_PAIRS.findIndex(([a, b]) => a === p.labels.a && b === p.labels.b));
    box.innerHTML = `
      <div class="pbox-head"><div class="pbox-title">Edit parties</div></div>
      <label class="pbox-role">Roles
        <select data-f="roles">${ROLE_PAIRS.map(([a, b], i) => `<option value="${i}" ${i === pairIdx ? 'selected' : ''}>${a} / ${b}</option>`).join('')}</select>
      </label>
      <div class="pbox-grid" style="margin-top:10px;">
        <label class="pbox-party a"><span class="pbox-role" data-role="a">${esc(ROLE_PAIRS[pairIdx][0])}</span>
          <input data-f="a" value="${esc(p.a)}" placeholder="Full name" autocomplete="off" /></label>
        <label class="pbox-party b"><span class="pbox-role" data-role="b">${esc(ROLE_PAIRS[pairIdx][1])}</span>
          <input data-f="b" value="${esc(p.b)}" placeholder="Full name" autocomplete="off" /></label>
      </div>
      <div class="pbox-actions">
        <button class="pbox-btn primary" data-act="save" type="button">Save</button>
        <button class="pbox-btn" data-act="cancel" type="button">Cancel</button>
        <span class="pbox-msg" data-msg></span>
      </div>`;
    const sel = box.querySelector('[data-f="roles"]');
    sel.onchange = () => {
      const [ra, rb] = ROLE_PAIRS[+sel.value];
      box.querySelector('[data-role="a"]').textContent = ra;
      box.querySelector('[data-role="b"]').textContent = rb;
    };
    box.querySelector('[data-act="cancel"]').onclick = () => renderView(box);
    box.querySelector('[data-act="save"]').onclick = async () => {
      const msg = box.querySelector('[data-msg]');
      const [ra, rb] = ROLE_PAIRS[+sel.value];
      msg.className = 'pbox-msg'; msg.textContent = 'Saving…';
      try {
        await window.VeritasMatter.saveParties({
          petitioner: box.querySelector('[data-f="a"]').value,
          respondent: box.querySelector('[data-f="b"]').value,
          partyLabels: { a: ra, b: rb },
        });
        // veritas:matter fires on save and re-renders every box in view mode.
      } catch (e) {
        msg.className = 'pbox-msg err';
        msg.textContent = 'Could not save — is the backend running?';
      }
    };
  }

  function renderAll() {
    injectCss();
    document.querySelectorAll('[data-party-box]').forEach((box) => { box.classList.add('pbox'); renderView(box); });
  }

  window.addEventListener('veritas:matter', renderAll);
  const start = () => { if (window.VeritasMatter && window.VeritasMatter.matter) renderAll(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
