// Real-Time Sync Handler
// Listens for WebSocket updates and refreshes module data

class SyncHandler {
  constructor() {
    this.handlers = {};
    this.initSocketListeners();
  }

  // Initialize WebSocket event listeners
  initSocketListeners() {
    if (typeof socket === 'undefined') return;

    // Join case room when case loads
    socket.on('connected', () => {
      this.joinCurrentCase();
    });

    // Handle incoming module updates
    socket.on('module-updated', (data) => {
      this.handleRemoteUpdate(data);
    });

    // Show when collaborators join/leave
    socket.on('user-joined', (data) => {
      this.showPresence(`${data.userId} joined`, 'success');
    });

    socket.on('user-left', (data) => {
      this.showPresence(`${data.userId} left`, 'info');
    });

    // Reconnection handling
    socket.on('disconnected', () => {
      this.showPresence('Offline mode (changes will sync when online)', 'warning');
    });
  }

  // Join the current case room
  joinCurrentCase() {
    const caseData = caseManager.getCurrentCase();
    if (!caseData) return;

    const userId = localStorage.getItem('veritas_user_name') || 'You';
    socket.joinCase(caseData._id, userId);
  }

  // Leave current case room
  leaveCurrentCase() {
    const caseData = caseManager.getCurrentCase();
    if (!caseData) return;

    const userId = localStorage.getItem('veritas_user_name') || 'You';
    socket.leaveCase(caseData._id, userId);
  }

  // Register a module's refresh handler
  registerModuleHandler(moduleName, refreshFunc) {
    this.handlers[moduleName] = refreshFunc;
  }

  // Handle incoming updates from collaborators
  handleRemoteUpdate(data) {
    const { moduleName, result, userId, timestamp } = data;
    console.log(`↙ Received update: ${moduleName} from ${userId}`);

    // Load updated data into case manager
    const caseData = caseManager.getCurrentCase();
    if (caseData) {
      caseData.modules = caseData.modules || {};
      caseData.modules[moduleName] = result;

      // Save locally
      localStorage.setItem(`veritas_case_${caseData._id}`, JSON.stringify(caseData));

      // Refresh the module UI if handler exists
      if (this.handlers[moduleName]) {
        this.handlers[moduleName](result);
        this.showUpdate(`${moduleName} updated by ${userId}`, 'info');
      }
    }
  }

  // Show presence notification
  showPresence(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 16px;
      background: ${
        type === 'success' ? '#4caf50' :
        type === 'warning' ? '#ff9800' :
        '#2196f3'
      };
      color: white;
      border-radius: 6px;
      font-size: 12px;
      z-index: 9999;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Show update notification (less intrusive)
  showUpdate(message, type = 'info') {
    const el = document.getElementById('syncNotification');
    if (el) {
      const safeMessage = typeof window !== 'undefined' && typeof window.renderSafeText === 'function'
        ? window.renderSafeText(message)
        : String(message ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
      el.innerHTML = `<span>${safeMessage}</span>`;
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 2000);
    }
  }
}

// Create global sync handler instance
const syncHandler = new SyncHandler();

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  syncHandler.leaveCurrentCase();
  if (typeof socket !== 'undefined') {
    socket.disconnect();
  }
});

// Add animation CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);
