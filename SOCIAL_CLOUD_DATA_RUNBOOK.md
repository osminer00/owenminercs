# Social Cloud Data Runbook

Last verified: 2026-09-07

## Purpose

The Content page (`Socials/socials.html`, nav label **Content**) renders the social cloud from **committed JSON** plus a **live Reddit fetch**. It does **not** call `GET /api/social-feed`.

Older handoffs (`SOCIAL_CLOUD_AGENT_HANDOFF.md`, `YOUTUBE_LOCAL_AUTOFILL_HANDOFF.md`) still describe a planned aggregator. Trust this runbook and `Socials/scripts/social-cloud.js` for current behavior.

## Architecture

```text
Socials/data/*.json  ─┐
                      ├─ fetchLocalSocialContentItems()
Reddit public JSON  ──┤
                      └─ initializeCloud() → cards (engagement ≥ 101)
```

If every local JSON array is empty, the cloud falls back to in-file `manualSocialContentItems`. Local data wins when any local item exists (Reddit results are still merged in).

## Local JSON (git)

Loaded from site-root paths:

| File | Typical producer |
| --- | --- |
| `Socials/data/youtube-shorts.json` | `node scripts/sync-youtube-local-feed.mjs` (`yt-dlp`, `@OwenMinerCS`, skips livestream-like entries, max 150 shorts / 100 videos) |
| `Socials/data/youtube-videos.json` | same script |
| `Socials/data/x-top-posts.json` | `python scripts/sync-x-top-posts.py` (Nitter RSS + `api.fxtwitter.com`, username from first `https://x.com/…` in `scripts/components.js`, currently `@OwenMiner`, writes **at most 20** items) |
| `Socials/data/tiktok-posts.json` | `node scripts/sync-tiktok-posts.mjs` (`yt-dlp`, `https://www.tiktok.com/@owenminercs`) |
| `Socials/data/instagram-posts.json` | manual / other tooling (no in-repo sync script) |
| `Socials/data/facebook-posts.json` | same |
| `Socials/data/twitch-posts.json` | same |

Item shape expected by `normalizeLocalSocialSourceItem()`:

```json
{
  "platform": "youtube",
  "contentType": "short",
  "title": "…",
  "url": "https://www.youtube.com/shorts/…",
  "thumbnail": "https://i.ytimg.com/vi/…/hqdefault.jpg",
  "caption": "…",
  "publishedAt": "2026-01-01T00:00:00.000Z",
  "viewCount": 0,
  "likeCount": 0,
  "commentCount": 0,
  "embedUrl": "",
  "mediaKind": "video",
  "aspectRatio": "9 / 16"
}
```

## Reddit (browser, no secret)

`fetchRedditTopContentItems()`:

1. Username from a page `reddit.com/user/` or `/u/` link, else JSON-LD, else `https://www.reddit.com/user/OwenMCS`.
2. `GET https://www.reddit.com/user/<name>/submitted.json?limit=100&sort=top&t=all&raw_json=1`
3. Map to cloud items (video / gallery / image / post). Failures return `[]` (adblock, 403, CORS).

Shared social dock Reddit URL is `https://www.reddit.com/user/OwenMCS` (`socialNavMarkup` in `scripts/components.js`).

## Engagement filter

`MIN_SOCIAL_ENGAGEMENT = 101`. Cards need likes (or Reddit upvotes) ≥ 101. This matches `memory/preferences.md` (posts at/over 100 likes; the code uses `>= 101`).

Idle fidget: after 15 minutes with no interaction, cards spin until the next interaction (`SOCIAL_CARD_IDLE_SPIN_MS`). Date + stats stay on one row (see preferences).

## `/api/social-feed` (unused by this UI)

Pages Function only — **no** `netlify/functions/social-feed.js`.

- YouTube-only aggregator: Data API when `YOUTUBE_API_KEY` + `YOUTUBE_CHANNEL_ID` work, else RSS (`YOUTUBE_USERNAME` / `YOUTUBE_HANDLE` / default `OwenMinerCS`).
- In-memory cache 15 minutes; stale serve up to 24 hours after a failed refresh; `?refresh=1` bypasses the fresh cache.
- Default `limit` 60, max 200.

Do not assume Content cards come from this endpoint. Changing the cloud data still means updating `Socials/data/` (or the Reddit mapping), not this Function, until a client is wired.

## Related unused live endpoint

`GET /api/live-status` (Pages + Netlify twins) checks manual override, then Twitch Helix, then YouTube search `eventType=live`. Fallback URL is `https://x.com/OwenMiner`. **No in-repo HTML/JS fetches it.** Env names: `LIVE_OVERRIDE_IS_LIVE`, `LIVE_OVERRIDE_PLATFORM`, `LIVE_OVERRIDE_URL`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_BROADCASTER_ID`, `TWITCH_CHANNEL_LOGIN`, `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID`.

## X sync pitfall

`scripts/sync-x-top-posts.py` **always overwrites** `Socials/data/x-top-posts.json`, including with `[]` if Nitter/FxTwitter return nothing. Review the diff before committing. Username is parsed from `scripts/components.js` (`https://x.com/OwenMiner`), not from a CLI flag.

## Checks

1. Open `/Socials/socials` and confirm cards load without a network call to `/api/social-feed`.
2. After a YouTube sync, confirm `youtube-shorts.json` / `youtube-videos.json` are non-empty arrays and livestream titles were filtered.
3. After an X sync, confirm the file is not an empty array unless that is intentional.
4. Reddit: disable extensions that block `reddit.com` if those cards are missing.
