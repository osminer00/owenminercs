# Shared Components Guide

Concise notes for maintaining the global browser components in
`scripts/components.js` and their shared styles in `css/owenminercs.css`.

## Shared primary navigation

### Intent

`shared-header` and `shared-footer` render the same primary navigation so every
page gets consistent labels, routes, hover titles, and active-pill behavior.
`scripts/components.js` is the source of truth for this chrome; individual pages
should not copy their own main nav unless they are archived/mockup pages.

### Public surface

- Header and footer pills use `a.site-nav-link[data-nav]`.
- The **Programs** pill points to `dev/dev-stack` with `data-nav="Dev"`.
- **Bigfoot's Jungle** points to `The%20Setup/the-setup` with
  `data-nav="The Setup"`.
- Keyboard build pages remain under `Keyboard/` but intentionally highlight
  **Bigfoot's Jungle** because they are setup/gear content.

When adding or renaming a main nav item, update both the `SharedHeader` and
`SharedFooter` markup and keep the `data-nav` value stable enough for:

1. `resolveActiveNavLink()` active-state matching;
2. `MAIN_NAV_TOUR_SLOTS` / `mainNavTourSlotFromHref()` if the pill should count
   toward the main-nav achievement;
3. redirects and `sitemap.xml` when the public route changes.

### Active-route matching

`resolveActiveNavLink(scope)` first looks for the current path containing a
`data-nav` value. It then applies explicit fallbacks for older or grouped
content:

- `/Counter-Strike/` and `nosmoking` highlight **Gaming**.
- `The%20Setup`, `The Setup`, and `/Upgrades/` highlight **Bigfoot's Jungle**.
- `/Keyboard/*60he*` and `/PC/` highlight **Bigfoot's Jungle**.

If a new hub owns pages outside its directory, add a specific fallback here
instead of relying on broad substring matches.

### Main-nav return helper

`initMainNavReturnHistory()` gives same-site main-nav clicks a temporary floating
**Back** button on the destination page:

1. A capture-phase listener records unmodified left-clicks on
   `a.site-nav-link` only.
2. External origins, `_blank` links, and same-page destinations are ignored.
3. The source URL, document title, scroll position, destination URL, and creation
   time are saved in `localStorage`.
4. On the destination page, `maybeShowNavReturnButton()` appends
   `.site-nav-return-popup` when the saved destination matches the current URL.
5. Clicking **Back** writes a scroll-restore payload, clears the return state,
   navigates to the source URL, and `applyPendingNavReturnScrollRestore()` tries
   to restore scroll on the returned page.

Storage keys:

| Key | Shape | Owner |
| --- | --- | --- |
| `owenminercs-nav-return-state-v1` | Object with `fromUrl`, `fromTitle`, `fromScrollX`, `fromScrollY`, `toUrl`, `createdAt` | Destination-page Back prompt |
| `owenminercs-nav-return-scroll-v1` | Object with `targetUrl`, `scrollX`, `scrollY`, `createdAt` | Source-page scroll restore |

Both payloads expire after `NAV_RETURN_MAX_AGE_MS` (8 hours). The popup styles
live in `css/owenminercs.css` as `.site-nav-return-popup` and
`.site-nav-return-popup__button`.

### Keyboard hub routing

`Keyboard/60he.html` is now a small landing page, not the full build article. It
links to:

- `Keyboard/60he-2025.html` for the current Kilowatt build.
- `Keyboard/60he-2023.html` for the Crosshair Alpha and v1 archive.

Keep existing inbound links to `Keyboard/60he.html` unless the public route is
intentionally changed; the hub lets old backlinks and setup cards keep working
while visitors choose the build generation.

### Manual verification checklist

1. Click a header/footer nav pill and confirm the destination highlights the
   expected active pill.
2. Use an unmodified click between two main-nav pages; the destination should
   show **Back**, and clicking it should return to the prior page near the saved
   scroll position.
3. Ctrl/Cmd-click, middle-click, and external links should not create the Back
   prompt.
4. Visit `Keyboard/60he.html`, `Keyboard/60he-2025.html`, and
   `Keyboard/60he-2023.html`; all should highlight **Bigfoot's Jungle**.

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
