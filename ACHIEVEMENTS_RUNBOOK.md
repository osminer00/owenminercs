# Achievements Runbook

Last verified: 2026-09-14 against `main`.

Client-only easter eggs. Progress lives in the visitor’s browser (`localStorage`). There is no server, account, or sync.

Keep this document in sync with:

- `scripts/components.js` — unlock API, tour tracking, dock/fidget/bookmark triggers
- `scripts/achievement-celebration.js` — toast titles and motion
- `scripts/achievements-page.js` — `/Achievements/achievements` grid
- `Socials/scripts/social-cloud.js` — Content-page pin/move unlock
- `ACHIEVEMENT_SOCIAL_BUTTERFLY_HANDOFF.md` — **proposed** rename/fix work, not current shipping titles

## Public API

Injected by `scripts/components.js` on pages that load shared chrome:

| Function / event | Behavior |
| --- | --- |
| `owenminercsUnlockAchievement(id)` | Adds `id` to the unlocked set. Returns `false` if already unlocked or `id` is empty. Dispatches `owenminercs-achievement-unlocked`. |
| `owenminercsIsAchievementUnlocked(id)` | Read-only check. |
| `owenminercsClearAchievementProgress()` | Removes achievement + tour keys and dispatches `owenminercs-achievements-cleared`. |
| `owenminercs-achievement-unlocked` | `CustomEvent` with `{ detail: { id } }`. |
| `owenminercs-achievements-cleared` | Fired after a full local reset. |

`components.js` queues unlock events until `achievement-celebration.js` defines `owenminercsOnAchievementUnlocked`, so a fast first unlock still gets a toast.

## Catalog (shipped ids)

Card titles below are the **Achievements page** copy. Toast titles in `achievement-celebration.js` `TITLES` can differ.

| Id | Page title | How it unlocks |
| --- | --- | --- |
| `trophy-shelf` | First steps | Visiting `/Achievements/achievements` (`achievements-page.js` unlocks on load). |
| `lexicon-pin` | Bookmark | Click a per-word glow span to pin it. Inside a link, use **Alt+click** so the URL does not fire. |
| `fidget-spinner` | Fidget spinner | On the **floating social dock**, rotate the rim about **five full turns** in one gesture (`FIDGET_FIVE_REV_DEG` = `1800`, minus `20°` tolerance). That starts a 2s turbo spin and unlocks. This is **not** the Content-page 15-minute idle spinner. |
| `social-dock-move` | Twist it | First real move of the floating dock (`unlockSocialDockMoveAchievement()`). On the Content page, moving a social card **or** finishing a ~five-turn card fidget also unlocks this same id (not `fidget-spinner`). |
| `social-card-pin-and-move` | Hands on | On the Content page (`Socials/socials.html`), drag any social card **and** pin any social card (same or different cards). |
| `social-dock-grand-tour` | Social Media Addict | Open each dock/footer profile once: X, Reddit, YouTube, Twitch, Instagram, Facebook, TikTok, Discord. Slot ids come from `socialDockTourSlotFromHref()` (host matching). Page title is **Social Media Addict**; the toast title is **Grand tour**. |
| `main-nav-full-tour` | Mega nerd | Load a page in every `MAIN_NAV_TOUR_SLOTS` section (see below). Subpages map to a parent tab (`/keyboard/60he*` and `/pc/` → Gaming Setups, `/gaming` and `/counter-strike/` → Gaming). |

Unused leftovers: `achievements-page.js` `GRAPHIC_LABELS` still lists `green-thumb` and `canopy`. Those ids have no cards and no unlockers.

## Storage keys

| Key | Shape | Owner |
| --- | --- | --- |
| `owenminercs-achievements-v1` | JSON array of unlocked ids | Unlock set |
| `owenminercs-social-dock-tour-v1` | JSON array of slot ids (`x`, `reddit`, …) | Dock grand tour progress |
| `owenminercs-main-nav-tour-v1` | JSON array of `data-nav` slot ids | Mega nerd progress |
| `owenminercs-word-glow-bookmarks` | JSON object `{ [pathname]: number[] }` | Per-URL pinned word indices |
| `smc-social-card-pin-move-progress-v1` | `{ "moved": bool, "pinned": bool }` | Hands on progress (Content page) |

`owenminercsClearAchievementProgress()` clears the first three keys only. Word-glow pins, dock placement, Ko-fi position, and Hands on progress (`smc-social-card-pin-move-progress-v1`) remain. After a clear, one more Content-page drag or pin can immediately re-unlock Hands on if both flags were already saved.

QA snippet:

```js
JSON.parse(localStorage.getItem('owenminercs-achievements-v1') || '[]');
JSON.parse(localStorage.getItem('owenminercs-social-dock-tour-v1') || '[]');
JSON.parse(localStorage.getItem('owenminercs-main-nav-tour-v1') || '[]');
```

## Mega nerd slots vs Programs

`MAIN_NAV_TOUR_SLOTS` is:

`index.html`, `The Setup`, `Gaming`, `Donators`, `garage-sale`, `Help Wanted`, `QA`, `Achievements`, `Socials`

The header/footer also render **Programs** (`data-nav="Dev"` → `dev/dev-stack`). That slot is **not** in the tour list. Visiting Programs does not count toward Mega nerd.

The Achievements page hint still says “Bigfoot's Jungle”. The live nav label is **Gaming Setups** (`data-nav="The Setup"`).

`getMainNavTourSlotFromLocation()` only treats `/` and `index.html` as Home. `resolveActiveNavLink()` still treats any path ending in `/` as Home, so highlight and tour progress can disagree on directory URLs.

## Constraints and pitfalls

- Do not put `display: flex; flex-direction: column` on containers that wrap `.text-word-glow` — each word becomes a flex item and stacks one per line (see `memory/issues.md`).
- Changing an achievement **id** orphans existing `localStorage` unlocks unless you migrate the array.
- `ACHIEVEMENT_SOCIAL_BUTTERFLY_HANDOFF.md` proposes renaming Social Media Addict → Social butterfly and Mega nerd → Grand tour. **Not shipped.** The toast already calls the dock tour “Grand tour”; the page card does not.
- New social hosts need both a `socialNavMarkup()` link and a `socialDockTourSlotFromHref()` host branch, or the dock tour cannot complete.
- Celebration respects `prefers-reduced-motion: reduce` (toast only, no confetti/fireworks).

## Manual checks

1. Clear progress on the Achievements page (or remove the keys above) and confirm the grid shows `0 / 7 unlocked`.
2. Reload that page: `trophy-shelf` unlocks immediately.
3. Pin a word in a long paragraph; Alt+pin a word inside a link. `lexicon-pin` unlocks; pins survive reload on that path.
4. Drag the dock interior: `social-dock-move`. Rim-rotate ~five turns: `fidget-spinner`.
5. Click each of the eight social icons once: `social-dock-grand-tour`.
6. Visit each Mega nerd section except Programs; confirm Programs does not fill a missing slot.
