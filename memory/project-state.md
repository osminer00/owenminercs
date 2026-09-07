# Project State

Last reviewed: 2026-09-07

## Stack

- Static HTML/CSS/JS site.
- Live hosting is **GitHub + Cloudflare Pages** (not Netlify). `_redirects` and `netlify/functions/` exist for compatibility; prefer `functions/api/` on Pages.
- Dual serverless trees: `functions/api/*` (Pages) and `netlify/functions/*`. Check both before changing APIs. `social-feed` is Pages-only.
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

## Important Data

- Public setup hub name: Bigfoot's Jungle. Keep existing `The Setup/the-setup.html` paths/routes unless the user asks to rename URLs. Nav **label** is **Gaming Setups** (`data-nav="The Setup"`).
- Programs nav: visible **Programs**, `data-nav="Dev"`, `dev/dev-stack`. Not in `MAIN_NAV_TOUR_SLOTS`.
- Site search: `/search` → `search.html` + `data/site-search-index.json`. Pretty `/search/` rewrite exists; path-relative assets on trailing-slash URLs can 404.
- Music listen-along page exists at `Music/music.html` but `_redirects` 301 `/music` and `/Music/music` to `/`.
- Site assistant Function exists; no HTML includes `scripts/ai-assistant.js`; `/assistant` 301s to `/`.
- Affiliate products: `affiliate-links.json`; partner network site-verification meta tags belong in `index.html` and are documented in `IMPLEMENTATION_GUIDE.md`.
- Donation/support links: `donation-links.json`
- Shop product drops: `Garage Sale/shop-products.json`
- Referrals page is temporarily removed; the Mercari referral lives near the top of `Garage Sale/garage-sale.html`.
- Donator data: `Donators/donators.json`
- Social cloud data: `Socials/data/` — card chrome layout (date + stats on one line) is a documented preference in `memory/preferences.md`. Cloud does not call `/api/social-feed`.
- Photos/posts data: `Photography/photos.json`, `Posts/posts.json`

## Focused Docs

- `SHARED_COMPONENTS_GUIDE.md` documents `scripts/components.js` + `css/owenminercs.css` shared chrome, including social dock mount/persistence/drag behavior and current nav labels.
- `SOCIAL_DOCK_RUNBOOK.md` — dock ops + current profile URLs (`@OwenMiner`).
- `DISCORD_QA_RUNBOOK.md` — Q&A Discord feed.
- `SOCIAL_CLOUD_DATA_RUNBOOK.md` — Content page JSON + Reddit + unused `/api/social-feed`.
- `MUSIC_LISTEN_ALONG_RUNBOOK.md` / `SITE_ASSISTANT_RUNBOOK.md` — parked or unwired public surfaces.
- `TWITCH_DONATOR_HANDOFF.md` — EventSub; donator activity UI paused.

## Repo Hygiene

- Worktree is often dirty. Do not clean, reset, or delete unrelated files.
- `package/` appears to be Simple Icons package/vendor content.
- `.claude/worktrees/` may contain nested worktree artifacts; do not treat it as normal source unless asked.
