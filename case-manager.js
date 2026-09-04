// Matter Manager - Pure API-based persistence (no localStorage fallback)
// Maps "cases" (frontend UI term) to "matters" (backend term)

class MatterManager {
  constructor() {
    this.currentMatter = null;
    this.matterList = [];
    this.userList = [];
  }

  // Load all matters from API
  async loadMatterList() {
    try {
      const matters = await api.getMatters();
      this.matterList = matters;
      return matters;
    } catch (err) {
      console.error('Error loading matters:', err);
      throw err;
    }
  }

  // Load all users
  async loadUserList() {
    try {
      const users = await api.getUsers();
      this.userList = users;
      return users;
    } catch (err) {
      console.error('Error loading users:', err);
      return [];
    }
  }

  // Load a specific matter with its details
  async loadMatter(matterId) {
    try {
      this.currentMatter = await api.getMatter(matterId);
      return this.currentMatter;
    } catch (err) {
      console.error('Error loading matter:', err);
      throw err;
    }
  }

  // Create a new matter
  async createMatter(matterData) {
    try {
      const { v4: uuidv4 } = require('uuid');
      const newMatter = await api.createMatter({
        id: uuidv4(),
        firm_id: 'firm-demo-001',
        name: matterData.name,
        client_name: matterData.clientName,
        status: matterData.status || 'active',
      });
      this.matterList.push(newMatter);
      return newMatter;
    } catch (err) {
      console.error('Error creating matter:', err);
      throw err;
    }
  }

  // Delete a matter
  async deleteMatter(matterId) {
    try {
      await api.deleteMatter(matterId);
      this.matterList = this.matterList.filter(m => m.id !== matterId);
      if (this.currentMatter?.id === matterId) {
        this.currentMatter = null;
      }
    } catch (err) {
      console.error('Error deleting matter:', err);
      throw err;
    }
  }

  // Get all matters
  getAllMatters() {
    return this.matterList;
  }

  // Get documents for current matter
  async loadDocuments(matterId) {
    try {
      return await api.getDocuments(matterId);
    } catch (err) {
      console.error('Error loading documents:', err);
      return [];
    }
  }

  // Upload a document
  async uploadDocument(matterId, fileName, contentType, userId) {
    try {
      const doc = await api.uploadDocument(matterId, fileName, contentType, userId);
      return doc;
    } catch (err) {
      console.error('Error uploading document:', err);
      throw err;
    }
  }

  // Delete a document
  async deleteDocument(documentId) {
    try {
      await api.deleteDocument(documentId);
    } catch (err) {
      console.error('Error deleting document:', err);
      throw err;
    }
  }

  // Assign user to matter
  async assignUserToMatter(matterId, userId, role) {
    try {
      await api.assignUserToMatter(matterId, userId, role);
    } catch (err) {
      console.error('Error assigning user:', err);
      throw err;
    }
  }
}

// Initialize global matter manager (using "Matter" internally, "Case" for legacy UI compatibility)
const matterManager = new MatterManager();
const caseManager = matterManager; // Alias for compatibility with existing UI code

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MatterManager, matterManager, caseManager };
}
