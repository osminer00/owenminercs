# Markdown And Memory File Audit

Audit date: 2026-04-28

## Scope

Reviewed repo Markdown files and assistant memory/config-style files:

- Top-level Markdown: `codex.md`, `CLAUDE.md`, `cursor.md`, handoff docs, monetization docs, checklist docs.
- Package Markdown: `package/README.md`, `package/LICENSE.md`, `package/DISCLAIMER.md`, `package/VERSIONING.md`.
- Memory/config-adjacent files: `.cursor/rules/context7.mdc`, `.cursor/mcp.json`, `.claude/settings.json`, `.claude/settings.local.json`, `.claude/worktrees/festive-thompson-09040c/handoffs/*.md`.

The existing git worktree is heavily modified and user-owned, so this audit intentionally avoids changing existing docs.

## Executive Summary

The project has good operational memory, but it is spread across too many files with mixed freshness. The highest-value cleanup is to separate active agent guidance from historical handoffs, fix encoding/mojibake, and consolidate overlapping monetization docs.

Priority order:

1. Make `codex.md`, `CLAUDE.md`, and `cursor.md` consistent, current, and encoding-clean.
2. Archive or move stale handoff docs into a clearly marked `handoffs/archive/` folder.
3. Consolidate the affiliate/monetization guides into one current source of truth plus one short checklist.
4. Exclude or vendor-label `package/` docs from project audits because they are Simple Icons package docs, not OwenMinerCS project docs.
5. Review `.claude/settings.local.json` permissions because it contains broad command allowances and local token/environment references.

## Key Findings

### 1. Encoding Drift In Several Docs

Files with visible mojibake include:

- `CLAUDE.md`
- `cursor.md`
- `ACTIONABLE_CHECKLIST.md`
- `README_MONETIZATION.md`
- `QUICK_START.md`
- `MONETIZATION_STRATEGY.md`
- `ACHIEVEMENT_SOCIAL_BUTTERFLY_HANDOFF.md`
- `.cursor/rules/context7.mdc`
- `.claude/worktrees/festive-thompson-09040c/handoffs/*.md`

Examples include `â€”`, `â†’`, `â€œ`, `â€`, `âœ…`, and `ðŸ...` sequences.

Recommendation: normalize these files to UTF-8 and either preserve real symbols intentionally or convert to ASCII equivalents. For long-lived memory files, ASCII is safer.

### 2. Agent Memory Files Overlap

Active memory files:

- `codex.md`: best current agent guide. It covers project structure, coding style, commands, affiliate notes, media/accessibility review, git safety, and edit workflow.
- `CLAUDE.md`: shorter project summary with dev tooling and MCP notes, but has encoding issues and appears less complete than `codex.md`.
- `cursor.md`: useful historical handoff, but reads like a session log from 2026-04-20 rather than a stable project guide.

Recommendation: keep `codex.md` as the primary source of truth, then either:

- make `CLAUDE.md` and `cursor.md` short pointers to `codex.md`, or
- maintain a shared `AGENTS.md` and make all tool-specific files reference it.

### 3. Stale Handoffs Are Mixed With Active Docs

Top-level handoff docs:

- `ACHIEVEMENT_SOCIAL_BUTTERFLY_HANDOFF.md`
- `SOCIAL_CLOUD_AGENT_HANDOFF.md`
- `SOCIAL_CLOUD_CLICK_PLAYBACK_HANDOFF.md`
- `TWITCH_DONATOR_HANDOFF.md`
- `YOUTUBE_LOCAL_AUTOFILL_HANDOFF.md`

Nested handoff docs:

- `.claude/worktrees/festive-thompson-09040c/handoffs/antigravity.md`
- `.claude/worktrees/festive-thompson-09040c/handoffs/codex.md`
- `.claude/worktrees/festive-thompson-09040c/handoffs/cursor.md`
- `.claude/worktrees/festive-thompson-09040c/handoffs/ollama.md`
- `.claude/worktrees/festive-thompson-09040c/handoffs/visual-studio.md`

These are valuable, but some describe work that may already be complete or superseded. The nested `.claude/worktrees/...` copy also risks confusing future audits because it looks like project source.

Recommendation:

- Create `handoffs/active/` and `handoffs/archive/`.
- Move only currently actionable handoffs into `handoffs/active/`.
- Add `Status`, `Last reviewed`, and `Owner/agent` fields at the top of each handoff.
- Ignore or remove nested `.claude/worktrees/` from project documentation workflows once any needed work has been merged.

### 4. Monetization Docs Duplicate Each Other

Overlapping files:

- `README_MONETIZATION.md`
- `MONETIZATION_STRATEGY.md`
- `QUICK_START.md`
- `IMPLEMENTATION_GUIDE.md`
- `ACTIONABLE_CHECKLIST.md`
- `MARKETING_MEDIA_KIT.md`

The docs are useful but repeat setup steps, revenue projections, link examples, and compliance guidance. Several also claim files are "already" created or ready, which can become stale quickly.

Recommendation:

- Keep `README_MONETIZATION.md` as the overview.
- Keep `IMPLEMENTATION_GUIDE.md` as the technical reference.
- Keep `ACTIONABLE_CHECKLIST.md` as the working checklist, but update statuses.
- Fold `QUICK_START.md` into the README or checklist.
- Keep `MARKETING_MEDIA_KIT.md` separate as sponsorship/media collateral.
- Add dates and "source of truth" notes to avoid contradiction.

### 5. Package Markdown Is Vendor Documentation

The `package/` folder contains Simple Icons package documentation:

- `package/README.md`
- `package/LICENSE.md`
- `package/DISCLAIMER.md`
- `package/VERSIONING.md`

These should not be edited as OwenMinerCS docs unless the package is intentionally vendored and maintained locally.

Recommendation: mark `package/` as vendor/external in future audits, or remove it if it is only an extracted package artifact and not needed in source control.

### 6. Local Permission Files Need Review

Files:

- `.claude/settings.json`
- `.claude/settings.local.json`
- `.cursor/mcp.json`
- `.cursor/rules/context7.mdc`

Notes:

- `.cursor/mcp.json` references environment variables for GitHub and Brave Search, which is appropriate.
- `.claude/settings.local.json` includes broad allowances such as `Bash(npm install *)`, `Bash(node -e ' *)`, `Bash(npx playwright *)`, `WebSearch`, and commands that read user-level environment variables.
- `.claude/settings.json` contains a very specific eBay curl permission.

Recommendation: keep local permissions out of the project repo unless they are intentionally shared. If committed, reduce broad allowances and document why each is needed.

## Per-File Notes

### `codex.md`

Best project memory file. Keep and use as canonical agent guide. Possible improvements:

- Add `Last reviewed: 2026-04-28`.
- Mention that `package/` is vendor/package content.
- Mention that `.claude/worktrees/` is a nested worktree/cache area, not normal source.

### `CLAUDE.md`

Short and useful, but less complete than `codex.md` and has mojibake in path bullets. Recommended to rewrite as a clean pointer to `codex.md` plus Claude-specific notes.

### `cursor.md`

Useful, but it is a dated handoff rather than durable memory. Recommended to move completed/resolved sections to `handoffs/archive/` and leave only current Cursor-specific guidance.

### `ACHIEVEMENT_SOCIAL_BUTTERFLY_HANDOFF.md`

Actionable and specific. Needs encoding cleanup. Should get a status header because the requested renames may already be implemented or partially implemented.

### `SOCIAL_CLOUD_AGENT_HANDOFF.md`

Strong architecture handoff. Keep if the social cloud API work is still active. Add status and last-reviewed metadata.

### `SOCIAL_CLOUD_CLICK_PLAYBACK_HANDOFF.md`

Looks like a bug-specific handoff. Archive if fixed; otherwise add current reproduction status.

### `TWITCH_DONATOR_HANDOFF.md`

Still useful if Twitch/EventSub work is active. Add current hosting truth because it references Cloudflare while the repo also has Netlify functions.

### `YOUTUBE_LOCAL_AUTOFILL_HANDOFF.md`

Useful if YouTube local sync remains the chosen approach. Add current data file paths and whether API-less ingestion is still desired.

### `README_MONETIZATION.md`

Good overview but has mojibake and likely stale "what I've created" language. Convert to a neutral project doc.

### `MONETIZATION_STRATEGY.md`

Good strategy source, but some rates/program details may change over time. Mark as strategic guidance, not guaranteed current affiliate terms.

### `QUICK_START.md`

Useful, but mostly overlaps with `README_MONETIZATION.md` and `ACTIONABLE_CHECKLIST.md`. Merge or shorten.

### `IMPLEMENTATION_GUIDE.md`

Best technical monetization reference. Keep, but verify examples match the current `scripts/affiliate-links.js` API before treating as copy-paste ready.

### `ACTIONABLE_CHECKLIST.md`

Useful as a live task list. Needs status updates so it does not keep saying "this week" forever.

### `MARKETING_MEDIA_KIT.md`

Keep as separate sponsor/channel collateral. Fill in audience/reach numbers or mark placeholders clearly.

## Suggested Cleanup Plan

### Pass 1: Memory Files

- Clean encoding in `codex.md`, `CLAUDE.md`, `cursor.md`, and `.cursor/rules/context7.mdc`.
- Add last-reviewed metadata.
- Make `codex.md` canonical.
- Convert `CLAUDE.md` and `cursor.md` into short tool-specific pointers.

### Pass 2: Handoff Triage

- Create a `handoffs/` folder.
- Move active handoffs into `handoffs/active/`.
- Move stale/resolved handoffs into `handoffs/archive/`.
- Add status metadata to each active handoff.
- Decide whether `.claude/worktrees/` should be ignored, cleaned, or left as local-only.

### Pass 3: Monetization Docs

- Merge `QUICK_START.md` into `README_MONETIZATION.md` or `ACTIONABLE_CHECKLIST.md`.
- Update all checklist statuses.
- Fix encoding across all monetization docs.
- Verify examples against current files.

### Pass 4: Repo Hygiene

- Decide whether `package/` belongs in repo source.
- If kept, add an audit note that it is vendor content.
- Review `.claude/settings.local.json` before sharing/committing.

