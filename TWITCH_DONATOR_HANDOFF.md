# Twitch Activity Setup Handoff (Donator Page)

## Shipped status (verify before following the checklist below)

Last verified: 2026-09-07 against `scripts/donators.js` and `functions/api/`.

- **Donator Twitch activity UI is paused.** `renderActivity()` always shows “Twitch activity is paused for now” (Ko-fi / StreamElements copy). `fetchTwitchFeed()` is `Promise.resolve(null)` — the page does **not** poll `/api/twitch-feed`.
- **Registration is not an open POST.** `POST /api/twitch-register-eventsub` requires `x-twitch-register-secret` or `Authorization: Bearer …` matching `TWITCH_REGISTER_SECRET` (fallback `TWITCH_EVENTSUB_SECRET`). Missing secret → 503; mismatch → 403.
- **EventSub persist pitfall (still on `main`):** `twitch-eventsub.js` `SET`s the idempotency key (`activity:twitch:seen:<id>` NX, 86400s) **before** the LPUSH pipeline. If persist throws after that SET, Twitch retries can be treated as duplicates and the event is lost. Failed persist does **not** delete the seen key. Do not assume unmerged critical-bug PRs are live.
- Backend Functions (`twitch-feed`, `twitch-eventsub`, `twitch-health`, register) still exist on Pages and Netlify twins. The setup checklist below is valid for **re-enabling** the UI, not a description of current visitor behavior.

## Goal

Finish wiring real Twitch activity into the donor/support page so `Recent Twitch activity` shows live follows/subs/gift subs/bits from EventSub, and follower totals update correctly (Cloudflare Pages deploy path).

## Current State (already implemented)

- Donator page UI exists in `Donators/donators.html`.
- Front-end render logic exists in `scripts/donators.js`.
    - Live `/api/twitch-feed` polling is **stubbed out** (see shipped status).
    - Static supporters still come from `Donators/donators.json`.
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
- `TWITCH_REGISTER_SECRET` (optional; register auth falls back to `TWITCH_EVENTSUB_SECRET`)
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
    - Send `x-twitch-register-secret: <TWITCH_REGISTER_SECRET or TWITCH_EVENTSUB_SECRET>` (or Bearer). Unauthenticated calls return 403.
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

- `scripts/donators.js` can merge static supporters (`donators.json`) with live Twitch feed events, but `fetchTwitchFeed()` currently returns `null`. Unpause that stub before expecting activity cards.
- Follower count behavior:
    - If `followers.twitch` in `Donators/donators.json` is empty, UI falls back to `twitch-feed` total follows (also unused while the stub is in place).
- `twitch-eventsub.js` has idempotency protection:
    - Uses key prefix `activity:twitch:seen:` for message IDs.
    - `SET NX EX 86400` runs **before** LPUSH. A failed pipeline after a successful SET can drop Twitch retries (seen key is not deleted on persist failure).
- Event age/signature checks are strict:
    - Stale timestamps are rejected.
    - Signature uses `twitch-eventsub-message-*` headers and HMAC SHA-256.

## Suggested Agent Task (copy/paste)

Use this prompt with another agent:

> Set up and verify Twitch EventSub activity for the donor page.  
> Context: the UI and functions already exist in `Donators/donators.html`, `scripts/donators.js`, and `functions/api/{twitch-feed.js,twitch-eventsub.js,twitch-register-eventsub.js,_twitch-utils.js}`.  
> Please:
>
> 1. Verify/complete env var wiring for Cloudflare Pages (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_EVENTSUB_SECRET`, `TWITCH_BROADCASTER_ID`, `PUBLIC_SITE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).
> 2. Register EventSub subscriptions by calling `/api/twitch-register-eventsub` **with** `x-twitch-register-secret` (or Bearer) and confirm all required types are enabled.
> 3. Validate webhook ingestion (`twitch-eventsub`) and storage (`twitch-feed` + Redis totals).
> 4. Restore `fetchTwitchFeed()` if the activity UI should be live again, then confirm `Donators/donators.html` displays real activity under `Recent Twitch activity`.
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
    - `POST https://<your-custom-domain>/api/twitch-register-eventsub` with `x-twitch-register-secret`
4. Validate feed endpoint:
    - `GET https://<your-custom-domain>/api/twitch-feed?limit=40`
5. Trigger real Twitch events (follow/sub/gift/bits) and refresh `Donators/donators.html`.

## Hosting Note (Cloudflare)

- On Cloudflare Pages, use `/api/*` endpoints from the `functions/` directory.
- If `/api/twitch-health` returns HTML instead of JSON, Pages Functions are not being picked up in the deploy.
- Confirm your project is deployed as Cloudflare Pages with Functions enabled and `functions/api/*` present in the build output.
