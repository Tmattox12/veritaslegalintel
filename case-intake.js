// Case Intake Form Handler

let childCount = 0;

function updateChildrenFields() {
  const count = parseInt(document.getElementById('childrenCount').value) || 0;
  const container = document.getElementById('childrenContainer');

  // Adjust to match the count
  while (childCount < count) {
    addChildEntry();
  }
  while (childCount > count) {
    removeChildEntry(childCount - 1);
  }
}

function addChildEntry() {
  const container = document.getElementById('childrenContainer');
  const index = childCount;

  const entry = document.createElement('div');
  entry.className = 'child-entry';
  entry.id = `child-${index}`;
  entry.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <span style="font-weight: 600; color: #1c3f66;">Child ${index + 1}</span>
      <button type="button" class="remove-btn" onclick="removeChildEntry(${index})">Remove</button>
    </div>
    <div class="child-grid">
      <div class="form-group">
        <label for="childName${index}">Child Name</label>
        <input type="text" id="childName${index}" name="childName${index}" placeholder="First & Last name" />
      </div>
      <div class="form-group">
        <label for="childAge${index}">Age *</label>
        <input type="number" id="childAge${index}" name="childAge${index}" min="0" max="30" placeholder="Age" required />
      </div>
      <div class="form-group">
        <label for="childGender${index}">Gender</label>
        <select id="childGender${index}" name="childGender${index}">
          <option value="">Select...</option>
          <option value="M">Male</option>
          <option value="F">Female</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div class="form-group">
        <label for="childBirthDate${index}">Birth Date</label>
        <input type="date" id="childBirthDate${index}" name="childBirthDate${index}" />
      </div>
    </div>
  `;

  container.appendChild(entry);
  childCount++;
}

function removeChildEntry(index) {
  const entry = document.getElementById(`child-${index}`);
  if (entry) {
    entry.remove();
  }
  childCount--;

  // Update childrenCount input to match actual entries
  const count = document.querySelectorAll('.child-entry').length;
  document.getElementById('childrenCount').value = count;
}

function updatePrenupFields() {
  const prenupDetails = document.getElementById('prenupDetails');
  const prenupExists = document.getElementById('prenupExists').checked;
  prenupDetails.style.display = prenupExists ? 'block' : 'none';
}

function updateStateInfo() {
  const state = document.getElementById('state').value;
  // Could add state-specific statute references here in future
  console.log('State changed to:', state);
}

function resetForm() {
  document.getElementById('intakeForm').reset();
  document.getElementById('childrenContainer').innerHTML = '';
  childCount = 0;
  document.getElementById('prenupDetails').style.display = 'none';
  // Also clear any saved draft/case so old data doesn't re-populate on reload.
  localStorage.removeItem('currentCaseDraft');
  localStorage.removeItem('currentCase');
}

function saveDraft() {
  // Collect form data without validation
  const formData = new FormData(document.getElementById('intakeForm'));

  // Collect children data
  const children = [];
  const childEntries = document.querySelectorAll('.child-entry');
  childEntries.forEach((entry, index) => {
    const name = document.getElementById(`childName${index}`)?.value;
    const age = document.getElementById(`childAge${index}`)?.value;
    const gender = document.getElementById(`childGender${index}`)?.value;
    const birthDate = document.getElementById(`childBirthDate${index}`)?.value;

    if (age) {
      children.push({
        name: name || `Child ${index + 1}`,
        age: parseInt(age),
        gender: gender || null,
        birthDate: birthDate || null,
      });
    }
  });

  // Build case data from whatever is filled in
  const caseName = formData.get('caseName') || 'Untitled Case';

  const caseData = {
    name: caseName,
    caseNumber: formData.get('caseNumber') || null,
    state: formData.get('state') || null,
    county: formData.get('county') || null,
    court: formData.get('court') || null,
    judgeAssigned: formData.get('judgeAssigned') || null,
    trialDate: formData.get('trialDate') || null,

    petitioner: formData.get('petitioner') || null,
    petitionerAge: parseInt(formData.get('petitionerAge')) || null,
    respondent: formData.get('respondent') || null,
    respondentAge: parseInt(formData.get('respondentAge')) || null,

    marriageLength: parseFloat(formData.get('marriageLength')) || null,
    marriageDate: formData.get('marriageDate') || null,
    separationDate: formData.get('separationDate') || null,
    yearsInState: parseFloat(formData.get('yearsInState')) || null,
    petitionerPriorMarriage: formData.get('petitionerPrior') ? true : false,
    respondentPriorMarriage: formData.get('respondentPrior') ? true : false,

    children: children,
    childrenCount: children.length,
    custodyArrangement: Array.from(document.querySelectorAll('input[name="custody"]:checked')).map(x => x.value),
    childSupportStatus: formData.get('childSupport') || null,
    spousalMaintenanceStatus: formData.get('alimony') || null,

    hasPrenup: formData.get('prenupExists') ? true : false,
    prenupDetails: formData.get('prenupDetailsText') || null,
    separatePropertyClaims: formData.get('separateProperty') || null,


    notes: formData.get('notes') || null,
    status: 'draft',
    createdAt: new Date().toISOString(),
    _savedAt: new Date().toISOString(),
  };

  // Save to localStorage as draft
  localStorage.setItem('currentCaseDraft', JSON.stringify(caseData));

  // Show success message
  const msg = document.createElement('div');
  msg.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #e3f2ea;
    border: 1px solid #2e7d32;
    color: #2e7d32;
    padding: 16px 24px;
    border-radius: 8px;
    z-index: 9999;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  msg.textContent = '✓ Draft saved successfully!';
  document.body.appendChild(msg);

  setTimeout(() => msg.remove(), 3000);
}

let boundMatterId = null;

async function handleSubmit(event) {
  event.preventDefault();

  // Collect form data
  const formData = new FormData(document.getElementById('intakeForm'));

  // Collect children data
  const children = [];
  const childEntries = document.querySelectorAll('.child-entry');
  childEntries.forEach((entry, index) => {
    const name = document.getElementById(`childName${index}`)?.value;
    const age = document.getElementById(`childAge${index}`)?.value;
    const gender = document.getElementById(`childGender${index}`)?.value;
    const birthDate = document.getElementById(`childBirthDate${index}`)?.value;

    if (age) {
      children.push({
        name: name || `Child ${index + 1}`,
        age: parseInt(age),
        gender: gender || null,
        birthDate: birthDate || null,
      });
    }
  });

  // Build case data
  const caseData = {
    name: formData.get('caseName') || 'Untitled Case',
    caseNumber: formData.get('caseNumber') || null,
    state: formData.get('state'),
    county: formData.get('county'),
    court: formData.get('court'),
    judgeAssigned: formData.get('judgeAssigned') || null,
    trialDate: formData.get('trialDate') || null,

    petitioner: formData.get('petitioner'),
    petitionerAge: parseInt(formData.get('petitionerAge')) || 0,
    respondent: formData.get('respondent'),
    respondentAge: parseInt(formData.get('respondentAge')) || 0,

    marriageLength: parseFloat(formData.get('marriageLength')) || 0,
    marriageDate: formData.get('marriageDate') || null,
    separationDate: formData.get('separationDate') || null,
    yearsInState: parseFloat(formData.get('yearsInState')) || 0,
    petitionerPriorMarriage: formData.get('petitionerPrior') ? true : false,
    respondentPriorMarriage: formData.get('respondentPrior') ? true : false,

    children: children,
    childrenCount: children.length,
    custodyArrangement: Array.from(document.querySelectorAll('input[name="custody"]:checked')).map(x => x.value),
    childSupportStatus: formData.get('childSupport') || null,
    spousalMaintenanceStatus: formData.get('alimony') || null,

    hasPrenup: formData.get('prenupExists') ? true : false,
    prenupDetails: formData.get('prenupDetailsText') || null,
    separatePropertyClaims: formData.get('separateProperty') || null,

    petitionerAnnualIncome: parseFloat(formData.get('petitionerIncome')) || 0,
    respondentAnnualIncome: parseFloat(formData.get('respondentIncome')) || 0,
    petitionerEmploymentStatus: formData.get('petitionerEmployment') || null,
    respondentEmploymentStatus: formData.get('respondentEmployment') || null,

    estimatedEstateValue: parseFloat(formData.get('estimatedEstate')) || 0,
    estimatedLiabilities: parseFloat(formData.get('estimatedDebt')) || 0,

    notes: formData.get('notes') || null,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  // The backend matter (fetched fresh each load) is the source of truth.
  // localStorage.currentCase is no longer used to repopulate the form.
  localStorage.removeItem('currentCaseDraft'); // Clear draft when case is submitted

  const successMsg = document.getElementById('successMessage');
  const isUpdate = !!boundMatterId;
  try {
    const url = isUpdate ? `http://localhost:3000/api/matters/${boundMatterId}` : 'http://localhost:3000/api/matters';
    const resp = await fetch(url, {
      method: isUpdate ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: caseData.name,
        clientName: caseData.petitioner || caseData.name,
        caseNo: caseData.caseNumber,
        county: caseData.county,
        state: caseData.state,
        court: caseData.court,
        petitioner: caseData.petitioner,
        respondent: caseData.respondent,
        details: caseData,
      }),
    });

    if (!resp.ok) throw new Error(isUpdate ? 'Matter update failed' : 'Matter creation failed');
    const matter = await resp.json();
    boundMatterId = matter.id;

    // Make this the active matter everywhere (matter-selector + discovery pages listen for this).
    localStorage.setItem('currentMatterId', matter.id);
    window.dispatchEvent(new CustomEvent('matterSelected', { detail: matter }));

    successMsg.innerHTML = isUpdate
      ? `✓ Case "${caseData.name}" updated. Case-specific details across the app stay driven by this intake plus your uploaded documents — nothing else to do here.<br>
         <a href="/discovery-intake.html?matter=${matter.id}" style="display:inline-block;margin-top:10px;padding:10px 16px;background:#1c6b52;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Go to Document Intake →</a>`
      : `
      ✓ Case "${caseData.name}" created. <strong>Next step: import discovery documents.</strong><br>
      <a href="/discovery-intake.html?matter=${matter.id}" style="display:inline-block;margin-top:10px;padding:10px 16px;background:#1c6b52;color:#fff;border-radius:6px;text-decoration:none;font-weight:600;">Import Documents →</a>
      <a href="index.html" style="display:inline-block;margin-top:10px;margin-left:8px;padding:10px 16px;background:#eef2f7;color:#1c3f66;border-radius:6px;text-decoration:none;font-weight:600;">Go to Dashboard</a>
    `;
    successMsg.classList.add('show');
    // No auto-redirect: let the user choose the next step.
  } catch (e) {
    console.error('Matter save error:', e);
    successMsg.innerHTML = `
      Could not reach the backend</strong> (is the Node server running on :3000?),<br>
      so this case could not be ${isUpdate ? 'updated' : 'created'}. <a href="index.html" style="color:#1c3f66;">Continue to dashboard</a>
    `;
    successMsg.classList.add('show');
  }
}

// This page is a blank template by default. When a real matter is already
// active (backend-confirmed, not just stale localStorage), it loads that
// matter's saved intake details so editing updates the same case instead of
// creating a duplicate. Case-specific values always come from the backend
// matter + uploaded documents — never hardcoded into the template.
async function loadActiveMatter() {
  const mid = localStorage.getItem('currentMatterId');
  if (!mid) return false;
  try {
    const resp = await fetch(`http://localhost:3000/api/matters/${mid}`);
    if (!resp.ok) {
      // Stale id (matter deleted or backend reset) — stay on a blank template.
      localStorage.removeItem('currentMatterId');
      return false;
    }
    const matter = await resp.json();
    let details = {};
    try { details = matter.details ? JSON.parse(matter.details) : {}; } catch (e) { details = {}; }
    // Fall back to top-level matter columns if details JSON is missing a field.
    details.name = details.name || matter.name;
    details.caseNumber = details.caseNumber || matter.case_no;
    details.county = details.county || matter.county;
    details.state = details.state || matter.state;
    details.court = details.court || matter.court;
    details.petitioner = details.petitioner || matter.petitioner;
    details.respondent = details.respondent || matter.respondent;

    fillForm(details);
    boundMatterId = matter.id;

    const banner = document.getElementById('successMessage');
    if (banner) {
      banner.innerHTML = `Editing active case: <strong>${matter.name || 'Untitled Case'}</strong>. Saving below updates this case — it does not create a new one.`;
      banner.classList.add('show');
    }
    return true;
  } catch (e) {
    // Backend offline — leave the template blank rather than guessing from stale local data.
    return false;
  }
}

// Start with a BLANK form. Do not auto-fill from stale localStorage drafts/cases —
// this is a clean template. Users can still use the explicit "Save draft" feature.
function loadDraft() {
  // If a draft was saved in THIS session via the Save Draft button, restore it.
  // Only restore drafts that are clearly fresh (have a _savedAt timestamp within 24h).
  const raw = localStorage.getItem('currentCaseDraft');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    const savedAt = data._savedAt ? new Date(data._savedAt).getTime() : 0;
    const fresh = savedAt && (Date.now() - savedAt) < 24 * 60 * 60 * 1000;
    if (!fresh) {
      localStorage.removeItem('currentCaseDraft');
      return;
    }
    fillForm(data);
  } catch (e) { /* ignore corrupt draft */ }
}

function fillForm(data) {
  try {
    // Fill in form fields from draft
    document.getElementById('caseName').value = data.name || '';
    document.getElementById('caseNumber').value = data.caseNumber || '';
    document.getElementById('county').value = data.county || '';
    document.getElementById('state').value = data.state || '';
    document.getElementById('court').value = data.court || '';
    document.getElementById('judgeAssigned').value = data.judgeAssigned || '';
    document.getElementById('trialDate').value = data.trialDate || '';

    document.getElementById('petitioner').value = data.petitioner || '';
    document.getElementById('petitionerAge').value = data.petitionerAge || '';
    document.getElementById('respondent').value = data.respondent || '';
    document.getElementById('respondentAge').value = data.respondentAge || '';

    document.getElementById('marriageLength').value = data.marriageLength || '';
    document.getElementById('marriageDate').value = data.marriageDate || '';
    document.getElementById('separationDate').value = data.separationDate || '';
    document.getElementById('yearsInState').value = data.yearsInState || '';

    if (data.petitionerPriorMarriage) document.getElementById('petitionerPrior').checked = true;
    if (data.respondentPriorMarriage) document.getElementById('respondentPrior').checked = true;

    // Restore children
    if (data.children && data.children.length > 0) {
      data.children.forEach(() => {
        addChildEntry();
      });

      document.querySelectorAll('.child-entry').forEach((entry, index) => {
        if (data.children[index]) {
          document.getElementById(`childName${index}`).value = data.children[index].name || '';
          document.getElementById(`childAge${index}`).value = data.children[index].age || '';
          document.getElementById(`childGender${index}`).value = data.children[index].gender || '';
          document.getElementById(`childBirthDate${index}`).value = data.children[index].birthDate || '';
        }
      });

      document.getElementById('childrenCount').value = data.children.length;
    }

    // Restore custody checkboxes
    if (data.custodyArrangement && Array.isArray(data.custodyArrangement)) {
      data.custodyArrangement.forEach(val => {
        const checkbox = document.getElementById(`custody-${val}`);
        if (checkbox) checkbox.checked = true;
      });
    }

    document.getElementById('childSupport').value = data.childSupportStatus || '';
    document.getElementById('alimony').value = data.spousalMaintenanceStatus || '';

    if (data.hasPrenup) {
      document.getElementById('prenupExists').checked = true;
      document.getElementById('prenupDetails').style.display = 'block';
      document.getElementById('prenupDetailsText').value = data.prenupDetails || '';
    }
    document.getElementById('separateProperty').value = data.separatePropertyClaims || '';


    document.getElementById('notes').value = data.notes || '';

    console.log('✓ Draft loaded successfully');
  } catch (e) {
    console.error('Error loading draft:', e);
  }
}

// Setup auto-calculations for dates
function setupCalculations() {
  // Marriage length calculation
  const marriageDate = document.getElementById('marriageDate');
  const separationDate = document.getElementById('separationDate');
  const marriageLength = document.getElementById('marriageLength');

  if (marriageDate && separationDate && marriageLength) {
    marriageDate.addEventListener('change', calculateMarriageLength);
    separationDate.addEventListener('change', calculateMarriageLength);
  }
}

function calculateMarriageLength() {
  const marriageDateEl = document.getElementById('marriageDate');
  const separationDateEl = document.getElementById('separationDate');
  const marriageLengthEl = document.getElementById('marriageLength');

  if (!marriageDateEl?.value) return;

  const marriage = new Date(marriageDateEl.value);
  const separation = separationDateEl?.value ? new Date(separationDateEl.value) : new Date();

  if (marriage > separation) {
    marriageLengthEl.value = '';
    return;
  }

  const years = (separation - marriage) / (1000 * 60 * 60 * 24 * 365.25);
  marriageLengthEl.value = years.toFixed(1);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  // If a real matter is already active, load its saved details from the
  // backend. Only fall back to a local draft when there's no active matter.
  const loadedMatter = await loadActiveMatter();
  if (!loadedMatter) loadDraft();

  // Setup calculations
  setupCalculations();

  // Trigger marriage length calculation if dates are already filled
  setTimeout(() => {
    calculateMarriageLength();
  }, 100);

  // Skip auth redirect in local dev; only enforce when actually behind the API
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isDev && typeof api !== 'undefined' && !api.isAuthenticated()) {
    window.location.href = 'auth.html';
    return;
  }

  // Load logo
  if (typeof setupLogo === 'function') {
    setupLogo();
  }

  // Reflect edit-vs-create state on the submit button.
  const submitBtn = document.querySelector('button[type="submit"]');
  if (boundMatterId && submitBtn) {
    submitBtn.innerHTML = '✎ Update Case';
  }
});
