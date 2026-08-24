# Steam CS2 Inventory Runbook

Last verified: 2026-08-24

## Purpose

`GET /api/steam-cs2-inventory` loads a public Steam CS2 inventory, optionally prices a subset on the Steam Community Market, and returns featured expensive/cool skins plus case/container counts for the Gaming skins UI.

Keep this document in sync with:

- `functions/api/steam-cs2-inventory.js` — Cloudflare Pages Function (canonical)
- `netlify/functions/steam-cs2-inventory.js` — Netlify twin (keep in sync)
- `scripts/cs2-skins.js` — public consumer

## Public contract

| Item | Value |
| --- | --- |
| Method | `GET` only (`onRequest` returns 405 otherwise) |
| Default profile | `putaWinfrontofsteamlilbro` (vanity; resolved via Steam XML to a 17-digit SteamID64) |
| Cache | `public, max-age=300, s-maxage=300` |
| App / context | CS2 app `730`, context `2` |

### Query parameters

| Param | Default | Clamp / notes |
| --- | --- | --- |
| `profile` | vanity above | SteamID64 or vanity; XML lookup at `steamcommunity.com/id/{vanity}/?xml=1` |
| `limit` | `120` | 1–300; number of items returned |
| `count` | `120` | 1–`MAX_FETCH_COUNT` (250); Steam page size |
| `expensiveMin` | `100` | USD floor from lowest or median market price |
| `featured` | on unless `featured=0` | Featured mode returns expensive+cool skins only |

Skins UI call:

```text
/api/steam-cs2-inventory?profile=putaWinfrontofsteamlilbro&limit=60&expensiveMin=90&featured=1
```

### Caps (do not raise casually)

Steam Community rate-limits market lookups. Hard limits in source:

| Constant | Value | Role |
| --- | --- | --- |
| `MAX_PAGE_COUNT` | 8 | Inventory pagination loops |
| `MAX_FETCH_COUNT` | 250 | Per-page `count` |
| `MAX_PRICED_ITEMS` | 300 | Candidates eligible for pricing |
| `MAX_PRICE_LOOKUPS` | 80 | Unique `market_hash_name` GETs to `/market/priceoverview/` |

Pricing is sequential (one market request after another), USD only (`currency=1`). Failures on a name return `pricing: null` for that item rather than failing the whole response.

## Featured filtering

With `featured` on (default):

1. Map assets + descriptions (rarity / weapon / exterior / inspect / icon).
2. Enrich a capped unique set of skin-like, container, or “cool” names with market prices.
3. Build `caseStats` (`totalCases`, `byName`) from container/case/capsule/souvenir items (uses `amount`).
4. Return `items` = skin-like, non-container rows that are **cool** and, when a USD price exists, **at or above `expensiveMin`**. Unpriced cool items still qualify in featured mode. Sorted by price descending, then sliced to `limit`.

“Cool” (`isCoolItem`): rarity in Covert / Extraordinary / Contraband, or type knife/gloves, or name contains doppler, fade, slaughter, case hardened, crimson web, dragon lore, howl.

With `featured=0`, `items` is the full enriched inventory sliced to `limit` (still subject to page/price caps). `hasMore` is true if Steam reported more pages after the 8-page cap.

Success payload shape:

```json
{
  "ok": true,
  "profile": "…",
  "steamId64": "…",
  "generatedAt": "ISO-8601",
  "totalItems": 0,
  "hasMore": false,
  "expensiveMin": 100,
  "caseStats": { "totalCases": 0, "byName": {} },
  "items": []
}
```

Errors return HTTP 500 with `{ ok: false, error, detail }`.

## Constraints and pitfalls

- This is a **public** Steam Community scrape, not Steam Web API. Private inventories fail.
- Do not treat returned prices as a full-inventory valuation; most items are never looked up.
- Icon URLs use `community.cloudflare.steamstatic.com`. Inspect links substitute `%assetid%` / `%owner_steamid%` tokens.
- Change the function in **both** `functions/api/` and `netlify/functions/` (see `PAGES_FUNCTIONS_RUNBOOK.md`).
- Gaming page preference (see `memory/preferences.md`): expensive/cool skins plus case counts — not a full dump. The featured defaults implement that.

## Manual verification

1. `GET /api/steam-cs2-inventory?featured=1&limit=5` returns `ok: true` and a short `items` array.
2. Confirm `caseStats.totalCases` is a number even when no featured skins price.
3. Load the CS2 skins UI and confirm cards match featured names, not an unfiltered inventory.
4. `featured=0&limit=5` should include non-cool items if the inventory has them.
