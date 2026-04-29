# Handoff: Social “Grand tour” fix + renames (Social butterfly / Grand tour)

## Goals

1. **Fix** the social-dock achievement so it reliably unlocks after the user has opened each profile from the floating social bar (X, Reddit, YouTube, Twitch, Instagram, Facebook, TikTok, Discord).
2. **Rename** the social achievement to **“Social butterfly”** (toast + Achievements page card title + hint).
3. **Rename** the main-nav achievement **“Atlas”** → **“Grand tour”** (toast + Achievements page card title + hint).  
   The main-nav achievement id stays **`main-nav-full-tour`** unless you intentionally migrate users; only user-facing copy changes.

## Suspected bug (why unlock might not fire)

`target="_blank"` **should not** prevent the `click` listener on the opener tab from running—the event is dispatched in the same document before the new tab opens.

Still investigate:

- **Event type**: Today tracking uses **`click`** in capture phase on `document` (`initSocialDockGrandTourTracking` in `scripts/components.js`). If `click` is missing or canceled in some paths, switch or add **`pointerdown`** / **`mousedown`** (primary button only) on `a.site-social-nav__link`, still using capture + `closest`, and keep idempotent writes.
- **Hit target**: Clicks may land on **child SVG** inside the `<a>`; `closest('a.site-social-nav__link')` should still resolve—verify in browser DevTools.
- **Dock gestures**: Confirm **`pointerdown`** on the dock for drag/rotate does not **`preventDefault`** in a way that blocks link activation on the same gesture (read `initSiteSupportDockDrag` / `initSiteSocialDragRotate` in `components.js`).
- **localStorage**: If reads/writes silently fail (private mode, quota), progress never persists—consider a one-line dev guard or optional `sessionStorage` fallback for debugging only.
- **Slot mapping**: `socialDockTourSlotFromHref()` uses `new URL(href)` and host checks. Confirm every dock `href` resolves to one of `SOCIAL_DOCK_TOUR_SLOTS`. Prefer adding **`data-owen-social-tour="x"`** (etc.) on each anchor in `socialNavMarkup()` and reading that in `recordSocialDockTourClick` so slot detection cannot drift from URL changes.

## Files to touch

| Area                                                        | File                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Social tour logic + constants + optional `data-*` on markup | `scripts/components.js` (`socialNavMarkup`, `recordSocialDockTourClick`, `socialDockTourSlotFromHref`, `SOCIAL_DOCK_TOUR_*`, `initSocialDockGrandTourTracking`)                                                                                      |
| Toast title map                                             | `scripts/achievement-celebration.js` (`TITLES` object)                                                                                                                                                                                               |
| Achievements grid copy + `data-achievement` attrs           | `Achievements/achievements.html`                                                                                                                                                                                                                     |
| Clear-save behavior                                         | `scripts/components.js` — `owenminercsClearAchievementProgress` already clears `owenminercs-social-dock-tour-v1`; if you **rename the achievement id**, add removal/migration for the old id in `owenminercs-achievements-v1` JSON array (optional). |

## Rename / id checklist

- **Social achievement**
    - **User-facing name**: “Social butterfly”.
    - **Achievement id**: Prefer **`social-butterfly`** (new) _or_ keep **`social-dock-grand-tour`** to avoid breaking existing `localStorage` unlocks. If you change the id, existing users lose the unlocked row until they re-earn—document that or migrate `localStorage` keys.
    - Update: `Achievements/achievements.html` (`data-achievement`, title, hint), `achievement-celebration.js` `TITLES`, and any `ACH_*` constant + `owenminercsUnlockAchievement('…')` call in `components.js`.

- **Main-nav achievement**
    - **User-facing name**: “Grand tour” (replace “Atlas”).
    - Keep id **`main-nav-full-tour`** unless you have a reason to churn ids.
    - Update: `Achievements/achievements.html`, `achievement-celebration.js` `TITLES`.

## Acceptance tests

1. Clear progress (Achievements page “Clear saved progress” or remove `owenminercs-social-dock-tour-v1` and the achievement id from `owenminercs-achievements-v1` in DevTools).
2. On a page that loads `components.js`, click each **floating dock** social icon once (same tab stays open; new tab is OK).
3. On the **8th** distinct platform, **`social-butterfly`** (or current id) unlocks and celebration runs if motion is allowed.
4. Main-nav card shows **“Grand tour”** (not “Atlas”). Social card shows **“Social butterfly”** (not “Grand tour”).

## Quick debug snippet (paste in console on site)

```js
JSON.parse(localStorage.getItem('owenminercs-social-dock-tour-v1') || '[]');
JSON.parse(localStorage.getItem('owenminercs-achievements-v1') || '[]');
```

After one dock click, the first array should gain one string slot (`x`, `youtube`, …). If it stays `[]`, the listener or write path is broken.

## Out of scope unless requested

- Social **cloud** page (`Socials/scripts/social-cloud.js`) uses different markup; this handoff is only for the **dock** bar unless product wants both.
