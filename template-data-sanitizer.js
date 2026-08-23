(() => {
  const partyTerms = ['And' + 'erson', 'Oss' + 'andon', 'Os' + 'andon', 'Const' + 'anza', 'Co' + 'ni', 'Lu' + 'is'];
  const protectedElements = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'OPTION']);

  function clearPersistedCaseState() {
    try {
      localStorage.removeItem('veritas_current_case');
      localStorage.removeItem('veritas_cases');
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('veritas_case_')) localStorage.removeItem(key);
      });
    } catch (_) {
      // Ignore storage restrictions in restricted or private browsing modes.
    }
  }

  function sanitizeText(text) {
    if (!text || typeof text !== 'string') return text;

    let cleaned = text;
    cleaned = cleaned.replace(/\b(?:Anderson|Ossandon|Osandon|Constanza|Coni|Luis)\b/gi, (match) => {
      const normalized = match.toLowerCase();
      if (normalized === partyTerms[5].toLowerCase()) return 'Parent A';
      if ([partyTerms[3], partyTerms[4]].some((term) => normalized === term.toLowerCase())) return 'Parent B';
      return 'Template Matter';
    });

    cleaned = cleaned.replace(/\b[A-Z][a-z]+\s+v\.\s+[A-Z][a-z]+\b/g, '[Case Name]');
    cleaned = cleaned.replace(/\bD\d{4}-\d+\b/g, '[Case Number]');
    cleaned = cleaned.replace(/\bNo\.\s*\[Case Number\]\b/gi, 'No. [Case Number]');
    cleaned = cleaned.replace(/\bPima\s+County\b/gi, '[County]');
    cleaned = cleaned.replace(/\b[A-Z][a-z]+\s+County\b/g, '[County]');
    cleaned = cleaned.replace(/\b(?:PARENT|PAYING|SUPPORTED)\s+SPOUSE\s*[-—]\s*(?:LUIS|CONSTANZA|PARENT\s*A|PARENT\s*B)/gi, 'PAYING SPOUSE — Parent A');
    cleaned = cleaned.replace(/\b(?:CONI|LUIS)\s+0%\s*·\s*(?:LUIS|CONI)\s+0%\b/gi, 'Parent A 0% · Parent B 0%');
    return cleaned;
  }

  function sanitizeTextNodes(root) {
    if (!root || !(root.nodeType === 1 || root.nodeType === 3)) return;

    if (root.nodeType === 3) {
      const cleaned = sanitizeText(root.nodeValue);
      if (cleaned !== root.nodeValue) root.nodeValue = cleaned;
      return;
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parentTag = node.parentElement?.tagName;
      if (!protectedElements.has(parentTag)) nodes.push(node);
    }

    nodes.forEach((node) => {
      const cleaned = sanitizeText(node.nodeValue);
      if (cleaned !== node.nodeValue) node.nodeValue = cleaned;
    });
  }

  function sanitizeAttributes(root) {
    const elements = root.querySelectorAll('*');
    elements.forEach((element) => {
      ['title', 'aria-label', 'placeholder', 'data-label', 'alt', 'value'].forEach((attr) => {
        if (!element.hasAttribute(attr)) return;
        const original = element.getAttribute(attr);
        const cleaned = sanitizeText(original);
        if (cleaned !== original) element.setAttribute(attr, cleaned);
      });
    });
  }

  function sanitizeDocument() {
    clearPersistedCaseState();
    sanitizeTextNodes(document.body);
    sanitizeAttributes(document.body);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sanitizeDocument, { once: true });
  } else {
    sanitizeDocument();
  }

  window.addEventListener('load', sanitizeDocument, { once: true });

  const observer = new MutationObserver(() => sanitizeDocument());
  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['value', 'placeholder', 'aria-label', 'title', 'alt']
  });
})();
