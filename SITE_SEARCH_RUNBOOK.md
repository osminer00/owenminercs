# Site Search Runbook

Last verified: 2026-08-03

## Purpose

Client-side site search lets visitors find pages by title, snippet, body text, path, and curated keywords. There is no hosted search API: the browser loads a static JSON index and ranks matches locally.

Keep this document in sync with:

- `scripts/components.js` — `owenminercsSiteSearchApi`, ranking/filter/render, home preview wiring, header Search link
- `scripts/search-page.js` — full results page (`?q=`)
- `search.html` — dedicated results UI
- `data/site-search-index.json` — committed static index
- `_redirects` — `/search` and `/search/` → `search.html`

## Architecture

```text
Header Search link → /search (or search.html locally)
Home form (#home-site-search-*) → live preview (max 40 hits)
search.html?q=… → scripts/search-page.js → uncapped matches

All paths fetch data/site-search-index.json and use
window.owenminercsSiteSearchApi from components.js.
```

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

Committed artifact: `data/site-search-index.json`.

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
- Optional `manualTerms` boost ranking (+36) when the query or joined tokens match a listed phrase. Several pages already ship with curated terms (Keyboard hubs, CS2 merch, garage sale, nosmoking wallpapers).
- `dev/public-content-regression-check.mjs` skips `site-search-index.json` and `search-manual-keywords.json` by basename so generated/stale index snippets do not fail public-content rules.

There is no in-repo index builder today. When page copy or routes change, update `data/site-search-index.json` (and `manualTerms` on entries as needed) before publish. A separate `data/search-manual-keywords.json` filename is reserved/excluded by the content check but is not loaded at runtime unless folded into entry `manualTerms`.

## Ranking and constraints

- Queries shorter than 2 characters return no matches (hint UI only).
- Multi-word queries match when every token appears somewhere in title + snippet + text + decoded path, or when the full query string is a substring.
- Title and body hits score higher than snippet/path; `manualTerms` can outrank incidental long-page mentions.
- Home / preview caps at 40 results; the dedicated page lists all ranked matches.
- Home form submit clicks the first result link when one exists (does not navigate to `/search` by itself).
- Header Search control goes to the dedicated page without a query; empty-query messaging points users to the nav or home search section.
- Search inputs marked `[data-owen-site-search]` are exempt from the temporary site-wide text-input lockdown in `components.js`.

## Routes

| URL | Behavior |
| --- | --- |
| `/search`, `/search/` | Rewrite to `search.html` (`_redirects` 200) |
| `/search?q=wooting` | Full ranked results for `wooting` |
| `search.html` | Same page when browsing local `.html` paths |

Canonical / OG URL on the page: `https://www.owenminercs.com/search`.

## Manual verification

1. Open home, type at least 2 characters into `#home-site-search-input`; preview list updates without a network search API.
2. Confirm `data/site-search-index.json` loads (Network tab); failure shows “Could not load search index.”
3. Open `/search?q=keyboard` (or `search.html?q=keyboard` locally) and confirm uncapped results + title `keyboard — Search | Owen Miner`.
4. After adding/renaming a public page, refresh the index entry (`path`/`title`/`snippet`/`text`) and re-check a distinctive query.
5. Run `npm run test:content` after index edits to ensure non-index public files still pass content rules.
6. Hit both `/search` and `/search/` and confirm CSS + `components.js` + `search-page.js` load (see pitfalls).

## Pitfalls

- Do not invent a live search backend; ranking must stay client-side against the static index.
- Path casing matters on production hosting—index `path` values must match real directories (or redirects).
- Keep result rendering on DOM APIs (`textContent` / `createElement`); never inject untrusted HTML from the index.
- Skipping index updates after large content moves leaves Search pointing at stale titles/snippets.
- `/search/` keeps a trailing-slash URL while rewriting to `search.html`. **Root-relative** asset URLs (`/css/…`, `/scripts/…`) are required on that page; path-relative `css/` / `scripts/` resolve under `/search/…` and 404. Prefer an on-page GET form (`[data-owen-site-search]`) so `/search` without `?q=` is usable.
