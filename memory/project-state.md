# Project State

Last reviewed: 2026-09-14

## Stack

- Static HTML/CSS/JS site.
- Live hosting is **GitHub + Cloudflare Pages**. `_redirects` still uses Netlify-style rewrite syntax (`/.netlify/functions/:splat` → `/api/:splat`).
- Serverless helpers also exist in `functions/api/` and `netlify/functions/`; check both paths before changing APIs. `functions/amazon-price.js` is a Netlify-shaped leftover, not a Pages `/api` twin.
- Shared components live in `scripts/components.js`.
- Shared CSS lives in `css/owenminercs.css`.

## Common Commands

```powershell
node .\dev\media-accessibility-check.mjs
npm run format:check
npm run lint:css
npm test
npm run test:content
node .\scripts\sync-ebay-listings.mjs
```

Use only commands relevant to the change. Some scripts need local credentials, local files, or network access.

## Important Data

- Public setup hub name: Bigfoot's Jungle. Nav label is **Gaming Setups** (`data-nav="The Setup"`). Keep existing `The Setup/the-setup.html` paths/routes unless the user asks to rename URLs.
- Affiliate products: `affiliate-links.json`; partner network site-verification meta tags belong in `index.html` and are documented in `IMPLEMENTATION_GUIDE.md`.
- Donation/support links: `donation-links.json`
- Shop product drops: `Garage Sale/shop-products.json` (hold-card preview today). Live For Sale cards come from `Garage Sale/ebay-listings.json`.
- Referrals page is retired; Mercari lives near the top of `Garage Sale/garage-sale.html`. Photography lives on that page’s `#photography` section.
- Donator data: `Donators/donators.json`
- Social cloud data: `Socials/data/` — card chrome layout (date + stats on one line) is a documented preference in `memory/preferences.md`.
- Photos/posts data: `Photography/photos.json` (`years` may be empty), `Posts/posts.json`

## Focused Docs

- `SHARED_COMPONENTS_GUIDE.md` documents `scripts/components.js` + `css/owenminercs.css` shared chrome, including social dock, Ko-fi overlay, construction notice, and word-glow bookmarks.
- `SOCIAL_DOCK_RUNBOOK.md` — dock mount/persistence/drag plus fidget champion spin.
- `ACHIEVEMENTS_RUNBOOK.md` — unlock ids, storage keys, Mega nerd vs Programs.
- `Garage Sale/SHOP_PAYMENT_SETUP.md` — shop grids, eBay RSS sync, cart, hosted checkout prep.

## Repo Hygiene

- Worktree is often dirty. Do not clean, reset, or delete unrelated files.
- `package/` appears to be Simple Icons package/vendor content.
- `.claude/worktrees/` may contain nested worktree artifacts; do not treat it as normal source unless asked.
