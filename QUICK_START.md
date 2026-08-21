# Veritas AI Chat Widget - Quick Start (5 Minutes)

## 1. Get API Key (1 minute)

Go to: https://console.anthropic.com/api_keys

Create an API key and copy it.

## 2. Create .env File (1 minute)

Create a file named `.env` in this directory with:

```
ANTHROPIC_API_KEY=paste_your_key_here
```

## 3. Install & Run (3 minutes)

```bash
# Install dependencies (first time only)
npm install

# Start the server
npm start
```

You'll see: `Veritas AI Chat API running on port 3000`

## 4. Test It!

Open your browser to any of these pages:
- `index.html`
- `afi.html`
- `intake-questionnaire.html`
- `document-management.html`

Look for the blue **💬** button in the bottom-right corner.

Click it and start asking questions!

---

## That's It!

The widget is now live on all 4 pages. Users will see:
- A blue chat button (bottom-right)
- Click to open the chat panel
- Suggested questions for context help
- Full chat history with timestamps
- Clear chat button to reset

## What's Next?

### Customize It
- Edit `ai-chat-config.js` to change suggested questions
- Edit `ai-chat-widget.css` to change colors
- Edit `ai-chat-backend.js` to change the AI model

### Deploy
- Change `apiEndpoint` in `ai-chat-config.js` to your production API
- Deploy `ai-chat-backend.js` to your server (Heroku, AWS, etc.)
- Keep your API key secure in environment variables

### Monitor
- Check `http://localhost:3000/api/health` to verify API is running
- Watch browser console for errors
- Check backend logs for API issues

## Common Issues

**"Cannot find module..."**
→ Run `npm install` again

**"API error"**
→ Check your API key in `.env`

**"Chat button not showing"**
→ Check browser console (F12) for errors

**"Widget won't send messages"**
→ Verify `npm start` is running

See `AI_CHAT_SETUP.md` for more help.

---

## Files Created

- `ai-chat-widget.js` - Main widget code
- `ai-chat-widget.css` - Widget styling  
- `ai-chat-config.js` - Page configurations
- `ai-chat-backend.js` - API server
- `package.json` - Dependencies
- `AI_CHAT_SETUP.md` - Complete setup guide
- `.env.example` - Configuration template
- This file!

## What's Integrated

✅ `index.html` - System overview chat
✅ `afi.html` - Expense reconciliation chat
✅ `intake-questionnaire.html` - Document prep chat
✅ `document-management.html` - File upload chat

Each page has its own context and suggested questions!

---

**Questions?** See `AI_CHAT_SETUP.md` for detailed documentation.
