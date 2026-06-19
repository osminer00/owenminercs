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

## Primary navigation contract

### Intent

The header and footer navigation are generated in `scripts/components.js` so
global labels, routes, active-state styling, nav-return history, and achievement
tracking stay centralized. Keep header and footer nav rows in sync; both use the
same `site-nav-link` class and `data-nav` ids.

### Current items

`getLink(path)` adds `.html` only for local/file-server use. Production links use
extensionless Cloudflare/GitHub-style paths.

| Label | Source path | `data-nav` | Notes |
| --- | --- | --- | --- |
| Home | site root | `index.html` | Direct `siteRoot` link, not `getLink()`. |
| Bigfoot's Jungle | `The%20Setup/the-setup` | `The Setup` | Owns setup, PC, upgrades, and Keyboard build routes. |
| Gaming | `Gaming/gaming` | `Gaming` | Also covers `Counter-Strike/` and `nosmoking` fallback pages. |
| Donators | `Donators/donators` | `Donators` | Supporters and tip history. |
| For sale | `Garage%20Sale/garage-sale` | `garage-sale` | Uses a lowercase id because the path is lowercase after the space. |
| Help Wanted | `Help%20Wanted/help-wanted` | `Help Wanted` | Collaborations and open requests. |
| Q&A | `QA/qa` | `QA` | Short public FAQ only. |
| Programs | `dev/dev-stack` | `Dev` | Public label for the dev/tools page. See caveat below. |
| Achievements | `Achievements/achievements` | `Achievements` | Easter eggs and site milestones. |
| Content | `Socials/socials` | `Socials` | Social feeds and featured posts. |

### Active-state and achievements

- `applyNavHighlight()` calls `resolveActiveNavLink()` for both header and
  footer. The first pass checks whether the current `pathname` contains a nav
  item's `data-nav` value. That check is case-sensitive.
- Fallbacks then map related routes to a parent tab:
    - `nosmoking` and `/Counter-Strike/` -> Gaming.
    - `The%20Setup`, `The Setup`, `/Upgrades/`, `/PC/`, and `/Keyboard/` paths
      containing `60he` -> Bigfoot's Jungle.
- `getMainNavTourSlotFromLocation()` mirrors the parent-tab mapping for the
  `main-nav-full-tour` achievement. Its `MAIN_NAV_TOUR_SLOTS` list currently
  excludes `Dev`, so visiting Programs does not count toward that achievement.

### Constraints and pitfalls

- When adding a nav item, update the header and footer markup together.
- If the route casing does not literally include the `data-nav` value, add an
  explicit fallback in both `resolveActiveNavLink()` and
  `getMainNavTourSlotFromLocation()` when active styling or achievement credit is
  required. The Programs link currently points at lowercase `/dev/dev-stack`
  while its id is `Dev`, so the source does not provide automatic
  case-insensitive highlighting for that page.
- `captureNavReturnState()` only records clicks on same-origin
  `.site-nav-link` anchors without modifier keys. Do not add that class to
  external links.

## Keyboard build route map

### Intent

`Keyboard/60he.html` is the stable public entry point for Wooting 60HE content.
It now works as a small hub that lets visitors choose between the current
Kilowatt build and the older Crosshair/v1 page while preserving existing links
from home, setup pages, affiliate data, feeds, and old social captions.

### Pages

| Page | Purpose | Notes |
| --- | --- | --- |
| `Keyboard/60he.html` | Landing hub | Two-card choice page; should remain the stable inbound URL. |
| `Keyboard/60he-2025.html` | Current Kilowatt build | Parts list and current case/plate/switch notes. |
| `Keyboard/60he-2023.html` | Crosshair Alpha and v1 archive | Older GH60 case, dampening, lubing, and Crosshair setup notes. |

All three pages use `shared-header`, `shared-footer`, `site-card-ui`, and the
sitewide `95%` body zoom pattern used by nearby setup pages. The build detail
pages load `scripts/affiliate-links.js`; the hub only links to build pages and
does not auto-render affiliate cards.

### Maintenance checklist

1. Keep links to `Keyboard/60he.html` as the public "keyboard build" URL unless a
   task explicitly asks to deep-link a specific year/build.
2. If moving product links from the hub to a build detail page, update related
   data files such as `affiliate-links.json`, `data/site-feed.json`, and the
   dev affiliate idea board so generated cards and audits point at the right
   page.
3. Keyboard `60he` pages should continue to highlight Bigfoot's Jungle in the
   shared nav via the setup fallback described above.
4. Preserve page-level Amazon disclosures on build pages that include tagged
   Amazon links.
