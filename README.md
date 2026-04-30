# OwenMinerCS Site Developer Runbook

Static personal site for Owen Miner / OwenMinerCS. Pages are mostly hand-written HTML, CSS, and browser JavaScript with a few serverless API mirrors for live data.

## Architecture at a glance

- `index.html` is the public home page.
- `scripts/components.js` owns shared custom elements, header/footer behavior, social dock links, theme state, and achievement unlock helpers.
- `css/owenminercs.css` is the shared global stylesheet. Page-specific CSS should stay near the page when practical.
- `shared/` contains reusable head/header snippets for older pages and manual includes.
- Data-driven public sections read static JSON from the repo:
    - Social cards: `Socials/data/*.json`
    - Q&A fallback: `QA/answered-qa.json`
    - Shop cards: `Garage Sale/shop-products.json` plus `Garage Sale/ebay-listings.json`
    - Donators: `Donators/donators.json`
- Serverless endpoints exist in both `functions/api/` (Cloudflare Pages-style) and `netlify/functions/` (Netlify mirror). Keep shared behavior in sync when changing a public API.

## Local development

This repo has no build step for the site itself. Serve the workspace with any static file server so browser fetches for JSON files use HTTP instead of raw `file://` paths.

Common verification commands:

```bash
npm run format:check
npm run lint:css
npm run lint:html
node ./dev/media-accessibility-check.mjs
```

Use only the checks relevant to the change. Media review is most useful when touching public images, setup pages, photography, or shop cards.

## Current public interfaces

### Social Cloud

- Page: `Socials/socials.html`
- Renderer: `Socials/scripts/social-cloud.js`
- Styles: `Socials/social-cloud.css`
- Static feed files: `Socials/data/youtube-shorts.json`, `youtube-videos.json`, `x-top-posts.json`, `tiktok-posts.json`, `instagram-posts.json`, `facebook-posts.json`, `twitch-posts.json`
- Optional API prototype: `functions/api/social-feed.js` (`GET /api/social-feed`) returns normalized YouTube cards with in-memory caching, but the browser renderer currently uses local JSON files plus Reddit fetches.

See `SOCIAL_CLOUD_AGENT_HANDOFF.md` for the source schema, sync scripts, and troubleshooting notes.

### Q&A mirror

- Page: `QA/qa.html`
- Client loader: `QA/scripts/qa-feed.js`
- Live endpoint: `functions/api/discord-qa.js` and `netlify/functions/discord-qa.js`
- Static fallback: `QA/answered-qa.json`

The client skips the live Discord endpoint on localhost/file URLs and always merges the static fallback. See `QA/README.md` for the Discord message formats and required environment variables.

### Garage Sale / shop

- Page: `Garage Sale/garage-sale.html`
- Renderer: `scripts/garage-sale.js`
- Product data: `Garage Sale/shop-products.json`
- Payment notes: `Garage Sale/SHOP_PAYMENT_SETUP.md`

Shop products are merged into the For Sale grid before eBay listings. Hosted checkout links are public URLs only; do not commit private payment credentials or dashboard-only links.

## Common pitfalls

- Do not assume `.html` URLs behave the same locally and in production. `scripts/components.js` appends `.html` locally but uses clean paths in production.
- Do not put API tokens in frontend JavaScript, HTML, CSS, or public JSON. Public pages can only fetch sanitized JSON from serverless endpoints.
- Keep `functions/api/` and `netlify/functions/` mirrors aligned for endpoints that exist in both places.
- `package/` is vendor/package artifact content, not project documentation.
- The worktree is often dirty before agent work starts. Preserve unrelated edits and check `git status --short` before and after changes.
