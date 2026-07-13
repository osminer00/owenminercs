# Shared Components Guide

Concise notes for maintaining the global browser components in
`scripts/components.js` and their shared styles in `css/owenminercs.css`.

## Shared header, footer, and site search

### Intent

`shared-header` and `shared-footer` provide the site-wide brand chrome,
navigation, support links, and the default home for the floating social dock.
Keep this file aligned with `scripts/components.js`; most production pages use
the custom elements instead of hard-coded header/footer markup.

### Navigation contract

The shared navigation is generated in `SharedHeader` and `SharedFooter`.
Both locations should stay in the same order, with the same visible labels,
`href` targets, titles, and stable `data-nav` ids.

Current public labels and targets:

| Label         | Target                      | Stable `data-nav` |
| ------------- | --------------------------- | ----------------- |
| Home          | `/`                         | `index.html`      |
| Gaming Setups | `The%20Setup/the-setup`     | `The Setup`       |
| Gaming        | `Gaming/gaming`             | `Gaming`          |
| Donators      | `Donators/donators`         | `Donators`        |
| For sale      | `Garage%20Sale/garage-sale` | `garage-sale`     |
| Help Wanted   | `Help%20Wanted/help-wanted` | `Help Wanted`     |
| Q&A           | `QA/qa`                     | `QA`              |
| Programs      | `dev/dev-stack`             | `Dev`             |
| Achievements  | `Achievements/achievements` | `Achievements`    |
| Content       | `Socials/socials`           | `Socials`         |

Constraints:

- `data-nav` ids are behavioral keys. They drive active-link highlighting,
  section matching for subpages, and related nav behaviors; do not rename them
  just because a public label changes. If a link should count toward the
  main-nav tour achievement, also update `MAIN_NAV_TOUR_SLOTS`.
- The public setup hub label is **Gaming Setups**, but the target page and
  historical page copy still use `The Setup/the-setup` and Bigfoot's Jungle.
- Search is the icon-only first item in the header nav. It is not duplicated in
  the footer nav.
- `getLink()` and `getSearchPageUrl()` add `.html` only for local/file-style
  browsing. Production links should remain pretty extensionless paths.

### Site search

The search UI is a static, client-side search over `data/site-search-index.json`.
It does not call a hosted API.

Runtime pieces:

- `search.html` is the dedicated results page and reads `?q=`.
- `_redirects` maps `/search` and `/search/` to `/search.html` for static hosts
  that need an explicit page rewrite.
- `scripts/search-page.js` loads the shared search API from `components.js`,
  fetches the JSON index, and renders full-page results.
- `components.js` exposes `window.owenminercsSiteSearchApi` with:
    - `indexUrl`;
    - `resolveHref(pagePath)`;
    - `getSearchPageUrl()`;
    - `filterEntries(entries, query, maxResults)`;
    - `renderResults(container, list, query, variant)`.

Search behavior:

- Queries shorter than 2 characters show a hint and return no matches.
- Matching checks title, snippet, full indexed text, and decoded path.
- Multi-word queries match when every token appears somewhere in the combined
  searchable blob, even if the exact phrase is absent.
- Results are ranked higher for title/text/snippet/path hits; embedded
  `manualTerms` in the generated index add an extra boost.
- Results are rendered with DOM APIs (`textContent`, created elements), not by
  injecting raw HTML.

Operational notes:

- Keep `data/site-search-index.json` in sync when public page copy, titles, or
  paths change. The checked-in index is the source used by production search.
- If manual keyword boosts are regenerated, keep them embedded as
  `manualTerms` arrays on index entries; `components.js` reads those arrays but
  this repo currently does not include a separate manual-keyword source file.
- Search result links expect canonical page paths such as
  `The%20Setup/the-setup` or `Gaming/gaming`, without a leading slash.
- When changing search CSS or markup, verify both `/search?q=keyboard` and a
  local `search.html?q=keyboard` style URL.

## Social dock

### Runtime structure

- The dock starts as a compact horizontal pill inside
  `.site-header-dock-cluster` so it behaves like header chrome until a visitor
  intentionally customizes it.
- `socialNavMarkup('site-social-nav--dock')` builds the dock link markup.
- `injectSiteSupportDock()` creates `#site-support-dock` once per page.
- `appendDockToDefaultSlot()` mounts the dock after the reset button in
  `.site-header-dock-cluster` when the header is available.
- `syncSocialDockIntoHeaderWhenPossible()` moves the dock from the temporary
  body fallback into the header slot after `shared-header` connects.
- `css/owenminercs.css` controls the two layouts:
    - default header mode: `#site-support-dock` is relative and horizontal;
    - customized floating mode: `#site-support-dock.site-support-dock--placed` is
      fixed on `body` and may rotate/scale.

### User interactions and persistence

Move and rotate gestures are intentionally split:

- Drag the interior of the pill to move it.
- After the dock has been moved once, drag near the outer rim to rotate and
  resize it (`SOCIAL_DOCK_EDGE_ROTATE_PX` controls the rim width).
- Double-click empty dock chrome or click **Reset Social Bar** to clear the
  saved state and remount the dock in the header.

State is stored in `localStorage` under `owenminercs-social-dock-pos` only when
the dock is customized. The stored object may include:

```json
{ "customized": true, "left": 24, "top": 96, "scale": 1.15, "tilt": 18 }
```

Default header placement is not persisted; if a saved state is effectively the
same as the default, the key is removed.

### First-drag orientation lock

When the first real move drag starts from the header, `initSiteSupportDockDrag()`
temporarily adds `site-support-dock--drag-lock-horizontal` while promoting the
dock into fixed positioning. The CSS for this class keeps the pill horizontal,
keeps the compact header icon sizing, and sets `--site-social-tilt: 0deg`.

This avoids the initial pointer tracking jump that would happen if the dock
switched to its normal floating vertical/rotatable geometry during the same
gesture. The lock is removed on `pointerup`, `pointercancel`, or lost pointer
capture so later floating gestures use the normal move/rotate/resize behavior.

### Constraints and pitfalls

- Do not make rim rotate/resize available before the dock is customized; the
  compact header pill is mostly edge area and would steal normal move drags.
- Do not clamp during active dragging. Clamp only default anchors and normalize
  fractional pixels after gestures so near-edge drags continue to follow the
  pointer.
- Keep `touch-action: none` on `.site-social-nav--dock`; touch browsers can
  otherwise convert the gesture into page scrolling before pointer movement
  reaches the drag handler.
- The body-bottom strip is only a legacy fallback for pages without a header
  slot at injection time. Normal default placement should remain in the header.

### Manual verification checklist

1. Load a page with `shared-header` and confirm the dock starts in the header.
2. Drag the dock interior from the header; while dragging, it should stay
   horizontal and track the pointer.
3. Release the drag; the dock should persist as a fixed, customized dock and the
   reset button should appear.
4. Drag near the outer rim; rotate/resize should now work.
5. Double-click empty dock chrome or click **Reset Social Bar**; the dock should
   return to `.site-header-dock-cluster` and remove
   `owenminercs-social-dock-pos`.
