# Social Cloud Content + API Handoff

## Goal

Move the Social Cloud from hardcoded placeholder items to real, auto-updating social posts:

- YouTube Shorts/videos
- TikTok posts
- Instagram posts/reels/photos
- X (tweets/media posts)

Each card should only show:

1. Content media (photo/video/embed)
2. Title
3. Description
4. Post date

No API secrets can ever be exposed in the frontend (public Cloudflare Pages site).

---

## Current UI/Interaction State (Already Built)

Social cloud behavior in `Socials/scripts/social-cloud.js` and `Socials/social-cloud.css` includes:

- Floating motion cards with pin/unpin state
- Click card to pause/pin
- Top-left `X`-style close control to resume drift
- Drag card to reposition anywhere
- 4-corner resize handles (aspect ratio locked)
- Pinned rotate control (outside/top):
  - click = center rotation
  - drag = rotate card
- External visit links now use explicit "Visit <Platform>" link inside card
- Reduced motion path still supported

The card data source is still local/hardcoded (`socialContentItems`).

---

## Critical Security Requirement

This site is public. Treat **all client-side code as visible**.

### Must do

- Keep API keys/tokens in server-side secrets only.
- Use Cloudflare server-side components for API calls:
  - Cloudflare Worker and/or Pages Functions
  - optionally KV / D1 / R2 for cached feed data
- Frontend fetches sanitized JSON from your own endpoint only.

### Must not do

- Do not put tokens in JS, HTML, CSS, or public JSON files.
- Do not commit `.env` secrets to git, even in private repo.
- Do not call privileged provider APIs directly from browser.

---

## Target Architecture (Recommended)

### 1) Aggregator endpoint

Create a server endpoint (Worker or Pages Function), e.g.:

- `GET /api/social-feed`

Response: normalized list of card items ready for frontend rendering.

### 2) Ingestion + cache

Use scheduled ingestion (or webhook when available) to refresh a stored feed:

- fetch from platform APIs with server-side secrets
- normalize into one schema
- cache/store in KV or D1
- `social-cloud.js` fetches this single source

### 3) Frontend rendering

Replace hardcoded `socialContentItems` with fetched feed and graceful fallback.

---

## Normalized Content Schema

Use one consistent schema per card:

```json
{
  "id": "platform_unique_id",
  "platform": "youtube|tiktok|instagram|x",
  "contentType": "short|video|reel|photo|tweet",
  "title": "string",
  "description": "string",
  "publishedAt": "ISO-8601",
  "permalink": "https://...",
  "media": {
    "kind": "image|video|embed",
    "thumbnailUrl": "https://...",
    "embedUrl": "https://...",
    "aspectRatio": "16:9"
  }
}
```

Notes:

- Keep only required fields in UI: media, title, description, date.
- Preserve `permalink` for "Visit" link.

---

## Platform Reality Check (Important)

Not all platforms offer equal API access for auto-feed usage:

- **YouTube**: best supported via Data API; practical for auto updates.
- **X**: API access may require paid tier; verify limits and policy.
- **Instagram**: official access usually tied to Meta app + business/creator setup.
- **TikTok**: access depends on approved app/scopes; verify if feed endpoints are available for your account/app type.

Plan for partial rollout:

1. Ship YouTube automation first.
2. Add whichever of X/Instagram/TikTok can be legally and technically supported.
3. For unsupported platforms, keep manual fallback JSON entries.

---

## Implementation Plan For Next Agent

1. Add backend endpoint and secret configuration.
2. Implement YouTube ingestion (latest uploads/shorts -> normalized schema).
3. Add feed cache with TTL and stale fallback.
4. Update frontend to load `/api/social-feed` and render cards from response.
5. Keep current interactions (drag/resize/rotate/pin) unchanged.
6. Add platform adapters for X/Instagram/TikTok as access is confirmed.
7. Add monitoring/logging for failed ingestion jobs.

---

## Frontend Change Checklist

- Replace local `socialContentItems` constant with async fetch.
- Show loading state and fallback cards on failure.
- Keep existing card controls and accessibility labels.
- Continue using explicit "Visit <Platform>" link.

---

## Security Checklist

- Secrets only in Cloudflare environment vars (server runtime).
- API responses sanitized (no tokens, no internal IDs that should stay private).
- CORS restricted to site domain if needed.
- Rate limit backend endpoint.
- Cache third-party API results to reduce quota usage and abuse.

---

## Suggested Milestones

### Milestone 1 (fast win)

- YouTube-only auto cards (title, description, date, media thumbnail/embed)
- live on `/api/social-feed`

### Milestone 2

- Add one more platform with verified official access

### Milestone 3

- Full multi-platform automation + reliability hardening

---

## Done Criteria

- New YouTube uploads appear automatically in social cloud without manual edits.
- No API keys appear in frontend source or network payloads.
- Existing card interactions still work:
  - pin/unpin
  - drag
  - resize with locked ratio
  - rotate button click/drag
- Errors gracefully degrade to cached/manual feed.

