# Project State

Last reviewed: 2026-08-24

## Stack

- Static HTML/CSS/JS site.
- Live hosting: **GitHub + Cloudflare Pages** (not Netlify). `_redirects` still used.
- Canonical APIs: `functions/api/`. Twins: `netlify/functions/` (incomplete; `social-feed.js` is Pages-only). See `PAGES_FUNCTIONS_RUNBOOK.md`.
- Shared components live in `scripts/components.js`.
- Shared CSS lives in `css/owenminercs.css`.
- Site search is static/client-side (`SITE_SEARCH_RUNBOOK.md`).

## Common Commands

```powershell
node .\dev\media-accessibility-check.mjs
npm run format:check
npm run lint:css
npm test
npm run test:content
```

Use only commands relevant to the change. Some scripts need local credentials, local files, or network access.

## Important Data

- Public setup hub path stays `The Setup/the-setup`. Visible nav label is **Gaming Setups**; page copy may still say Bigfoot's Jungle.
- Site search index: `data/site-search-index.json` (no in-repo builder; update when pages change).
- X Social Cloud cards: `Socials/data/x-top-posts.json` via `scripts/sync-x-top-posts.py` (`@OwenMiner`).
- Affiliate products: `affiliate-links.json`; partner network site-verification meta tags belong in `index.html` and are documented in `IMPLEMENTATION_GUIDE.md`.
- Donation/support links: `donation-links.json`
- Shop product drops: `Garage Sale/shop-products.json`
- Referrals page is temporarily removed; the Mercari referral lives near the top of `Garage Sale/garage-sale.html`.
- Donator data: `Donators/donators.json`
- Social cloud data: `Socials/data/` — card chrome layout (date + stats on one line) is a documented preference in `memory/preferences.md`.
- Photos/posts data: `Photography/photos.json`, `Posts/posts.json`

## Focused Docs

- `SHARED_COMPONENTS_GUIDE.md` — shared chrome, nav label/`data-nav` map, social dock.
- `SOCIAL_DOCK_RUNBOOK.md` — dock lifecycle + current profile URLs.
- `SITE_SEARCH_RUNBOOK.md` — client-side search + `/search/` asset pitfall.
- `STEAM_CS2_INVENTORY_RUNBOOK.md` — CS2 inventory GET + pricing caps.
- `KEYBOARD_HUB_RUNBOOK.md` — intentional `60he.html` chooser.
- `X_TOP_POSTS_SYNC_RUNBOOK.md` — X sync + empty-overwrite pitfall.
- `TWITCH_DONATOR_HANDOFF.md` — EventSub register auth, persist pitfall, paused UI.
- `PAGES_FUNCTIONS_RUNBOOK.md` — `/api/*` map, env names, dual-path rule.

## Repo Hygiene

- Worktree is often dirty. Do not clean, reset, or delete unrelated files.
- `package/` appears to be Simple Icons package/vendor content.
- `.claude/worktrees/` may contain nested worktree artifacts; do not treat it as normal source unless asked.
