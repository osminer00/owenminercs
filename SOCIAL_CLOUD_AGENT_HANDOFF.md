# Social Cloud Content Feed Runbook

## Goal

Keep the Social Cloud on `Socials/socials.html` populated with verified public social posts while preserving the existing animated card interactions.

The browser renderer is `Socials/scripts/social-cloud.js`; layout and animations live in `Socials/social-cloud.css`.

---

## Current UI/Interaction State

The current card behavior includes:

- Floating motion cards with pin/unpin state
- Click card to pause/pin
- Top-left `X`-style close control to resume drift
- Drag card to reposition anywhere
- 4-corner resize handles (aspect ratio locked)
- Pinned rotate control (outside/top):
    - click = center rotation
    - drag = rotate card
- Explicit "Visit <Platform>" links inside cards
- Hashtag filters when available
- Light/full mode selection stored in `localStorage` key `smc-cloud-mode`
- Visited external links stored in `localStorage` key `smc-visited-links`
- Idle "fidget spinner" rotation after 15 minutes of no interaction
- Reduced motion path still supported

The static fallback card list is `manualSocialContentItems` in `Socials/scripts/social-cloud.js`, but production content should come from the JSON files below.

---

## Content Sources

`initializeCloud()` merges:

1. Local social JSON files from `Socials/data/`
2. Top Reddit submissions fetched client-side from the public Reddit JSON endpoint
3. `manualSocialContentItems` only when no local JSON items load

Local files loaded by `fetchLocalSocialContentItems()`:

| File                                | Producer / owner                      | Notes                                                 |
| ----------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| `Socials/data/youtube-shorts.json`  | `scripts/sync-youtube-local-feed.mjs` | Short-form YouTube cards.                             |
| `Socials/data/youtube-videos.json`  | `scripts/sync-youtube-local-feed.mjs` | Long-form YouTube cards.                              |
| `Socials/data/x-top-posts.json`     | `scripts/sync-x-top-posts.py`         | Public X media posts, ranked by likes/views/comments. |
| `Socials/data/tiktok-posts.json`    | `scripts/sync-tiktok-posts.mjs`       | Public TikTok profile videos.                         |
| `Socials/data/instagram-posts.json` | Manual/static                         | Empty array is valid.                                 |
| `Socials/data/facebook-posts.json`  | Manual/static                         | Empty array is valid.                                 |
| `Socials/data/twitch-posts.json`    | Manual/static                         | Empty array is valid.                                 |

The renderer filters candidate cards to posts with at least `101` likes/upvotes via `MIN_SOCIAL_ENGAGEMENT`.

---

## Local JSON Schema

Static source files use this compact shape before being normalized by `normalizeLocalSocialSourceItem()`:

```json
{
	"platform": "youtube",
	"contentType": "short",
	"title": "Learn this Mechanic to Stay Hidden in CS2!",
	"url": "https://www.youtube.com/shorts/ibGgdhWVHW8",
	"thumbnail": "https://i.ytimg.com/vi/ibGgdhWVHW8/hqdefault.jpg",
	"embedUrl": "",
	"caption": "Short public description or caption",
	"publishedAt": "2024-08-06T14:03:09.000Z",
	"viewCount": 16570,
	"likeCount": 543,
	"commentCount": 0,
	"mediaKind": "video",
	"aspectRatio": "9 / 16"
}
```

Constraints:

- `platform` is normalized to lowercase; `twitter` becomes `x`.
- `url` must be a public `http`/`https` permalink for the visit CTA.
- `thumbnail` should be public and hotlink-safe enough for a public static site.
- `aspectRatio` must be CSS ratio text such as `16 / 9`, `9 / 16`, or `586 / 334`.
- Keep secrets and private scrape credentials out of these files.

---

## Refresh Workflows

Run only the sync needed for the platform being updated:

```bash
node scripts/sync-youtube-local-feed.mjs
node scripts/sync-tiktok-posts.mjs
python3 scripts/sync-x-top-posts.py
```

Notes:

- YouTube and TikTok scripts shell out to `yt-dlp`, `py -m yt_dlp`, or `python -m yt_dlp`; install `yt-dlp` locally before running them.
- The X script reads the username from `scripts/components.js` when possible, pulls public RSS candidates, enriches via `api.fxtwitter.com`, and writes media posts only.
- Sync scripts overwrite their target JSON files. Review diffs before committing.
- Do not commit Python `__pycache__` files or scrape scratch files.

---

## Optional `/api/social-feed` Prototype

`functions/api/social-feed.js` exposes `GET /api/social-feed` for Cloudflare Pages-style runtimes. It currently returns YouTube-only normalized cards and is not the active browser feed source.

Behavior verified from source:

- Query parameter: `limit`, default `60`, max `200`.
- Query parameter: `refresh=1` bypasses fresh in-memory cache.
- Uses YouTube Data API when both `YOUTUBE_API_KEY` and `YOUTUBE_CHANNEL_ID` are set.
- Falls back to YouTube RSS using `YOUTUBE_CHANNEL_ID` or `YOUTUBE_USERNAME` / `YOUTUBE_HANDLE` (default `OwenMinerCS`).
- Caches successful payloads in memory for 15 minutes and can return stale cache for up to 24 hours after a refresh failure.

Normalized API response item shape:

```json
{
	"id": "youtube_ibGgdhWVHW8",
	"platform": "youtube",
	"contentType": "short",
	"title": "string up to 120 chars",
	"description": "string up to 260 chars",
	"publishedAt": "2024-08-06T14:03:09.000Z",
	"permalink": "https://www.youtube.com/watch?v=ibGgdhWVHW8",
	"media": {
		"kind": "embed",
		"thumbnailUrl": "https://...",
		"embedUrl": "https://...",
		"aspectRatio": "16:9"
	},
	"metrics": {
		"viewCount": 0,
		"likeCount": 0,
		"commentCount": 0
	},
	"isLive": false
}
```

---

## Security Requirements

This site is public. Treat all client-side code and JSON as visible.

Must do:

- Keep API keys/tokens in server-side secrets only.
- Frontend can fetch public JSON or sanitized serverless responses only.
- Sanitize API responses: no tokens, no private IDs, no dashboard URLs.

Must not do:

- Do not put tokens in JS, HTML, CSS, or public JSON files.
- Do not commit `.env` secrets.
- Do not call privileged provider APIs directly from the browser.

---

## Troubleshooting

- **Only hardcoded cards appear:** one or more `Socials/data/*.json` files failed to load or all were empty. Check browser network requests and JSON validity.
- **Cards disappear after sync:** confirm posts meet the `101` engagement threshold and include a usable `url`.
- **Portrait videos crop oddly:** provide a correct `aspectRatio`; TikTok and YouTube shorts should normally use `9 / 16`.
- **Reddit videos do not play:** the renderer avoids HLS/DASH streams in plain `<video>` and falls back to Reddit embed URLs when possible.
- **Low-end devices show fewer cards:** slow connections, Save-Data, reduced motion, or low hardware/memory switch to light mode automatically unless the user stored full mode.

---

## Change Checklist

- Update the relevant JSON source or sync script.
- Re-run the relevant sync command when source data changes.
- Verify `Socials/socials.html` loads local JSON over HTTP.
- Preserve existing interactions: pin/unpin, drag, resize, rotate, hashtag filters, and visit links.
- Check mobile/reduced-motion behavior when editing animation or card count logic.
