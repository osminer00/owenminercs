# Gaming Hub Runbook

Last verified: 2026-09-28

## Purpose

`Gaming/gaming.html` is the public Counter-Strike hub (nav label **Gaming**, `data-nav="Gaming"`). Several related URLs look like finished tools. Only some of them accept input or load live data.

Keep this document in sync with:

- `Gaming/gaming.html` and the child pages under `Gaming/`
- `scripts/setup-cards.js` — hub card navigation
- `scripts/cs2-config-explainer.js`
- `scripts/cs2-skins.js`
- `Gaming/cs2-price-calc.html` — calculator is inline, not a shared script
- `functions/api/steam-cs2-inventory.js` — Cloudflare Pages `/api/steam-cs2-inventory`
- `scripts/components.js` — `initTemporaryInputLockdown()`

## What is actually linked

Hub cards use `scripts/setup-cards.js`, which navigates only `.keep-card[data-href]`.

| Hub card | Destination | Live behavior |
| --- | --- | --- |
| Agent Number K Wallpapers | `Gaming/cs2-wallpapers.html` | Static gallery. The download/gallery link goes to `Counter-Strike/nosmoking.html`. |
| Counter Strike Background | `Gaming/counter-strike-background.html` | Static story page. |
| Counter-Strike 2 Merch Shelves | `Gaming/cs2-merch.html` | Static photos. Store links are the Perfect World AliExpress URL, `rel="sponsored nofollow"`. |
| CS2 Config Explainer | none | Card is `.keep-card--static` with CTA **Coming soon**. No `data-href`. |
| CS2 Expensive Skins | `Gaming/cs2-skins.html` | Fetches public inventory. |
| More Counter-Strike 2 Content | `Gaming/cs2-videos.html` | Static YouTube embeds. |

`Gaming/cs2-price-calc.html` is a real page and is not a hub card. The FAQ on the hub links wallpapers straight to `Counter-Strike/nosmoking.html`, not to the wallpaper card URL.

Public profile links on the hub are Faceit `BowlCutBoi` and Steam vanity `bowlcutboi`. The skins API uses a different vanity string (below). Do not assume those strings are interchangeable.

## Routes and discovery

- Nav and canonical hub: `/Gaming/gaming`.
- `_redirects` sends `/Counter-Strike/CS` and `/Counter-Strike/CS.html` to `/Gaming/gaming` (`301!`).
- `/nosmoking` and `/nosmoking.html` redirect to `/Counter-Strike/nosmoking`.
- `sitemap.xml` lists the hub, wallpapers, merch, videos, config explainer, and skins. It does not list `cs2-price-calc` or `counter-strike-background`.
- `data/site-search-index.json` (generated 2026-05-03) includes `Gaming/cs2-price-calc`, `Gaming/cs2-config-explainer`, and `Gaming/cs2-dust2-gap-bug`. There is no `Gaming/cs2-dust2-gap-bug.html` in the repo, and `Gaming/cs2-wallpapers` is absent from that index. Search results can advertise a missing page and omit a live one until the index is regenerated.

## Config explainer

Page: `Gaming/cs2-config-explainer.html`. Script: `scripts/cs2-config-explainer.js`.

The page is reachable, indexed, and in the sitemap, but visitors cannot type:

- The textarea is `disabled` with placeholder `Read-only during testing`.
- The page copy says the tool is read-only.
- `initTemporaryInputLockdown()` also disables `textarea` and text-like `input`s on every page.

The script still runs. **Explain config** analyzes `#cs2-config-input`. With an empty box it sets the summary to `Paste at least one config command to analyze.` **Clear** wipes the field and results.

Parser constraints:

- `//` comments are stripped. `#` and `;` comments are not.
- Tokens are quoted strings or non-whitespace. The first token is the command, lowercased.
- Blank and comment-only lines are skipped.
- Unknown commands are explained as custom/less common and are not flagged.
- Known numeric commands flag values outside the ranges in `KNOWN_COMMANDS` (for example `sensitivity` about 0.4–3.0, `viewmodel_fov` 54–68).
- `unbindall` always flags. `sv_cheats 1` flags VAC matchmaking. `cl_interp` and `cl_interp_ratio` always flag as legacy CS2 behavior.
- Nothing is uploaded. Analysis is local.

To make the tool editable, remove the HTML `disabled` / `aria-disabled` state and exempt this textarea from the global lockdown. Shipping the script alone does not do that. Also replace the hub’s static card with `data-href="cs2-config-explainer.html"` if it should be navigable.

## Skin price calculator

Page: `Gaming/cs2-price-calc.html`. Logic is an inline script at the bottom of that file.

- Visitors type prices. Nothing is fetched.
- Steam seller net is `steam * 0.85` (`STEAM_FEE = 0.15`, described in the page note as 13% Valve + 2% CS2).
- Verdict: CSFloat below Steam-after-fees → “Buy on CSFloat”; CSFloat above the raw Steam price → “Buy on Steam”; otherwise “Close — Compare Float & Pattern”.
- Sticker craft % is `(asking - base) / unapplied sticker total * 100`. The craft card and the sticker verdict use different cutoffs (about 5/15/35 versus 10/30). Change them together if the copy should match.
- Number inputs match `TEXT_ENTRY_SELECTOR`, so the global lockdown disables them. This page re-enables `.calc-container input` and watches that subtree so added sticker rows stay editable. Other new text fields on the site do not get that exception.

## Expensive skins

Page: `Gaming/cs2-skins.html`. Client: `scripts/cs2-skins.js`.

Default request (hardcoded):

```text
/api/steam-cs2-inventory?profile=putaWinfrontofsteamlilbro&limit=60&expensiveMin=90&featured=1
```

Server: `functions/api/steam-cs2-inventory.js` (`onRequestGet`). A Netlify-shaped twin is `netlify/functions/steam-cs2-inventory.js`. Live hosting is GitHub + Cloudflare, so `/api/*` is the Pages function. The two copies can drift; edit the Pages function for production behavior.

Query behavior that matters for this page:

- `profile` is a SteamID64 or a vanity name resolved via `steamcommunity.com/id/<vanity>/?xml=1`. Default in the function is the same vanity as the page.
- `featured` is on unless the query is `featured=0`. `featured=1` does not change that.
- With featured mode, `items` is the expensive “cool” subset (Covert / Extraordinary / Contraband, knives, gloves, or names such as Doppler, Fade, Howl), sorted by lowest then median USD price, sliced to `limit`.
- `expensiveMin` defaults to `100` in the function. This page sends `90`.
- Items with no Steam price still appear in featured mode when they pass `isCoolItem`. Priced items must be `>= expensiveMin`.
- `caseStats` counts containers/cases/capsules across the fetched inventory, including items not shown in the grid. The page prints the total and the top six names.
- Price lookups stop at 80 unique market names (`MAX_PRICE_LOOKUPS`). Response cache is `max-age=300`.
- Inventory must be public. Failures return HTTP 500 `{ ok: false, error: "Failed to fetch CS2 inventory.", detail }`. The page displays `error`, not `detail`, and the status line `Could not load skins right now.`

Card UI:

- Price label uses `pricing.lowestPriceUsd`, then `medianPriceUsd`, else `N/A`.
- Drag on the image spins a flat icon (`rotateX` / `rotateY`). It is not a 3D inspect model. Clicks on links and buttons do not start a spin.
- **Copy offline inspect setup** copies console lines (`map de_mirage`, `sv_cheats 1`, buy/round cvars, `bot_kick`, plus `echo` of the name and inspect link). It does not run `give` or buy the skin.

Changing the Steam vanity requires updating the query in `scripts/cs2-skins.js`. The hub’s Faceit/Steam profile links are separate strings.

## Global input lockdown

`initTemporaryInputLockdown()` in `scripts/components.js` runs on `DOMContentLoaded` and on nodes added later. It sets `disabled`, `readOnly`, `aria-disabled`, placeholder `Temporarily disabled`, and `data-input-disabled-for-now="1"` on `TEXT_ENTRY_SELECTOR`.

The code skips elements inside `[data-owen-site-search]`. No current HTML uses that attribute. `search.html` has no text field; results come from `scripts/search-page.js`.

Do not treat a new textarea or number input as usable until you exempt it the way `cs2-price-calc.html` does, or until the lockdown is removed.

## Checks before calling a Gaming tool “shipped”

1. Hub card has `data-href` and is not `.keep-card--static`.
2. Text fields are not `disabled` in HTML and survive `initTemporaryInputLockdown()`.
3. Sitemap, `data/site-search-index.json`, and the real file path agree. Drop index entries whose HTML does not exist.
4. Skins changes are verified against `functions/api/steam-cs2-inventory.js`, not only the Netlify twin.
5. Merch store URL stays the Perfect World AliExpress link already in `Gaming/cs2-merch.html`, with sponsored disclosure in the footer.
