// Case Manager - Data Persistence with Backend API
// Uses API for persistent storage with fallback to localStorage

class CaseManager {
  constructor() {
    this.currentCase = null;
    this.caseList = [];
    this.syncing = false;
    this.useAPI = api && api.isAuthenticated();
  }

  // Load all cases from API or localStorage
  async loadCaseList() {
    try {
      if (this.useAPI) {
        const cases = await api.getCases();
        this.caseList = cases;
        return cases;
      }
    } catch (err) {
      console.warn('API error, falling back to localStorage:', err);
      this.useAPI = false;
    }

    // Fallback to localStorage
    const stored = localStorage.getItem('veritas_cases');
    this.caseList = stored ? JSON.parse(stored) : [];
    return this.caseList;
  }

  // Save case list to storage
  saveCaseList() {
    if (!this.useAPI) {
      localStorage.setItem('veritas_cases', JSON.stringify(this.caseList));
    }
  }

  // Load current active case
  async loadCurrentCase() {
    const caseId = localStorage.getItem('veritas_current_case');
    if (!caseId) return null;

    try {
      if (this.useAPI) {
        this.currentCase = await api.getCase(caseId);
        return this.currentCase;
      }
    } catch (err) {
      console.warn('API error loading case:', err);
    }

    // Fallback to localStorage
    const caseData = localStorage.getItem(`veritas_case_${caseId}`);
    this.currentCase = caseData ? JSON.parse(caseData) : null;
    return this.currentCase;
  }

  // Create a new case
  async createCase(caseData) {
    try {
      if (this.useAPI) {
        const newCase = await api.createCase({
          name: caseData.name,
          caseNumber: caseData.caseNumber,
          court: caseData.court,
          parties: {
            petitioner: caseData.petitioner || 'Party A',
            respondent: caseData.respondent || 'Party B',
          },
        });
        await this.openCase(newCase._id);
        return newCase;
      }
    } catch (err) {
      console.warn('API error creating case:', err);
    }

    // Fallback: localStorage
    const newCase = {
      _id: 'case_' + Date.now(),
      name: caseData.name,
      caseNumber: caseData.caseNumber,
      court: caseData.court,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parties: {
        petitioner: caseData.petitioner || 'Party A',
        respondent: caseData.respondent || 'Party B',
      },
      modules: {},
    };

    this.caseList.push(newCase);
    this.saveCaseList();
    await this.openCase(newCase._id);
    return newCase;
  }

  // Open a case by ID
  async openCase(caseId) {
    try {
      if (this.useAPI) {
        this.currentCase = await api.getCase(caseId);
      } else {
        const caseData = localStorage.getItem(`veritas_case_${caseId}`);
        this.currentCase = caseData ? JSON.parse(caseData) : null;
      }

      localStorage.setItem('veritas_current_case', caseId);
      return this.currentCase;
    } catch (err) {
      console.error('Error opening case:', err);
      return null;
    }
  }

  // Save current case data
  async saveCurrentCase() {
    if (!this.currentCase) return false;

    try {
      if (this.useAPI) {
        await api.updateCase(this.currentCase._id, {
          status: this.currentCase.status,
          tags: this.currentCase.tags,
          notes: this.currentCase.notes,
        });
        return true;
      }
    } catch (err) {
      console.warn('API error saving case:', err);
    }

    // Fallback: localStorage
    localStorage.setItem(`veritas_case_${this.currentCase._id}`, JSON.stringify(this.currentCase));
    return true;
  }

  // Save module-specific data
  async saveModuleData(moduleName, data) {
    if (!this.currentCase) return false;

    try {
      if (this.useAPI) {
        await api.saveModuleData(this.currentCase._id, moduleName, data);
        this.currentCase.modules = this.currentCase.modules || {};
        this.currentCase.modules[moduleName] = data;

        // Broadcast to collaborators via WebSocket if connected
        if (typeof socket !== 'undefined' && socket.isConnected()) {
          const userId = localStorage.getItem('veritas_user_id') || 'unknown';
          socket.broadcastModuleUpdate(
            this.currentCase._id,
            moduleName,
            data,
            userId
          );
        }

        return true;
      }
    } catch (err) {
      console.warn('API error saving module data:', err);
    }

    // Fallback: localStorage
    if (!this.currentCase.modules) this.currentCase.modules = {};
    this.currentCase.modules[moduleName] = data;
    localStorage.setItem(`veritas_case_${this.currentCase._id}`, JSON.stringify(this.currentCase));
    return true;
  }

  // Get module-specific data
  getModuleData(moduleName) {
    if (!this.currentCase) return null;
    return this.currentCase.modules?.[moduleName] || {};
  }

  // Delete a case
  async deleteCase(caseId) {
    try {
      if (this.useAPI) {
        await api.deleteCase(caseId);
      } else {
        localStorage.removeItem(`veritas_case_${caseId}`);
      }
    } catch (err) {
      console.warn('API error deleting case:', err);
    }

    this.caseList = this.caseList.filter(c => (c._id || c.id) !== caseId);
    this.saveCaseList();

    if (this.currentCase && (this.currentCase._id === caseId || this.currentCase.id === caseId)) {
      this.currentCase = null;
      localStorage.removeItem('veritas_current_case');
    }
  }

  // Get all cases
  getAllCases() {
    return this.caseList;
  }

  // Export case as JSON
  exportCase(caseId) {
    const caseData = this.caseList.find(c => (c._id || c.id) === caseId);
    return caseData || null;
  }

  // Import case from JSON
  async importCase(caseJson) {
    const newCase = {
      ...caseJson,
      _id: 'case_' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.caseList.push(newCase);
    this.saveCaseList();
    return newCase;
  }

  // Get case summary
  getCaseSummary(caseId) {
    const caseData = this.caseList.find(c => (c._id || c.id) === caseId);
    if (!caseData) return null;

    return {
      id: caseData._id || caseData.id,
      name: caseData.name,
      caseNumber: caseData.caseNumber,
      court: caseData.court,
      parties: caseData.parties,
      createdDate: caseData.createdAt || caseData.createdDate,
      lastModified: caseData.updatedAt || caseData.lastModified,
      completedModules: this.getCompletedModules(caseData.modules || {}),
    };
  }

  // Count completed modules
  getCompletedModules(modules) {
    const completed = [];
    if (modules.afi && Object.keys(modules.afi).length > 0) completed.push('AFI');
    if (modules.spousal && Object.keys(modules.spousal).length > 0) completed.push('Spousal Maintenance');
    if (modules.childSupport && Object.keys(modules.childSupport).length > 0) completed.push('Child Support');
    if (modules.estate && Object.keys(modules.estate).length > 0) completed.push('Estate');
    if (modules.equitableDistribution && Object.keys(modules.equitableDistribution).length > 0) completed.push('Equitable Distribution');
    if (modules.incomeImputation && Object.keys(modules.incomeImputation).length > 0) completed.push('Income Imputation');
    return completed;
  }
}

// Initialize global case manager
const caseManager = new CaseManager();

// Auto-save functionality (save module data every 30 seconds)
let unsavedChanges = false;
let autoSaveInterval = null;

function markUnsavedChanges() {
  unsavedChanges = true;
  if (!autoSaveInterval) {
    autoSaveInterval = setInterval(() => {
      if (unsavedChanges && caseManager.currentCase) {
        caseManager.saveCurrentCase();
        unsavedChanges = false;
      }
    }, 30000);
  }
}

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CaseManager, caseManager, markUnsavedChanges };
}
