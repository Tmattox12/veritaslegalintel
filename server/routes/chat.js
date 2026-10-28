// AI assistant for the in-page chat bubble (ai-chat-widget.js).
// The category list comes from afi-taxonomy.js — the same source as the
// "Assign to AFI category" dropdown — so the assistant only ever names
// categories a person can actually pick.
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const T = require('../../afi-taxonomy');

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_HISTORY = 20;
const MAX_CHARS = 4000;

function taxonomyReference() {
  return T.SECTIONS.map((s) => {
    const cats = T.categoriesForSection(s.key).map((c) => {
      const line = T.afiLineFor(c.code);
      return `  - ${T.displayLabel(c.code)}${line ? ` (rolls into AFI Line ${line})` : ''} [treatment: ${c.treatment}]`;
    });
    return `${s.label}${s.legalBasis ? ` — ${s.legalBasis}` : ''}\n${cats.join('\n')}`;
  }).join('\n\n');
}

// Built once: stable text keeps the prompt cacheable across requests.
const BASE_SYSTEM = `You are the Veritas assistant inside an Arizona family-law financial analysis app used by legal staff. You help them classify bank and card transactions into the categories of the Arizona Affidavit of Financial Information (AFI) and answer questions about how the app works.

How classification works in the app:
- Each unmapped merchant row has a search box ("Search or add a category…"). Typing part of a category name filters the list; picking one saves it. "✓ Confirm" accepts the suggested category as-is.
- Merchants already classified appear under "Already classified", where the category can be changed or undone with "↺ Undo".
- Only categories with an AFI line number land on the 8-line AFI form. Other need categories are reported on their own line; discretionary items are reported separately and are never treated as a need; excluded items never count; "Not an expense" items (income, transfers) are left out of spending entirely.
- "Other / Skip — leave out of AFI" removes a merchant from AFI totals.

The complete category list (use these exact names; never invent a category — if nothing fits, say so and mention that typing a new name offers "Add as a new category"):

${taxonomyReference()}

Answer style: the chat window shows plain text, so do not use markdown headings, bold, or tables. Short sentences and simple "- " lists are fine. When recommending a category, give its exact name as it appears above and the word to type in the search box to find it. If the right category depends on a fact you don't have (for example whether a therapist is for the parent or the child, or whether a payment is court-ordered), ask or give both options. Where the classification is a legal judgment (necessary vs. discretionary, allocation between parents), say so briefly and leave the call to the attorney.`;

router.post('/', async (req, res) => {
  const { message, history, context, systemPrompt } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'AI assistant is not configured (ANTHROPIC_API_KEY missing in .env).' });
  }

  const messages = (Array.isArray(history) ? history : [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content)
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  // The API needs the conversation to start with a user turn.
  while (messages.length && messages[0].role !== 'user') messages.shift();
  messages.push({ role: 'user', content: message.slice(0, MAX_CHARS) });

  // Page guidance goes after the cached base so it never invalidates it.
  const pageNotes = [context && `Current page: ${String(context).slice(0, 300)}`,
    typeof systemPrompt === 'string' && systemPrompt.slice(0, 2000)].filter(Boolean).join('\n\n');

  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [
        { type: 'text', text: BASE_SYSTEM, cache_control: { type: 'ephemeral' } },
        ...(pageNotes ? [{ type: 'text', text: pageNotes }] : []),
      ],
      messages,
    });

    if (response.stop_reason === 'refusal') {
      return res.json({ content: "I can't help with that one. Try rephrasing the question about the expense or category." });
    }
    const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    res.json({ content: text || 'No answer came back. Please try again.' });
  } catch (error) {
    console.error('Chat API error:', error.status || '', error.message);
    if (error instanceof Anthropic.AuthenticationError) {
      return res.status(502).json({ error: 'The AI key in .env was rejected. Check ANTHROPIC_API_KEY.' });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'The AI service is busy. Try again in a moment.' });
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return res.status(502).json({ error: 'Could not reach the AI service. Check the internet connection.' });
    }
    res.status(500).json({ error: 'The assistant hit an error. Please try again.' });
  }
});

module.exports = router;
