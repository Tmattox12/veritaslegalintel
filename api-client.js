// Veritas API Client - Frontend wrapper for backend API
class VeritasAPI {
  constructor(baseUrl = 'http://localhost:3000/api') {
    this.baseUrl = baseUrl;
  }

  // ===== MATTERS (formerly "cases") =====

  async getMatters() {
    return this._fetch('/matters');
  }

  async getMatter(matterId) {
    return this._fetch(`/matters/${matterId}`);
  }

  async createMatter(matterData) {
    return this._fetch('/matters', {
      method: 'POST',
      body: matterData,
    });
  }

  async deleteMatter(matterId) {
    return this._fetch(`/matters/${matterId}`, { method: 'DELETE' });
  }

  // ===== USERS =====

  async getUsers() {
    return this._fetch('/users');
  }

  // ===== DOCUMENTS =====

  async getDocuments(matterId) {
    return this._fetch(`/matters/${matterId}/documents`);
  }

  async uploadDocument(matterId, fileName, contentType, uploadedBy) {
    return this._fetch('/documents', {
      method: 'POST',
      body: {
        matterId,
        filename: fileName,
        contentType,
        uploadedBy,
      },
    });
  }

  async deleteDocument(documentId) {
    return this._fetch(`/documents/${documentId}`, { method: 'DELETE' });
  }

  // ===== MATTER ASSIGNMENTS =====

  async assignUserToMatter(matterId, userId, role) {
    return this._fetch('/matter-assignments', {
      method: 'POST',
      body: {
        matterId,
        userId,
        role,
      },
    });
  }

  // ===== INTERNAL HELPERS =====

  async _fetch(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
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
}

// Global API instance
const api = new VeritasAPI();
