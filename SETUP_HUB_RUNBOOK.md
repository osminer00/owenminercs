# Setup Hub Runbook

Last verified: 2026-09-21 against `main`.

## Purpose

The setup catalog is the public gear hub: monitors, audio, desks, plants, clothing, cameras, mounts, lighting, workout gear, and PCs. Shared chrome labels this section **Gaming Setups**. On-page copy still uses the older nickname **Bigfoot's Jungle**. Keep those two names distinct; do not rename URL paths unless the user asks.

Keep this document in sync with:

- `The Setup/the-setup.html` — hub page.
- `scripts/setup-cards.js` — keep-card click/keyboard navigation.
- `scripts/setup-panorama.js` — wide-shot pan/zoom on archive pages.
- `scripts/components.js` — header/footer nav (`data-nav="The Setup"`).
- `_redirects` — old PC / Desk Setup / CS URLs.

## Naming and routes

| Surface | Current value |
| --- | --- |
| Header/footer label | `Gaming Setups` |
| `data-nav` id | `The Setup` |
| Canonical path | `/The%20Setup/the-setup` (`The Setup/the-setup.html`) |
| Hub H1 / back-links | `Bigfoot's Jungle` |
| Document title | `Bigfoot's Jungle \| Owen Miner` |

Do not treat “Gaming Setups” as a folder name. The directory stays `The Setup/`. Keyboard detail pages stay under `Keyboard/`; the 2024 PC parts page stays under `PC/` but is linked from `The Setup/computers.html`.

## Public URL contracts

`_redirects` (Cloudflare/Netlify-style) maps legacy and pretty URLs:

| Request | Result |
| --- | --- |
| `/Desk Setup/setup` and `/PC/pc` | 301 to `/The Setup/the-setup` |
| `/Counter-Strike/CS` | 301 to `/Gaming/gaming` |
| `/dev/dev-stack` | Programs page (canonical, lowercase `dev/`) |
| `/Dev/dev-stack` | 301 to `/dev/dev-stack` |
| `/Photography/photography` | 301 to `/Garage Sale/garage-sale#photography` |
| `/referrals` and `/Referrals/referrals` | 301 to garage-sale |
| `/music` and `/assistant` | 301 to `/` |

Hosting is case-sensitive. Always match directory casing in nav, sitemap, and canonical tags, or add a redirect for any previously published casing.

## Keep-card architecture

Hub and category pages use `.keep-board` + `.keep-card`. There is **no** `keep-thumbs.js` in the repo and **no** `.keep-board--hub` CSS class. Category titles live in `.keep-card__body` under `.keep-card__video-slot`, not overlaid on the image.

Navigation:

- Clickable cards set `role="link"`, `tabindex="0"`, and `data-href`.
- `scripts/setup-cards.js` sends click / Enter / Space to `data-href`.
- Clicks on nested `<a>` (affiliate/store links) are ignored so those links still work.
- Static/info cards omit `data-href` (see Programs / Help Wanted).

`scripts/accessible-media.js` fills weak keep-card `alt` from `.keep-card__label` and sets `aria-label` to `Open {caption}` when missing.

### Hub category map (`the-setup.html`)

| Card label | `data-href` |
| --- | --- |
| Previous Setups | `previous-setups.html` |
| Monitors | `monitors.html` |
| Audio | `audio.html` |
| Keyboards | `keyboards.html` |
| Mice | `mice.html` |
| Desks | `desks.html` |
| Plants | `plants.html` |
| Clothing | `clothing.html` |
| Workout Equipment | `workout-equipment.html` |
| Lighting | `lighting-hub.html` |
| Cameras | `cameras.html` |
| Mounts & Arms | `mounts-arms.html` |
| Headphones | `headphones-hub.html` |
| Computers | `computers.html` |

Keyboards → `../Keyboard/60he.html`. Computers → `gaming-pc.html` and `old-pc-laptop.html`. Clothing → OBS fit check at `../Desk Setup/fit-check.html`.

## Tools split (intentional)

`The Setup/tools.html` **does not exist**. Do not add a physical-tools page unless asked.

- CS2 inventory calculator, expensive skins browser, Major merch, and client-side CS tools belong on `Gaming/gaming.html`.
- OBS multi-camera fit check belongs under Clothing (`The Setup/clothing.html`) with a hub shortcut on the Outfits/Clothing card.

## Setup panorama

Used on `The Setup/2024-setup.html` and the legacy `Desk Setup/setup.html` via `[data-setup-panorama]`.

- Auto-pans on a 15s period; drag to explore; wheel zoom 1–2.75×; double-click opens the full image in a new tab.
- Drag sensitivity is `4.25`. Native image drag is disabled.
- If `prefers-reduced-motion: reduce`, the script **returns immediately** — no pan, drag, or zoom. The image stays a static crop.

## Programs nav (adjacent)

Label **Programs** points at `dev/dev-stack.html` with `data-nav="Dev"`.

- Mega nerd / main-nav full tour (`MAIN_NAV_TOUR_SLOTS`) does **not** include `Dev`. Visiting Programs does not count toward that achievement.
- `resolveActiveNavLink()` matches `pathname.includes(dataNav)`. `/dev/dev-stack` does not contain `Dev`, and there is no `/dev/` fallback, so the Programs pill usually stays unhighlighted.

## Constraints and pitfalls

- Do not “fix” hub H1 text to Gaming Setups unless the user wants the on-page nickname changed. Nav and H1 are allowed to differ.
- Do not restore `keep-thumbs.js` album transitions from memory notes; current hub cards are static thumbs plus `setup-cards.js`.
- Nested affiliate `<a>` inside a `data-href` card must stay clickable; `setup-cards.js` relies on `e.target.closest('a')`.
- Body `zoom: 95%` is used on setup pages. Do not inverse-zoom only header/footer (see `memory/issues.md`).

## QA checklist

1. Header **Gaming Setups** opens `/The Setup/the-setup` and highlights `data-nav="The Setup"`.
2. Hub H1 still reads Bigfoot's Jungle; category cards navigate via `data-href`.
3. `/PC/pc` and `/Desk Setup/setup` redirect to the hub.
4. Clothing card opens the OBS fit-check page; Gaming still hosts CS tools.
5. Previous Setups / 2024 page: panorama pans, drag/zoom work, reduced-motion shows a static image.
6. After setup/photo edits, run `node dev/media-accessibility-check.mjs` (see `PHOTOGRAPHY_AND_MEDIA_RUNBOOK.md`).
