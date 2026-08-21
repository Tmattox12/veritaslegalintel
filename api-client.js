// Veritas API Client - Frontend wrapper for backend API
class VeritasAPI {
  constructor(baseUrl = 'http://localhost:5000/api') {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem('veritas_token');
    this.user = JSON.parse(localStorage.getItem('veritas_user') || '{}');
  }

  // ===== AUTHENTICATION =====

  async register(name, email, password, firm) {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, firm }),
    });
    const data = await response.json();
    if (data.token) {
      this._setAuth(data.token, data.user);
    }
    return data;
  }

  async login(email, password) {
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    if (data.token) {
      this._setAuth(data.token, data.user);
    }
    return data;
  }

  async verifyToken() {
    return this._fetch('/auth/verify', { method: 'GET' });
  }

  logout() {
    localStorage.removeItem('veritas_token');
    localStorage.removeItem('veritas_user');
    this.token = null;
    this.user = {};
  }

  // ===== USERS =====

  async getCurrentUser() {
    return this._fetch('/users/me');
  }

  async updateProfile(name, firm) {
    return this._fetch('/users/me', {
      method: 'PATCH',
      body: { name, firm },
    });
  }

  // ===== CASES =====

  async getCases() {
    return this._fetch('/cases');
  }

  async getCase(caseId) {
    return this._fetch(`/cases/${caseId}`);
  }

  async createCase(caseData) {
    return this._fetch('/cases', {
      method: 'POST',
      body: caseData,
    });
  }

  async updateCase(caseId, updates) {
    return this._fetch(`/cases/${caseId}`, {
      method: 'PATCH',
      body: updates,
    });
  }

  async deleteCase(caseId) {
    return this._fetch(`/cases/${caseId}`, { method: 'DELETE' });
  }

  async shareCase(caseId, email, role = 'viewer') {
    return this._fetch(`/cases/${caseId}/collaborators`, {
      method: 'POST',
      body: { email, role },
    });
  }

  // ===== MODULE DATA =====

  async getModuleData(caseId, moduleName) {
    return this._fetch(`/modules/cases/${caseId}/${moduleName}`);
  }

  async saveModuleData(caseId, moduleName, data) {
    return this._fetch(`/cases/${caseId}/modules/${moduleName}`, {
      method: 'PATCH',
      body: data,
    });
  }

  // ===== DOCUMENTS =====

  async getDocuments(caseId) {
    return this._fetch(`/documents/cases/${caseId}`);
  }

  async uploadDocument(caseId, fileName, fileType, category) {
    return this._fetch('/documents/upload', {
      method: 'POST',
      body: { caseId, fileName, fileType, category },
    });
  }

  // ===== INTERNAL HELPERS =====

  _setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('veritas_token', token);
    localStorage.setItem('veritas_user', JSON.stringify(user));
  }

  async _fetch(path, options = {}) {
    if (!this.token && path !== '/auth/register' && path !== '/auth/login') {
      throw new Error('Not authenticated');
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      ...options.headers,
    };

    const fetchOptions = {
      method: options.method || 'GET',
      headers,
      ...(options.body && { body: JSON.stringify(options.body) }),
    };

    try {
      const response = await fetch(this.baseUrl + path, fetchOptions);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `API error: ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  }

  // ===== UTILITY METHODS =====

  isAuthenticated() {
    return !!this.token;
  }

  getToken() {
    return this.token;
  }

  getAuthHeader() {
    return { 'Authorization': `Bearer ${this.token}` };
  }
}

// Global API instance
const api = new VeritasAPI();

// Auto-verify token on page load (only on non-auth pages)
document.addEventListener('DOMContentLoaded', async () => {
  if (api.token && !window.location.pathname.includes('auth.html')) {
    try {
      await api.verifyToken();
      // Token is valid
    } catch (err) {
      // Token expired, clear it
      api.logout();
    }
  }
});
