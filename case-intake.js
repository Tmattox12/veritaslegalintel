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

  // Save to localStorage
  localStorage.setItem('currentCase', JSON.stringify(caseData));
  localStorage.removeItem('currentCaseDraft'); // Clear draft when case is created

  // Show success message
  const successMsg = document.getElementById('successMessage');
  successMsg.classList.add('show');

  // Redirect to dashboard after 2 seconds
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 2000);
}

// Load saved draft or case on page load
function loadDraft() {
  // Try to load draft first, fall back to current case
  let draft = localStorage.getItem('currentCaseDraft');
  if (!draft) {
    draft = localStorage.getItem('currentCase');
  }
  if (!draft) return;

  try {
    const data = JSON.parse(draft);

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
document.addEventListener('DOMContentLoaded', () => {
  // Load any saved draft
  loadDraft();

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

  // Check if updating existing case
  const existingCase = localStorage.getItem('currentCase');
  const submitBtn = document.querySelector('button[type="submit"]');
  if (existingCase && submitBtn) {
    submitBtn.innerHTML = '✎ Update Case';
  }
});
