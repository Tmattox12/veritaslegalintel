# Veritas AI Chat Widget Setup Guide

## Overview

The Veritas AI Chat Widget is a reusable component that adds an AI assistant to any page in the Veritas system. Users can ask questions about the current page's features and functionality, and receive contextual assistance.

## Files Included

### Frontend Files
- **ai-chat-widget.js** - Main widget component (initialization and UI logic)
- **ai-chat-widget.css** - Widget styling (responsive, theme-aware)
- **ai-chat-config.js** - Page-specific configurations, system prompts, and suggested questions

### Backend Files
- **ai-chat-backend.js** - Express API server for Claude integration

## Setup Instructions

### 1. Backend Setup

#### Prerequisites
- Node.js 14+ and npm
- Anthropic API key (obtain from https://console.anthropic.com)

#### Installation

```bash
# Install dependencies
npm install express cors dotenv @anthropic-ai/sdk

# Create .env file
echo "ANTHROPIC_API_KEY=your_api_key_here" > .env

# Start the server
node ai-chat-backend.js
```

The API will run on `http://localhost:3000` by default.

#### Environment Variables
```
ANTHROPIC_API_KEY=your_anthropic_api_key
PORT=3000  # Optional, defaults to 3000
```

### 2. Frontend Integration

Add the following to the `<head>` section of each HTML page:

```html
<!-- Veritas AI Chat Widget -->
<link rel="stylesheet" href="ai-chat-widget.css" />
<script src="ai-chat-config.js"></script>
<script src="ai-chat-widget.js"></script>
```

The config script will auto-detect the current page and initialize the widget with appropriate context.

### 3. API Configuration

By default, the widget expects the API at `/api/chat`. If hosting the backend elsewhere, update the endpoint in `ai-chat-config.js`:

```javascript
// In the config objects:
apiEndpoint: 'https://your-api-host.com/api/chat'
```

Or configure it when manually initializing:

```javascript
window.veritasChatConfig = {
  pageContext: 'Custom context',
  systemPrompt: 'Your system prompt',
  suggestedQuestions: ['Question 1', 'Question 2'],
  apiEndpoint: 'https://your-api-host.com/api/chat',
  storageKey: 'veritas-chat-history'
};
```

## Page-Specific Configuration

### index.html
- **Context:** Overview of the AFI system
- **Suggested Questions:**
  - What is the AFI system and why do I need it?
  - How do I get started with Veritas?
  - What documents do I need to prepare?
  - What is the overall process timeline?
  - Where should I upload my financial documents?

### afi.html
- **Context:** Expense reconciliation and form sections
- **Suggested Questions:**
  - How do I fill out Section 6: Employment Income?
  - What documents do I need for expense reconciliation?
  - How does the expense matching system work?
  - What is the difference between Section 4.A and 4.B?
  - How do I reconcile expenses across multiple sources?

### intake-questionnaire.html
- **Context:** Document preparation and intake process
- **Suggested Questions:**
  - What documents should I gather before starting?
  - How do I organize my financial documents?
  - What are conditional questions and when do they apply?
  - How do I know if a section applies to me?
  - What is the next step after completing intake?

### document-management.html
- **Context:** Document upload and linking
- **Suggested Questions:**
  - What file types can I upload?
  - How do I link a document to an expense?
  - How should I organize my document folders?
  - What is the maximum file size?
  - Can I upload multiple documents for one expense?

## Features

### User-Facing Features
- **Chat Panel**: 400px wide on desktop, full-width on mobile
- **Message History**: Scrollable chat with user and AI messages
- **Suggested Questions**: Context-specific starter questions
- **Typing Indicator**: Shows when AI is processing
- **Message Timestamps**: When messages were sent
- **Clear Chat**: Option to clear conversation history
- **Responsive**: Works on desktop, tablet, and mobile
- **Dark Mode**: Automatically adapts to system theme
- **Local Storage**: Chat history persists per page

### Technical Features
- **No External Dependencies**: Pure JavaScript, only Claude API dependency
- **Smooth Animations**: Slide-in effects and transitions
- **Accessibility**: Proper ARIA labels and semantic HTML
- **XSS Protection**: HTML escaping for user messages
- **Error Handling**: User-friendly error messages
- **Token Optimization**: Sends only necessary message history

## Styling

The widget uses CSS custom properties (variables) that can be overridden:

```css
:root {
  --veritas-primary: #2e5b8a;
  --veritas-primary-dark: #1f5f9d;
  --veritas-user-msg: #e8f0f7;
  --veritas-ai-msg: #f0f0f0;
  --veritas-text: #1a2432;
  --veritas-text-light: #55637a;
}
```

### Widget Size
- **Toggle Button**: 60px diameter circle
- **Chat Panel**: 400px wide (on desktop)
- **Mobile**: Full viewport width
- **Position**: Bottom-right corner with 20px padding

### Color Scheme
- Primary: #2e5b8a (Veritas blue)
- Accent: #1f5f9d (Darker blue)
- User Messages: Light blue (#e8f0f7)
- AI Messages: Light gray (#f0f0f0)
- Text: Dark navy (#1a2432)
- Secondary Text: Slate (#55637a)

## Troubleshooting

### Widget Not Appearing
1. Check that both `.css` and `.js` files are loaded (browser DevTools → Network)
2. Verify z-index is not being overridden by other elements
3. Check browser console for JavaScript errors

### API Errors
1. Verify `ANTHROPIC_API_KEY` is set correctly
2. Check that backend is running: `curl http://localhost:3000/api/health`
3. Verify CORS is properly configured
4. Check browser console for network errors

### Chat Not Sending
1. Ensure message input has text
2. Check that API endpoint is correct
3. Look for network errors in browser DevTools
4. Verify backend is responding to requests

### Chat History Not Persisting
1. Check browser's localStorage is enabled
2. Verify localStorage quota is not exceeded
3. Check browser console for storage errors
4. Try clearing browser cache and reloading

## API Reference

### POST /api/chat

**Request:**
```json
{
  "message": "What is the AFI?",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "context": "Ask me about expense reconciliation...",
  "systemPrompt": "You are an expert in family law..."
}
```

**Response:**
```json
{
  "content": "The AFI (Affidavit of Financial Information) is...",
  "usage": {
    "input_tokens": 150,
    "output_tokens": 45
  }
}
```

**Error Response:**
```json
{
  "error": "Authentication failed. Check API key."
}
```

## Customization

### Adding the Widget to More Pages
1. Add the three `<script>` and `<link>` tags to the page's `<head>`
2. The widget auto-detects the page and initializes with appropriate context
3. To customize, add a new page key to `VERITAS_CHAT_CONFIGS` in `ai-chat-config.js`

### Changing the AI Model
In `ai-chat-backend.js`, update the model parameter:
```javascript
model: 'claude-3-5-sonnet-20241022'  // Change this
```

Available models:
- `claude-3-opus-20250219` (Most capable)
- `claude-3-5-sonnet-20241022` (Balanced, recommended)
- `claude-3-haiku-20250307` (Fast, lower cost)

### Custom System Prompts
Edit `ai-chat-config.js` and modify the `systemPrompt` in the appropriate page config.

### Suggested Questions
Update the `suggestedQuestions` array in the page config:
```javascript
suggestedQuestions: [
  'Custom question 1?',
  'Custom question 2?'
]
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Android)

## Performance Notes

- Widget is lightweight (~20KB minified)
- Lazy loads only when user clicks toggle button
- Reuses API connection for multiple messages
- Message history stored locally, not on server

## Security Considerations

1. **API Key**: Keep `ANTHROPIC_API_KEY` secure on backend only
2. **CORS**: Configure appropriately for your domain
3. **Input Validation**: Widget escapes user messages to prevent XSS
4. **Rate Limiting**: Implement on backend to prevent abuse
5. **Content Moderation**: Consider adding content filters

## Support & Feedback

For issues or improvements:
1. Check this guide's troubleshooting section
2. Review browser console for errors
3. Verify API key and backend connectivity
4. Check Anthropic API status

## License

Part of the Veritas AFI System
