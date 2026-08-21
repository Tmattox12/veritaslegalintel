/* Veritas Template — home screen with sample case data */

const MODULES = [
  {
    key: 'discovery', icon: '⤓', tint: '#274566', soft: '#e7edf5',
    title: 'Discovery Intake', badge: 'Live', badgeCls: 'live',
    desc: 'Auto-ingest, OCR & classify statements, pay stubs, tax records and disclosures.',
    statNum: '42', statLbl: 'docs indexed'
  },
  {
    key: 'spousal', icon: '⚖', tint: '#8a6528', soft: '#f4ead6',
    title: 'Spousal Maintenance', badge: 'AZ §25-319', badgeCls: 'law',
    desc: 'Guideline calculator with BLS expenditure bands, duration & scenario modeling.',
    statNum: '$2,850', statLbl: '/mo · 11 yr'
  },
  {
    key: 'childsupport', icon: '◈', tint: '#2f7d5b', soft: '#e3f2ea',
    title: 'Child Support', badge: 'AZ Worksheet', badgeCls: 'law',
    desc: 'Income Shares worksheet, childcare add-ons and 70/30 reimbursement tracing.',
    statNum: '$1,620', statLbl: '/mo · 2 kids'
  },
  {
    key: 'custody', icon: '⌘', tint: '#5b4b8a', soft: '#efeafd',
    title: 'Child Custody', badge: 'Parenting Plan', badgeCls: 'law',
    desc: 'Legal decision-making, best-interest factors, communication protocols and order drafting.',
    statNum: '6', statLbl: 'core custody sections'
  },
  {
    key: 'schedules', icon: '◷', tint: '#1d6f7a', soft: '#e3f4f6',
    title: 'Schedules & Calendar', badge: 'Template', badgeCls: 'live',
    desc: 'Weekly parenting schedule, holidays, summer rotations, exchanges and deadline tracking.',
    statNum: '4', statLbl: 'schedule tracks'
  },
  {
    key: 'afi', icon: '≠', tint: '#b3402f', soft: '#fbe7e2',
    title: 'AFI Discrepancy', badge: '3 flags', badgeCls: 'warn',
    desc: 'Line-by-line AFI comparison vs. bank reality with headcount allocation.',
    statNum: '$1,200', statLbl: '/mo variance'
  },
  {
    key: 'forensic', icon: '⌕', tint: '#274566', soft: '#e7edf5',
    title: 'Forensic Tracing', badge: '2 accts', badgeCls: 'live',
    desc: 'Source-and-application tracing of separate property through the residence chain.',
    statNum: '2', statLbl: 'accounts traced'
  },
  {
    key: 'estate', icon: '⊟', tint: '#8a6528', soft: '#f4ead6',
    title: 'Estate & Worksheets', badge: 'Date of service', badgeCls: 'law',
    desc: 'Date-of-service asset/liability inventory, AZ guideline worksheets & document comparison.',
    statNum: '$1.35M', statLbl: 'estate @ service'
  },
  {
    key: 'settlement', icon: '⇄', tint: '#8a6528', soft: '#f4ead6',
    title: 'Settlement Modeling', badge: 'Draft', badgeCls: 'live',
    desc: 'Blend spousal, support, property splits & credits into ranked offer scenarios.',
    statNum: '$280K', statLbl: 'current gap'
  },
  {
    key: 'argument', icon: '§', tint: '#274566', soft: '#e7edf5',
    title: 'Argument Builder', badge: 'AI-assist', badgeCls: 'ai',
    desc: 'Draft fact-anchored position memos with statute & exhibit citations.',
    statNum: '5', statLbl: 'issue memos'
  },
  {
    key: 'redflag', icon: '⚑', tint: '#b3402f', soft: '#fbe7e2',
    title: 'Red-Flag Detection', badge: '2 med', badgeCls: 'warn',
    desc: 'Surface undisclosed accounts, inflated claims & inconsistent sworn statements.',
    statNum: '3', statLbl: 'open flags'
  }
];

const ACTIVITY = [
  { who: 'You', txt: 'uploaded <b>Checking ••4521</b> — transactions imported', time: '18m ago' },
  { who: 'Veritas', txt: 'flagged <b>Investment acct ••7834</b> as not on inventory', time: '1h ago' },
  { who: 'Veritas', txt: 'surfaced income discrepancy in <b>Paystub summary</b>', time: '2h ago' },
  { who: 'You', txt: 'completed <b>Spousal Support calculation</b>', time: '4h ago' },
  { who: 'Veritas', txt: 'traced property through <b>residence purchase</b>', time: 'Yesterday' },
  { who: 'You', txt: 'generated <b>Child Support Worksheet</b>', time: '2 days ago' }
];

const FLAGS = [
  {
    sev: 'med',
    title: 'Investment income omitted from disclosure',
    body: 'Investment account ••7834 shows $18,200 annual income but is not listed on the financial inventory.',
    ref: 'Sample Case · Memo 01'
  },
  {
    sev: 'med',
    title: 'Income variance in paystub series',
    body: 'Petitioner\'s bonus ($32K) varies year-to-year; no documentation of recurring nature.',
    ref: 'Discovery Intake · Paystubs'
  },
  {
    sev: 'low',
    title: 'Childcare expense line-item mismatch',
    body: 'Claimed childcare of $1,200/mo but receipts show average of $950/mo over same period.',
    ref: 'AFI Discrepancy · Worksheet'
  }
];

const MISSING = [
  {
    id: 'recent-stubs', priority: 'high', module: 'discovery', area: 'Discovery Intake',
    doc: 'Recent paystubs (2026 YTD)',
    why: 'Needed to establish current income run-rate. Last provided stub is May 2026.',
    ask: 'Request current paystubs through month-end'
  },
  {
    id: 'tax-return', priority: 'high', module: 'estate', area: 'Estate & Worksheets',
    doc: '2025 Tax return',
    why: 'Cross-check reported income and verify investment income claims.',
    ask: 'RFP — 2025 personal tax return'
  },
  {
    id: 'investment-stmt', priority: 'med', module: 'forensic', area: 'Forensic Tracing',
    doc: 'Investment account ••7834 — 2024 statements',
    why: 'Establish pre-service date balances for date-of-service calculation.',
    ask: 'Request 12-month historical statements'
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
