const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function parseWithClaude(prompt, systemPrompt = null) {
  try {
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4000,
      ...(systemPrompt && { system: systemPrompt }),
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    if (!response.content || response.content.length === 0) {
      throw new Error('No content in Claude response');
    }

    // Find the text content (Claude Opus 5 may return thinking blocks first)
    const textContent = response.content.find(c => c.type === 'text');
    if (textContent && textContent.text) {
      return textContent.text;
    }

    // Fallback for first content if no text found
    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    throw new Error('No text content found in Claude response');
  } catch (error) {
    console.error('Claude API error:', error);
    throw error;
  }
}

async function parseJSONWithClaude(prompt, systemPrompt = null) {
  const text = await parseWithClaude(prompt, systemPrompt);

  // Extract JSON from markdown code blocks if present
  const jsonMatch = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]);
  }

  // Try parsing directly
  return JSON.parse(text);
}

module.exports = {
  parseWithClaude,
  parseJSONWithClaude,
};
