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

async function handleSubmit(event) {
  event.preventDefault();

  // Validate required fields
  const caseName = document.getElementById('caseName')?.value;
  if (!caseName) {
    alert('Please enter a case name');
    return;
  }

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
    name: caseName,
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
    custodyArrangement: formData.get('custody') || null,
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
    status: 'intake-complete',
    createdAt: new Date().toISOString(),
  };

  // Save to localStorage
  localStorage.setItem('currentCase', JSON.stringify(caseData));

  // Show success message
  const successMsg = document.getElementById('successMessage');
  successMsg.classList.add('show');

  // Redirect to dashboard after 2 seconds
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 2000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Skip auth redirect in local dev; only enforce when actually behind the API
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isDev && !api.isAuthenticated()) {
    window.location.href = 'auth.html';
    return;
  }

  // Load logo
  if (typeof setupLogo === 'function') {
    setupLogo();
  }
});
