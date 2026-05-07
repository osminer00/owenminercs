# CS2 Inventory API Runbook

Last verified: 2026-05-06

## Purpose

The CS2 skins page uses a serverless API to read a public Steam inventory,
highlight expensive or visually notable skins, and summarize CS2 case/container
counts. The API keeps Steam-specific parsing and price lookups out of browser
code while returning a simple JSON payload for `scripts/cs2-skins.js`.

Keep this document aligned with:

- `scripts/cs2-skins.js` - browser consumer and card rendering.
- `functions/api/steam-cs2-inventory.js` - Cloudflare Pages Functions version.
- `netlify/functions/steam-cs2-inventory.js` - Netlify Functions version.

## Endpoints

Use the path for the active host:

- Cloudflare Pages: `/api/steam-cs2-inventory`
- Netlify: `/.netlify/functions/steam-cs2-inventory`

Only `GET` is supported. Other methods return a JSON `405` response.

Current browser usage:

```js
fetch('/api/steam-cs2-inventory?profile=putaWinfrontofsteamlilbro&limit=60&expensiveMin=90&featured=1');
```

## Query parameters

| Parameter | Default | Bounds | Meaning |
| --- | --- | --- | --- |
| `profile` | `putaWinfrontofsteamlilbro` | Steam vanity name or 17-digit SteamID64 | Inventory owner |
| `limit` | `120` | `1` to `300` | Maximum returned items |
| `count` | `120` | `1` to `250` | Steam inventory page size per request |
| `expensiveMin` | `100` | Minimum `0` | USD threshold for featured expensive skins |
| `featured` | enabled | Use `featured=0` to disable | Return only expensive/cool skins when enabled |

## Response shape

Successful responses include:

```json
{
  "ok": true,
  "profile": "putaWinfrontofsteamlilbro",
  "steamId64": "7656119...",
  "generatedAt": "2026-05-06T00:00:00.000Z",
  "totalItems": 142,
  "hasMore": false,
  "expensiveMin": 90,
  "caseStats": {
    "totalCases": 12,
    "byName": {
      "Kilowatt Case": 4
    }
  },
  "items": [
    {
      "assetId": "123",
      "marketName": "AK-47 | Redline (Field-Tested)",
      "marketHashName": "AK-47 | Redline (Field-Tested)",
      "type": "Rifle",
      "rarity": "Classified",
      "weapon": "AK-47",
      "exterior": "Field-Tested",
      "collection": "The Phoenix Collection",
      "iconUrl": "https://community.cloudflare.steamstatic.com/economy/image/...",
      "inspectLink": "steam://rungame/730/...",
      "tradable": true,
      "marketable": true,
      "pricing": {
        "lowestPrice": "$42.00",
        "medianPrice": "$43.10",
        "volume": "24",
        "lowestPriceUsd": 42,
        "medianPriceUsd": 43.1
      }
    }
  ]
}
```

Failures return `500` with `{ "ok": false, "error": "...", "detail": "..." }`.

## Selection and pricing behavior

- Inventory pages are capped at `MAX_PAGE_COUNT` (`8`) to avoid unbounded Steam
  requests.
- Steam page size is capped at `MAX_FETCH_COUNT` (`250`).
- Price enrichment considers the first `MAX_PRICED_ITEMS` (`300`) skin-like,
  container, or cool-rarity items, then looks up at most `MAX_PRICE_LOOKUPS`
  (`80`) unique market hash names.
- Market prices come from Steam Community Market `priceoverview` with USD
  currency (`1`).
- `featured=1` returns skins that are at or above `expensiveMin` and also match
  the cool-item heuristics when a price is available. Unpriced items only appear
  in featured mode if they match the cool-item heuristic.
- Containers/cases are excluded from the featured skin cards but are still
  counted in `caseStats`.

Cool-item heuristics currently include Covert, Extraordinary, and Contraband
rarities; knives/gloves; and names containing terms such as `doppler`, `fade`,
`slaughter`, `case hardened`, `crimson web`, `dragon lore`, or `howl`.

## Troubleshooting

### The page says skins could not load

Open the API URL directly and check for JSON. If the response is HTML, the
serverless route is not active for that host or the wrong function path is being
used.

### Steam profile fails to resolve

`profile` can be a vanity slug or 17-digit SteamID64. Vanity resolution reads
`https://steamcommunity.com/id/<profile>/?xml=1`; private, renamed, or invalid
profiles can fail before inventory fetching starts.

### Inventory loads but prices are missing

Steam Market `priceoverview` can return no data or throttle. Cards tolerate
missing `pricing` and render `N/A`; do not treat missing prices as proof the item
has no market value.

### The API is slow

Lower `limit` or `count` while testing. Avoid raising `MAX_PAGE_COUNT`,
`MAX_PRICED_ITEMS`, or `MAX_PRICE_LOOKUPS` without adding caching or backoff,
because each request fans out to Steam inventory and market endpoints.
