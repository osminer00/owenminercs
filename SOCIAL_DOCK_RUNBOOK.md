# Social Dock Runbook

Last verified: 2026-05-04

## Purpose

The social dock is the shared external profile bar shown in the site header and footer. The floating header dock gives visitors quick access to OwenMinerCS social profiles while preserving a user-customized position, rotation, and scale across page navigation.

Keep this document in sync with:

- `scripts/components.js` - generated markup, shared custom elements, drag/rotate/persistence logic, achievements.
- `css/owenminercs.css` - dock layout, fixed/header states, drag locks, tooltips, motion styles.
- `memory/preferences.md` and `memory/issues.md` - durable product preferences and recurring layout pitfalls.

## Public surface

### Markup and components

`scripts/components.js` builds the social nav through `socialNavMarkup(extraClass)`:

- Header dock: `#site-support-dock` containing `.site-social-nav--dock`.
- Header mount point: `.site-header-dock-cluster` inside `<shared-header>`.
- Footer social links: `.site-social-nav--footer`, using the same link markup but without the movable dock wrapper.
- Reset control: `[data-owen-social-dock-reset]` with text `Reset Social Bar`.

The social link list is generated in this order and also feeds the "grand tour" achievement:

1. X/Twitter
2. Reddit
3. YouTube
4. Twitch
5. Instagram
6. Facebook
7. TikTok
8. Discord

When changing a profile URL, verify `socialDockTourSlotFromHref()` still maps that host to the expected achievement slot. New platforms need both a link entry and a stable slot id if they should count toward the achievement.

### Browser storage keys

The dock stores only client-side UI state:

| Key | Shape | Owner |
| --- | --- | --- |
| `owenminercs-social-dock-pos` | JSON object with optional `left`, `top`, `scale`, `tilt`, `customized` | Floating dock placement/transform |
| `owenminercs-social-dock-tour-v1` | JSON array of visited slot ids | Social dock grand tour achievement |
| `owenminercs-achievements-v1` | JSON array of unlocked achievement ids | Shared achievement system |

To reset only the dock during manual QA:

```js
localStorage.removeItem('owenminercs-social-dock-pos');
location.reload();
```

Use `window.owenminercsClearAchievementProgress()` only when intentionally clearing all achievement progress.

## Lifecycle

1. `injectSiteSupportDock()` creates `#site-support-dock` once per page.
2. Saved position/scale/tilt are applied from `owenminercs-social-dock-pos`.
3. If there is no saved customization, the dock mounts into `.site-header-dock-cluster`.
4. If the header is not defined yet, the dock can temporarily fall back to `body`; after `<shared-header>` is ready, `syncSocialDockIntoHeaderWhenPossible()` moves it into the header cluster.
5. On `pagehide` and hidden `visibilitychange`, current dock state is flushed to localStorage.

Default behavior matters: the uncustomized dock should live in the header cluster, not as a bottom-of-viewport strip. Body fallback is only for pages or timing windows without a header slot.

## Interaction model

### Move

- Drag empty/interior space on `.site-social-nav--dock`.
- Links remain clickable and are excluded from drag start.
- A drag must move at least `SOCIAL_DOCK_DRAG_THRESHOLD_PX` (currently `6`) before the dock is considered customized.
- The first real drag promotes the dock from the header into `body` with `site-support-dock--placed`.
- The first header-to-floating move uses `site-support-dock--drag-lock-horizontal` so the pill stays in its header-style horizontal geometry until release.
- On release, the dock persists position and unlocks `social-dock-move`.

Users may drag the dock partially or fully off-screen. Do not clamp live dragging back into the viewport; only default anchoring and normalized saved coordinates are clamped/rounded.

### Rotate and resize

- Rotate/resize starts by dragging near the outer rim of the pill.
- Edge gestures are enabled only after the dock has been customized with `site-support-dock--customized`; this prevents the compact header pill from stealing normal move/click gestures.
- Rotation uses `--site-social-tilt`; scale uses `--site-social-scale`.
- Icons counter-rotate so glyphs stay screen-upright.
- Scale is clamped between `0.5` and `2`.

### Reset

Reset is available in two ways:

- Double-click empty dock space.
- Click `Reset Social Bar` in the header.

Reset clears `owenminercs-social-dock-pos`, removes placed/drag/custom transform state, and re-mounts the dock in `.site-header-dock-cluster` when available.

## Styling contract

Key classes:

- `#site-support-dock` - default header-attached wrapper.
- `site-support-dock--placed` - fixed-position floating dock on `body`.
- `site-support-dock--customized` - user-customized placement/rotation/scale exists.
- `site-support-dock--dragging` - active move drag.
- `site-support-dock--drag-lock-horizontal` - first header-to-floating drag geometry lock.
- `.site-social-nav--edge-rotating` - active rotate/resize gesture.

Important CSS constraints:

- Header default is a compact horizontal strip.
- Floating dock is fixed and stacks vertically by default.
- `touch-action: none` on `.site-social-nav--dock` is required for touch/pen drag handlers to receive movement.
- Tooltip transforms must account for `--site-social-tilt` so labels stay readable when the dock rotates.
- Reduced motion disables some visual effects but does not remove core move/reset behavior.

## QA checklist

Run these checks on at least one desktop browser and one narrow/mobile viewport when touching dock code or CSS:

1. Load a normal page with `<shared-header>` and confirm the dock is in the header row.
2. Click each social link and verify it opens in a new tab with `rel="noopener noreferrer"`.
3. Drag the dock from the header by its interior:
   - It should stay horizontal while dragging out of the header.
   - It should become fixed/floating only after crossing the drag threshold.
   - It should persist after reload and navigation.
4. Drag near the rim after customization:
   - Rotation and scale should update smoothly.
   - Icons should remain upright.
   - Reload should restore the same rough transform.
5. Use the reset button and double-click reset:
   - The dock should return to the header cluster.
   - `Reset Social Bar` should hide when no customization remains.
6. Resize the viewport after customization:
   - The dock should keep its saved placement without snapping to the header.
7. Enable `prefers-reduced-motion: reduce`:
   - Core move/reset should still work.
   - Decorative idle/fidget effects should not run.

## Troubleshooting

### Dock appears to jump between pages

Check whether the page has body `zoom`, missing header markup, or scrollbar gutter differences. The intended default is header-mounted; fixed fallback should use `getSocialDockDefaultViewportPosition()` and avoid page-specific logo/header rect assumptions for user-customized placement.

### Dock reappears as a body strip

Confirm `<shared-header>` renders `.site-header-dock-cluster`. If the cluster exists, `syncSocialDockIntoHeaderWhenPossible()` should move uncustomized docks into it after the custom element is defined.

### Rotate starts when trying to move

Edge rotate should be blocked until `site-support-dock--customized` is present. If it happens in the header state, inspect `onEdgeRotatePointerDown()` and the class list on `#site-support-dock`.

### Touch drag scrolls the page instead

Keep CSS and JS aligned:

- CSS: `#site-support-dock .site-social-nav--dock { touch-action: none; }`
- JS: touch/pen pointer handlers use non-passive listeners and call `preventDefault()`.

### Reset button stays visible after reset

`setSocialDockCustomized(wrap, false)` hides `[data-owen-social-dock-reset]`. Check for duplicate reset buttons outside `.site-header-dock-cluster` or stale `owenminercs-social-dock-pos` values.
