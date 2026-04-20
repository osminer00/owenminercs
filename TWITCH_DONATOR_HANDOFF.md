# Twitch Activity Setup Handoff (Donator Page)

## Goal
Finish wiring real Twitch activity into the donor/support page so `Recent Twitch activity` shows live follows/subs/gift subs/bits from EventSub, and follower totals update correctly (Cloudflare Pages deploy path).

## Current State (already implemented)
- Donator page UI exists in `Donators/donators.html`.
- Front-end polling/render logic exists in `scripts/donators.js`.
  - It calls `/api/twitch-feed?limit=40` first (Cloudflare Pages Functions).
  - It falls back to `/.netlify/functions/twitch-feed?limit=40` for legacy Netlify compatibility.
  - It auto-refreshes every 20 seconds.
  - It renders a fallback message when feed is unavailable.
- Cloudflare Pages Functions exist:
  - `functions/api/twitch-feed.js` (read from Redis)
  - `functions/api/twitch-eventsub.js` (receive/verify Twitch webhooks)
  - `functions/api/twitch-register-eventsub.js` (create subscriptions)
  - `functions/api/twitch-health.js` (safe env/Upstash/Twitch auth diagnostics)
  - `functions/api/_twitch-utils.js` (shared helpers + Upstash calls)
- Data model for manual/static supporter entries exists in `Donators/donators.json`.

## What Needs To Be Done
1. Configure all required Cloudflare Pages environment variables.
2. Deploy functions and verify `twitch-feed` works.
3. Run EventSub registration (`twitch-register-eventsub`) once.
4. Confirm Twitch webhook delivery to `twitch-eventsub`.
5. Verify events appear on `Donators/donators.html` under `Recent Twitch activity`.
6. Optional: if no real events are incoming yet, add a temporary test fixture path (dev-only) for easier QA.

## Required Environment Variables (Cloudflare Pages)
- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `TWITCH_EVENTSUB_SECRET`
- `TWITCH_BROADCASTER_ID`
- `PUBLIC_SITE_URL` (example: `https://www.owenminercs.com`)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Notes:
- `PUBLIC_SITE_URL` must match your live site origin; it is used to build callback URL:
  - `https://<site>/api/twitch-eventsub`
- `TWITCH_EVENTSUB_SECRET` must be the same secret used during registration and verification.

## Verification Checklist
- `GET /api/twitch-health`
  - Returns JSON with env var presence booleans only (no secret values).
  - `ok: true` means env vars are present and basic Upstash/Twitch auth checks passed.
- `GET /api/twitch-feed`
  - Returns JSON with `{ ok: true, events: [...], totals: {...} }`.
- `POST /api/twitch-register-eventsub`
  - Returns `ok: true` and per-type results for:
    - `channel.follow`
    - `channel.subscribe`
    - `channel.subscription.gift`
    - `channel.cheer`
- Twitch Developer Console/EventSub shows enabled webhook subscriptions.
- New Twitch events cause:
  - Redis list `activity:twitch:events` to get new entries.
  - Redis hash `activity:twitch:totals` to increment.
  - Donator page updates on refresh/auto-refresh.

## Important Implementation Notes
- `scripts/donators.js` already merges static supporters (`donators.json`) with live Twitch feed events.
- Follower count behavior:
  - If `followers.twitch` in `Donators/donators.json` is empty, UI falls back to `twitch-feed` total follows.
- `twitch-eventsub.js` has idempotency protection:
  - Uses key prefix `activity:twitch:seen:` for message IDs.
- Event age/signature checks are strict:
  - Stale timestamps are rejected.
  - Signature uses `twitch-eventsub-message-*` headers and HMAC SHA-256.

## Suggested Agent Task (copy/paste)
Use this prompt with another agent:

> Set up and verify Twitch EventSub activity for the donor page.  
> Context: the UI and functions already exist in `Donators/donators.html`, `scripts/donators.js`, and `functions/api/{twitch-feed.js,twitch-eventsub.js,twitch-register-eventsub.js,_twitch-utils.js}`.  
> Please:  
> 1) Verify/complete env var wiring for Cloudflare Pages (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_EVENTSUB_SECRET`, `TWITCH_BROADCASTER_ID`, `PUBLIC_SITE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).  
> 2) Register EventSub subscriptions by calling `/api/twitch-register-eventsub` and confirm all required types are enabled.  
> 3) Validate webhook ingestion (`twitch-eventsub`) and storage (`twitch-feed` + Redis totals).  
> 4) Confirm `Donators/donators.html` displays real activity under `Recent Twitch activity`.  
> 5) If needed, add minimal safe diagnostics (without exposing secrets) and document exactly how to run checks again later.

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
3. Register EventSub once:
   - `POST https://<your-custom-domain>/api/twitch-register-eventsub`
4. Validate feed endpoint:
   - `GET https://<your-custom-domain>/api/twitch-feed?limit=40`
5. Trigger real Twitch events (follow/sub/gift/bits) and refresh `Donators/donators.html`.

## Hosting Note (Cloudflare)
- On Cloudflare Pages, use `/api/*` endpoints from the `functions/` directory.
- If `/api/twitch-health` returns HTML instead of JSON, Pages Functions are not being picked up in the deploy.
- Confirm your project is deployed as Cloudflare Pages with Functions enabled and `functions/api/*` present in the build output.
