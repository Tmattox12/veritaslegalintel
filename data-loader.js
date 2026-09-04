// Data Loader - Initialize the app with real data from the backend

async function initializeAppData() {
  try {
    console.log('Loading matters from backend...');
    const matters = await matterManager.loadMatterList();
    const users = await matterManager.loadUserList();

    console.log('Matters loaded:', matters);
    console.log('Users loaded:', users);

    // Store in window for global access
    window.APP_DATA = {
      matters,
      users,
      loading: false,
    };

    // Trigger UI update (custom event that the UI can listen for)
    document.dispatchEvent(new CustomEvent('appDataLoaded', { detail: { matters, users } }));

    return { matters, users };
  } catch (err) {
    console.error('Failed to load app data:', err);
    window.APP_DATA = { matters: [], users: [], loading: false, error: err.message };
    document.dispatchEvent(new CustomEvent('appDataError', { detail: err }));
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (typeof matterManager !== 'undefined') {
    initializeAppData();
  }
});
