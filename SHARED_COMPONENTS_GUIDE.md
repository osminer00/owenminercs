# Shared Components Guide

Concise notes for maintaining the global browser components in
`scripts/components.js` and their shared styles in `css/owenminercs.css`.

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

## Main navigation labels

Header and footer main-nav pills are built in `SharedHeader` / `SharedFooter`
inside `scripts/components.js`. Stable `data-nav` keys must stay aligned with
`applyNavHighlight` / return-helper logic even when visible labels change.

Notable current labels:

| Visible label | `data-nav` | Target |
| --- | --- | --- |
| Home | `index.html` | `/` |
| Gaming Setups | `The Setup` | `The Setup/the-setup` (hub; page copy may still say Bigfoot's Jungle) |
| Gaming | `Gaming` | `Gaming/gaming` |
| Programs | `Dev` | `dev/dev-stack` (route casing matters; see `_redirects`) |
| Content | `Socials` | `Socials/socials` |

Do not rename `data-nav` values casually; highlight and “Back” helpers key off them.

## Site search (shared API)

Search ranking, preview rendering, and the header Search link live in
`components.js` (`window.owenminercsSiteSearchApi`). The dedicated results page
is `search.html` + `scripts/search-page.js` over static
`data/site-search-index.json`.

Operational detail, index shape, ranking rules, and pitfalls:
`SITE_SEARCH_RUNBOOK.md`.
