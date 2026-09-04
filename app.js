/* Veritas Template — home screen (no hardcoded client data) */

const MODULES = [
  {
    key: 'discovery', icon: '⤓', tint: '#274566', soft: '#e7edf5',
    title: 'Discovery Intake', badge: 'Live', badgeCls: 'live',
    desc: 'Auto-ingest, OCR & classify statements, pay stubs, tax records and disclosures.',
    statNum: '—', statLbl: 'documents'
  },
  {
    key: 'spousal', icon: '⚖', tint: '#8a6528', soft: '#f4ead6',
    title: 'Spousal Maintenance', badge: 'Guideline', badgeCls: 'law',
    desc: 'Guideline calculator with expenditure bands, duration & scenario modeling.',
    statNum: '—', statLbl: 'monthly support'
  },
  {
    key: 'childsupport', icon: '◈', tint: '#2f7d5b', soft: '#e3f2ea',
    title: 'Child Support', badge: 'Worksheet', badgeCls: 'law',
    desc: 'Income Shares worksheet, childcare add-ons and reimbursement tracing.',
    statNum: '—', statLbl: 'monthly support'
  },
  {
    key: 'custody', icon: '⌘', tint: '#5b4b8a', soft: '#efeafd',
    title: 'Child Custody', badge: 'Parenting Plan', badgeCls: 'law',
    desc: 'Legal decision-making, best-interest factors, communication protocols and order drafting.',
    statNum: '—', statLbl: 'custody sections'
  },
  {
    key: 'schedules', icon: '◷', tint: '#1d6f7a', soft: '#e3f4f6',
    title: 'Schedules & Calendar', badge: 'Template', badgeCls: 'live',
    desc: 'Weekly parenting schedule, holidays, summer rotations, exchanges and deadline tracking.',
    statNum: '—', statLbl: 'schedule tracks'
  },
  {
    key: 'afi', icon: '≠', tint: '#b3402f', soft: '#fbe7e2',
    title: 'AFI Discrepancy', badge: 'Analysis', badgeCls: 'warn',
    desc: 'Line-by-line expense comparison vs. bank reality with allocation analysis.',
    statNum: '—', statLbl: 'variances'
  },
  {
    key: 'forensic', icon: '⌕', tint: '#274566', soft: '#e7edf5',
    title: 'Forensic Tracing', badge: 'Tracing', badgeCls: 'live',
    desc: 'Source-and-application tracing of separate property through transaction history.',
    statNum: '—', statLbl: 'accounts traced'
  },
  {
    key: 'estate', icon: '⊟', tint: '#8a6528', soft: '#f4ead6',
    title: 'Estate & Worksheets', badge: 'Valuation', badgeCls: 'law',
    desc: 'Asset/liability inventory, guideline worksheets & document comparison.',
    statNum: '—', statLbl: 'estate value'
  },
  {
    key: 'settlement', icon: '⇄', tint: '#8a6528', soft: '#f4ead6',
    title: 'Settlement Modeling', badge: 'Scenario', badgeCls: 'live',
    desc: 'Blend support, property splits & credits into ranked settlement scenarios.',
    statNum: '—', statLbl: 'settlement gap'
  },
  {
    key: 'argument', icon: '§', tint: '#274566', soft: '#e7edf5',
    title: 'Argument Builder', badge: 'AI-assist', badgeCls: 'ai',
    desc: 'Draft fact-anchored position memos with statute & exhibit citations.',
    statNum: '—', statLbl: 'position memos'
  },
  {
    key: 'redflag', icon: '⚑', tint: '#b3402f', soft: '#fbe7e2',
    title: 'Red-Flag Detection', badge: 'Alerts', badgeCls: 'warn',
    desc: 'Surface undisclosed accounts, inflated claims & inconsistent sworn statements.',
    statNum: '—', statLbl: 'flags'
  }
];

const ACTIVITY = [
  { who: 'You', txt: 'uploaded <b>Financial document</b> — transactions imported', time: '18m ago' },
  { who: 'Veritas', txt: 'flagged <b>Account</b> as not on inventory', time: '1h ago' },
  { who: 'Veritas', txt: 'surfaced discrepancy in <b>Income documentation</b>', time: '2h ago' },
  { who: 'You', txt: 'completed <b>Support calculation</b>', time: '4h ago' },
  { who: 'Veritas', txt: 'traced property through <b>transaction history</b>', time: 'Yesterday' },
  { who: 'You', txt: 'generated <b>Worksheet</b>', time: '2 days ago' }
];

const FLAGS = [
  {
    sev: 'med',
    title: 'Account omitted from disclosure',
    body: 'Account shows annual income but is not listed on the financial inventory.',
    ref: 'Matter · Document'
  },
  {
    sev: 'med',
    title: 'Income variance in documentation',
    body: 'Income varies year-to-year; no documentation of recurring nature.',
    ref: 'Discovery Intake · Income'
  },
  {
    sev: 'low',
    title: 'Expense line-item mismatch',
    body: 'Claimed expense shows different amounts across documents.',
    ref: 'AFI Analysis · Expenses'
  }
];

const MISSING = [
  {
    id: 'income-docs', priority: 'high', module: 'discovery', area: 'Discovery Intake',
    doc: 'Current income documentation',
    why: 'Needed to establish current income. Previous documentation is outdated.',
    ask: 'Request recent income statements'
  },
  {
    id: 'tax-docs', priority: 'high', module: 'estate', area: 'Estate & Worksheets',
    doc: 'Tax return documentation',
    why: 'Cross-check reported income and verify all income sources.',
    ask: 'Request personal tax return'
  },
  {
    id: 'account-stmts', priority: 'med', module: 'forensic', area: 'Forensic Tracing',
    doc: 'Account statements',
    why: 'Establish account balances for valuation calculation.',
    ask: 'Request historical account statements'
  }
];

const BADGE_STYLE = {
  live: { color: '#274566', bg: '#e7edf5', bd: '#cfdae8' },
  law:  { color: '#8a6528', bg: '#f4ead6', bd: '#e6d3ac' },
  warn: { color: '#b3402f', bg: '#fbe7e2', bd: '#f2cfc7' },
  ai:   { color: '#2f7d5b', bg: '#e3f2ea', bd: '#c6e2d2' }
};

function loadLiveModuleStats() {
  try {
    const sp = JSON.parse(localStorage.getItem('veritas.spousal.state.v1') || 'null');
    if (sp?.state) {
      const spMod = MODULES.find(m => m.key === 'spousal');
      if (spMod) {
        const monthly = sp.state.masterMonthly || sp.state.maintenanceMonthly;
        if (monthly > 0) { spMod.statNum = '$' + Math.round(monthly).toLocaleString(); spMod.statLbl = '/mo (live)'; }
      }
    }
  } catch (_) {}
  try {
    const cs = JSON.parse(localStorage.getItem('veritas.cs.selections') || 'null');
    if (cs) {
      const csMod = MODULES.find(m => m.key === 'childsupport');
      if (csMod && cs.numChildren) { csMod.statLbl = `/mo · ${cs.numChildren} child${cs.numChildren !== 1 ? 'ren' : ''} (live)`; }
    }
  } catch (_) {}
  try {
    const se = JSON.parse(localStorage.getItem('veritas.settlement.state.v1') || 'null');
    if (se) {
      const seMod = MODULES.find(m => m.key === 'settlement');
      const MARITAL = 1235000; // Generic estate value for settlement calcs
      if (seMod && se.spousalMonthly) {
        const spousalTot = se.spousalMonthly * (se.spousalDuration || 132);
        const csTot = 1620 * 216;
        const petitionerAssets = MARITAL * (se.petitionerAssetPercent || 0.50);
        const gap = Math.abs((-(spousalTot + csTot + (se.cashAdjustment || 100000)) + petitionerAssets) -
                             ((spousalTot + csTot + (se.cashAdjustment || 100000)) + MARITAL * (1 - (se.petitionerAssetPercent || 0.50))));
        seMod.statNum = '$' + Math.round(Math.abs(gap) / 1000).toLocaleString() + 'K';
        seMod.statLbl = 'current gap (live)';
      }
    }
  } catch (_) {}
}

loadLiveModuleStats();
