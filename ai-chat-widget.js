/**
 * Veritas AI Chat Assistant Widget
 * A reusable chat widget component for all Veritas pages
 */

class VeritasAIChat {
  constructor(config = {}) {
    this.config = {
      pageContext: 'general',
      systemPrompt: 'You are a helpful assistant.',
      suggestedQuestions: [],
      apiEndpoint: '/api/chat',
      storageKey: 'veritas-chat-history',
      ...config
    };

    this.isOpen = false;
    this.messages = [];
    this.isLoading = false;
    this.container = null;
    this.chatHistory = [];
    this.regulationsData = null;
    this.casesCasesLoaded = false;

    this.loadChatHistory();
    this.init();
  }

  init() {
    this.createWidget();
    this.attachEventListeners();
  }

  createWidget() {
    const widget = document.createElement('div');
    widget.className = 'veritas-ai-chat-widget';
    widget.innerHTML = `
      <!-- Chat Toggle Button -->
      <button class="veritas-chat-toggle" title="Chat with AI Assistant">
        <span class="chat-icon">💬</span>
      </button>

      <!-- Chat Panel -->
      <div class="veritas-chat-panel">
        <!-- Header -->
        <div class="veritas-chat-header">
          <div class="veritas-chat-title">
            <span class="chat-icon-large">📖</span>
            <div>
              <h3>Veritas Assistant</h3>
              <p>${this.config.pageContext}</p>
            </div>
          </div>
          <button class="veritas-chat-close" title="Close chat">✕</button>
        </div>

        <!-- Tabs -->
        <div class="veritas-chat-tabs">
          <button class="veritas-tab-btn active" data-tab="chat">Chat</button>
          <button class="veritas-tab-btn" data-tab="regulations">Regulations</button>
          <button class="veritas-tab-btn" data-tab="cases">Cases</button>
        </div>

        <!-- Chat Tab -->
        <div class="veritas-tab-content active" data-tab-content="chat">
          <!-- Chat Messages -->
          <div class="veritas-chat-messages">
            <!-- Messages will be inserted here -->
          </div>

          <!-- Suggested Questions (shown initially) -->
          <div class="veritas-chat-suggestions">
            ${this.config.suggestedQuestions
              .map(
                (q, i) => `
              <button class="suggestion-btn" data-index="${i}">
                <span class="suggestion-icon">→</span>
                ${q}
              </button>
            `
              )
              .join('')}
          </div>

          <!-- Input Area -->
          <div class="veritas-chat-input-area">
            <div class="veritas-chat-input-wrapper">
              <input
                type="text"
                class="veritas-chat-input"
                placeholder="Ask me anything..."
                aria-label="Chat message input"
              />
              <button class="veritas-chat-send" title="Send message">
                <span>→</span>
              </button>
            </div>
            <button class="veritas-chat-clear-btn">Clear chat</button>
          </div>
        </div>

        <!-- Regulations Tab -->
        <div class="veritas-tab-content" data-tab-content="regulations">
          <div class="veritas-regulations-loader" style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
            Loading regulations...
          </div>
        </div>

        <!-- Cases Tab -->
        <div class="veritas-tab-content" data-tab-content="cases">
          <div class="veritas-cases-loader" style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
            Loading cases...
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(widget);
    this.container = widget;
    this.regulationsData = null;
  }

  attachEventListeners() {
    // Toggle button
    this.container
      .querySelector('.veritas-chat-toggle')
      .addEventListener('click', () => this.toggleChat());

    // Close button
    this.container
      .querySelector('.veritas-chat-close')
      .addEventListener('click', () => this.closeChat());

    // Send button
    this.container
      .querySelector('.veritas-chat-send')
      .addEventListener('click', () => this.sendMessage());

    // Input enter key
    this.container
      .querySelector('.veritas-chat-input')
      .addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

    // Suggested questions
    this.container
      .querySelectorAll('.suggestion-btn')
      .forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const question = e.target.textContent.replace('→', '').trim();
          this.container.querySelector('.veritas-chat-input').value = question;
          this.sendMessage();
        });
      });

    // Clear chat button
    this.container
      .querySelector('.veritas-chat-clear-btn')
      .addEventListener('click', () => this.clearChat());

    // Setup tabs
    this.setupTabs();
  }

  toggleChat() {
    if (this.isOpen) {
      this.closeChat();
    } else {
      this.openChat();
    }
  }

  openChat() {
    this.isOpen = true;
    this.container.classList.add('open');
    this.container.querySelector('.veritas-chat-input').focus();
    this.renderMessages();
  }

  closeChat() {
    this.isOpen = false;
    this.container.classList.remove('open');
  }

  renderMessages() {
    const messagesContainer = this.container.querySelector('.veritas-chat-messages');
    const suggestionsContainer = this.container.querySelector('.veritas-chat-suggestions');

    if (this.chatHistory.length === 0) {
      messagesContainer.innerHTML = '';
      suggestionsContainer.style.display = 'flex';
      return;
    }

    suggestionsContainer.style.display = 'none';

    messagesContainer.innerHTML = this.chatHistory
      .map(
        (msg, i) => `
      <div class="veritas-chat-message ${msg.role}">
        <div class="message-content">
          ${msg.role === 'assistant' ? '<span class="message-icon">📖</span>' : ''}
          <div class="message-text">${this.escapeHtml(msg.content)}</div>
          ${msg.timestamp ? `<span class="message-time">${this.formatTime(msg.timestamp)}</span>` : ''}
        </div>
      </div>
    `
      )
      .join('');

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async sendMessage() {
    const input = this.container.querySelector('.veritas-chat-input');
    const message = input.value.trim();

    if (!message || this.isLoading) return;

    // Add user message
    this.chatHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    input.value = '';
    this.renderMessages();
    this.isLoading = true;

    // Show thinking indicator
    const messagesContainer = this.container.querySelector('.veritas-chat-messages');
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'veritas-chat-message assistant thinking';
    thinkingDiv.innerHTML = `
      <div class="message-content">
        <span class="message-icon">📖</span>
        <div class="message-text">
          <span class="typing-indicator">
            <span></span><span></span><span></span>
          </span>
        </div>
      </div>
    `;
    messagesContainer.appendChild(thinkingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      // Call API to get response
      const response = await this.callAPI(message, this.chatHistory.slice(0, -1));

      // Remove thinking indicator
      thinkingDiv.remove();

      if (response && response.content) {
        this.chatHistory.push({
          role: 'assistant',
          content: response.content,
          timestamp: new Date()
        });
      } else {
        this.chatHistory.push({
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date()
        });
      }
    } catch (error) {
      thinkingDiv.remove();
      this.chatHistory.push({
        role: 'assistant',
        content: `Error: ${error.message}`,
        timestamp: new Date()
      });
      console.error('Chat error:', error);
    }

    this.isLoading = false;
    this.saveChatHistory();
    this.renderMessages();
  }

  async callAPI(message, history) {
    const payload = {
      message,
      history,
      context: this.config.pageContext,
      systemPrompt: this.config.systemPrompt
    };

    const response = await fetch(this.config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return await response.json();
  }

  clearChat() {
    if (confirm('Are you sure you want to clear the chat history?')) {
      this.chatHistory = [];
      this.saveChatHistory();
      this.renderMessages();
    }
  }

  saveChatHistory() {
    try {
      const historyToSave = this.chatHistory.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp?.toISOString()
      }));
      localStorage.setItem(
        `${this.config.storageKey}-${this.config.pageContext}`,
        JSON.stringify(historyToSave)
      );
    } catch (e) {
      console.warn('Failed to save chat history:', e);
    }
  }

  loadChatHistory() {
    try {
      const saved = localStorage.getItem(
        `${this.config.storageKey}-${this.config.pageContext}`
      );
      if (saved) {
        this.chatHistory = JSON.parse(saved).map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : null
        }));
      }
    } catch (e) {
      console.warn('Failed to load chat history:', e);
      this.chatHistory = [];
    }
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  formatTime(date) {
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  }

  // Tab management
  setupTabs() {
    const tabButtons = this.container.querySelectorAll('.veritas-tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // Load regulations when regulations tab is first clicked
    this.container.querySelector('[data-tab="regulations"]')?.addEventListener('click', () => {
      if (!this.regulationsData) {
        this.fetchRegulations();
      }
    });

    // Load cases when cases tab is first clicked
    this.container.querySelector('[data-tab="cases"]')?.addEventListener('click', () => {
      if (this.regulationsData && !this.casesCasesLoaded) {
        this.displayCases();
        this.casesCasesLoaded = true;
      } else if (!this.regulationsData) {
        this.fetchRegulations().then(() => this.displayCases());
      }
    });
  }

  switchTab(tabName) {
    // Update buttons
    this.container.querySelectorAll('.veritas-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update content
    this.container.querySelectorAll('.veritas-tab-content').forEach(content => {
      content.classList.toggle('active', content.dataset.tabContent === tabName);
    });
  }

  async fetchRegulations() {
    try {
      const response = await fetch('http://localhost:3000/api/regulations/afi');
      if (!response.ok) throw new Error('Failed to fetch regulations');

      const result = await response.json();
      this.regulationsData = result.data;
      this.displayRegulations();
    } catch (error) {
      console.error('Error fetching regulations:', error);
      const container = this.container.querySelector('[data-tab-content="regulations"]');
      container.innerHTML = `<div class="veritas-regulations-empty">Unable to load regulations. Please ensure ScaleSerp API key is configured.</div>`;
    }
  }

  displayRegulations() {
    if (!this.regulationsData) return;

    const container = this.container.querySelector('[data-tab-content="regulations"]');
    const { regulations, guidance, courtRules, bestPractices } = this.regulationsData;

    let html = '';

    // Regulations section
    if (regulations.items && regulations.items.length > 0) {
      html += `<div class="veritas-regulations-section-title">${regulations.title}</div>`;
      regulations.items.forEach(item => {
        html += this.createRegulationItemHtml(item);
      });
    }

    // Guidance section
    if (guidance.items && guidance.items.length > 0) {
      html += `<div class="veritas-regulations-section-title">${guidance.title}</div>`;
      guidance.items.forEach(item => {
        html += this.createRegulationItemHtml(item);
      });
    }

    // Court Rules section
    if (courtRules.items && courtRules.items.length > 0) {
      html += `<div class="veritas-regulations-section-title">${courtRules.title}</div>`;
      courtRules.items.forEach(item => {
        html += this.createRegulationItemHtml(item);
      });
    }

    // Best Practices section
    if (bestPractices.items && bestPractices.items.length > 0) {
      html += `<div class="veritas-regulations-section-title">${bestPractices.title}</div>`;
      bestPractices.items.forEach(item => {
        html += this.createRegulationItemHtml(item);
      });
    }

    if (!html) {
      html = '<div class="veritas-regulations-empty">No regulations found. Please configure ScaleSerp API.</div>';
    }

    container.innerHTML = html;
  }

  createRegulationItemHtml(item) {
    return `
      <a href="${this.escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="veritas-regulations-item" title="Open in new tab">
        <div class="veritas-regulations-item-title">${this.escapeHtml(item.title)}</div>
        <div class="veritas-regulations-item-snippet">${this.escapeHtml(item.snippet || '')}</div>
        <div class="veritas-regulations-item-meta">${this.escapeHtml(item.source || 'Source')}</div>
      </a>
    `;
  }

  displayCases() {
    if (!this.regulationsData || !this.regulationsData.cases) return;

    const container = this.container.querySelector('[data-tab-content="cases"]');
    const caseItems = this.regulationsData.cases.items || [];

    let html = '';

    if (caseItems.length > 0) {
      html += `<div class="veritas-regulations-section-title">Arizona AFI Case Law</div>`;
      caseItems.forEach(item => {
        html += this.createRegulationItemHtml(item);
      });
    } else {
      html = '<div class="veritas-regulations-empty">No case law found.</div>';
    }

    container.innerHTML = html;
  }
}

// Initialize widget when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.veritasChat = new VeritasAIChat(window.veritasChatConfig || {});
  });
} else {
  window.veritasChat = new VeritasAIChat(window.veritasChatConfig || {});
}
