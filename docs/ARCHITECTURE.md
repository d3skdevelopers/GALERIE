# GALERIE — Architecture

## Overview

GALERIE is a three-layer system: a React frontend, an Express backend, and a Supabase data layer. A fourth layer — PIGMENT — is an external AI service that handles genome conversion and evolution.

```
┌─────────────────────────────────────────────────────┐
│                    Browser                           │
│   React + Vite (claude.ai / galerie.art)            │
│   ├── 15 pages                                      │
│   ├── pigment.js (API client)                       │
│   └── pigment-local.js (local genome renderer)      │
└────────────────┬────────────────┬───────────────────┘
                 │                │
         REST API│                │Direct Supabase
                 ▼                ▼
┌────────────────────┐  ┌──────────────────────────────┐
│  Express Backend   │  │  Supabase                    │
│  (Vercel/Node.js)  │  │  ├── PostgreSQL (9 tables)   │
│  ├── /api/auth     │  │  ├── Row Level Security       │
│  ├── /api/artworks │  │  ├── Storage (artworks/)     │
│  ├── /api/votes    │  │  └── Auth                    │
│  ├── /api/rooms    │  └──────────────────────────────┘
│  ├── /api/kinship  │
│  ├── /api/search   │  ┌──────────────────────────────┐
│  ├── /api/articles │  │  PIGMENT API (external)      │
│  ├── /api/pushes   │  │  pigment-api.onrender.com    │
│  └── /api/exhibitions  │  ├── /v1/convert/html-to-pg │
└────────────────────┘  │  ├── /v1/works               │
                         │  ├── /v1/evolve              │
                         │  ├── /v1/kinship             │
                         │  └── /v1/training            │
                         └──────────────────────────────┘
```

---

## Database Schema

### `profiles`
Extends Supabase Auth users. Contains `username`, `full_name`, `avatar_url`, `bio`, `voting_tickets`.

### `spaces`
Top-level containers (e.g. "The Museum"). Each space has one or more rooms.

### `rooms`
Gallery rooms within a space. Artworks are associated to rooms via the artworks table.

### `artworks`
Core table. Every uploaded work lives here.

Key columns:
- `file_url` — Supabase Storage URL (original file)
- `file_type` — `html`, `htm`, `js`, `png`, `jpg`, `jpeg`, `gif`
- `is_approved` — boolean, set true after 5 approval votes
- `voting_ends` — 7 days after upload
- `genome` — `.pg` genome string (set by PIGMENT on upload)
- `features` — 16-float feature vector (for kinship)
- `pigment_work_id` — PIGMENT's UUID for this work
- `pigment_fitness` — 0–100 fitness score
- `parent_id` — foreign key to `artworks.id` (for evolved children)
- `generation` — evolution depth (0 = original upload)
- `is_evolved` — boolean

### `votes`
One row per vote. `vote_type` is `approve` or `reject`. Enforced one-vote-per-user-per-artwork by RLS.

### `kinship`
Pairwise similarity scores between artworks. `similarity_score` is 0–1. Populated by `/api/kinship/calculate/:artworkId`.

### `exhibitions`
Curated groupings. `artwork_ids` is a UUID array.

### `articles`
Long-form writing about artworks. `artwork_ids` links an article to one or more works. `push_count` tracks boosts.

### `article_pushes`
One row per push action. Enforces one-push-per-user-per-article.

---

## Authentication Flow

```
1. User signs up → Supabase Auth creates auth.users entry
2. Trigger auto-creates profiles row (username = email prefix)
3. Frontend stores session token in Supabase client
4. Backend reads Bearer token from Authorization header
5. Backend verifies via supabase.auth.getUser(token)
6. RLS policies enforce row-level access automatically
```

---

## Upload Flow

```
1. Artist selects file in Upload.jsx
2. File uploaded to Supabase Storage: artworks/{userId}/{timestamp}-{filename}
3. If PIGMENT enabled and file is HTML:
   a. HTML source read as text
   b. POST /v1/convert/html-to-pg → { genome, features, preview }
   c. Preview (base64 PNG) stored to Storage: artworks/{userId}/previews/{id}.png
4. Artwork row inserted to DB with all PIGMENT fields
5. POST /v1/works → registers with PIGMENT, gets pigment_work_id
6. pigment_work_id written back to artwork row
7. Artwork enters 7-day voting queue
```

---

## Evolution Flow

```
1. Artist clicks "Evolve" on their own artwork (Focus page)
2. EvolveButton.jsx connects WebSocket: wss://pigment-ai-server.onrender.com/ws/{userId}
3. POST /v1/evolve → { job_id }
4. WebSocket streams: evolution_tick events (generation, fitness, progress, operator)
5. evolution_done event → { child_id, html, fitness_after, operator }
6. Evolved HTML uploaded to Supabase Storage
7. New artwork row inserted (parent_id = original, generation = parent.generation + 1, is_evolved = true)
8. Training record sent to PIGMENT /v1/training
9. onEvolved callback updates Focus page UI
```

---

## Voting Flow

```
1. Works with is_approved=false appear in /voting queue
2. Any logged-in user with tickets can vote
3. POST /api/votes → records vote, decrements tickets
4. Trigger checks: if approval_votes >= 5 → set is_approved=true
5. Trigger checks: if rejection_votes >= 5 OR voting_ends passed → work removed
6. Approved works appear in gallery rooms
```

---

## Kinship Calculation

Kinship is computed two ways:
- **Local** (GALERIE backend): pixel/metadata similarity between artworks in `artworks.features` vector
- **PIGMENT** (external): POST /v1/kinship → returns parents, siblings, children, cousins, similar from their cross-user genome database

Results stored in `kinship` table as pairwise scores. KinshipMap.jsx visualises as a force-directed graph.

---

## Frontend Pages

| Page | Route | Purpose |
|---|---|---|
| Foyer | `/` | Landing, featured works |
| Room | `/room/:id` | Gallery grid for a room |
| Focus | `/artwork/:id` | Single artwork, evolution, kinship |
| Upload | `/upload` | Submit work to voting |
| Voting | `/voting` | Community approval queue |
| KinshipMap | `/kinship/:id` | Force graph of related works |
| ArtistProfile | `/artist/:username` | Portfolio + works |
| Library | `/library` | Articles index |
| ReadArticle | `/article/:id` | Single article |
| WriteArticle | `/write` | Article editor |
| SearchDesk | `/search` | Full-text search |
| CreateExhibition | `/exhibitions/new` | Curate exhibition |
| MySubmissions | `/my-submissions` | Own works + voting status |
| Login / Signup | `/login`, `/signup` | Auth |
| EditProfile | `/profile/edit` | Profile settings |

---

## Security Model

- **RLS everywhere**: No table is publicly writable without auth
- **Rate limiting**: General (200/15min), auth (20/15min), uploads (10/15min)
- **Helmet**: Security headers on all Express responses
- **Sandboxed iframes**: HTML artworks run in `sandbox="allow-scripts"` — no parent DOM access
- **File type allowlist**: Only `html`, `htm`, `js`, `png`, `jpg`, `jpeg`, `gif` accepted
- **Ticket system**: Voting costs tickets, preventing spam
- **One vote per user**: Enforced at DB level by unique constraint + RLS
