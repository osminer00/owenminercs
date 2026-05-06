# Project State

Last reviewed: 2026-04-28

## Stack

- Static HTML/CSS/JS site.
- Hosted/deployed through Netlify-style files (`_redirects`, `netlify/functions/`).
- Serverless helpers also exist in `functions/api/`; check both paths before changing APIs.
- Shared components live in `scripts/components.js`.
- Shared CSS lives in `css/owenminercs.css`.

## Common Commands

```powershell
node .\dev\media-accessibility-check.mjs
npm run format:check
npm run lint:css
```

Use only commands relevant to the change. Some scripts need local credentials, local files, or network access.

## Important Data

- Public setup hub name: Bigfoot's Jungle. Keep existing `The Setup/the-setup.html` paths/routes unless the user asks to rename URLs.
- Affiliate products: `affiliate-links.json`; partner network site-verification meta tags belong in `index.html` and are documented in `IMPLEMENTATION_GUIDE.md`.
- Donation/support links: `donation-links.json`
- Shop product drops: `Garage Sale/shop-products.json`
- Referrals page is temporarily removed; the Mercari referral lives near the top of `Garage Sale/garage-sale.html`.
- Donator data: `Donators/donators.json`
- Social cloud data: `Socials/data/` — card chrome layout (date + stats on one line) is a documented preference in `memory/preferences.md`.
- Photos/posts data: `Photography/photos.json`, `Posts/posts.json`

## Focused Docs

- `SHARED_COMPONENTS_GUIDE.md` documents `scripts/components.js` + `css/owenminercs.css` shared chrome, including social dock mount/persistence/drag behavior.

## Repo Hygiene

- Worktree is often dirty. Do not clean, reset, or delete unrelated files.
- `package/` appears to be Simple Icons package/vendor content.
- `.claude/worktrees/` may contain nested worktree artifacts; do not treat it as normal source unless asked.
