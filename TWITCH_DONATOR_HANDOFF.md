# Twitch Activity Runbook (Donator Page)

Last verified: 2026-05-06

## Purpose

The donor page can show live Twitch follows, subscriptions, gift subscriptions,
and cheers in the `Recent Twitch activity` panel. Twitch EventSub webhooks are
received by serverless functions, normalized, stored in Upstash Redis, and then
read by `scripts/donators.js`.

Keep this document aligned with:

- `Donators/donators.html` - donor page markup.
- `scripts/donators.js` - client polling, refresh button, and fallback rendering.
- `functions/api/twitch-*.js` - Cloudflare Pages Functions implementation.
- `netlify/functions/twitch-*.js` - Netlify Functions compatibility implementation.

## Runtime architecture

1. `scripts/donators.js` loads static supporters from `Donators/donators.json`.
2. The browser requests `/api/twitch-feed?limit=40` first.
3. If that fails, the browser tries `/.netlify/functions/twitch-feed?limit=40`.
4. Twitch posts EventSub webhooks to the registered callback:
   - Cloudflare path: `https://<site>/api/twitch-eventsub`
   - Netlify path: `https://<site>/.netlify/functions/twitch-eventsub`
5. `twitch-eventsub` verifies the Twitch signature, rejects stale/duplicate
   messages, normalizes events, and writes to Upstash Redis.
6. `twitch-feed` reads Redis events and totals for the donor page.

Redis keys used by the shared helpers:

| Key | Purpose |
| --- | --- |
| `activity:twitch:events` | Recent normalized activity list |
| `activity:twitch:totals` | Totals by activity type |
| `activity:twitch:last_updated` | Last successful webhook write timestamp |
| `activity:twitch:seen:<message-id>` | EventSub idempotency guard |

## Required environment variables

Set these on the hosting provider that will serve the active functions:

- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `TWITCH_EVENTSUB_SECRET`
- `TWITCH_BROADCASTER_ID`
- `PUBLIC_SITE_URL` (example: `https://www.owenminercs.com`)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Set `TWITCH_REGISTER_SECRET` for the registration endpoint when possible. If it
is absent, registration falls back to `TWITCH_EVENTSUB_SECRET`, but keeping a
separate registration secret limits exposure of the webhook signing secret.

Constraints:

- `PUBLIC_SITE_URL` must be the live origin with no path suffix.
- `TWITCH_EVENTSUB_SECRET` must match the secret sent to Twitch during
  subscription registration.
- Never commit env values or paste them into docs, logs, or issues.

## Register EventSub subscriptions

The registration endpoint is intentionally protected. It accepts `POST` only and
requires either an `x-twitch-register-secret` header or a bearer token matching
`TWITCH_REGISTER_SECRET` (or the fallback secret described above).

Cloudflare Pages Functions:

```sh
curl -X POST "https://<site>/api/twitch-register-eventsub" \
  -H "x-twitch-register-secret: $TWITCH_REGISTER_SECRET"
```

Netlify Functions:

```sh
curl -X POST "https://<site>/.netlify/functions/twitch-register-eventsub" \
  -H "Authorization: Bearer $TWITCH_REGISTER_SECRET"
```

Expected successful response shape:

```json
{
  "ok": true,
  "callback": "https://www.owenminercs.com/api/twitch-eventsub",
  "broadcasterId": "123456789",
  "results": [
    { "type": "channel.follow", "status": "created" },
    { "type": "channel.subscribe", "status": "already_exists" }
  ]
}
```

The endpoint creates or skips these subscription types:

- `channel.follow` version `2`
- `channel.subscribe` version `1`
- `channel.subscription.gift` version `1`
- `channel.cheer` version `1`

## Verification checklist

Use the function path for the active host:

1. `GET /api/twitch-health`
   - Returns JSON with safe env/Upstash/Twitch diagnostics.
   - Secret values are not returned.
2. `POST /api/twitch-register-eventsub`
   - Returns `ok: true`.
   - Each subscription result is `created` or `already_exists`.
3. Twitch Developer Console
   - Shows enabled webhook subscriptions for the same callback URL.
4. `GET /api/twitch-feed?limit=40`
   - Returns `{ "ok": true, "events": [...], "totals": {...} }`.
5. `Donators/donators.html`
   - The activity panel renders live entries or a safe fallback.
   - The refresh button re-queries the feed.

## Troubleshooting

### Registration returns 403

Confirm the request uses `POST` and one of these auth forms:

- `x-twitch-register-secret: <secret>`
- `Authorization: Bearer <secret>`

The expected value is `TWITCH_REGISTER_SECRET` when set; otherwise it is
`TWITCH_EVENTSUB_SECRET`.

### Twitch accepts registration but events never arrive

Check that the callback URL in the registration response matches the hosting
provider currently serving functions. Cloudflare uses `/api/twitch-eventsub`;
Netlify uses `/.netlify/functions/twitch-eventsub`.

### Feed is empty but health is OK

Trigger a real follow/sub/gift/cheer event, then inspect Upstash keys with the
`activity:twitch:*` prefixes above. If `activity:twitch:seen:*` exists without a
new event entry, inspect the EventSub event type and normalization logic in
`_twitch-utils.js`.

### Donor page shows fallback content

The browser tries Cloudflare first and Netlify second. If both return HTML
instead of JSON, the functions are not deployed or the redirects are pointing at
static content.
