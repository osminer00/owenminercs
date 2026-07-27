# Steam CS2 Inventory API Runbook

Last verified: 2026-07-27

## Purpose

`steam-cs2-inventory` is a serverless GET helper that pulls a public Steam CS2 inventory, optionally prices a capped subset via the Steam Community market, and returns expensive/cool skins plus case counts for the Gaming skins UI.

Primary consumer: `scripts/cs2-skins.js` → `Gaming` skins experience (`/api/steam-cs2-inventory?...`).

Keep this document in sync with:

- `functions/api/steam-cs2-inventory.js` (Cloudflare Pages Functions path)
- `netlify/functions/steam-cs2-inventory.js` (legacy Netlify twin — keep behavior aligned)
- `scripts/cs2-skins.js` (default query used by the page)

## Endpoint

| Hosting | Method | URL |
| --- | --- | --- |
| Cloudflare Pages (canonical) | `GET` | `/api/steam-cs2-inventory` |
| Netlify legacy | `GET` | `/.netlify/functions/steam-cs2-inventory` |

Non-GET methods return `405`.

### Query parameters

| Param | Default | Constraints / meaning |
| --- | --- | --- |
| `profile` | `putaWinfrontofsteamlilbro` | Steam vanity id or 17-digit SteamID64 |
| `limit` | `120` | Clamped to `1…300` — max items returned in `items` |
| `count` | `120` | Per-page Steam fetch size, clamped to `1…250` (`MAX_FETCH_COUNT`) |
| `expensiveMin` | `100` | USD threshold for “expensive” when a market price exists |
| `featured` | on (`!== '0'`) | When on, return expensive/cool skins only; when `featured=0`, return a raw inventory slice |

Live page default (from `scripts/cs2-skins.js`):

```text
/api/steam-cs2-inventory?profile=putaWinfrontofsteamlilbro&limit=60&expensiveMin=90&featured=1
```

### Success payload (shape)

```json
{
  "ok": true,
  "profile": "…",
  "steamId64": "7656…",
  "generatedAt": "ISO-8601",
  "totalItems": 0,
  "hasMore": false,
  "expensiveMin": 100,
  "caseStats": { "totalCases": 0, "byName": {} },
  "items": []
}
```

Each item may include identity fields (`marketName`, `rarity`, `iconUrl`, `inspectLink`, …) and optional `pricing` (`lowestPrice`, `medianPrice`, USD parses, `volume`).

Failures return `500` with `{ ok: false, error, detail }` (for example private inventory or Steam HTTP errors).

## Hard caps (do not raise casually)

These limits exist to bound Steam Community load and function runtime:

| Cap | Value | Effect |
| --- | --- | --- |
| `MAX_PAGE_COUNT` | `8` | Max inventory pages walked |
| `MAX_FETCH_COUNT` | `250` | Max assets requested per Steam page |
| `MAX_PRICED_ITEMS` | `300` | Skin/container/cool candidates considered for pricing |
| `MAX_PRICE_LOOKUPS` | `80` | Unique `market_hash_name` calls to `/market/priceoverview/` |
| Response cache headers | `max-age=300`, `s-maxage=300` | Public CDN/browser cache ~5 minutes |

Pricing is sequential per unique market name. Raising `MAX_PRICE_LOOKUPS` increases latency and Steam rate-limit risk.

## Featured / cool filtering

When `featured` is on (default):

1. Inventory pages are fetched and mapped.
2. Market pricing is attempted only for skin-like, container, or “cool” items (Covert/Extraordinary/Contraband; knives/gloves; name heuristics such as Doppler, Fade, Dragon Lore, Howl, …).
3. Skin-like non-containers are kept when:
   - a parsed USD price is `>= expensiveMin` and (if featured) `isCoolItem`, or
   - no price exists but featured mode still wants cool items.
4. Results sort high→low by lowest/median USD price and slice to `limit`.

Container/case totals always land in `caseStats` regardless of the featured skin list.

## Operational notes

- Profile must be resolvable via SteamID64 or vanity XML (`/id/<vanity>/?xml=1`).
- Inventory must be publicly visible or Steam returns a non-success payload and the function errors.
- Cloudflare and Netlify copies should stay feature-parity; prefer editing both when changing caps or query semantics.
- No API key is required for these public Steam Community endpoints; abuse protection is the in-code caps + short cache.

## Manual verification

1. `GET /api/steam-cs2-inventory?limit=5&expensiveMin=90&featured=1` → `ok: true`, small `items` array, `caseStats` present.
2. `featured=0&limit=10` → broader inventory slice (not only expensive cool skins).
3. Open the CS2 skins UI and confirm cards render with spin/inspect when the API succeeds.
4. Invalid/private profile → `ok: false` JSON, not an HTML error page.

## Pitfalls

- Do not remove `MAX_PRICE_LOOKUPS` / page caps to “load everything”; Steam will throttle and the function may time out.
- Vanity profile renames break the default `profile` query until updated in `scripts/cs2-skins.js` and any docs/examples.
- Parsed prices depend on Steam’s localized price strings; missing pricing still allows cool-item fallback in featured mode.
