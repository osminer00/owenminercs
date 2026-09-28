# Project State

Last reviewed: 2026-09-28

## Stack

- Static HTML/CSS/JS site.
- Live site is GitHub + Cloudflare Pages. `_redirects` and `netlify/functions/` still exist; Pages handlers live in `functions/api/`. Check both before changing APIs.
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

- Setup hub: nav label **Gaming Setups** (`data-nav="The Setup"`, path `The Setup/the-setup.html`). On-page H1 stays Bigfoot's Jungle. Do not rename that URL to match the nav label.
- Gaming hub and client tools: `GAMING_HUB_RUNBOOK.md`. Config explainer is reachable but the textarea is disabled and the hub card is static. Skins inventory vanity is not the hub’s Faceit/Steam profile string.
- Homepage “What’s new”: `data/site-feed.json` via `scripts/site-feed.js`. See `SITE_FEED_RUNBOOK.md`. Copy can drift from shop behavior.
- `scripts/setup-comparisons.js` is unused: no page includes it or `[data-setup-vs]`.
- Affiliate products: `affiliate-links.json`; partner network site-verification meta tags belong in `index.html` and are documented in `IMPLEMENTATION_GUIDE.md`.
- Donation/support links: `donation-links.json`
- Shop product drops: `Garage Sale/shop-products.json`
- Referrals page is temporarily removed; the Mercari referral lives near the top of `Garage Sale/garage-sale.html`.
- Donator data: `Donators/donators.json`
- Social cloud data: `Socials/data/` — card chrome layout (date + stats on one line) is a documented preference in `memory/preferences.md`.
- Photos/posts data: `Photography/photos.json`, `Posts/posts.json`

## Focused Docs

- `SHARED_COMPONENTS_GUIDE.md` documents `scripts/components.js` + `css/owenminercs.css` shared chrome, including social dock mount/persistence/drag behavior.
- `GAMING_HUB_RUNBOOK.md` — Gaming cards, config explainer lockdown, price calculator, skins API consumer.
- `SITE_FEED_RUNBOOK.md` — homepage changelog JSON and renderer.

## Repo Hygiene

- Worktree is often dirty. Do not clean, reset, or delete unrelated files.
- `package/` appears to be Simple Icons package/vendor content.
- `.claude/worktrees/` may contain nested worktree artifacts; do not treat it as normal source unless asked.
