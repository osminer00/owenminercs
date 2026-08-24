# Site Search Runbook

Last verified: 2026-08-24

## Purpose

Client-side site search lets visitors find pages by title, snippet, body text, path, and curated keywords. There is **no hosted search API**: the browser loads a static JSON index and ranks matches locally.

Keep this document in sync with:

- `scripts/components.js` — `owenminercsSiteSearchApi`, ranking/filter/render, header Search link, optional home preview wiring
- `scripts/search-page.js` — full results page (`?q=`)
- `search.html` — dedicated results UI
- `data/site-search-index.json` — committed static index
- `_redirects` — `/search` and `/search/` → `search.html`

## Architecture

```text
Header Search link → /search (or search.html locally)
search.html?q=… → scripts/search-page.js → uncapped matches

Both fetch data/site-search-index.json and use
window.owenminercsSiteSearchApi from components.js.
```

### Current public entry (as of this verification)

The only shipped search UI is the header magnifying-glass link (`getSearchPageUrl()`), which opens `/search` with no query. `search.html` then reads `?q=` and lists matches.

`initSiteSearch()` in `components.js` will also wire a home preview if `#home-site-search-input` and `#home-site-search-results` exist. **Those IDs are not present on `index.html` (or any other HTML file) today**, so the home live-preview path is unused. `search.html` also has no on-page GET form.

Do not document a home search box as live until that markup is added.

### Public browser API

`window.owenminercsSiteSearchApi` exposes:

| Member | Role |
| --- | --- |
| `indexUrl` | Resolved URL for `data/site-search-index.json` |
| `getSearchPageUrl()` | `/search` on production-style hosts; `search.html` when served as local file paths |
| `filterEntries(entries, query, maxResults)` | Rank + filter; default `maxResults` is `40`; full page uses `Infinity` |
| `renderResults(container, list, query, variant)` | DOM-only list render (`preview` \| `fullPage`); no HTML string injection |
| `resolveHref(path)` | Turns an index `path` into a navigable href |

### Index shape

Committed artifact: `data/site-search-index.json` (`version: 2`, `generated: 2026-05-03`, `entryCount: 113` at last check).

```json
{
  "version": 2,
  "generated": "ISO-8601 timestamp",
  "entryCount": 113,
  "entries": [
    {
      "path": "Keyboard/60he",
      "title": "…",
      "snippet": "…",
      "text": "…",
      "manualTerms": ["optional", "curated", "phrases"]
    }
  ]
}
```

- `path` is extensionless and may be URL-encoded (for example `Garage%20Sale/garage-sale`).
- Optional `manualTerms` boost ranking (+36) when the query or joined tokens match a listed phrase. Current curated pages: Keyboard hubs, CS2 merch, garage sale, nosmoking wallpapers.
- `dev/public-content-regression-check.mjs` skips `site-search-index.json` and `search-manual-keywords.json` by basename so generated/stale index snippets do not fail public-content rules.

There is no in-repo index builder today. When page copy or routes change, update `data/site-search-index.json` (and `manualTerms` on entries as needed) before publish. A `data/search-manual-keywords.json` filename is reserved/excluded by the content check but is **not loaded at runtime** unless folded into entry `manualTerms`. That file is not present on `main`.

## Ranking and constraints

- Queries shorter than 2 characters return no matches (hint UI only).
- Multi-word queries match when every token appears somewhere in title + snippet + text + decoded path, or when the full query string is a substring.
- Title and body hits score higher than snippet/path; `manualTerms` can outrank incidental long-page mentions.
- Home / preview (if wired) caps at 40 results; the dedicated page lists all ranked matches.
- If a home form `.site-search-form--home` exists, submit clicks the first result link (does not navigate to `/search` by itself).
- Header Search control goes to the dedicated page without a query; empty-query messaging points users to the nav or a home search section.
- Search inputs marked `[data-owen-site-search]` are exempt from the temporary site-wide text-input lockdown in `components.js`.

## Routes

| URL | Behavior |
| --- | --- |
| `/search`, `/search/` | Rewrite to `search.html` (`_redirects` 200) |
| `/search?q=wooting` | Full ranked results for `wooting` |
| `search.html` | Same page when browsing local `.html` paths |

Canonical / OG URL on the page: `https://www.owenminercs.com/search`.

## Manual verification

1. Click Search in the header; `/search` (or `search.html` locally) should load with the empty-query hint.
2. Open `/search?q=keyboard` (or `search.html?q=keyboard` locally) and confirm uncapped results + title `keyboard — Search | Owen Miner`.
3. Confirm `data/site-search-index.json` loads (Network tab); failure shows “Could not load search index.”
4. After adding/renaming a public page, refresh the index entry (`path`/`title`/`snippet`/`text`) and re-check a distinctive query.
5. Run `npm run test:content` after index edits to ensure non-index public files still pass content rules.
6. Hit both `/search` and `/search/` and confirm CSS + `components.js` + `search-page.js` load (see pitfalls).

## Pitfalls

- Do not invent a live search backend; ranking must stay client-side against the static index.
- Path casing matters on production hosting—index `path` values must match real directories (or redirects).
- Keep result rendering on DOM APIs (`textContent` / `createElement`); never inject untrusted HTML from the index.
- Skipping index updates after large content moves leaves Search pointing at stale titles/snippets.
- `/search/` keeps a trailing-slash URL while rewriting to `search.html`. **Root-relative** asset URLs (`/css/…`, `/scripts/…`) are required on that page; path-relative `css/` / `scripts/` resolve under `/search/…` and 404.
- As of 2026-08-24 on `main`, `search.html` still uses path-relative `css/` and `./scripts/` links, and has no on-page GET form. Verify `/search/` in production until a root-relative asset fix lands. Unmerged critical-bug PRs should not be treated as shipped.
