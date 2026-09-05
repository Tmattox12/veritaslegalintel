// Load and inject shared sidebar on all pages
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('sidebar.html');
    const sidebarHTML = await response.text();

    // Find the existing sidebar or create a placeholder
    let sidebarContainer = document.querySelector('aside.sidebar');

    if (sidebarContainer) {
      // Replace existing sidebar
      sidebarContainer.outerHTML = sidebarHTML;
    } else {
      // Insert at the beginning of body if no sidebar exists
      document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
    }

    // Mark the current page's nav item as active
    setActiveNavItem();

    // Setup Matters link to open dropdown
    setupSidebarMattersLink();

    // Load case header (updates topbar with case name, county, state)
    loadCaseHeader();
  } catch (error) {
    console.error('Error loading sidebar:', error);
  }
});

// Load and display current case on all pages
function loadCaseHeader() {
  const caseData = localStorage.getItem('currentCase');
  if (!caseData) return;

  try {
    const currentCase = JSON.parse(caseData);
    updateCaseHeader(currentCase);
  } catch (e) {
    console.error('Error loading case header:', e);
  }
}

function updateCaseHeader(caseData) {
  // Build case title
  const petitioner = caseData.petitioner || '[Petitioner]';
  const respondent = caseData.respondent || '[Respondent]';
  const caseTitle = `${petitioner} v. ${respondent}`;

  // Update page title
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
}

function setActiveNavItem() {
  // Get current page filename
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  // Remove active class from all nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  // Add active class to current page's nav item
  const activeItem = Array.from(document.querySelectorAll('.nav-item'))
    .find(item => {
      const href = item.getAttribute('href');
      return href === currentPage || href === currentPage.replace('.html', '.html');
    });

  if (activeItem) {
    activeItem.classList.add('active');
  }
}

function setupSidebarMattersLink() {
  // Find Matters link and make it open the dropdown (same as in matter-selector.js)
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    const text = item.textContent.trim();
    if (text === 'Matters' || (text.includes('▤') && text.includes('Matters'))) {
      item.style.cursor = 'pointer';
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Trigger matter dropdown if matter-selector.js is loaded
        if (window.showMatterDropdownFromSidebar) {
          window.showMatterDropdownFromSidebar();
        }
      });
    }
  });
}
