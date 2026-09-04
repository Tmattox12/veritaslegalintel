# Veritas Local Development Setup

## Overview

The Veritas template now has a real local backend (Express + SQLite) that stores matters, users, and documents. This lets you:
- ✅ Build features with realistic data
- ✅ Upload test documents
- ✅ Reset to a clean template with `npm run reset`
- ✅ All data stays local (in `.data/` folder, gitignored)

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Reset to clean template (optional, if you have old data)
```bash
npm run reset
```

### 3. Seed with demo data
```bash
npm run seed
```

This loads 3 sample users and 3 sample matters from `seed-data/demo-firm.json`.

### 4. Start the server
```bash
npm start
```

Server runs on `http://localhost:3000`

### 5. Open the app
Open `index.html` in a browser (or via a local server). The app will:
- Load matters, users, and documents from the backend
- Display them in the dashboard
- All API calls go to `localhost:3000/api`

## Development Workflow

### Build with data
```bash
npm run seed   # Load demo data
# ... make changes, test features, upload docs ...
```

### Reset when done
```bash
npm run reset  # Wipes .data/ and uploads/
git status     # No data files tracked ✓
```

### Push clean template to git
```bash
git add .
git commit -m "feature: add X functionality"
git push
```

## API Endpoints

All endpoints are at `http://localhost:3000/api`:

### Matters
- `GET /matters` — List all matters
- `GET /matters/:id` — Get matter details + assignments
- `POST /matters` — Create a new matter
- `DELETE /matters/:id` — Soft-delete a matter

### Users
- `GET /users` — List all users

### Documents
- `GET /matters/:id/documents` — List documents for a matter
- `POST /documents` — Upload a document
- `DELETE /documents/:id` — Soft-delete a document

### Matter Assignments
- `POST /matter-assignments` — Assign a user to a matter

### Health
- `GET /health` — Server status

## File Structure

```
Veritas_CLEAN/
├── server/              ← Backend (Express + SQLite)
│   ├── index.js         (main server)
│   └── db/
│       └── schema.js    (database schema)
├── scripts/
│   ├── seed.js          (load demo data)
│   └── reset.js         (wipe .data/ and uploads/)
├── seed-data/
│   └── demo-firm.json   (fake data for development)
├── .data/               (gitignored — SQLite database lives here)
├── uploads/             (gitignored — uploaded files)
├── index.html           (main app)
├── app.js               (dashboard logic)
├── api-client.js        (API wrapper)
└── case-manager.js      (data loading + persistence)
```

## Key Changes from Before

| Before | Now |
|--------|-----|
| Data in `localStorage` | Data in SQLite backend |
| Hardcoded demo arrays in `app.js` | Demo data in `seed-data/demo-firm.json` |
| No real server | Real Express server on `:3000` |
| Can't wipe data without deleting code | `npm run reset` wipes data only |
| localStorage fallback in case-manager.js | Pure API-based (no fallback) |

## Troubleshooting

### "Cannot find module 'sqlite3'"
Run `npm install` again.

### "Port 3000 in use"
Change the PORT in `.env` or kill the process using port 3000.

### Data not loading
1. Check server is running: `curl http://localhost:3000/api/health`
2. Check browser console for API errors
3. Check `.data/veritas.sqlite` exists

### Want to reload with fresh data
```bash
npm run reset
npm run seed
npm start
```

## Next Steps (Phase 1 — Cloud)

When you're ready to deploy:
1. Replace SQLite with Postgres RDS
2. Add Clerk authentication (JWT validation)
3. Add per-firm database routing
4. Deploy to AWS ECS Fargate

For now, focus on building features locally and resetting cleanly when needed.
