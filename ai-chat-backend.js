/**
 * Veritas AI Chat Backend Handler
 * Node.js/Express API endpoint for handling chat requests
 * Integrates with Anthropic Claude API
 */

// Install with: npm install express cors dotenv @anthropic-ai/sdk

const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk').default;
const { getAFIRegulations, formatRegulationsForDisplay } = require('./regulations-service');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

/**
 * POST /api/chat
 * Handles chat message requests
 *
 * Request body:
 * {
 *   message: string,
 *   history: Array<{role: string, content: string}>,
 *   context: string,
 *   systemPrompt: string
 * }
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, context, systemPrompt } = req.body;

    // Validate input
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required and must be a string' });
    }

    if (!systemPrompt || typeof systemPrompt !== 'string') {
      return res.status(400).json({ error: 'System prompt is required' });
    }

    // Build message history for Claude
    // Claude expects messages in the format: [{ role: 'user'|'assistant', content: string }]
    const messages = [];

    // Add previous conversation history if provided
    if (Array.isArray(history) && history.length > 0) {
      messages.push(
        ...history.map((msg) => ({
          role: msg.role,
          content: msg.content
        }))
      );
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: message
    });

    // Enhance system prompt with context if provided
    let enhancedSystemPrompt = systemPrompt;
    if (context) {
      enhancedSystemPrompt += `\n\nCurrent page context: ${context}`;
    }

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      system: enhancedSystemPrompt,
      messages: messages
    });

    // Extract response content
    const responseText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Return response
    res.json({
      content: responseText,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens
      }
    });
  } catch (error) {
    console.error('Chat API error:', error);

    // Handle specific error types
    if (error.status === 401) {
      return res.status(401).json({ error: 'Authentication failed. Check API key.' });
    }

    if (error.status === 429) {
      return res
        .status(429)
        .json({ error: 'Rate limit exceeded. Please try again in a moment.' });
    }

    res.status(500).json({
      error: 'An error occurred processing your message. Please try again.'
    });
  }
});

/**
 * GET /api/regulations/afi
 * Get AFI regulations, guidance, and case law
 */
app.get('/api/regulations/afi', async (req, res) => {
  try {
    const apiKey = process.env.SCALESERP_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'ScaleSerp API key not configured',
        data: {
          regulations: { title: 'Arizona AFI Regulations', items: [] },
          guidance: { title: 'Necessary vs Discretionary Guidance', items: [] },
          cases: { title: 'Recent Case Law', items: [] },
          courtRules: { title: 'Court Rules', items: [] },
          bestPractices: { title: 'Best Practices', items: [] },
          lastUpdated: new Date().toISOString(),
          note: 'API key not configured. Please set SCALESERP_API_KEY in .env'
        }
      });
    }

    const regulationsData = await getAFIRegulations(apiKey);
    const formattedData = formatRegulationsForDisplay(regulationsData);

    res.json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error('Regulations API error:', error);
    res.status(500).json({
      error: 'Error fetching regulations',
      message: error.message
    });
  }
});

/**
 * GET /api/health
 * Simple health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'veritas-ai-chat' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Veritas AI Chat API running on port ${PORT}`);
  console.log('Make sure ANTHROPIC_API_KEY is set in your environment');
});

module.exports = app;
