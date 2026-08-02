# Issues And Diagnostics

Last reviewed: 2026-04-28

Use this file for active bugs, recurring failures, and diagnosis patterns future chats should remember.

## Active Issues

- Markdown/memory docs have encoding/mojibake in several files. See `MARKDOWN_AUDIT.md`.
- Agent memory is being consolidated around `AGENTS.md` and `memory/`.

### 2026-08-02 - Twitch EventSub retry loss + related regressions

- Symptom: Follow/sub/bits webhooks can be permanently dropped after a Redis persist failure; X sync can wipe `Socials/data/x-top-posts.json` on empty fetch; `/search/` breaks CSS/JS via relative assets.
- Affected files/pages: `functions/api/twitch-eventsub.js`, `functions/api/_twitch-utils.js`, Netlify twins, `scripts/sync-x-top-posts.py`, `search.html`, `scripts/search-page.js`.
- Suspected cause: Idempotency key claimed before LPUSH and not released on failure; pipeline ignores per-command `{error}`; sync writes `[]` unconditionally; `/search/` rewrite + relative URLs.
- Fix attempted: Release claimed key on persist failure; treat pipeline entry errors as failures; fail-closed empty X sync overwrite; root-relative search assets + GET form.
- Verification: `npm test` regression suites for EventSub/pipeline/X sync/search.
- Status: needs follow-up (merge PR on `cursor/critical-bug-investigation-7533`; prior equivalent PRs #85/#88/#90/#92/#94/#96/#98/#100/#102/#104 unmerged)

## Recurring Patterns

- `initWordBackgroundGlow` wraps words in `<span class="text-word-glow">`. Do not use `display: flex; flex-direction: column` on those containers — each word becomes a flex item and stacks one word per line. Use normal block flow, or `flex-direction: row` with `flex-wrap: wrap` (see `Achievements/achievements.html` `.achievement-card__hint`).
- Centered main column vs fixed social dock: vertical scrollbar toggling used to shift `margin: auto` layout horizontally while the dock stayed fixed — looked like the dock moved. Fix: `html { scrollbar-gutter: stable; }` plus one `--site-gutter-x` for `.container` and `shared-header` / footer padding (`css/owenminercs.css`).
- Floating `#site-support-dock` default position must not use header/logo rects: pages differ (`body` `zoom`, scrollbars) and the bar would shift between routes. Default is fixed viewport `(2px, 2px)` after clamp (see `getSocialDockDefaultViewportPosition` in `scripts/components.js`).
- Inline `zoom: 95%` on `body`: do **not** inverse-zoom only `shared-header` / `shared-footer` — that mis-centered `.container` vs the sticky header (nested zoom). Header/footer/main now share body zoom; home/Socials without body zoom stay unchanged.
- `body` sets `justify-content: center` with `min-height: 100vh`; `body.site-card-ui` must override with `justify-content: flex-start` and give the main column (`> .container`, `> main`, `> .calc-container`) `flex: 1 1 auto` so short pages do not vertically center header/content/footer on tall viewports.
- Worktree is often heavily modified before agent work starts. Always preserve unrelated changes.
- Some docs and handoffs are stale or duplicated; verify current source files before trusting old handoffs.
- Netlify/API code may exist in both `functions/api/` and `netlify/functions/`; check both before changing behavior.
- Local machine config file `.claude/settings.local.json` was once tracked; keep it gitignored and untracked to avoid leaking local command permissions or environment-related references.
- Affiliate widgets can over-generate marketplace search buttons from product names; for products without reliable marketplace listings, explicitly disable marketplace buttons and keep official/direct buy links.
- Paths are case-sensitive on production-style static hosting. When adding shared nav/sitemap/canonical URLs, match the actual directory casing or add redirects for any previously published casing.

## Issue Template

```md
### YYYY-MM-DD - Short title

- Symptom:
- Affected files/pages:
- Suspected cause:
- Fix attempted:
- Verification:
- Status: active | fixed | needs follow-up
```

