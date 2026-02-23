# Changelog

All notable changes to GALERIE are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [0.3.0] — 2026-02-21

### Added — PIGMENT AI Integration
- `src/lib/pigment.js` — Complete PIGMENT API client (20 exported functions covering all endpoints)
- `src/lib/pigment-local.js` — Local genome parser and renderer extracted from PIGMENT v6 engine
- `components/EvolveButton.jsx` — Evolution UI with WebSocket progress, polling fallback, and post-evolution artwork storage
- `database/07_pigment_columns.sql` — Adds genome, features, pigment_work_id, pigment_fitness, generation, parent_id, is_evolved, evolved_at to artworks table
- Genome-to-canvas local rendering in Focus page and Room gallery (fallback when preview_url absent)
- Fitness phase display (`explore` / `refine` / `polish`) on Focus page
- Polygon count display on Focus page metadata
- Lineage dot-track visualisation on Focus page
- Evolved children list on Focus page
- PIGMENT attribution (`⚡ evolved with PIGMENT`) on all evolved works
- `GenomeThumb` component in Room.jsx for gallery grid previews

### Changed — Upload Flow
- Upload now calls `/v1/convert/html-to-pg` after Supabase storage upload
- HTML source sent directly to PIGMENT (server-side render, no captureFrame needed)
- Genome + features + preview stored alongside original file
- PIGMENT work registered via `/v1/works` immediately after upload
- 4-step progress indicator added to Upload UI

### Changed — Focus Page
- Shows fitness meter bar (30% color + 70% edge score)
- Shows fitness badge overlaid on artwork canvas
- Shows evolution/generation badge on evolved works
- Loads PIGMENT ancestry non-blocking after main render
- Ancestry displays fitness history with operator labels

### Changed — Room Gallery
- Artwork cards now prefer `preview_url` over `file_url` for display
- HTML artworks without preview fallback to local genome render
- PIGMENT fitness badge on evolved works in gallery grid
- Supabase query extended to include `preview_url`, `genome`, `pigment_fitness`, `is_evolved`

### Changed — Fitness Labels
- Thresholds recalibrated to match PIGMENT's actual engine phases:
  - 0–30: nascent (was 0–20)
  - 30–60: emerging (was 20–40)
  - 60–80: developing (was 40–60)
  - 80–95: strong (was 60–80)
  - 95–100: exceptional (was 80–100)
- New `fitnessPhase()` export returns raw phase name (`explore`/`refine`/`polish`)

### Environment
- Three PIGMENT env vars added to `frontend/.env`:
  - `VITE_PIGMENT_API_URL`
  - `VITE_PIGMENT_WS_URL`
  - `VITE_PIGMENT_API_KEY`

---

## [0.2.0] — 2026-02-17

### Added
- Full codebase: 30+ files, 15 pages, 9 DB tables
- Authentication (signup, signin, session management)
- Artwork upload to Supabase Storage
- Community voting system (approve/reject, ticket-based)
- Gallery rooms with approved artwork display
- Kinship mapping (feature vector similarity)
- Articles and push (boost) system
- Exhibitions (curated groupings)
- Artist profiles
- Full-text search across artworks, profiles, articles
- KinshipMap force-directed graph visualisation
- Living HTML artwork support (sandboxed iframes)
- Row Level Security on all tables
- Rate limiting (general, auth, upload)
- Security headers (Helmet)

### Fixed
- Voting infinite loop in Voting.jsx
- Auth token handling (centralised `getAuthToken()`)
- Kinship algorithm implementation
- Search functionality
- File uploads (multipart + content-type boundary)
- 15 pages with complete CSS

---

## [0.1.0] — 2026-02-15

### Added
- Initial project structure
- Supabase schema design
- Basic Express backend skeleton
- React + Vite frontend scaffold
