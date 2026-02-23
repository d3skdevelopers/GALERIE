# GALERIE

A digital museum for living art — HTML sketches, generative code, and image-based work submitted by artists, approved by the community, and evolved by AI.

Artists upload their work. The community votes it in or out over 7 days. Approved pieces enter permanent gallery rooms. Any work can be evolved by [PIGMENT](https://pigment-org.github.io), a genetic algorithm engine that mutates polygon genomes to produce new generations of the piece.

---

## What It Is

- **Community-curated gallery** — 5 approval votes admits a work; 5 rejections removes it from voting
- **Living HTML support** — generative code runs natively in sandboxed iframes, not as screenshots
- **PIGMENT evolution** — uploaded HTML is converted to a `.pg` genome; artists can evolve it into child works
- **Kinship mapping** — artworks are linked by visual similarity; family trees form across the collection
- **Articles & criticism** — members write long-form pieces about works; readers push articles to boost them
- **Exhibition spaces** — curated groupings of approved works around a theme

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + React Router |
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Storage | Supabase Storage (artworks bucket) |
| Auth | Supabase Auth (email/password + magic link) |
| AI Evolution | PIGMENT API (`pigment-api.onrender.com`) |
| Deployment | Vercel (backend) + Vercel (frontend) |

---

## Repository Structure

```
galerie/
├── frontend/               React/Vite app
│   ├── src/
│   │   ├── pages/          15 page components
│   │   ├── components/     Shared components (Navigation, EvolveButton)
│   │   └── lib/            API clients (supabase.js, api.js, pigment.js, pigment-local.js)
│   └── .env                Frontend environment variables
├── backend/                Express API server
│   ├── routes/             9 route modules
│   ├── server.js           App entry point
│   └── .env                Backend environment variables
├── database/               SQL migration files (run in order)
│   ├── 01_schema.sql       Tables
│   ├── 02_indexes.sql      Indexes
│   ├── 03_rls.sql          Row Level Security policies
│   ├── 04_functions_triggers.sql
│   ├── 05_storage.sql      Storage buckets
│   ├── 06_seed.sql         Initial data
│   └── 07_pigment_columns.sql  PIGMENT integration columns
└── docs/                   This folder
```

---

## Quick Start

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for full setup. The short version:

```bash
# 1. Run database migrations in Supabase SQL editor (01 → 07)
# 2. Set up backend
cd backend && cp .env.example .env && npm install && node server.js
# 3. Set up frontend
cd frontend && cp .env.example .env && npm install && npm run dev
```

---

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — system design and data flow
- [API.md](docs/API.md) — all backend endpoints
- [INTEGRATION.md](docs/INTEGRATION.md) — PIGMENT AI integration
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) — running in production
- [CONTRIBUTING.md](docs/CONTRIBUTING.md) — development guide
- [CHANGELOG.md](docs/CHANGELOG.md) — version history

---

## Legal

- [Terms of Service](docs/TERMS.md)
- [Privacy Policy](docs/PRIVACY.md)
- [DMCA Policy](docs/DMCA.md)

---

## License

Code: [MIT License](LICENSE)  
Documentation and assets: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

Artist-uploaded works remain the intellectual property of their creators.
