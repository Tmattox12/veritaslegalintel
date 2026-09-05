// Load current case data and display on pages
function loadCurrentCase() {
  const caseData = localStorage.getItem('currentCase');

  if (caseData) {
    try {
      const currentCase = JSON.parse(caseData);

      // Update page title/header with case info
      updateCaseHeader(currentCase);

      // Make case data globally available
      window.currentCase = currentCase;

      console.log('✓ Current case loaded:', currentCase.petitioner.name, 'v.', currentCase.respondent.name);
      return currentCase;
    } catch (e) {
      console.error('Error loading case data:', e);
      return null;
    }
  }

  return null;
}

function updateCaseHeader(caseData) {
  // Update page title
  const petitioner = caseData.petitioner || '[Petitioner]';
  const respondent = caseData.respondent || '[Respondent]';
  const caseTitle = `${petitioner} v. ${respondent}`;

  document.title = `${caseTitle} — Veritas`;

  // Update topbar matter button
  const matterBtn = document.querySelector('.matter-btn strong');
  if (matterBtn) {
    matterBtn.textContent = caseTitle;
  }

  // Update case number and county/state in topbar
  const caseNo = document.querySelector('.matter-btn .case-no');
  if (caseNo && caseData.caseNumber && caseData.county && caseData.state) {
    caseNo.textContent = `No. ${caseData.caseNumber} · ${caseData.county}, ${caseData.state}`;
  }

  // Update any element with id="caseName"
  const caseNameEl = document.getElementById('caseName');
  if (caseNameEl) {
    caseNameEl.textContent = caseTitle;
  }
}

function getCaseInfo(field) {
  if (!window.currentCase) return null;

  const parts = field.split('.');
  let value = window.currentCase;

  for (const part of parts) {
    value = value[part];
    if (value === undefined) return null;
  }

  return value;
}

// Load case on page load
document.addEventListener('DOMContentLoaded', loadCurrentCase);
