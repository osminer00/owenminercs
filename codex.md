# Codex Guide

Read `AGENTS.md` first. It is the canonical low-token project memory entry point.

Use `memory/` for durable project state, preferences, issues, and decisions. Update those files when the user gives lasting site facts, bug patterns, ratios, workflow rules, or unresolved issues.

The notes below are kept for Codex-specific continuity.

## Project Snapshot

This is a static personal website for Owen Miner / OwenMinerCS. It is mostly hand-written HTML, CSS, and browser JavaScript, with a few Netlify/serverless helpers and local data-sync scripts.

- `index.html` is the home page.
- `css/owenminercs.css` is the shared global stylesheet.
- `scripts/components.js` defines shared custom elements such as the header/footer.
- `shared/` contains reusable header/head snippets.
- `_redirects` contains Netlify redirect rules.
- `sitemap.xml` and `robots.txt` are maintained manually.
- Netlify functions live in both `functions/api/` and `netlify/functions/`; check existing usage before changing either path.

The repo currently has many uncommitted and untracked files. Treat the worktree as user-owned. Do not clean, reset, rename, or delete unrelated files.

## Important Areas

- `About/` - profile/about content and images.
- `Gaming/`, `Counter-Strike/` - CS2 and gaming pages.
- `Keyboard/` - Wooting 60HE build page and related scripts/images.
- `PC/` and `The Setup/` - PC, desk, gear, and setup pages.
- `Garage Sale/` - resale/eBay-style inventory pages.
- `Donators/` - supporter wall and donation-related data.
- `Socials/` - social hub, cloud feed, and local sync data.
- `Photography/`, `Posts/`, `Music/`, `AI/`, `Services/`, `Upgrades/` - newer content sections.
- `mockups/` - experimental designs. Do not treat these as production pages unless requested.

## Coding Style

- Prefer small, direct edits that match the page you are touching.
- Keep pages static-first. Add JavaScript only when the interaction needs it.
- Reuse existing classes and components before adding new styling.
- Keep global CSS changes conservative because many pages share `css/owenminercs.css`.
- Preserve existing affiliate, support, analytics, SEO, and disclosure copy unless the task specifically changes it.
- Use relative links that match the surrounding file. Pages in subfolders usually need `../` for shared assets.
- Keep accessibility basics intact: meaningful alt text, visible link text, keyboard-friendly controls, and no decorative media without clear intent.

## Common Commands

There is no single package manager workflow in this repo. Most pages can be opened directly in a browser, but API-backed features may need local servers or Netlify.

Useful checks:

```powershell
node .\dev\media-accessibility-check.mjs
```

Publish wrapper with required manual review:

```powershell
.\dev\publish-with-media-check.ps1 -PublishCommand "netlify deploy --prod"
```

Local helper scripts:

```powershell
node .\scripts\local-social-feed-server.mjs
node .\scripts\local-twitch-eventsub-server.mjs
node .\dev\sync-donators-from-csv.mjs
node .\scripts\sync-youtube-local-feed.mjs
node .\scripts\sync-ebay-listings.mjs
```

Run only the scripts relevant to the change. Some sync scripts may need local files, credentials, or network access.

## Affiliate And Support Notes

- Product/link data is centralized in `affiliate-links.json` and handled by `scripts/affiliate-links.js`.
- Donation/support data uses `donation-links.json`, `scripts/support-links.js`, and Donators pages/scripts.
- Affiliate disclosures are user-facing legal copy. Keep them accurate and visible when shopping links are present.
- Do not replace placeholder affiliate URLs with guessed real IDs.

## Media And Accessibility

Before publishing public content that changes images, videos, setup media, or photo-heavy pages, run:

```powershell
node .\dev\media-accessibility-check.mjs
```

For production deploys, use:

```powershell
.\dev\publish-with-media-check.ps1 -PublishCommand "netlify deploy --prod"
```

This prompts for a manual media review and requires typing `PUBLISH` before running the publish command.

## Git Safety

- Check `git status --short` before and after substantial work.
- Assume unrelated modified/untracked files belong to the user.
- Do not use destructive git commands.
- Do not normalize formatting across unrelated files.
- If a file already has encoding artifacts, avoid broad rewrites unless the task is specifically about encoding cleanup.

## When Editing Pages

1. Inspect the target page and nearby scripts/styles first.
2. Check whether shared components or shared CSS already provide the needed pattern.
3. Update metadata, sitemap, redirects, or disclosures only when the content change requires it.
4. Verify by opening the static file or running the narrowest relevant script/check.
5. Summarize changed files and any checks that were skipped or blocked.
