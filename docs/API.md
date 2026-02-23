# GALERIE API Reference

Base URL: `https://galerie-backend-theta.vercel.app`  
All authenticated endpoints require: `Authorization: Bearer <supabase_access_token>`

---

## Authentication — `/api/auth`

### `POST /api/auth/signup`
Create a new account.

**Body**
```json
{ "email": "artist@example.com", "password": "••••••••", "username": "goya" }
```

**Response** `201`
```json
{ "user": { "id": "uuid", "email": "..." }, "session": { "access_token": "...", "refresh_token": "..." } }
```

---

### `POST /api/auth/signin`
Sign in with email and password.

**Body**
```json
{ "email": "artist@example.com", "password": "••••••••" }
```

**Response** `200`
```json
{ "user": { ... }, "session": { "access_token": "...", "refresh_token": "..." } }
```

---

### `GET /api/auth/me` 🔒
Get the current user's profile.

**Response** `200`
```json
{
  "id": "uuid",
  "username": "goya",
  "full_name": "Francisco Goya",
  "avatar_url": "https://...",
  "bio": "...",
  "voting_tickets": 12
}
```

---

### `POST /api/auth/refresh-tickets` 🔒
Refresh the user's voting ticket allowance (rate limited).

**Response** `200`
```json
{ "tickets": 10 }
```

---

## Artworks — `/api/artworks`

### `GET /api/artworks`
List approved artworks. Supports pagination and room filtering.

**Query params**
| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | int | 20 | Results per page |
| `offset` | int | 0 | Pagination offset |
| `room_id` | uuid | — | Filter by room |

**Response** `200`
```json
[
  {
    "id": "uuid",
    "title": "The Final Wood",
    "file_url": "https://...",
    "file_type": "html",
    "preview_url": "https://...",
    "pigment_fitness": 82.4,
    "is_evolved": false,
    "generation": 0,
    "profiles": { "username": "goya" }
  }
]
```

---

### `GET /api/artworks/:id`
Get a single artwork by ID.

**Response** `200` — full artwork object including genome, features, kinship count.

---

### `POST /api/artworks` 🔒
Upload a new artwork. Multipart form data.

**Body** (form-data)
| Field | Type | Required |
|---|---|---|
| `file` | File | ✓ |
| `title` | string | ✓ |
| `description` | string | — |
| `year` | int | — |
| `medium` | string | — |
| `room_id` | uuid | — |

**Response** `201`
```json
{ "id": "uuid", "title": "...", "file_url": "https://...", "voting_ends": "2026-03-01T..." }
```

---

### `PUT /api/artworks/:id/transfer` 🔒
Transfer ownership of an artwork to another user.

**Body**
```json
{ "new_owner_id": "uuid" }
```

**Response** `200`
```json
{ "id": "uuid", "owned_by": "new-uuid" }
```

---

## Votes — `/api/votes`

### `GET /api/votes/pending`
List artworks currently in the voting queue (not yet approved, not expired).

**Response** `200` — array of artwork objects with current vote counts.

---

### `POST /api/votes` 🔒
Cast a vote on an artwork in the queue.

**Body**
```json
{ "artwork_id": "uuid", "vote_type": "approve" }
```
`vote_type`: `"approve"` or `"reject"`

**Response** `201`
```json
{ "id": "uuid", "artwork_id": "uuid", "vote_type": "approve" }
```

**Errors**
- `409` — already voted on this artwork
- `403` — not enough voting tickets
- `404` — artwork not in voting queue

---

### `GET /api/votes/my-votes` 🔒
Get the current user's vote history.

**Response** `200`
```json
[{ "artwork_id": "uuid", "vote_type": "approve", "created_at": "..." }]
```

---

## Rooms — `/api/rooms`

### `GET /api/rooms`
List all gallery rooms.

**Response** `200`
```json
[{ "id": "uuid", "name": "Room I", "description": "...", "space_id": "uuid" }]
```

---

### `GET /api/rooms/:id`
Get a room and its approved artworks.

**Response** `200`
```json
{
  "id": "uuid",
  "name": "Room I",
  "artworks": [ { "id": "uuid", "title": "...", "preview_url": "...", ... } ]
}
```

---

### `POST /api/rooms` 🔒
Create a new room (admin only).

**Body**
```json
{ "name": "Room IV", "description": "...", "space_id": "uuid" }
```

**Response** `201`
```json
{ "id": "uuid", "name": "Room IV" }
```

---

## Kinship — `/api/kinship`

### `GET /api/kinship/:artworkId`
Get kinship relationships for an artwork (pre-calculated).

**Response** `200`
```json
[
  {
    "artwork_b_id": "uuid",
    "similarity_score": 0.87,
    "artwork_b": { "id": "uuid", "title": "...", "profiles": { "username": "..." } }
  }
]
```

---

### `POST /api/kinship/calculate/:artworkId` 🔒
Trigger kinship recalculation for an artwork. Compares feature vectors against all approved works.

**Response** `200`
```json
{ "calculated": 14, "inserted": 8 }
```

---

## Search — `/api/search`

### `GET /api/search`
Full-text search across artworks, profiles, and articles.

**Query params**
| Param | Type | Required |
|---|---|---|
| `q` | string | ✓ |
| `type` | `artworks\|profiles\|articles` | — |
| `limit` | int | — |

**Response** `200`
```json
{
  "artworks": [ { "id": "uuid", "title": "...", "rank": 0.9 } ],
  "profiles": [ { "username": "...", "full_name": "..." } ],
  "articles": [ { "id": "uuid", "title": "..." } ]
}
```

---

### `POST /api/search` (image search)
Search by image similarity. Multipart form data.

**Body** (form-data)
| Field | Type |
|---|---|
| `file` | Image file |
| `limit` | int |

**Response** `200` — ranked list of similar artworks by feature vector distance.

---

## Articles — `/api/articles`

### `GET /api/articles/featured`
Get featured articles (highest push count).

### `GET /api/articles/recent`
Get recently published articles.

### `GET /api/articles/artwork/:artworkId`
Get articles that mention a specific artwork.

### `GET /api/articles/author/:userId`
Get articles by a specific author.

### `GET /api/articles/:id`
Get a single article.

### `POST /api/articles` 🔒
Publish a new article.

**Body**
```json
{
  "title": "The Geometry of Goya",
  "content": "...",
  "artwork_ids": ["uuid-1", "uuid-2"]
}
```

### `PUT /api/articles/:id` 🔒
Update an article (author only).

### `DELETE /api/articles/:id` 🔒
Delete an article (author only).

---

## Pushes — `/api/pushes`

### `POST /api/pushes/article/:articleId` 🔒
Push (boost) an article. One push per user per article.

**Response** `201`
```json
{ "article_id": "uuid", "push_count": 7 }
```

**Error** `409` — already pushed this article.

### `GET /api/pushes/my-pushes` 🔒
List articles the current user has pushed.

---

## Exhibitions — `/api/exhibitions`

### `GET /api/exhibitions`
List all exhibitions.

### `GET /api/exhibitions/:id`
Get an exhibition and its artworks.

### `POST /api/exhibitions` 🔒
Create an exhibition.

**Body**
```json
{
  "title": "Structures of Forgetting",
  "description": "...",
  "artwork_ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Response** `201`
```json
{ "id": "uuid", "title": "...", "artwork_ids": [...] }
```

---

## Error Format

All errors return:
```json
{ "error": "Human-readable message" }
```

| Code | Meaning |
|---|---|
| `400` | Bad request / missing fields |
| `401` | Not authenticated |
| `403` | Forbidden (wrong user / no tickets) |
| `404` | Resource not found |
| `409` | Conflict (duplicate vote, push, etc.) |
| `429` | Rate limit exceeded |
| `500` | Server error |

---

## Rate Limits

| Endpoint group | Limit |
|---|---|
| All `/api/*` | 200 requests / 15 min |
| `/api/auth/*` | 20 requests / 15 min |
| `/api/artworks` (POST) | 10 requests / 15 min |
