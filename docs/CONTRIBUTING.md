# Contributing to GALERIE

Thank you for your interest in GALERIE. This document covers how to set up a development environment, the conventions the codebase follows, and the process for submitting changes.

---

## Development Setup

See [DEPLOYMENT.md](DEPLOYMENT.md) for full environment setup. For contributors, the minimum you need:

```bash
git clone https://github.com/your-org/galerie.git
cd galerie

# Backend
cd backend && npm install

# Frontend
cd frontend && npm install && npm run dev
```

You'll need a Supabase project with the migrations applied. Using the production DB for development is not recommended — create a separate dev project.

---

## Project Conventions

### File naming
- Pages: `PascalCase.jsx` + matching `PascalCase.css`
- Components: `PascalCase.jsx`
- Libraries: `camelCase.js`
- SQL migrations: `NN_description.sql` (numbered, lowercase)

### Component structure
```jsx
// 1. Imports — React first, then internal, then styles
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './Component.css';

// 2. Helper components (small, local)
function HelperThing({ prop }) { ... }

// 3. Main export
export default function MyPage({ session }) {
  // state, effects, handlers, render
}
```

### API calls
- Direct Supabase calls: use `supabase` client from `lib/supabase.js`
- Backend API calls: use `apiFetch()` from `lib/api.js` (handles auth token)
- PIGMENT API calls: use functions from `lib/pigment.js` (handles API key)

### Error handling
PIGMENT API calls should always be non-fatal — wrap in try/catch and let the upload/action proceed without the genome. The app works without PIGMENT; PIGMENT is enhancement only.

### CSS
- No CSS frameworks. Plain CSS with custom properties defined in `App.css`
- Key variables: `--accent` (gold), `--bg`, `--bg-secondary`, `--border`, `--text`, `--text-secondary`
- Each page/component has its own `.css` file — no global styles except `App.css`

---

## Database Changes

All schema changes go in a new numbered SQL file in `database/`:

```
database/08_your_feature.sql
```

- Always use `if not exists` / `if exists` for idempotency
- Always write a down migration as a comment
- Update `docs/ARCHITECTURE.md` to reflect schema changes
- Test RLS policies manually in Supabase dashboard before committing

---

## Adding a Page

1. Create `frontend/src/pages/NewPage.jsx` and `NewPage.css`
2. Add route in `frontend/src/App.jsx`:
   ```jsx
   <Route path="/new-page" element={<NewPage session={session} />} />
   ```
3. Add navigation link in `Navigation.jsx` if needed
4. Document the page in `docs/ARCHITECTURE.md` (Frontend Pages table)

---

## Adding a Backend Endpoint

1. Add handler to the relevant `backend/routes/*.js` file
2. Document it in `docs/API.md`
3. If it's a new route module, register it in `backend/server.js`

---

## Adding a PIGMENT API Call

1. Add the function to `frontend/src/lib/pigment.js`
2. Make it non-fatal (try/catch, never throw to the user)
3. Document it in `docs/INTEGRATION.md`
4. If it requires a new `artworks` column, add a migration

---

## Pull Request Checklist

Before submitting:

- [ ] Ran the app locally with both frontend and backend
- [ ] Tested the specific feature being added/changed
- [ ] No `console.error` left from unhandled cases
- [ ] New DB columns have a migration file
- [ ] New endpoints are documented in `API.md`
- [ ] `CHANGELOG.md` updated with a brief entry

---

## Code Review

PRs need one approval before merge. Reviewers will look at:

- Does it work? (Functional correctness)
- Does it handle errors gracefully? (Non-fatal failures, user-facing messages)
- Does it respect the security model? (No RLS bypasses, no exposed keys)
- Is it consistent with existing conventions? (File names, CSS patterns, import order)

Large PRs should be broken into smaller ones where possible.

---

## Reporting Issues

Open a GitHub Issue with:
- What you were trying to do
- What happened instead
- Browser/OS/Node version
- Any console errors

For security issues, do not open a public issue. Email [security@galerie.art] directly.
