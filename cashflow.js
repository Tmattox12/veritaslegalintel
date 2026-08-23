(() => {
  const fieldIds = ['aIncome', 'aOther', 'aSupport', 'aExpenses', 'aPaid', 'bIncome', 'bOther', 'bSupport', 'bExpenses', 'bPaid'];
  const storageKey = 'veritas.template.cashflow.v1';
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  function value(id) { return Math.max(0, Number(document.getElementById(id).value) || 0); }
  function remaining(party) { return value(`${party}Income`) + value(`${party}Other`) + value(`${party}Support`) - value(`${party}Expenses`) - value(`${party}Paid`); }
  function renderAmount(id, amount) {
    const target = document.getElementById(id);
    target.textContent = money.format(amount);
    target.classList.toggle('negative', amount < 0);
  }
  function render() {
    const a = remaining('a');
    const b = remaining('b');
    const difference = a - b;
    renderAmount('aRemaining', a); renderAmount('bRemaining', b); renderAmount('summaryA', a); renderAmount('summaryB', b); renderAmount('summaryDifference', Math.abs(difference));
    const hasInput = fieldIds.some(id => value(id) > 0);
    document.getElementById('cashflowState').textContent = hasInput ? 'Draft calculation' : 'Awaiting inputs';
    document.getElementById('cashflowNarrative').textContent = hasInput
      ? `Party ${difference >= 0 ? 'A' : 'B'} has ${money.format(Math.abs(difference))} more monthly cash remaining under the entered assumptions.`
      : 'Enter verified monthly values to compare each household\'s remaining cash.';
  }
  function save() {
    const data = Object.fromEntries(fieldIds.map(id => [id, document.getElementById(id).value]));
    localStorage.setItem(storageKey, JSON.stringify(data));
    document.getElementById('cashflowSaveNote').textContent = 'Draft values saved locally in this browser.';
  }
  function load() {
    try { const data = JSON.parse(localStorage.getItem(storageKey) || '{}'); fieldIds.forEach(id => { if (data[id] !== undefined) document.getElementById(id).value = data[id]; }); } catch (_) {}
  }
  function clear() {
    localStorage.removeItem(storageKey);
    fieldIds.forEach(id => { document.getElementById(id).value = '0'; });
    document.getElementById('cashflowFiles').value = '';
    document.getElementById('cashflowFileSummary').textContent = 'No documents selected.';
    document.getElementById('cashflowSaveNote').textContent = 'Draft cleared from this browser.';
    render();
  }
  document.addEventListener('DOMContentLoaded', () => {
    load(); render();
    fieldIds.forEach(id => document.getElementById(id).addEventListener('input', () => { render(); save(); }));
    document.getElementById('cashflowFiles').addEventListener('change', event => {
      const files = [...event.target.files];
      document.getElementById('cashflowFileSummary').textContent = files.length ? `${files.length} document${files.length === 1 ? '' : 's'} selected: ${files.map(file => file.name).join(', ')}` : 'No documents selected.';
    });
    document.getElementById('clearCashflow').addEventListener('click', clear);
    document.getElementById('printCashflow').addEventListener('click', () => window.print());
  });
})();