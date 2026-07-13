# Project State

Last reviewed: 2026-05-06

## Stack

- Static HTML/CSS/JS site.
- **Production:** repo on **GitHub**, site on **Cloudflare** (not Netlify).
- Repo still has Netlify-oriented paths (`_redirects`, `netlify/functions/`) and `functions/api/`; check all relevant paths before changing APIs or redirects.
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

- Public setup hub name: **Gear** (nav label **Gear**). Keep existing `The Setup/the-setup.html` paths/routes unless the user asks to rename URLs.
- Affiliate products: `affiliate-links.json`; partner network site-verification meta tags belong in `index.html` and are documented in `IMPLEMENTATION_GUIDE.md`.
- **Affiliate quick links:** `The Setup/gear-quick-links.html` (catalog from JSON). Dense **3-column list rows** (title + shop link + small thumb). Regenerate: `node dev/generate-affiliate-quick-links.mjs`. Gear links pill in site-wide `.home-pillars` quick strip (`scripts/components.js`). Gaming quick-links page removed 2026-07-10 (AliExpress products unavailable); old URL redirects to `Gaming/gaming`.
- Donation/support links: `donation-links.json`
- Shop product drops: `Garage Sale/shop-products.json` (optional `checkoutBackend: "stripe"` → `POST /api/shop-checkout`, prices in `functions/api/_shop-catalog.js`, env `STRIPE_SECRET_KEY` on Cloudflare Pages)
- Referrals page is temporarily removed; resale lives on `Garage Sale/garage-sale.html` (eBay store, direct Stripe checkout when configured, free photography).
- Donator data: `Donators/donators.json`
- Social cloud data: `Socials/data/` — card chrome layout (date + stats on one line) is a documented preference in `memory/preferences.md`.
- Photos/posts data: `Photography/photos.json`, `Posts/posts.json`
- Site search index: `data/site-search-index.json` — deep index from HTML text + optional `data/search-manual-keywords.json`. Regenerate with `npm run build:search-index` or `node dev/build-deep-search-index.mjs` after content changes (113+ pages; ~200KB gzippable). Client-side substring/token matching only in `scripts/components.js` (`window.owenminercsSiteSearchApi`); dedicated results page `search.html` / `/search` + `scripts/search-page.js`. Nav **Search** links to `/search`; home search uses `#home-site-search-results`. Inputs under `[data-owen-site-search]` skip the temporary input lockdown.
- Home **What's new** feed: `data/site-feed.json` (internal site-update links only). Rendered by `scripts/site-feed.js` into `#site-feed-list`; 5-item scroll window via `scripts/site-feed-queue.js` (`data-visible-count="5"`). Discord CTA stays in the section lede only.
- Site map page: `site-map.html` / `/site-map` + `scripts/site-map-page.js`; section order in `data/site-map-order.json` (regenerate: `npm run build:site-map-order` after hub/search changes). Nav **Map** (last item).

## Computers archive (`The Setup`)

- Hub: `The Setup/computers.html` — cards include **Razer Blade 2019** (specs line from college build page), **2020 desktop upgrade** (Ryzen 3800X / 2070 Super / B550-F / storage / NZXT Phantom), **2014 PC build** (built 2014 at age 13; Instagram post March 14, 2015 on `images/archive/old-pcs/first-pc-build-instagram.png`).
- Hub: `The Setup/computers.html` — cards link to separate archive detail pages.
- Archive hub: `The Setup/old-pc-laptop.html` — card index + college desk-site artifact; hash deep links redirect client-side to split pages.
- Detail pages: `legacy-laptop.html`, `upgrade-desktop-2020.html`, `first-pc-build.html` — each rig on its own page with `.setup-archive-detail` layout; links to `college-desk-setup-site/pc.html` where relevant.
- **Privacy:** that Instagram screenshot should keep **profile pictures and usernames blurred** so handles are not readable; if re-exporting the asset, re-apply redaction before commit.

## Focused Docs

- `SHARED_COMPONENTS_GUIDE.md` documents `scripts/components.js` + `css/owenminercs.css` shared chrome, including social dock mount/persistence/drag behavior.

## Repo Hygiene

- Worktree is often dirty. Do not clean, reset, or delete unrelated files.
- `package/` appears to be Simple Icons package/vendor content.
- `.claude/worktrees/` may contain nested worktree artifacts; do not treat it as normal source unless asked.
