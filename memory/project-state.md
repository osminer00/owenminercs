# Project State

Last reviewed: 2026-07-27

## Stack

- Static HTML/CSS/JS site.
- Live hosting is **GitHub + Cloudflare Pages** (see `memory/preferences.md`). Repo still carries Netlify-style files (`_redirects`, `netlify/functions/`) for compatibility; prefer `functions/api/` for Cloudflare and keep Netlify twins in sync when changing APIs.
- Serverless helpers also exist in `functions/api/`; check both paths before changing APIs.
- Shared components live in `scripts/components.js`.
- Shared CSS lives in `css/owenminercs.css`.

## Common Commands

```powershell
node .\dev\media-accessibility-check.mjs
npm run format:check
npm run lint:css
npm test
npm run test:content
```

Use only commands relevant to the change. Some scripts need local credentials, local files, or network access.

### `npm test` / `npm run test:content`

- `npm test` — Node's test runner over `test/*.test.mjs` (shared chrome / social dock / Impact meta regressions).
- `npm run test:content` — `dev/public-content-regression-check.mjs` walks public `.html`/`.json` and fails on forbidden bio/alumni patterns (`DMACC`, `alumniOf`, old graduate sentences). Skips `dev/`, `mockups/`, `memory/`, `package/`, and generated search basenames `site-search-index.json` / `search-manual-keywords.json`.

## Important Data

- Public setup hub path remains `The Setup/the-setup.html`. Main-nav **label** is **Gaming Setups** (`data-nav="The Setup"`); page copy can still say Bigfoot's Jungle. Do not rename URLs unless asked.
- Site search index: `data/site-search-index.json` (static; no search API). See `SITE_SEARCH_RUNBOOK.md`.
- Affiliate products: `affiliate-links.json`; partner network site-verification meta tags belong in `index.html` and are documented in `IMPLEMENTATION_GUIDE.md`.
- Donation/support links: `donation-links.json`
- Shop product drops: `Garage Sale/shop-products.json`
- Referrals page is temporarily removed; the Mercari referral lives near the top of `Garage Sale/garage-sale.html`.
- Donator data: `Donators/donators.json`
- Social cloud data: `Socials/data/` — card chrome layout (date + stats on one line) is a documented preference in `memory/preferences.md`.
- Photos/posts data: `Photography/photos.json`, `Posts/posts.json`
- X/Twitter handle on public surfaces: `@OwenMiner` / `https://x.com/OwenMiner` (not `@owenminercs`).

## Focused Docs

- `SHARED_COMPONENTS_GUIDE.md` — `scripts/components.js` + `css/owenminercs.css` shared chrome, social dock, nav labels, search API pointer.
- `SOCIAL_DOCK_RUNBOOK.md` — floating social dock ops / QA.
- `SITE_SEARCH_RUNBOOK.md` — client-side search index, ranking, `/search` page.
- `STEAM_CS2_INVENTORY_RUNBOOK.md` — CS2 inventory/pricing function caps and query contract.
- `TWITCH_DONATOR_HANDOFF.md` — Twitch EventSub + donator feed; register endpoint requires auth header.
- `IMPLEMENTATION_GUIDE.md` — affiliate links + partner site-verification meta.

## Repo Hygiene

- Worktree is often dirty. Do not clean, reset, or delete unrelated files.
- `package/` appears to be Simple Icons package/vendor content.
- `.claude/worktrees/` may contain nested worktree artifacts; do not treat it as normal source unless asked.
