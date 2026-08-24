# Twitch Activity Setup Handoff (Donator Page)

Last verified: 2026-08-24

## Goal

Finish wiring real Twitch activity into the donor/support page so `Recent Twitch activity` shows live follows/subs/gift subs/bits from EventSub, and follower totals update correctly (Cloudflare Pages deploy path).

Related: `PAGES_FUNCTIONS_RUNBOOK.md` (dual `functions/api/` vs `netlify/functions/` paths).

## Current State (already implemented)

- Donator page UI exists in `Donators/donators.html`.
- Static supporter data lives in `Donators/donators.json`. `scripts/donators.js` still **merges** a Twitch feed when one is passed in (`buildSupportEvents`, follower fallback from `totals.follows_total`).
- **Frontend live fetch is paused.** `fetchTwitchFeed()` returns `Promise.resolve(null)`. `renderActivity()` always shows “Twitch activity is paused for now.” and Ko-fi / StreamElements-only copy. Do not assume the page polls `/api/twitch-feed` until that stub is restored.
- Cloudflare Pages Functions exist (Netlify twins in `netlify/functions/`):
    - `functions/api/twitch-feed.js` (read from Redis)
    - `functions/api/twitch-eventsub.js` (receive/verify Twitch webhooks)
    - `functions/api/twitch-register-eventsub.js` (create subscriptions; **authenticated**)
    - `functions/api/twitch-health.js` (safe env/Upstash/Twitch auth diagnostics)
    - `functions/api/_twitch-utils.js` (shared helpers + Upstash calls)

## What Needs To Be Done

1. Configure all required Cloudflare Pages environment variables.
2. Deploy functions and verify `twitch-feed` works.
3. Run EventSub registration (`twitch-register-eventsub`) once.
4. Confirm Twitch webhook delivery to `twitch-eventsub`.
5. Restore `scripts/donators.js` `fetchTwitchFeed()` (currently a stub) before expecting the donator page to show live events.
6. Verify events appear on `Donators/donators.html` under `Recent Twitch activity`.
7. Optional: if no real events are incoming yet, add a temporary test fixture path (dev-only) for easier QA.

## Required Environment Variables (Cloudflare Pages)

- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `TWITCH_EVENTSUB_SECRET`
- `TWITCH_BROADCASTER_ID`
- `PUBLIC_SITE_URL` (example: `https://www.owenminercs.com`)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `TWITCH_REGISTER_SECRET` (optional; register endpoint falls back to `TWITCH_EVENTSUB_SECRET`)

Notes:

- `PUBLIC_SITE_URL` must match your live site origin; it is used to build callback URL:
    - `https://<site>/api/twitch-eventsub`
- `TWITCH_EVENTSUB_SECRET` must be the same secret used during registration and verification.
- Register is **not** an open POST. Missing register secret → 503. Wrong/missing header → 403.

## Verification Checklist

- `GET /api/twitch-health`
    - Returns JSON with env var presence booleans only (no secret values).
    - `ok: true` means env vars are present and basic Upstash/Twitch auth checks passed.
- `GET /api/twitch-feed`
    - Returns JSON with `{ ok: true, events: [...], totals: {...} }`.
- `POST /api/twitch-register-eventsub`
    - Requires header `x-twitch-register-secret: <secret>` **or** `Authorization: Bearer <secret>`.
    - Secret is `TWITCH_REGISTER_SECRET` or fallback `TWITCH_EVENTSUB_SECRET` (compared with `String()` + timing-safe equality).
    - Returns `ok: true` and per-type results for:
        - `channel.follow` (Helix version `2`, includes `moderator_user_id`)
        - `channel.subscribe`
        - `channel.subscription.gift`
        - `channel.cheer`
    - Already-enabled matching callback/broadcaster rows return `already_exists`.
- Twitch Developer Console/EventSub shows enabled webhook subscriptions.
- New Twitch events cause:
    - Redis list `activity:twitch:events` to get new entries.
    - Redis hash `activity:twitch:totals` to increment.
    - Donator page updates **only after** `fetchTwitchFeed()` is restored; today the UI stays on the paused message even if Redis has events.

## Important Implementation Notes

- `scripts/donators.js` already merges static supporters (`donators.json`) with live Twitch feed events.
- Follower count behavior:
    - If `followers.twitch` in `Donators/donators.json` is empty, UI falls back to `twitch-feed` total follows.
- `twitch-eventsub.js` has idempotency protection:
    - Uses key prefix `activity:twitch:seen:` for message IDs (`SET NX EX 86400`).
- Event age/signature checks are strict:
    - Stale timestamps are rejected (`MAX_AGE_MS` = 10 minutes).
    - Signature uses `twitch-eventsub-message-*` headers and HMAC SHA-256.
- Redis keys: list `activity:twitch:events` (LPUSH + LTRIM to 100), hash `activity:twitch:totals`, string `activity:twitch:last_updated`.
- `twitch-feed` GET `limit` defaults to 30, max 80.

### Known EventSub persist pitfall (still on `main`)

Idempotency `SET NX` runs **before** the persist pipeline (`LPUSH` / `LTRIM` / totals). If persist throws:

1. The seen key remains for 24 hours.
2. Twitch retries get `{ ok: true, duplicate: true }` and the event is never stored.
3. `upstashPipeline` only fails the HTTP call when the pipeline response is not OK / not an array. It does **not** inspect per-command `{ error }` objects, so a partial Redis failure can look like success.

Do not treat unmerged critical-bug PRs as shipped. When debugging “webhook 204 but empty feed,” check whether the message id is already in `activity:twitch:seen:` without a matching list entry.

To re-enable the donator UI later: restore `fetchTwitchFeed()` to `GET /api/twitch-feed?limit=40` (legacy `/.netlify/functions/twitch-feed` still rewrites to `/api/` via `_redirects`) and stop hard-coding the pause copy in `renderActivity()`.

## Suggested Agent Task (copy/paste)

Use this prompt with another agent:

> Set up and verify Twitch EventSub activity for the donor page.  
> Context: the UI and functions already exist in `Donators/donators.html`, `scripts/donators.js`, and `functions/api/{twitch-feed.js,twitch-eventsub.js,twitch-register-eventsub.js,_twitch-utils.js}`.  
> Please:
>
> 1. Verify/complete env var wiring for Cloudflare Pages (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_EVENTSUB_SECRET`, `TWITCH_BROADCASTER_ID`, `PUBLIC_SITE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).
> 2. Register EventSub subscriptions with `x-twitch-register-secret` or Bearer (not an open POST).  
> 3. Validate webhook ingestion (`twitch-eventsub`) and storage (`twitch-feed` + Redis totals).  
> 4. Note that `fetchTwitchFeed()` is currently a stub; restore it before expecting the donator UI to show live events.  
> 5. If needed, add minimal safe diagnostics (without exposing secrets) and document exactly how to run checks again later.

## Done Definition

- Live Twitch follow/sub/gift/bits events appear on the donor page.
- `Refresh` button on donor page returns fresh data from `twitch-feed`.
- No secrets are committed to git.
- Any added diagnostics are safe and documented.

## Practical Setup Flow (Do This In Order)

1. Deploy latest branch to Cloudflare Pages after setting env vars.
2. Check health endpoint first:
    - `GET https://<your-custom-domain>/api/twitch-health`
    - Do not continue until `ok: true`.
3. Register EventSub once (authenticated):
    - `POST https://<your-custom-domain>/api/twitch-register-eventsub`
    - Header: `x-twitch-register-secret: <TWITCH_REGISTER_SECRET or TWITCH_EVENTSUB_SECRET>`
    - Unauthenticated POST returns 403; do not leave this open.
4. Validate feed endpoint:
    - `GET https://<your-custom-domain>/api/twitch-feed?limit=40`
5. Trigger real Twitch events (follow/sub/gift/bits) and refresh `Donators/donators.html`.

## Hosting Note (Cloudflare)

- On Cloudflare Pages, use `/api/*` endpoints from the `functions/` directory.
- If `/api/twitch-health` returns HTML instead of JSON, Pages Functions are not being picked up in the deploy.
- Confirm your project is deployed as Cloudflare Pages with Functions enabled and `functions/api/*` present in the build output.
