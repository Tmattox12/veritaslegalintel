let currentMatter = null;
let allMatters = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Load matters from API
  await loadMatters();

  // Setup matter button click handler
  const matterBtn = document.querySelector('.matter-btn');
  if (matterBtn) {
    matterBtn.addEventListener('click', showMatterDropdown);
  }

  // Make sidebar "Matters" link open the dropdown
  setupSidebarMattersLink();

  // Load previously selected matter from localStorage
  const savedMatterId = localStorage.getItem('currentMatterId');
  if (savedMatterId) {
    const saved = allMatters.find(m => m.id === savedMatterId);
    if (saved) {
      currentMatter = saved;
      updateMatterDisplay();
    } else {
      // Saved matter no longer exists (e.g., data was reset) -> clear it
      localStorage.removeItem('currentMatterId');
      updateMatterDisplay();
    }
  } else {
    updateMatterDisplay();
  }
});

function setupSidebarMattersLink() {
  // Find all nav items
  const navItems = document.querySelectorAll('.nav-item');

  navItems.forEach(item => {
    const text = item.textContent;
    // Look for the Matters link - check if text contains "Matters"
    if (text.includes('Matters')) {
      item.style.cursor = 'pointer';
      item.href = '#'; // Make sure href is set to prevent navigation
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showMatterDropdownFromSidebar();
      });
    }
  });
}

function showMatterDropdownFromSidebar() {
  // Remove any existing dropdown
  const existing = document.querySelector('.matter-dropdown');
  if (existing) {
    existing.remove();
    return;
  }

  // Create dropdown container in the sidebar near the Matters link
  const mattersLink = Array.from(document.querySelectorAll('.nav-item'))
    .find(a => a.textContent.includes('Matters'));

  if (!mattersLink) return;

  const dropdown = document.createElement('div');
  dropdown.className = 'matter-dropdown';
  dropdown.style.cssText = `
    position: fixed;
    top: 245px;
    left: 23px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    min-width: 200px;
    max-height: 400px;
    overflow-y: auto;
  `;

  allMatters.forEach(matter => {
    const item = document.createElement('button');
    item.style.cssText = `
      width: 100%;
      padding: 12px 16px;
      border: none;
      background: ${matter.id === currentMatter?.id ? '#f0f7ff' : 'white'};
      text-align: left;
      cursor: pointer;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    `;

    const name = matter.name || matter.client_name || 'Unknown';
    item.innerHTML = `
      <div style="font-weight: 600; color: #1c3f66;">${name}</div>
      <div style="font-size: 11px; color: #666; margin-top: 2px;">
        ${matter.id === currentMatter?.id ? '✓ Selected' : ''}
      </div>
    `;

    item.addEventListener('click', () => {
      selectMatter(matter);
      dropdown.remove();
    });

    dropdown.appendChild(item);
  });

  document.body.appendChild(dropdown);

  // Close dropdown when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (e.target !== mattersLink && !dropdown.contains(e.target)) {
      dropdown.remove();
    }
  }, { once: true });
}

async function loadMatters() {
  try {
    const response = await fetch('http://localhost:3000/api/matters');
    allMatters = await response.json();

    // Set first matter as default if none selected
    if (allMatters.length > 0 && !currentMatter) {
      currentMatter = allMatters[0];
      localStorage.setItem('currentMatterId', currentMatter.id);
      updateMatterDisplay();
    }
  } catch (error) {
    console.error('Error loading matters:', error);
  }
}

function updateMatterDisplay() {
  const matterBtn = document.querySelector('.matter-btn');
  if (!matterBtn) return;

  if (!currentMatter) {
    matterBtn.innerHTML = `
      <strong>[No matter selected]</strong>
      <span class="case-no">Create or select a matter</span>
      <span class="chev">▾</span>
    `;
    return;
  }

  const name = currentMatter.name || currentMatter.client_name || 'Unknown Matter';
  const caseNo = currentMatter.case_no || '[Case No.]';
  const county = currentMatter.county || '[County]';
  const state = currentMatter.state || '[State]';

  matterBtn.innerHTML = `
    <strong>${name}</strong>
    <span class="case-no">No. ${caseNo} · ${county}, ${state}</span>
    <span class="chev">▾</span>
  `;
}

function showMatterDropdown(e) {
  e.stopPropagation();

  // Remove any existing dropdown
  const existing = document.querySelector('.matter-dropdown');
  if (existing) {
    existing.remove();
    return;
  }

  const matterBtn = document.querySelector('.matter-btn');
  const dropdown = document.createElement('div');
  dropdown.className = 'matter-dropdown';
  dropdown.style.cssText = `
    position: absolute;
    top: 60px;
    left: 0;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    min-width: 280px;
    max-height: 400px;
    overflow-y: auto;
  `;

  // Empty state: no matters yet -> guide to create one
  if (allMatters.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:16px;font-size:13px;color:#666;';
    empty.innerHTML = `
      <div style="font-weight:600;color:#1c3f66;margin-bottom:6px;">No matters yet</div>
      <div style="margin-bottom:12px;">Start by completing a case intake to create your first matter.</div>
      <button id="goToIntake" style="width:100%;padding:10px;background:#1c3f66;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:600;">+ New Case Intake</button>
    `;
    dropdown.appendChild(empty);
    matterBtn.parentElement.style.position = 'relative';
    matterBtn.parentElement.appendChild(dropdown);
    empty.querySelector('#goToIntake').addEventListener('click', () => {
      window.location.href = '/case-intake.html';
    });
    document.addEventListener('click', () => { dropdown.remove(); }, { once: true });
    return;
  }

  allMatters.forEach(matter => {
    const item = document.createElement('button');
    item.style.cssText = `
      width: 100%;
      padding: 12px 16px;
      border: none;
      background: ${matter.id === currentMatter?.id ? '#f0f7ff' : 'white'};
      text-align: left;
      cursor: pointer;
      border-bottom: 1px solid #eee;
      font-size: 13px;
    `;

    const name = matter.name || matter.client_name || 'Unknown';
    item.innerHTML = `
      <div style="font-weight: 600; color: #1c3f66;">${name}</div>
      <div style="font-size: 11px; color: #666; margin-top: 2px;">
        ${matter.id === currentMatter?.id ? '✓ Selected' : ''}
      </div>
    `;

    item.addEventListener('click', () => {
      selectMatter(matter);
      dropdown.remove();
    });

    dropdown.appendChild(item);
  });

  matterBtn.parentElement.style.position = 'relative';
  matterBtn.parentElement.appendChild(dropdown);

  // Close dropdown when clicking elsewhere
  document.addEventListener('click', () => {
    dropdown.remove();
  }, { once: true });
}

function selectMatter(matter) {
  currentMatter = matter;
  localStorage.setItem('currentMatterId', matter.id);
  updateMatterDisplay();

  // Update discovery-intake.js with the selected matter
  window.dispatchEvent(new CustomEvent('matterSelected', { detail: matter }));
}

function navigateToDiscoveryIntake() {
  if (!currentMatter) {
    alert('Please select a matter first.');
    return;
  }
  window.location.href = `/discovery-intake.html?matter=${currentMatter.id}`;
}
