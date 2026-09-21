# Project State

Last reviewed: 2026-09-21

## Stack

- Static HTML/CSS/JS site.
- Live hosting: **GitHub + Cloudflare Pages**. `_redirects` still uses Netlify-style syntax; `/.netlify/functions/:splat` rewrites to `/api/:splat`.
- Serverless helpers exist in both `functions/api/` (Pages) and `netlify/functions/`; check both paths before changing APIs.
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

- Public setup hub path: `The Setup/the-setup.html`. Nav label is **Gaming Setups**; on-page H1 remains **Bigfoot's Jungle**. Do not rename URLs unless asked.
- Photography is embedded on `Garage Sale/garage-sale.html#photography` (`photos.json` `years` is empty on main). Standalone `Photography/photography.html` redirects there.
- Donators page shows Ko-fi + StreamElements only; Twitch feed client is stubbed. CSV sync overwrites `followers`.
- Programs: `dev/dev-stack.html` (redirect from `/Dev/`). Not in `MAIN_NAV_TOUR_SLOTS`.
- Affiliate products: `affiliate-links.json`; partner network site-verification meta tags belong in `index.html` and are documented in `IMPLEMENTATION_GUIDE.md`.
- Donation/support links: `donation-links.json`
- Shop product drops: `Garage Sale/shop-products.json`
- Referrals page is temporarily removed; the Mercari referral lives near the top of `Garage Sale/garage-sale.html`.
- Donator data: `Donators/donators.json`
- Social cloud data: `Socials/data/` — card chrome layout (date + stats on one line) is a documented preference in `memory/preferences.md`.
- Photos/posts data: `Photography/photos.json`, `Posts/posts.json`

## Focused Docs

- `SHARED_COMPONENTS_GUIDE.md` — shared chrome, social dock, nav label vs `data-nav` map.
- `SOCIAL_DOCK_RUNBOOK.md` — floating dock gestures and storage.
- `SETUP_HUB_RUNBOOK.md` — Gaming Setups / Bigfoot's Jungle routing, keep-cards, panorama, redirects.
- `DONATORS_PAGE_RUNBOOK.md` — shipped supporter wall (not live Twitch polling).
- `PHOTOGRAPHY_AND_MEDIA_RUNBOOK.md` — shop photo embed, alt-text helpers, `test:content`.
- `TWITCH_DONATOR_HANDOFF.md` — EventSub server restore checklist only.

## Repo Hygiene

- Worktree is often dirty. Do not clean, reset, or delete unrelated files.
- `package/` appears to be Simple Icons package/vendor content.
- `.claude/worktrees/` may contain nested worktree artifacts; do not treat it as normal source unless asked.
