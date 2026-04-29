# Issues And Diagnostics

Last reviewed: 2026-04-28

Use this file for active bugs, recurring failures, and diagnosis patterns future chats should remember.

## Active Issues

- Markdown/memory docs have encoding/mojibake in several files. See `MARKDOWN_AUDIT.md`.
- Agent memory is being consolidated around `AGENTS.md` and `memory/`.

## Recurring Patterns

- `body` sets `justify-content: center` with `min-height: 100vh`; `body.site-card-ui` must override with `justify-content: flex-start` and give the main column (`> .container`, `> main`, `> .calc-container`) `flex: 1 1 auto` so short pages do not vertically center header/content/footer on tall viewports.
- Worktree is often heavily modified before agent work starts. Always preserve unrelated changes.
- Some docs and handoffs are stale or duplicated; verify current source files before trusting old handoffs.
- Netlify/API code may exist in both `functions/api/` and `netlify/functions/`; check both before changing behavior.
- Local machine config file `.claude/settings.local.json` was once tracked; keep it gitignored and untracked to avoid leaking local command permissions or environment-related references.
- Affiliate widgets can over-generate marketplace search buttons from product names; for products without reliable marketplace listings, explicitly disable marketplace buttons and keep official/direct buy links.

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

