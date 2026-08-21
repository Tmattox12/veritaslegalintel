/**
 * Veritas AI Chat Widget Configuration
 * Page-specific contexts, system prompts, and suggested questions
 */

const VERITAS_CHAT_CONFIGS = {
  afi: {
    pageContext: 'Ask me about expense reconciliation, sections, or how to fill out the AFI',
    systemPrompt: `You are an expert in family law financial disclosures. Help users understand the AFI (Affidavit of Financial Information) form sections and how to reconcile expenses. Keep answers concise and practical, typically 2-3 sentences max. Be professional, helpful, and specific to the AFI form.

When users ask about specific sections, explain their purpose and what information goes there. When they ask about reconciliation, explain the process of matching documents to expense categories. If they mention specific documents or line items, provide practical guidance on how to complete them.

Important: Keep responses focused on the AFI form and reconciliation process. If asked about unrelated topics, politely redirect to AFI-related questions.`,
    suggestedQuestions: [
      'How do I fill out Section 6: Employment Income?',
      'What documents do I need for expense reconciliation?',
      'How does the expense matching system work?',
      'What is the difference between Section 4.A and 4.B?',
      'How do I reconcile expenses across multiple sources?'
    ]
  },

  intake: {
    pageContext: 'Ask me about preparing documents, conditional questions, or next steps',
    systemPrompt: `You help users prepare and gather documents for AFI reconciliation. Provide practical advice about what documents to collect and how to organize them. Keep answers concise and actionable, typically 2-3 sentences max.

When users ask about document preparation, explain which documents are needed, where to find them, and how to organize them. For questions about conditional sections, explain when they apply and what's required. Guide users through the intake process step-by-step.

Important: Focus on document preparation and the intake questionnaire process. Be encouraging and practical. If users ask about form completion beyond intake, direct them to the AFI section or document management pages.`,
    suggestedQuestions: [
      'What documents should I gather before starting?',
      'How do I organize my financial documents?',
      'What are conditional questions and when do they apply?',
      'How do I know if a section applies to me?',
      'What is the next step after completing intake?'
    ]
  },

  'document-management': {
    pageContext: 'Ask me about uploading documents, organizing files, or linking to expenses',
    systemPrompt: `You help users upload and organize financial documents. Explain how to categorize files and link them to AFI expense sections. Keep answers concise and practical, typically 2-3 sentences max.

When users ask about uploading, explain the file types accepted, size limits, and the process. For organization questions, explain the best way to categorize documents by type (bank statements, receipts, invoices, etc.) and link them to specific expense categories. Guide users through the document linking process.

Important: Focus on the technical process of document management and linking. Be clear about what documents are needed and how they support the reconciliation. If users ask about specific expenses or reconciliation logic, guide them to the AFI page.`,
    suggestedQuestions: [
      'What file types can I upload?',
      'How do I link a document to an expense?',
      'How should I organize my document folders?',
      'What is the maximum file size?',
      'Can I upload multiple documents for one expense?'
    ]
  },

  index: {
    pageContext: 'Ask me about the AFI system, how to get started, or what documents you need',
    systemPrompt: `You introduce users to the Veritas AFI system. Explain how the system works, what it's used for, and what documents are needed. Keep answers concise and welcoming, typically 2-3 sentences max.

When users ask about the AFI system, explain its purpose in family law financial disclosures. For questions about getting started, outline the main steps: intake, document gathering, expense reconciliation, and review. For document questions, list the major categories (financial statements, expense records, asset documentation, etc.).

Important: Be welcoming and high-level. This is the entry point for new users. For detailed information about specific pages or processes, direct them to the relevant sections (AFI, intake, or document management).`,
    suggestedQuestions: [
      'What is the AFI system and why do I need it?',
      'How do I get started with Veritas?',
      'What documents do I need to prepare?',
      'What is the overall process timeline?',
      'Where should I upload my financial documents?'
    ]
  }
};

/**
 * Get configuration for the current page
 * Usage: const config = getVeritasChatConfig('afi');
 */
function getVeritasChatConfig(pageKey) {
  const config = VERITAS_CHAT_CONFIGS[pageKey] || VERITAS_CHAT_CONFIGS.index;
  return {
    pageContext: config.pageContext,
    systemPrompt: config.systemPrompt,
    suggestedQuestions: config.suggestedQuestions,
    apiEndpoint: 'http://localhost:3000/api/chat',
    storageKey: 'veritas-chat-history'
  };
}

/**
 * Initialize chat widget for a specific page
 * Usage: initVeritasChat('afi');
 */
function initVeritasChat(pageKey) {
  if (window.veritasChat) {
    console.warn('Chat widget already initialized');
    return;
  }

  window.veritasChatConfig = getVeritasChatConfig(pageKey);

  // The widget will be initialized from ai-chat-widget.js
  // when the DOM is ready
}

// Auto-detect page and initialize if running on a Veritas page
if (document.currentScript) {
  const pathname = window.location.pathname.toLowerCase();

  // Detect page from URL
  let pageKey = 'index';
  if (pathname.includes('afi.html')) {
    pageKey = 'afi';
  } else if (pathname.includes('intake-questionnaire.html')) {
    pageKey = 'intake';
  } else if (pathname.includes('document-management.html')) {
    pageKey = 'document-management';
  } else if (pathname.includes('index.html') || pathname === '/' || pathname === '') {
    pageKey = 'index';
  }

  initVeritasChat(pageKey);
}
