const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function parseWithClaude(prompt, systemPrompt = null) {
  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      ...(systemPrompt && { system: systemPrompt }),
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    throw new Error('Unexpected response type from Claude');
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
