# Pages Functions Runbook

Last verified: 2026-08-24

## Purpose

Production APIs run as **Cloudflare Pages Functions** under `functions/api/`. A **Netlify-shaped twin** lives in `netlify/functions/` for legacy local/path compatibility. Live hosting is GitHub + Cloudflare, not Netlify deploys.

Keep this document in sync with:

- `functions/api/*.js` — canonical Pages Functions (`onRequest` / `onRequestGet` / `onRequestPost`)
- `netlify/functions/*.js` — twins (often `exports.handler`); **not a complete mirror**
- `_redirects` — `/.netlify/functions/:splat` → `/api/:splat` (200)
- Consumers: `scripts/cs2-skins.js`, `scripts/ai-assistant.js`, `scripts/music-listen-along.js`, `QA/scripts/qa-feed.js`

## Intent

Cloudflare Pages maps `functions/api/{name}.js` to `https://www.owenminercs.com/api/{name}`. Clients should call `/api/…`. The `_redirects` rewrite exists so leftover `/.netlify/functions/…` URLs still hit the same Cloudflare handlers.

If `/api/twitch-health` (or any `/api/*`) returns HTML instead of JSON, Pages Functions are not in the deploy.

## Endpoint map

Canonical files are in `functions/api/`. Unless noted, a Netlify twin exists.

| Route | Methods | Twin? | Role |
| --- | --- | --- | --- |
| `/api/twitch-health` | GET | yes | Env presence + Upstash PING + Twitch app-token check (no secret values) |
| `/api/twitch-feed` | GET | yes | Read Redis events/totals for donator activity |
| `/api/twitch-eventsub` | POST | yes | Twitch webhook verify + persist |
| `/api/twitch-register-eventsub` | POST | yes | Create EventSub subscriptions (auth required) |
| `/api/steam-cs2-inventory` | GET | yes | Public CS2 inventory + capped market prices |
| `/api/discord-qa` | GET | yes | Mirror Discord Q&A; empty `items` if bot env unset |
| `/api/live-status` | GET | yes | Manual override → Twitch Helix → YouTube live search |
| `/api/spotify-now-playing` | GET | yes | Spotify currently-playing via refresh token |
| `/api/music-suggestions` | GET, POST | yes | Upstash-backed song suggestions (`music:suggestions:list`) |
| `/api/site-assistant` | POST | yes | OpenAI chat with optional knowledge blob |
| `/api/social-feed` | GET | **no** | YouTube Data API or RSS; **Pages Function only** |

Also present but not a Pages Function: `functions/amazon-price.js` (Node PA-API helper, not an `/api/` route).

## Env vars (names only)

Set these on the Cloudflare Pages project. Never commit values.

**Twitch EventSub / health / feed:** `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_EVENTSUB_SECRET`, `TWITCH_BROADCASTER_ID`, `PUBLIC_SITE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. Register auth also accepts `TWITCH_REGISTER_SECRET` (falls back to `TWITCH_EVENTSUB_SECRET`). Optional: `TWITCH_CHANNEL_LOGIN`.

**Live status:** Twitch vars above plus optional `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID`, `LIVE_OVERRIDE_IS_LIVE`, `LIVE_OVERRIDE_PLATFORM`, `LIVE_OVERRIDE_URL`. Offline fallback URL is `https://x.com/OwenMiner`.

**Discord Q&A:** `DISCORD_BOT_TOKEN`. Optional: `DISCORD_GUILD_ID`, `DISCORD_QA_TEXT_CHANNEL_ID`, `DISCORD_QA_TEXT_CHANNEL_NAME` (default `#questions-and-answers`), `DISCORD_QA_FORUM_CHANNEL_ID`. `QA/scripts/qa-feed.js` skips the live API on localhost and always merges `QA/answered-qa.json`.

**Spotify / music:** `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`; suggestions also need Upstash.

**Assistant:** `OPENAI_API_KEY`, optional `OPENAI_MODEL` (default `gpt-4.1-mini`). Body/history/knowledge are capped in source.

**Social feed:** optional `YOUTUBE_API_KEY` + `YOUTUBE_CHANNEL_ID`; otherwise RSS via channel id or `YOUTUBE_USERNAME` / `YOUTUBE_HANDLE` (default `OwenMinerCS`).

**Steam inventory:** no secrets; public Community endpoints only.

## Dual-path rule

When changing an API that has a twin, edit **both** trees in the same change. Handler shapes differ (ESM `onRequest*` vs Netlify `handler`), but auth, caps, and Redis key names must stay aligned.

`social-feed.js` has no Netlify file. Social Cloud currently reads committed JSON under `Socials/data/` (`social-cloud.js`), not `/api/social-feed`. Treat the function as an unused/optional live YouTube path unless a client is wired.

`/api/live-status` also has **no in-repo HTML/JS caller** as of this verification. It is still a public GET if Functions are deployed.

## Pitfalls

- Check both `functions/api/` and `netlify/functions/` before changing behavior (`memory/issues.md`).
- `PUBLIC_SITE_URL` must be the live origin; EventSub callback is `{PUBLIC_SITE_URL}/api/twitch-eventsub`.
- Donator page **does not currently fetch** `/api/twitch-feed` (frontend paused). Backend can be healthy while the UI shows the pause message. See `TWITCH_DONATOR_HANDOFF.md`.
- Music/assistant pages redirect to `/` in `_redirects`; those clients may only matter on unpublished or local HTML.
