(() => {
  const fields = ['grantDate', 'vestDate', 'separationDate', 'awardValue', 'awardShares', 'formula'];
  const storageKey = 'veritas.template.rsu.v1';
  let files = [];
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  function readDate(id) { const value = document.getElementById(id).value; return value ? new Date(`${value}T00:00:00`) : null; }
  function daysBetween(start, end) { return Math.max(0, Math.round((end - start) / 86400000)); }
  function render() {
    const grant = readDate('grantDate'); const vest = readDate('vestDate'); const separation = readDate('separationDate');
    const awardValue = Math.max(0, Number(document.getElementById('awardValue').value) || 0);
    const shares = Math.max(0, Number(document.getElementById('awardShares').value) || 0);
    const formula = document.getElementById('formula').value;
    const note = formula === 'future'
      ? 'Future-service formula: marital percentage is the service time from grant to separation divided by the service time from grant to vest.'
      : 'Past-service formula: enter the employment start date as the grant date, then calculate service to separation divided by service to vest.';
    document.getElementById('formulaNote').textContent = note;
    if (!grant || !vest || !separation || vest <= grant) { document.getElementById('rsuState').textContent = 'Awaiting inputs'; document.getElementById('maritalPercent').textContent = '—'; document.getElementById('maritalValue').textContent = '—'; document.getElementById('maritalShares').textContent = '—'; document.getElementById('rsuNarrative').textContent = 'Enter the grant, vest, and separation dates to calculate the time-based marital percentage.'; return; }
    const serviceEnd = separation < vest ? separation : vest;
    const percentage = Math.min(1, daysBetween(grant, serviceEnd) / daysBetween(grant, vest));
    document.getElementById('rsuState').textContent = 'Draft calculation';
    document.getElementById('maritalPercent').textContent = `${(percentage * 100).toFixed(2)}%`;
    document.getElementById('maritalValue').textContent = currency.format(awardValue * percentage);
    document.getElementById('maritalShares').textContent = (shares * percentage).toLocaleString('en-US', { maximumFractionDigits: 4 });
    document.getElementById('rsuNarrative').textContent = `The entered timeline produces a ${(percentage * 100).toFixed(2)}% time-based marital allocation. Confirm the award purpose, formula, valuation date, and any separate-property claim before use.`;
  }
  function save() { localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(fields.map(id => [id, document.getElementById(id).value])))); document.getElementById('rsuSaveStatus').textContent = 'Draft inputs saved locally in this browser.'; }
  function load() { try { const saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); fields.forEach(id => { if (saved[id] !== undefined) document.getElementById(id).value = saved[id]; }); } catch (_) {} }
  function renderFiles() { const list = document.getElementById('rsuDocumentList'); list.innerHTML = files.length ? '' : '<div class="document-item"><span>No documents selected.</span></div>'; files.forEach((file, index) => { const item = document.createElement('div'); item.className = 'document-item'; const size = file.size < 1048576 ? `${Math.ceil(file.size / 1024)} KB` : `${(file.size / 1048576).toFixed(1)} MB`; item.innerHTML = `<span>${file.name} · ${size}</span><button type="button" data-index="${index}">Remove</button>`; list.appendChild(item); }); list.querySelectorAll('button[data-index]').forEach(button => button.addEventListener('click', () => { files.splice(Number(button.dataset.index), 1); renderFiles(); })); }
  function reset() { localStorage.removeItem(storageKey); fields.forEach(id => { document.getElementById(id).value = ''; }); document.getElementById('formula').value = 'future'; document.getElementById('rsuFiles').value = ''; files = []; renderFiles(); render(); document.getElementById('rsuSaveStatus').textContent = 'Draft cleared from this browser.'; }
  document.addEventListener('DOMContentLoaded', () => { load(); render(); fields.forEach(id => document.getElementById(id).addEventListener('input', () => { render(); save(); })); document.getElementById('formula').addEventListener('change', () => { render(); save(); }); const input = document.getElementById('rsuFiles'); input.addEventListener('change', event => { files = [...event.target.files]; renderFiles(); }); const zone = document.getElementById('rsuDropzone'); ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.add('dragging'); })); ['dragleave', 'drop'].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.remove('dragging'); })); zone.addEventListener('drop', event => { files = [...event.dataTransfer.files]; renderFiles(); }); document.getElementById('resetRsu').addEventListener('click', reset); document.getElementById('printRsu').addEventListener('click', () => window.print()); });
})();