function renderSafeText(value) {
  if (value === null || value === undefined) return '';

  const text = String(value);
  const replacements = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  let output = '';

  for (const ch of text) {
    if (ch === '\n') {
      output += '<br>';
      continue;
    }

    if (ch.charCodeAt(0) < 32) {
      continue;
    }

    output += replacements[ch] ?? ch;
  }

  return output;
}

if (typeof module !== 'undefined') {
  module.exports = { renderSafeText };
}

if (typeof window !== 'undefined') {
  window.renderSafeText = renderSafeText;
}
