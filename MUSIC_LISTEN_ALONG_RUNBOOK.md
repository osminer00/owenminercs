# Music Listen-Along Runbook

Last verified: 2026-09-07

## Purpose

`Music/music.html` polls Spotify for the currently playing track and accepts song suggestions into Upstash Redis. The page does **not** stream audio; it links out to Spotify (Jam URL when configured, otherwise the track URL).

Keep this document in sync with:

- `Music/music.html` — UI
- `scripts/music-listen-along.js` — client
- `functions/api/spotify-now-playing.js` and `functions/api/music-suggestions.js`
- `netlify/functions/spotify-now-playing.js` and `netlify/functions/music-suggestions.js`
- `_redirects` — public URL parking

## Public routing (important)

On current `main`, pretty and html Music URLs **301 to home**:

```text
/music, /music.html, /Music/music, /Music/music.html  →  /
```

The listen-along page is therefore not on the public nav. Direct file preview still works locally if you open `Music/music.html` without those redirects. Do not tell visitors `/music` is live until those `_redirects` lines are removed.

## Client behavior

`scripts/music-listen-along.js` only calls Cloudflare paths:

- `GET /api/spotify-now-playing` every 15 seconds
- `GET /api/music-suggestions?limit=15`
- `POST /api/music-suggestions`

There is no `/.netlify/functions/…` fallback in this client (unlike older Twitch donator code). `_redirects` still maps Netlify-style URLs to `/api/:splat` if something else calls them.

Now-playing UI:

- Idle Spotify (`204` from Spotify) renders “Nothing is playing right now”.
- Listen button uses `jamUrl` (`SPOTIFY_JAM_URL`) when set, else `spotifyUrl`, else `https://open.spotify.com/`.
- The site never plays the track itself.

Suggestions:

- Required: `songTitle`, `artistName`. Optional: `viewerName` (defaults to `Anonymous`), `note`.
- Hidden honeypot field `website` — any value is rejected as `Invalid submission.`
- Length caps (server): title/artist 120, viewer 60, note 220.

## Now playing API

`GET /api/spotify-now-playing` — no-store JSON.

Required env:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REFRESH_TOKEN`

Optional:

- `SPOTIFY_MARKET` — appended as `?market=` on the currently-playing request
- `SPOTIFY_JAM_URL` — copied onto the JSON as `jamUrl`

Uses Spotify refresh-token grant, then `GET https://api.spotify.com/v1/me/player/currently-playing`. Missing env or token failure → 500. Spotify API error → 502. Non-GET → 405.

## Suggestions API

`GET /api/music-suggestions?limit=` — default 20, max 50.

`POST /api/music-suggestions` JSON body:

```json
{
  "songTitle": "Midnight City",
  "artistName": "M83",
  "viewerName": "Anonymous",
  "note": "queue music",
  "website": ""
}
```

Rate limit: one successful POST per client IP per **20 seconds**. IP is `cf-connecting-ip`, else first `x-forwarded-for`, else `x-real-ip`, else `unknown`, then SHA-256 hex truncated to 24 chars. Redis key `music:suggestions:rate:<hash>` (`SET NX EX 20`). `429` if the key already exists.

Storage: Upstash list `music:suggestions:list` (`LPUSH` + `LTRIM` to 250). Needs `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (same helpers as Twitch: `functions/api/_twitch-utils.js` `upstashCommand`).

## Pitfalls

- Public `/music` is parked. Testing the page on production requires either removing the redirects or hitting the Functions directly.
- Dual function trees: edit Pages and Netlify copies together.
- Refresh token must be a user token that can read currently-playing. App-only client credentials will not work.
- Honeypot: do not rename `website` without updating both the form and `validateSuggestion()`.
- Rate-limit key uses hashed IP, not a cookie. Shared NAT can 429 legitimate users.

## Checks

```text
GET /api/spotify-now-playing
GET /api/music-suggestions?limit=5
```

Expect JSON. HTML from those URLs means Pages Functions are not serving `/api/*`. Confirm `_redirects` before linking the Music page from nav or sitemap.
