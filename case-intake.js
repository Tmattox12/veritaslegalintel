function updateChildrenFields() {
  const num = parseInt(document.getElementById('childrenCount').value) || 0;
  const container = document.getElementById('childrenContainer');
  const currentChildren = container.querySelectorAll('.child-entry').length;

  if (num > currentChildren) {
    for (let i = currentChildren; i < num; i++) {
      addChildEntry();
    }
  } else if (num < currentChildren) {
    const children = container.querySelectorAll('.child-entry');
    for (let i = currentChildren - 1; i >= num; i--) {
      children[i].remove();
    }
  }
}

function addChildEntry() {
  const container = document.getElementById('childrenContainer');
  const childCount = container.querySelectorAll('.child-entry').length + 1;
  const childId = `child-${Date.now()}-${Math.random()}`;

  const html = `
    <div class="child-entry" id="${childId}">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <strong>Child ${childCount}</strong>
        <button type="button" class="remove-btn" onclick="document.getElementById('${childId}').remove(); updateChildCount();">Remove</button>
      </div>
      <div class="child-grid">
        <div class="form-group">
          <label>Child's Name</label>
          <input type="text" class="childName" placeholder="Full name" />
        </div>
        <div class="form-group">
          <label>Date of Birth</label>
          <input type="date" class="childDOB" />
        </div>
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', html);
}

function updateChildCount() {
  const container = document.getElementById('childrenContainer');
  const count = container.querySelectorAll('.child-entry').length;
  document.getElementById('childrenCount').value = count;
}

function updatePrenupFields() {
  const prenupExists = document.getElementById('prenupExists').checked;
  document.getElementById('prenupDetails').style.display = prenupExists ? 'block' : 'none';
}

function resetForm() {
  if (confirm('Clear all fields?')) {
    document.getElementById('intakeForm').reset();
    document.getElementById('childrenContainer').innerHTML = '';
    document.getElementById('prenupDetails').style.display = 'none';
  }
}

function saveDraft() {
  const formData = {
    caseNumber: document.getElementById('caseNumber').value,
    petitioner: {
      name: document.getElementById('petitioner').value,
      age: document.getElementById('petitionerAge').value,
      income: document.getElementById('petitionerIncome').value,
      employment: document.getElementById('petitionerEmployment').value,
    },
    respondent: {
      name: document.getElementById('respondent').value,
      age: document.getElementById('respondentAge').value,
      income: document.getElementById('respondentIncome').value,
      employment: document.getElementById('respondentEmployment').value,
    },
    marriage: {
      date: document.getElementById('marriageDate').value,
      length: document.getElementById('marriageLength').value,
      separationDate: document.getElementById('separationDate').value,
    },
    children: Array.from(document.getElementById('childrenContainer').querySelectorAll('.child-entry')).map(entry => ({
      name: entry.querySelector('.childName').value,
      dob: entry.querySelector('.childDOB').value,
    })),
    custody: Array.from(document.querySelectorAll('input[name="custody"]:checked')).map(x => x.value),
    childSupport: document.getElementById('childSupport').value,
    alimony: document.getElementById('alimony').value,
    assets: {
      estimated: document.getElementById('estimatedEstate').value,
    },
    liabilities: {
      estimated: document.getElementById('estimatedDebt').value,
    },
    notes: document.getElementById('notes').value,
    timestamp: new Date().toISOString(),
  };

  localStorage.setItem('caseIntakeDraft', JSON.stringify(formData));

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

function loadDraft() {
  const draft = localStorage.getItem('caseIntakeDraft');
  if (draft) {
    try {
      const data = JSON.parse(draft);

      // Fill in basic fields
      if (data.caseNumber) document.getElementById('caseNumber').value = data.caseNumber;
      if (data.petitioner) {
        if (data.petitioner.name) document.getElementById('petitioner').value = data.petitioner.name;
        if (data.petitioner.age) document.getElementById('petitionerAge').value = data.petitioner.age;
        if (data.petitioner.income) document.getElementById('petitionerIncome').value = data.petitioner.income;
        if (data.petitioner.employment) document.getElementById('petitionerEmployment').value = data.petitioner.employment;
      }
      if (data.respondent) {
        if (data.respondent.name) document.getElementById('respondent').value = data.respondent.name;
        if (data.respondent.age) document.getElementById('respondentAge').value = data.respondent.age;
        if (data.respondent.income) document.getElementById('respondentIncome').value = data.respondent.income;
        if (data.respondent.employment) document.getElementById('respondentEmployment').value = data.respondent.employment;
      }
      if (data.marriage) {
        if (data.marriage.date) document.getElementById('marriageDate').value = data.marriage.date;
        if (data.marriage.length) document.getElementById('marriageLength').value = data.marriage.length;
        if (data.marriage.separationDate) document.getElementById('separationDate').value = data.marriage.separationDate;
      }

      // Fill custody checkboxes
      if (data.custody && Array.isArray(data.custody)) {
        data.custody.forEach(val => {
          const checkbox = document.querySelector(`input[name="custody"][value="${val}"]`);
          if (checkbox) checkbox.checked = true;
        });
      }

      if (data.childSupport) document.getElementById('childSupport').value = data.childSupport;
      if (data.alimony) document.getElementById('alimony').value = data.alimony;
      if (data.assets && data.assets.estimated) document.getElementById('estimatedEstate').value = data.assets.estimated;
      if (data.liabilities && data.liabilities.estimated) document.getElementById('estimatedDebt').value = data.liabilities.estimated;
      if (data.notes) document.getElementById('notes').value = data.notes;

      // Restore children
      if (data.children && Array.isArray(data.children)) {
        data.children.forEach(child => {
          addChildEntry();
          const container = document.getElementById('childrenContainer');
          const lastChild = container.querySelector('.child-entry:last-child');
          lastChild.querySelector('.childName').value = child.name || '';
          lastChild.querySelector('.childDOB').value = child.dob || '';
        });
      }

      console.log('✓ Draft loaded');
    } catch (e) {
      console.error('Error loading draft:', e);
    }
  }
}

function handleSubmit(event) {
  event.preventDefault();

  const formData = {
    caseNumber: document.getElementById('caseNumber').value,
    petitioner: {
      name: document.getElementById('petitioner').value,
      age: document.getElementById('petitionerAge').value,
      income: document.getElementById('petitionerIncome').value,
      employment: document.getElementById('petitionerEmployment').value,
    },
    respondent: {
      name: document.getElementById('respondent').value,
      age: document.getElementById('respondentAge').value,
      income: document.getElementById('respondentIncome').value,
      employment: document.getElementById('respondentEmployment').value,
    },
    marriage: {
      date: document.getElementById('marriageDate').value,
      length: document.getElementById('marriageLength').value,
      separationDate: document.getElementById('separationDate').value,
    },
    children: Array.from(document.getElementById('childrenContainer').querySelectorAll('.child-entry')).map(entry => ({
      name: entry.querySelector('.childName').value,
      dob: entry.querySelector('.childDOB').value,
    })),
    custody: Array.from(document.querySelectorAll('input[name="custody"]:checked')).map(x => x.value),
    childSupport: document.getElementById('childSupport').value,
    alimony: document.getElementById('alimony').value,
    assets: {
      estimated: document.getElementById('estimatedEstate').value,
    },
    liabilities: {
      estimated: document.getElementById('estimatedDebt').value,
    },
    notes: document.getElementById('notes').value,
  };

  localStorage.setItem('caseIntake', JSON.stringify(formData));
  localStorage.removeItem('caseIntakeDraft'); // Clear draft after creating case

  const successMsg = document.getElementById('successMessage');
  successMsg.classList.add('show');

  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1500);
}

function loadDiscoverySummary() {
  // Check if there's extracted data from discovery documents
  const bankStatements = localStorage.getItem('bankStatementsData');

  if (bankStatements) {
    try {
      const data = JSON.parse(bankStatements);

      // Extract income info
      if (data.incomeItems) {
        const petitionerIncome = data.incomeItems
          .filter(item => item.party === 'paying_spouse')
          .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        const respondentIncome = data.incomeItems
          .filter(item => item.party === 'supported_spouse')
          .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

        if (petitionerIncome > 0) {
          document.getElementById('summaryPetitionerIncome').value = '$' + petitionerIncome.toLocaleString('en-US', {maximumFractionDigits: 0});
          // Also populate the main income field if empty
          if (!document.getElementById('petitionerIncome').value) {
            document.getElementById('petitionerIncome').value = petitionerIncome;
          }
        }

        if (respondentIncome > 0) {
          document.getElementById('summaryRespondentIncome').value = '$' + respondentIncome.toLocaleString('en-US', {maximumFractionDigits: 0});
          if (!document.getElementById('respondentIncome').value) {
            document.getElementById('respondentIncome').value = respondentIncome;
          }
        }
      }

      // Extract flags info (assets, suspicious activity, etc.)
      if (data.flags && data.flags.length > 0) {
        const assetFlags = data.flags.filter(f => f.rule_type === 'undisclosed_account' || f.rule_type === 'large_transfer');
        if (assetFlags.length > 0) {
          document.getElementById('summaryAssets').value = assetFlags.length + ' account(s) identified';
        }
      }

      console.log('✓ Discovery summary loaded');
    } catch (e) {
      console.error('Error loading discovery summary:', e);
    }
  }
}

// Load draft on page load
window.addEventListener('DOMContentLoaded', function() {
  loadDraft();
  loadDiscoverySummary();
});