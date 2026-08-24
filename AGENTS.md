# OwenMinerCS Agent Memory

Last reviewed: 2026-08-24

This is the low-token entry point for any coding assistant working in this repo.

## Read Order

1. Read this file first.
2. Read `memory/project-state.md` for current structure and commands.
3. Read `memory/preferences.md` before UI/content work.
4. Read `memory/issues.md` before debugging or continuing unfinished work.
5. Read only the task-specific handoff/docs you need after that.

## Memory Rules

- Keep durable knowledge in `memory/`.
- Update memory when the user gives a lasting preference, site fact, bug pattern, layout ratio, workflow rule, or unresolved issue.
- Do not store secrets, tokens, private credentials, or one-off chat noise.
- Prefer short bullets over long prose. The goal is shared context with low token use.
- If a memory becomes stale, update it or move it to `memory/archive/`.

## Project Snapshot

Static personal website for Owen Miner / OwenMinerCS. Mostly hand-written HTML, CSS, and browser JavaScript. Live hosting is **GitHub + Cloudflare Pages**. Serverless helpers live in `functions/api/` (canonical) with Netlify-shaped twins in `netlify/functions/` — see `PAGES_FUNCTIONS_RUNBOOK.md`.

Key files:

- `index.html` - home page
- `css/owenminercs.css` - shared global CSS
- `scripts/components.js` - shared custom elements/header/footer/social dock/achievements/search API
- `search.html` + `data/site-search-index.json` - client-side site search (`SITE_SEARCH_RUNBOOK.md`)
- `shared/` - reusable head/header snippets
- `_redirects` - Cloudflare/`/_redirects` rewrites (includes `/search` and `/.netlify/functions/:splat` → `/api/:splat`)
- `sitemap.xml`, `robots.txt` - manually maintained
- `affiliate-links.json`, `donation-links.json` - support/affiliate data

Important areas:

- `PC/`, `The Setup/`, `Keyboard/` - gear/setup pages (nav label **Gaming Setups**; `Keyboard/60he.html` is a chooser hub — `KEYBOARD_HUB_RUNBOOK.md`)
- `Socials/` - social hub/cloud/feed work (X sync: `X_TOP_POSTS_SYNC_RUNBOOK.md`)
- `Donators/`, `Achievements/`, `Referrals/` - support/community features (Twitch: `TWITCH_DONATOR_HANDOFF.md`)
- `Gaming/`, `Counter-Strike/` - CS2/gaming content (inventory: `STEAM_CS2_INVENTORY_RUNBOOK.md`)
- `dev/dev-stack.html` - Programs page (`data-nav="Dev"`)
- `mockups/` - experimental designs, not production unless requested
- `package/` - vendor/package artifact docs, not project documentation

## Work Rules

- Treat the worktree as user-owned; many files may already be modified.
- Check `git status --short` before and after substantial edits.
- Make scoped edits and preserve unrelated user changes.
- Reuse existing styles/components before adding new systems.
- Keep global CSS changes conservative.
- For public media/photo/setup changes, run `node .\dev\media-accessibility-check.mjs` when practical.

## Cross-Platform Pointers

Platform-specific files should stay tiny and point here:

- `codex.md`
- `CLAUDE.md`
- `cursor.md`
- `GEMINI.md`
- `ANTIGRAVITY.md`
- `OLLAMA.md`

