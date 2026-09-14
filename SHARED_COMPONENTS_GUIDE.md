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

## Construction notice

`initConstructionNotice()` in `scripts/components.js` shows a modal on first visit
until dismissed. Dismiss writes `localStorage` key
`owenminercs-construction-notice-dismissed-v1` = `"1"`. Escape or **Got it** both
dismiss. Bug reports in the copy use `DISCORD_INVITE_URL`
(`https://discord.gg/fA9GbxmAge`). Timeline copy is still the May/July 2026 plan
from the notice markup — edit there, not in CSS.

## Ko-fi floating donate overlay

`loadKofiOverlayWidget()` injects Ko-fi `overlay-widget.js` and draws account
`owenminer` as `floating-chat`. `a[data-kofi-link]` clicks call
`tryOpenKofiWidgetOverlayFromLink()` (public alias
`window.owenminercsOpenKofiDonateOverlay()`). If the iframe donate button is
found, the click is prevented and the overlay opens in-page instead of navigating
away.

Drag the overlay donate button (inside the Ko-fi iframe document). Position
persists in `owenminercs-kofi-floating-chat-pos` as `{ "left": n, "top": n }`
only after a move of at least `5px`. The host is clamped to the viewport on
drag, resize, and restore. Dragging suppresses the following click so a drag
does not also open the overlay.

Constraints:

- Binding retries for ~30s (`120 * 250ms`) because the iframe is third-party.
- Same-origin access to `iframe.contentDocument` is required for drag; if Ko-fi
  serves a cross-origin frame, drag/open-from-link silently no-ops and the
  `<a data-kofi-link>` navigation proceeds.
- Do not replace `overlay-widget.js` with Widget_2.js if you still want an
  in-page overlay; Widget_2 is an external-link control.

## Word-glow bookmarks

`initWordBackgroundGlow()` wraps words in long `p` / `li` text as
`.text-word-glow`. Click pins `.text-word-glow--bookmark` (neon green). Inside
links, **Alt+click** pins without following the URL; clicking an already-pinned
word inside a link clears the pin and does not navigate.

Pins are stored per pathname in `owenminercs-word-glow-bookmarks`. Skip
selectors include headings, keep-card CTAs, and `[data-no-word-glow]`. First pin
unlocks achievement `lexicon-pin` (see `ACHIEVEMENTS_RUNBOOK.md`).

Do not use `flex-direction: column` on a wrapper that contains these spans —
each word becomes a flex item and stacks one per line.

## Related runbooks

- `SOCIAL_DOCK_RUNBOOK.md` — dock mount, drag/rotate, persistence, QA.
- `ACHIEVEMENTS_RUNBOOK.md` — unlock ids, Mega nerd slots, Programs omission.
