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

  const successMsg = document.getElementById('successMessage');
  successMsg.classList.add('show');

  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1500);
}