# OwenMinerCS Agent Memory

Last reviewed: 2026-07-10

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

Static personal website for Owen Miner / OwenMinerCS. Mostly hand-written HTML, CSS, and browser JavaScript, with Cloudflare/GitHub deployment and serverless helpers (`functions/api/`, legacy `netlify/functions/`) plus local sync scripts.

Key files:

- `index.html` - home page
- `css/owenminercs.css` - shared global CSS
- `scripts/components.js` - shared custom elements/header/footer/social dock/achievements
- `shared/` - reusable head/header snippets
- `_redirects` - Netlify redirects
- `sitemap.xml`, `robots.txt` - manually maintained
- `affiliate-links.json`, `donation-links.json` - support/affiliate data
- `memory/future-work.md` - deferred site tasks and content ideas (read when the user asks about backlog, reminders, or “stuff to do later”)

Important areas:

- `PC/`, `The Setup/`, `Keyboard/` - gear/setup pages
- `Socials/` - social hub/cloud/feed work
- `Donators/`, `Achievements/`, `Referrals/` - support/community features
- `Gaming/`, `Counter-Strike/` - CS2/gaming content
- `mockups/` - experimental designs, not production unless requested
- `package/` - vendor/package artifact docs, not project documentation

## Work Rules

- Treat the worktree as user-owned; many files may already be modified.
- Check `git status --short` before and after substantial edits.
- Make scoped edits and preserve unrelated user changes.
- **User-written copy only (default):** Do not add or publish visible page text the user did not write or explicitly approve in chat — no AI-drafted intros, FAQs, SEO ledes, cross-link paragraphs, meta/JSON-LD prose blocks, or “helpful” filler. If copy is needed, propose it in the chat and wait for approval before putting it in HTML. Exceptions without asking: required legal/affiliate disclosure blocks already standardized on the site (`affiliate-disclosure`, footer `disclosure=`, `affiliate-links.json` templates), alt text for accessibility, and tiny structural labels (e.g. nav/button text) when the user asked for the feature. See `memory/preferences.md` → **Copy approval**.
- **No em dashes (hard rule):** Do **not** use em dashes (`—`, U+2014) or spaced double hyphens (` -- `) in agent-written visible site copy, titles, ledes, captions, alt text, meta descriptions, or agent-written prose in memory/docs. That punctuation reads as AI slop on this site. Use periods, commas, colons, or parentheses instead. Keep dashes verbatim only when the user explicitly wrote that exact dash in approved copy. See `memory/preferences.md` → **No em dashes**.
- Reuse existing styles/components before adding new systems.
- Keep global CSS changes conservative.
- **Subpage density:** Hub pages keep current density; detail/subpages need more content per scroll — compact heroes, `.subpage-gallery--dense` on photo grids, tight section rhythm. See `memory/preferences.md` → **Subpage density**.
- **SEO intro placement:** Long keyword or cross-link SEO paragraphs belong at the **bottom** of the page (de-emphasized, still in DOM), not in the hero under the title. Hero = `h1` + disclosure + optional one-line tagline only. See `memory/preferences.md` → **SEO intro placement**.
- **Links must look like links:** Inline `<a>` in body/card/prose copy must be visibly clickable (accent color + underline, `#d946ef` on the purple bubble theme), not inherited plain text. Do not rely on default link styling inside dark card wrappers. See `memory/issues.md` → **Inline `<a>` links look like plain text**.
- For public media/photo/setup changes, run `node .\dev\media-accessibility-check.mjs` when practical.
- **Affiliate URL format:** Amazon and AliExpress compensated links use **search** URLs (not direct `/dp/` or `/item/` product pages) so links survive delistings. See `memory/preferences.md` → **Affiliate link URL format**; get user approval before bulk link migrations.
- **On-site embeds:** In content sections, prefer YouTube/TikTok/X embeds or in-site detail pages over outbound watch/post links. See `memory/preferences.md` → **On-site embeds**; bulk changes need an audit list and user approval first.

## Cross-Platform Pointers

Platform-specific files should stay tiny and point here:

- `codex.md`
- `CLAUDE.md`
- `cursor.md`
- `GEMINI.md`
- `ANTIGRAVITY.md`
- `OLLAMA.md`

