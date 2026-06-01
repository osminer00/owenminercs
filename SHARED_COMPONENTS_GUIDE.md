# Shared Components Guide

Concise notes for maintaining the global browser components in
`scripts/components.js` and their shared styles in `css/owenminercs.css`.

## Shared navigation

### Intent

`shared-header` and `shared-footer` own the public site navigation so individual
pages only need `<shared-header></shared-header>` and
`<shared-footer></shared-footer>`. The shared nav keeps labels, paths, active
state, and local/deployed URL behavior consistent across the static site.

### Link and label contract

- `getLink(path)` resolves extensionless production links and appends `.html`
  for local `localhost`, `127.0.0.1`, and `file:` previews.
- Header and footer nav entries should stay in sync:
    - `Home` -> `/`
    - `Bigfoot's Jungle` -> `The%20Setup/the-setup`
    - `Gaming` -> `Gaming/gaming`
    - `Donators` -> `Donators/donators`
    - `For sale` -> `Garage%20Sale/garage-sale`
    - `Help Wanted` -> `Help%20Wanted/help-wanted`
    - `Q&A` -> `QA/qa`
    - `Programs` -> `dev/dev-stack`
    - `Achievements` -> `Achievements/achievements`
    - `Content` -> `Socials/socials`
- `data-nav` values are stable ids for active highlighting and the main-nav
  achievement, not necessarily user-facing labels. For example, the public label
  is `Programs`, the path is `dev/dev-stack`, and the nav id is `Dev`.

### Active section mapping

`resolveActiveNavLink(scope)` first matches `data-nav` against the decoded
current path, then applies section fallbacks:

- `/Counter-Strike/` and `nosmoking` map to `Gaming`.
- `/The Setup/`, `/The%20Setup/`, and `/Upgrades/` map to `The Setup`.
- `/Keyboard/*60he*` and `/PC/` also map to `The Setup`.

`getMainNavTourSlotFromLocation()` mirrors these rules for the
`main-nav-full-tour` achievement. If a nav item is added or removed, update both
the header/footer markup and `MAIN_NAV_TOUR_SLOTS` / mapping logic. At the time
of writing, `Programs` appears in the nav but is not part of
`MAIN_NAV_TOUR_SLOTS`; do not assume visiting Programs is required for that
achievement unless the source is changed.

### Navigation return helper

Clicks on same-origin `a.site-nav-link` anchors are captured by
`initMainNavReturnHistory()` unless the click uses a modifier key, a non-left
button, an external origin, a non-`_self` target, or the same normalized URL.

State is stored in `localStorage`:

```json
{
	"owenminercs-nav-return-state-v1": {
		"fromUrl": "https://www.owenminercs.com/The%20Setup/the-setup",
		"fromTitle": "Bigfoot's Jungle | Owen Miner",
		"fromScrollX": 0,
		"fromScrollY": 420,
		"toUrl": "https://www.owenminercs.com/Gaming/gaming",
		"createdAt": 1715000000000
	}
}
```

On the destination page, a floating `Back` button is rendered with
`.site-nav-return-popup`. Clicking it writes
`owenminercs-nav-return-scroll-v1`, navigates to `fromUrl`, and restores the
saved scroll position with a few delayed `scrollTo()` attempts. Return records
expire after `NAV_RETURN_MAX_AGE_MS` (currently 8 hours).

Do not add `site-nav-link` to ordinary inline links unless they should
participate in this return-helper behavior.

## Site search runtime

### Public API and entry shape

`scripts/components.js` exposes `window.owenminercsSiteSearchApi` for any search
page or home-page search box:

```js
window.owenminercsSiteSearchApi = {
	indexUrl: `${siteRoot}data/site-search-index.json`,
	resolveHref: resolveSiteSearchHref,
	getSearchPageUrl,
	filterEntries: searchFilterEntries,
	renderResults: searchRenderResults,
};
```

The runtime expects `data/site-search-index.json` to contain an `entries` array.
Each entry may include:

```json
{
	"title": "Wooting 60HE Build Guides",
	"path": "Keyboard/60he",
	"snippet": "Choose the Kilowatt or Crosshair build guide.",
	"text": "Indexed page copy...",
	"manualTerms": ["keyboard", "wooting", "60he"]
}
```

Ranking checks title, full indexed text, snippet, and decoded path. Multi-word
queries match when every token appears somewhere in that combined blob. Manual
terms, when present on an entry, add ranking weight for curated synonyms or
short aliases.

### Wiring requirements

- Header search uses `getSearchPageUrl()` and currently links to `search` /
  `search.html` using the same local-extension rule as other pages.
- Home-page search support looks for:
    - `#home-site-search-input`
    - `#home-site-search-results`
    - optional closest `.site-search-form--home` for submit-to-first-result
- Search inputs must live inside an ancestor with `data-owen-site-search`; the
  temporary input lockdown skips only that subtree. Inputs outside that marker
  are disabled by `initTemporaryInputLockdown()`.
- Results are rendered with DOM APIs (`textContent`, `createElement`) rather
  than HTML injection.

### Current constraints

The repository currently contains the runtime search helpers, but does not track
`search.html`, `data/site-search-index.json`, or
`data/search-manual-keywords.json`. Until those artifacts are added, do not
describe public site search as complete. The content regression check explicitly
excludes generated search artifacts by basename so local stale snippets do not
trigger public-copy failures.

When completing search, add source-generated artifacts or a documented build
step, styles for the `site-search-*` / `site-header-search-*` classes, and a
manual QA check for missing-index behavior.

## Shared header and social dock

### Intent

`shared-header` provides the site-wide header, main navigation, and the default
home for the floating social dock. The dock starts as a compact horizontal pill
inside `.site-header-dock-cluster` so it behaves like header chrome until a
visitor intentionally customizes it.

### Runtime structure

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

## Keyboard guide hub

`Keyboard/60he.html` is now a lightweight hub for Wooting 60HE build guides, not
the full build article. It links to:

- `Keyboard/60he-2025.html` - 2025 Kilowatt build.
- `Keyboard/60he-2023.html` - 2023 Crosshair Alpha and v1 archive.

Existing production links to `Keyboard/60he.html` should continue to work as the
choice page. When adding more keyboard builds, add the new detail page under
`Keyboard/`, add a hub card, and verify setup pages that deep-link to the hub
still make sense (`The Setup/the-setup.html`, `The Setup/keyboards.html`, and
`The Setup/keyboard-mouse.html` are current entry points).
