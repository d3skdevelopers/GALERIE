# GALERIE × PIGMENT Integration

PIGMENT is an evolutionary AI engine developed by a separate team. This document covers the technical integration, data flows, and operational agreement between the two platforms.

---

## What PIGMENT Does

PIGMENT takes visual art and converts it into a polygon genome — a plain-text `.pg` file describing a set of translucent colored polygons that approximate the image. It then evolves that genome using a genetic algorithm, measuring fitness against the original using a Sobel edge-detection function (30% color accuracy + 70% edge accuracy).

Artists can direct evolution with natural-language prompts (`glitch`, `organic`, `void`) which adjust mutation rate and operator weights.

---

## The `.pg` Genome Format

```
-- PIGMENT Genome v6.0.0
-- @fitness 82.4
-- @generation 1247

canvas {
  width: 400
  height: 400
}

palette {
  c0: #c8ff00
  c1: #0a0a0a
  c2: #3355ff
}

layer evolved {
  zone poly_0 {
    color: palette.c0
    opacity: 0.72
    points: 120,140 180,120 160,200 130,210
  }
  zone poly_1 {
    color: palette.c1
    opacity: 0.45
    points: 50,80 200,90 190,150
  }
}
```

Genome files can be parsed and rendered entirely locally using `src/lib/pigment-local.js` — no API key required.

---

## Fitness Phases

Fitness scores map directly to PIGMENT's internal strategy phases:

| Score | Phase | What it means | GALERIE label |
|---|---|---|---|
| 0–30 | `explore` | Random noise, coarse seeding | nascent |
| 30–60 | `refine` | Recognizable structure emerging | emerging |
| 60–80 | `polish` | Detail refinement | developing |
| 80–95 | `polish` | High fidelity | strong |
| 95–100 | `polish` | Near-perfect reconstruction | exceptional |

---

## Evolution Operators

PIGMENT uses nine mutation operators, weighted differently per phase:

| Operator | What it does |
|---|---|
| `scale` | Resize a polygon around its centroid |
| `translate` | Move a polygon |
| `color` | Shift R, G, or B channel |
| `opacity` | Adjust polygon alpha |
| `rotate` | Rotate polygon vertices around centroid |
| `reshape` | Move a single vertex |
| `spawn` | Create a new polygon near the highest-error region |
| `merge` | Average colors of two polygons |
| `intelligent` | Find worst-matching polygon, mutate it specifically |

GALERIE logs which operator was used in each evolution via training data sent to `/v1/training`.

---

## GALERIE API Calls to PIGMENT

### On Upload
```javascript
// 1. Convert HTML to genome (server-side render — no captureFrame needed)
POST /v1/convert/html-to-pg
Body: { html, width: 400, height: 400, polygons: 100, extract_features: true }
Response: { genome, features, preview, polygons, width, height, fitness }

// 2. Register work in PIGMENT's database
POST /v1/works
Body: { title, content: genome, features, tags: ['galerie'], metadata: { galerie_id, original_url } }
Response: { id, title, style, fitness, features, created_at }
```

### On Evolution
```javascript
// 3. Queue evolution job
POST /v1/evolve
Body: { work_id: pigment_work_id, steps: 500, mutation_rate: 1.0, return_html: true }
Response: { job_id, status }

// 4. Stream progress via WebSocket
wss://pigment-ai-server.onrender.com/ws/{userId}
// Events: evolution_tick, evolution_done, kinship_update, fitness_milestone

// 5. Send training data
POST /v1/training
Body: [{ operator_used, mutation_success, offspring_fitness, generation, metadata }]
```

### On Focus Page Load
```javascript
// 6. Fetch ancestry lineage
GET /v1/ancestry/{pigment_work_id}
Response: { lineage: [...], fitness_history: [...] }
```

---

## Data Stored in GALERIE's Database

PIGMENT-related columns on the `artworks` table:

| Column | Type | Source |
|---|---|---|
| `pigment_work_id` | text | PIGMENT `/v1/works` response |
| `pigment_job_id` | text | PIGMENT `/v1/evolve` response |
| `genome` | text | PIGMENT `/v1/convert` response |
| `features` | numeric[] | PIGMENT `/v1/convert` response |
| `preview_url` | text | Stored from PIGMENT preview base64 |
| `pigment_fitness` | numeric | PIGMENT fitness score |
| `pigment_style` | text | `glitch`, `organic`, `void` etc. |
| `generation` | int | 0 = original, 1+ = evolved |
| `parent_id` | uuid | References `artworks.id` |
| `is_evolved` | boolean | True if created via evolution |
| `evolved_at` | timestamptz | When evolution completed |

---

## Local Rendering Fallback

If PIGMENT's API is unavailable or a preview hasn't been generated yet, GALERIE renders the genome locally using `src/lib/pigment-local.js`:

```javascript
import { parseGenome, renderGenomeToCanvas } from '../lib/pigment-local';

// In a React component:
const canvas = document.createElement('canvas');
renderGenomeToCanvas(parseGenome(artwork.genome), canvas, 400, 400);
```

This produces a pixel-identical render to what PIGMENT's server would generate, since the renderer is extracted from PIGMENT's v6 engine source.

---

## Attribution

Every artwork created through evolution must display:

```
⚡ evolved with PIGMENT
```

Linked to `https://pigment-org.github.io`. This is implemented in `EvolveButton.jsx` and `Focus.jsx`.

---

## Data Ownership

| Asset | Owner | Notes |
|---|---|---|
| Original HTML artwork | Artist | Stored in Supabase Storage |
| Genome (`.pg` file) | GALERIE / Artist | Derived from artist's work; stored in DB |
| Feature vector | GALERIE / PIGMENT | Shared for kinship computation |
| Evolved HTML | Artist | Created from their genome; stored in Supabase |
| Cross-user training data | PIGMENT | Aggregated, anonymized operator stats |
| PIGMENT model weights | PIGMENT | Proprietary |

Training data sent to PIGMENT (`/v1/training`) is:
- Operator name, success boolean, offspring fitness, generation count
- GALERIE metadata: artwork ID, artist username handle, style tag
- No PII, no email addresses, no IP addresses

---

## What Happens If PIGMENT Goes Down

| Feature | Degradation |
|---|---|
| Upload | Works — PIGMENT conversion is non-fatal |
| Gallery display | Works — preview_url already stored |
| Local genome preview | Works — `pigment-local.js` renders from DB |
| Evolution | Unavailable — EvolveButton shows error state |
| Kinship (GALERIE) | Works — local kinship DB still serves |
| Kinship (PIGMENT) | Unavailable — ancestry/family tree empty |

The platform remains fully functional for viewing, voting, and article writing if PIGMENT is offline.

---

## PIGMENT API Credentials

| Key | Value |
|---|---|
| Base URL | `https://pigment-api.onrender.com` |
| WebSocket | `wss://pigment-ai-server.onrender.com` |
| API Key header | `X-API-Key` |
| GALERIE plan | Unlimited requests, works, evolutions, training |

The API key is stored as `VITE_PIGMENT_API_KEY` in the frontend environment. It is a shared key for the GALERIE integration — not per-user.
