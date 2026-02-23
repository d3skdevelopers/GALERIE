# GALERIE — Deployment Guide

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Vercel](https://vercel.com) account (free tier works)
- A PIGMENT API key (contact the PIGMENT team)

---

## 1. Supabase Setup

### 1a. Create a project
Go to [supabase.com](https://supabase.com) → New Project. Note your project URL and anon key from Settings → API.

### 1b. Run migrations
Open the SQL Editor in your Supabase dashboard. Run each file in order:

```
database/01_schema.sql
database/02_indexes.sql
database/03_rls.sql
database/04_functions_triggers.sql
database/05_storage.sql
database/06_seed.sql
database/07_pigment_columns.sql
```

Paste and run each file. Wait for the previous to complete before running the next.

### 1c. Get your service role key
Settings → API → `service_role` key. This is used by the backend only — never expose it to the browser.

### 1d. Enable email auth
Authentication → Providers → Email → Enable. Optionally disable email confirmation for local development.

---

## 2. Backend Setup

### 2a. Environment variables
Copy `backend/.env.example` to `backend/.env` and fill in:

```env
PORT=3001
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 2b. Install and run locally
```bash
cd backend
npm install
node server.js
# Server running on http://localhost:3001
```

### 2c. Deploy to Vercel
```bash
cd backend
npx vercel
```

Follow the prompts. Add environment variables in the Vercel dashboard under Settings → Environment Variables.

The backend expects to be deployed as a Node.js serverless function. `vercel.json` (if present) handles routing. If not, Vercel auto-detects Express apps.

**Note:** Vercel free tier has a 10-second function timeout. File uploads and kinship calculations can be slow on cold starts. Consider Vercel Pro or Railway for production.

---

## 3. Frontend Setup

### 3a. Environment variables
Copy `frontend/.env.example` to `frontend/.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=https://your-backend.vercel.app
VITE_PIGMENT_API_URL=https://pigment-api.onrender.com
VITE_PIGMENT_WS_URL=wss://pigment-ai-server.onrender.com
VITE_PIGMENT_API_KEY=pigment_galerie_prod_2026_...
```

### 3b. Install and run locally
```bash
cd frontend
npm install
npm run dev
# App running on http://localhost:5173
```

### 3c. Deploy to Vercel
```bash
cd frontend
npx vercel
```

Set the same environment variables in the Vercel dashboard.

**Build settings:**
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

---

## 4. Supabase Storage

The `05_storage.sql` migration creates an `artworks` bucket. Verify it exists:

Supabase Dashboard → Storage → Buckets → `artworks` should be present with public read access.

If artworks aren't loading, check that the bucket policy allows `SELECT` without auth (artworks are public once approved).

---

## 5. PIGMENT Integration

PIGMENT integration is optional at the infrastructure level — the app works without it, just without genome/evolution features.

To enable:
1. Get an API key from the PIGMENT team
2. Add it to `frontend/.env` as `VITE_PIGMENT_API_KEY`
3. Deploy the frontend

PIGMENT calls are made directly from the browser to `pigment-api.onrender.com`. No backend proxy is needed.

---

## 6. Local Development (Full Stack)

Run backend and frontend simultaneously:

```bash
# Terminal 1
cd backend && node server.js

# Terminal 2
cd frontend && npm run dev
```

Frontend dev server proxies API calls to `localhost:3001` if you set `VITE_API_URL=http://localhost:3001` in `frontend/.env`.

---

## 7. Environment Variable Reference

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✓ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✓ | Supabase anon key |
| `VITE_API_URL` | ✓ | Backend URL |
| `VITE_PIGMENT_API_URL` | — | PIGMENT API base URL |
| `VITE_PIGMENT_WS_URL` | — | PIGMENT WebSocket URL |
| `VITE_PIGMENT_API_KEY` | — | PIGMENT API key |

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | — | Server port (default 3001) |
| `SUPABASE_URL` | ✓ | Supabase project URL |
| `SUPABASE_ANON_KEY` | ✓ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | Supabase service role key |

---

## 8. Health Checks

After deployment, verify:

```bash
# Backend health
curl https://your-backend.vercel.app/api/artworks

# Should return [] or an array of artworks

# Frontend
# Visit https://your-frontend.vercel.app
# Should show the Foyer page
```

Common issues:
- **CORS errors**: Check backend CORS config includes your frontend URL
- **401 on API calls**: Supabase session not being passed; check `getAuthToken()` in `frontend/src/lib/api.js`
- **Artworks not showing**: Check Supabase Storage bucket is public
- **Voting not working**: Check RLS policies ran correctly (03_rls.sql)
