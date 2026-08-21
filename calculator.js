/* ========================================================================
   Veritas — Reusable Interactive Calculator Component
   Supports formula display, scenario selection, live recalculation
   ======================================================================== */

function escapeText(value) {
  if (typeof window !== 'undefined' && typeof window.renderSafeText === 'function') {
    return window.renderSafeText(value);
  }

  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch] || ch));
}

class VeritasCalculator {
  constructor(containerId, config) {
    this.container = document.getElementById(containerId);
    this.config = config;
    this.state = { ...config.initialState };
    this.scenarios = config.scenarios || {};
    this.formulas = config.formulas || {};

    this.render();
    this.attachEventListeners();
  }

  // Update a state value and recalculate
  updateState(key, value) {
    this.state[key] = value;
    this.recalculate();
  }

  // Select a preset scenario
  selectScenario(category, scenarioId) {
    const scenario = this.scenarios[category]?.find(s => s.id === scenarioId);
    if (scenario) {
      Object.assign(this.state, scenario.state);
      this.recalculate();
    }
  }

  // Recalculate all formulas with current state
  recalculate() {
    const result = this.config.calculate(this.state);
    this.updateDisplay(result);
    if (this.config.onCalculate) this.config.onCalculate(result);
  }

  // Render the full calculator UI
  render() {
    const html = `
      <div class="calculator">
        ${this.renderScenarioSelection()}
        ${this.renderFormulaBreakdown()}
        ${this.renderInteractiveInputs()}
        ${this.renderResults()}
      </div>
    `;
    this.container.innerHTML = html;
  }

  // Scenario selection buttons/dropdowns
  renderScenarioSelection() {
    if (!this.config.scenarios) return '';

    let html = '<div class="calc-section scenario-selection"><h3>Scenarios</h3>';

    Object.entries(this.config.scenarios).forEach(([category, options]) => {
      html += `<div class="scenario-group">
        <label>${escapeText(category)}:</label>
        <div class="scenario-buttons">`;

      options.forEach(opt => {
        const isActive = this.state[category] === opt.id ? 'active' : '';
        html += `<button class="scenario-btn ${isActive}"
                 onclick="window.calc.selectScenario('${escapeText(category)}', '${escapeText(opt.id)}')">
          ${escapeText(opt.label)}
        </button>`;
      });

      html += `</div></div>`;
    });

    html += '</div>';
    return html;
  }

  // Formula breakdown display
  renderFormulaBreakdown() {
    if (!this.config.formulaDisplay) return '';

    const formula = this.config.formulaDisplay(this.state);
    return `
      <div class="calc-section formula-breakdown">
        <h3>Formula Breakdown</h3>
        <div class="formula-display">
          ${escapeText(formula)}
        </div>
      </div>
    `;
  }

  // Interactive input fields
  renderInteractiveInputs() {
    if (!this.config.editableFields) return '';

    let html = '<div class="calc-section interactive-inputs"><h3>Adjust Values</h3>';

    this.config.editableFields.forEach(field => {
      const value = this.state[field.key];
      html += `
        <div class="input-row">
          <label>${escapeText(field.label)}</label>
          <input type="number" value="${escapeText(value)}"
                 onchange="window.calc.updateState('${escapeText(field.key)}', parseFloat(this.value))"
                 step="${escapeText(field.step || '1')}" />
          ${field.suffix ? `<span class="suffix">${escapeText(field.suffix)}</span>` : ''}
        </div>
      `;
    });

    html += '</div>';
    return html;
  }

  // Results display
  renderResults() {
    return `
      <div class="calc-section results">
        <h3>Results</h3>
        <div class="results-grid" id="resultsGrid"></div>
      </div>
    `;
  }

  // Update results display
  updateDisplay(result) {
    const grid = this.container.querySelector('#resultsGrid');
    if (!grid) return;

    let html = '';

    if (result.primary) {
      html += `
        <div class="result-card primary">
          <span class="result-label">${escapeText(result.primary.label)}</span>
          <span class="result-value">${this.fmt0(result.primary.value)}</span>
          <span class="result-unit">${escapeText(result.primary.unit || '')}</span>
        </div>
      `;
    }

    if (result.bands) {
      html += '<div class="result-bands">';
      result.bands.forEach(band => {
        const isMaster = band.active ? 'active' : '';
        html += `
          <div class="band ${isMaster}">
            <span>${escapeText(band.label)}</span>
            <span class="band-value">${this.fmt0(band.value)}</span>
          </div>
        `;
      });
      html += '</div>';
    }

    if (result.secondary) {
      html += '<div class="result-secondary">';
      result.secondary.forEach(item => {
        html += `
          <div class="secondary-item">
            <span>${escapeText(item.label)}</span>
            <strong>${this.fmt0(item.value)}</strong>
          </div>
        `;
      });
      html += '</div>';
    }

    grid.innerHTML = html;
  }

  // Attach event listeners
  attachEventListeners() {
    // Delegated listeners already attached via onclick attributes
  }

  // Format number as currency
  fmt0(n) {
    if (typeof n !== 'number') return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(n);
  }
}

// Global reference for calculator instance
let calc = null;
