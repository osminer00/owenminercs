# Homepage “What’s new” Feed

Last verified: 2026-09-28

## Purpose

The homepage section `#whats-new` is a hand-written changelog. It is not generated from git, sitemap, or shop data. Edit `data/site-feed.json`, then deploy.

## Files

| File | Role |
| --- | --- |
| `index.html` | `#site-feed-list`, `#site-feed-error`, heading “What’s new”. |
| `scripts/components.js` | `injectSiteFeedClient()`, called from the `shared-footer` element. |
| `scripts/site-feed.js` | Fetches JSON and renders the list. |
| `data/site-feed.json` | `{ "entries": [ ... ] }` source of truth. |

`injectSiteFeedClient()` runs only when `#site-feed-list` exists and does not have `data-site-feed-static`. Today only `index.html` has that list. A second script tag with `data-owen-site-feed` is ignored.

## Entry shape

```json
{
  "id": "2026-04-24-site-feed",
  "date": "2026-04-24",
  "title": "What’s new feed & optional browser alerts",
  "summary": "Changelog-style list on the homepage.",
  "path": "/#whats-new"
}
```

- `date` is `YYYY-MM-DD`. The renderer parses it as local noon (`T12:00:00`) so the calendar day does not shift across time zones. Invalid dates are shown as the raw string.
- `title` defaults to `Update` when missing.
- `summary` is optional. Text is HTML-escaped, then the exact words `Ko-fi` and `StreamElements` become links to `https://ko-fi.com/owenminer` and `https://streamelements.com/owenminercs/tip`.
- `path` (or `url`) is the click target. Absolute `http(s)` URLs are used as-is. Other values are forced to a site path starting with `/`.

The list is replaced on each successful load. Fetch uses `cache: 'no-store'`. A failed fetch sets `#site-feed-error` to `Could not load the site feed. Try refreshing the page.` and, if the list is still empty, a `Feed unavailable.` item.

## What the feed does not do

- There is no Notification API, service worker, or permission prompt. The 2026-04-24 summary mentions “optional browser alerts”; that sentence is copy, not a feature.
- Entries are not filtered, sorted, or capped in JavaScript. Order is the array order in the JSON file.
- The feed does not read `Garage Sale/shop-products.json`. The 2026-04-28 summary says sticker and print drops “load together into the For Sale grid”. On the shop page, eBay checkout cards render in `#shop-ebay-garage` and direct drops render as separate on-hold cards in `#shop-drops-hold` (`scripts/garage-sale.js`). Both sit in `#for-sale`, but hold cards are not checkout rows. Update the summary when describing the shop so it matches that split.

## Editing checklist

1. Prepend a new object to `entries` (the list is not re-sorted).
2. Use a unique `id` and a real `path` that survives redirects (for example `/Gaming/gaming`, not a removed `/Counter-Strike/CS` URL).
3. Keep `summary` plain text aside from the two brand names the renderer linkifies.
4. Re-read the target page before repeating its behavior in the summary.
