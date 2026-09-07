# OwenMinerCS Agent Memory

Last reviewed: 2026-09-07

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

Static personal website for Owen Miner / OwenMinerCS. Mostly hand-written HTML, CSS, and browser JavaScript. Live deploy is GitHub + Cloudflare Pages; `netlify/functions/` twins and `_redirects` remain for compatibility.

Key files:

- `index.html` - home page
- `css/owenminercs.css` - shared global CSS
- `scripts/components.js` - shared custom elements/header/footer/social dock/achievements
- `shared/` - reusable head/header snippets
- `_redirects` - Netlify redirects
- `sitemap.xml`, `robots.txt` - manually maintained
- `affiliate-links.json`, `donation-links.json` - support/affiliate data

Important areas:

- `PC/`, `The Setup/`, `Keyboard/` - gear/setup pages
- `Socials/` - Content cloud; cards from `Socials/data/` + Reddit, not `/api/social-feed` (`SOCIAL_CLOUD_DATA_RUNBOOK.md`)
- `Donators/`, `Achievements/`, `Referrals/` - support/community features (Twitch activity UI on Donators is paused)
- `Gaming/`, `Counter-Strike/` - CS2/gaming content
- `QA/` - public FAQ + Discord-mirrored answers (`DISCORD_QA_RUNBOOK.md`)
- `mockups/` - experimental designs, not production unless requested
- `package/` - vendor/package artifact docs, not project documentation

## Work Rules

- Treat the worktree as user-owned; many files may already be modified.
- Check `git status --short` before and after substantial edits.
- Make scoped edits and preserve unrelated user changes.
- Reuse existing styles/components before adding new systems.
- Keep global CSS changes conservative.
- For public media/photo/setup changes, run `node .\dev\media-accessibility-check.mjs` when practical.

## Focused docs

- `SHARED_COMPONENTS_GUIDE.md` / `SOCIAL_DOCK_RUNBOOK.md` — header, nav, social dock
- `DISCORD_QA_RUNBOOK.md` — Q&A feed + Discord bot env
- `SOCIAL_CLOUD_DATA_RUNBOOK.md` — Content page data sources
- `MUSIC_LISTEN_ALONG_RUNBOOK.md` — Spotify/suggestions (pretty `/music` is parked)
- `SITE_ASSISTANT_RUNBOOK.md` — `/api/site-assistant` (no HTML host on `main`)
- `TWITCH_DONATOR_HANDOFF.md` — EventSub setup; donator UI currently paused

## Cross-Platform Pointers

Platform-specific files should stay tiny and point here:

- `codex.md`
- `CLAUDE.md`
- `cursor.md`
- `GEMINI.md`
- `ANTIGRAVITY.md`
- `OLLAMA.md`

