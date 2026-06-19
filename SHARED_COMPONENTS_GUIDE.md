# Shared Components Guide

Concise notes for maintaining the global browser components in
`scripts/components.js` and their shared styles in `css/owenminercs.css`.

## Primary navigation and route helpers

### Intent

`shared-header` and `shared-footer` render the same main navigation so every
page gets consistent top and bottom routes. The nav also drives active-link
highlighting, the "Grand tour" achievement, and the floating Back helper that
returns visitors to the nested page they came from.

### Source of truth

The navigation markup is duplicated in `SharedHeader` and `SharedFooter`; keep
the two lists in the same order when editing:

1. Search icon (`getSearchPageUrl()`)
2. Home (`data-nav="index.html"`)
3. Bigfoot's Jungle (`data-nav="The Setup"`)
4. Gaming (`data-nav="Gaming"`)
5. Donators (`data-nav="Donators"`)
6. For sale (`data-nav="garage-sale"`)
7. Help Wanted (`data-nav="Help Wanted"`)
8. Q&A (`data-nav="QA"`)
9. Programs (`data-nav="Dev"`)
10. Achievements (`data-nav="Achievements"`)
11. Content (`data-nav="Socials"`)

Use `getLink('Folder/page')` for internal nav routes. It emits extensionless
production paths and appends `.html` only for localhost, `127.0.0.1`, and
`file://` testing. Pass encoded spaces in folder names (`The%20Setup`,
`Garage%20Sale`, `Help%20Wanted`) and do not include the `.html` suffix in the
argument.

### Active section aliases

`applyNavHighlight()` calls `resolveActiveNavLink(scope)`, which mostly matches
the current URL against each link's `data-nav`. It also has legacy/section
aliases that matter for old paths and deep pages:

- `/Keyboard/*60he*`, `/PC/`, and `/Upgrades/` highlight Bigfoot's Jungle.
- `/Counter-Strike/` and `nosmoking` highlight Gaming.
- Home is matched only for `/` or `index.html`, not every trailing-slash URL.

`getMainNavTourSlotFromLocation()` separately maps the current URL to the
achievement slot. Keep that mapping aligned with `resolveActiveNavLink()` when
adding routes so the highlighted tab and achievement progress do not disagree.
As currently implemented, Programs (`data-nav="Dev"`) is a nav/return-helper
route but is not listed in `MAIN_NAV_TOUR_SLOTS`; add a `Dev` slot and route
mapping before treating Programs as part of the Grand tour achievement.

When changing public route casing or moving a page, also check `_redirects`,
`sitemap.xml`, `data/site-search-index.json`, and any page-local cross-links.
Static hosting is case-sensitive.

### Main-nav Back helper

`initMainNavReturnHistory()` listens in capture phase for unmodified primary
clicks on same-origin `a.site-nav-link` anchors. Before navigation it stores
the source page, destination, title, and scroll offsets in:

```json
{
	"fromUrl": "https://www.owenminercs.com/The%20Setup/the-setup",
	"fromTitle": "Bigfoot's Jungle | Owen Miner",
	"fromScrollX": 0,
	"fromScrollY": 640,
	"toUrl": "https://www.owenminercs.com/Gaming/gaming",
	"createdAt": 1770000000000
}
```

Storage keys:

| Key                                | Purpose                                             |
| ---------------------------------- | --------------------------------------------------- |
| `owenminercs-nav-return-state-v1`  | Pending Back button state for the destination page  |
| `owenminercs-nav-return-scroll-v1` | One-shot scroll restore payload after clicking Back |

Records expire after 8 hours (`NAV_RETURN_MAX_AGE_MS`). The Back popup only
appears when the current URL exactly matches the stored destination and is not
the source URL. Clicking it writes the one-shot scroll restore payload, clears
the pending state, and navigates to `fromUrl`.

### Keyboard build guide routing

`Keyboard/60he.html` is a hub page, not the full build guide. It links to:

- `Keyboard/60he-2025.html` - current Kilowatt build.
- `Keyboard/60he-2023.html` - Crosshair Alpha plus first-build archive notes.

Both subpages still load `scripts/components.js` and should highlight Bigfoot's
Jungle through the `/Keyboard/*60he*` alias. Keep inbound links aimed at the hub
unless they intentionally need a specific year/build page.

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
