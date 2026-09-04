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
  } catch (error) {
    console.error('Error loading sidebar:', error);
  }
});

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
