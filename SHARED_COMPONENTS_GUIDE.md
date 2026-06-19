# Shared Components Guide

Concise notes for maintaining the global browser components in
`scripts/components.js` and their shared styles in `css/owenminercs.css`.

## Shared header navigation

### Intent

`shared-header` and `shared-footer` render the same primary site sections so
navigation labels, active states, and return behavior stay consistent across
hand-written pages.

### Public surface

Both shared elements emit `a.site-nav-link` anchors with stable `data-nav`
values. `applyNavHighlight()` and `resolveActiveNavLink()` use those values to
mark the active pill, while `initMainNavReturnHistory()` uses the class to store
return state for same-origin nav clicks.

| Label            | URL helper target           | `data-nav`     | Notes                                                               |
| ---------------- | --------------------------- | -------------- | ------------------------------------------------------------------- |
| Home             | `/`                         | `index.html`   | Active on `/` and `index.html`.                                     |
| Bigfoot's Jungle | `The%20Setup/the-setup`     | `The Setup`    | Also active for `Keyboard/60he*`, `PC/`, and `Upgrades/` pages.     |
| Gaming           | `Gaming/gaming`             | `Gaming`       | Also active for Counter-Strike and `nosmoking` pages.               |
| Donators         | `Donators/donators`         | `Donators`     | Shared header/footer link.                                          |
| For sale         | `Garage%20Sale/garage-sale` | `garage-sale`  | Lowercase slot id is intentional.                                   |
| Help Wanted      | `Help%20Wanted/help-wanted` | `Help Wanted`  | Space-bearing slot id.                                              |
| Q&A              | `QA/qa`                     | `QA`           | Shared header/footer link.                                          |
| Programs         | `dev/dev-stack`             | `Dev`          | Rendered nav item; not currently included in `MAIN_NAV_TOUR_SLOTS`. |
| Achievements     | `Achievements/achievements` | `Achievements` | Shared header/footer link.                                          |
| Content          | `Socials/socials`           | `Socials`      | Active for paths containing `socials`.                              |

When adding or renaming nav items, update both header and footer markup in
`scripts/components.js`, then verify `resolveActiveNavLink()` and
`getMainNavTourSlotFromLocation()` still route subpages to the intended section.
If the item should count toward the full main-nav achievement, add its stable
slot id to `MAIN_NAV_TOUR_SLOTS` too.

### Return button lifecycle

Same-origin primary-nav clicks store a short-lived record in
`localStorage.owenminercs-nav-return-state-v1`:

```json
{
	"fromUrl": "https://www.owenminercs.com/The%20Setup/the-setup.html",
	"fromTitle": "Bigfoot's Jungle | Owen Miner",
	"fromScrollX": 0,
	"fromScrollY": 640,
	"toUrl": "https://www.owenminercs.com/Gaming/gaming.html",
	"createdAt": 1710000000000
}
```

On the destination page, `maybeShowNavReturnButton()` displays a fixed
`.site-nav-return-popup` button only when the current URL exactly matches
`toUrl` after origin/path/search normalization. Clicking **Back** stores the
previous scroll position in `owenminercs-nav-return-scroll-v1`, removes the
return-state key, and navigates to `fromUrl`. `applyPendingNavReturnScrollRestore()`
then restores scroll with `requestAnimationFrame` plus two delayed retries.

Return records expire after eight hours (`NAV_RETURN_MAX_AGE_MS`). Modified
clicks, external links, links with non-`_self` targets, and same-page links are
ignored.

### Keyboard 60HE routing

`Keyboard/60he.html` is now a landing page for the Wooting 60HE build guides:

- `Keyboard/60he-2025.html` - current Kilowatt build.
- `Keyboard/60he-2023.html` - Crosshair Alpha plus v1 archive content.

The landing page uses `.keyboard-parts-row` and `.keyboard-parts-card` from the
global stylesheet for a two-card layout that stacks on narrow viewports. All
`/Keyboard/` paths containing `60he` should highlight Bigfoot's Jungle via
`resolveActiveNavLink()` and count as `The Setup` in
`getMainNavTourSlotFromLocation()`.

### Manual verification checklist

1. Load `/Keyboard/60he.html`, `/Keyboard/60he-2025.html`, and
   `/Keyboard/60he-2023.html`; Bigfoot's Jungle should be the active nav pill.
2. Click a primary nav link such as Gaming from a scrolled setup page; the
   destination should show the floating **Back** button.
3. Click **Back**; the browser should return to the source URL and restore the
   saved scroll position.
4. Use Ctrl/Cmd-click or an external social/footer link; those should not create
   a nav-return popup.

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
