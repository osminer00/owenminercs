# X Top Posts Sync Runbook

Last verified: 2026-08-24

## Purpose

Local build-time script fills Social Cloud X cards from public Nitter RSS + FxTwitter, then writes ranked media posts to a committed JSON file. The live Socials page does **not** call a hosted X API.

Keep this document in sync with:

- `scripts/sync-x-top-posts.py` — fetcher / writer
- `Socials/data/x-top-posts.json` — committed output
- `Socials/scripts/social-cloud.js` — reads `LOCAL_X_TOP_POSTS_PATH`
- `scripts/components.js` — `socialNavMarkup` X URL (username source)

## Workflow

```text
python3 scripts/sync-x-top-posts.py
        │
        ├─ username from first https://x.com/{handle} in scripts/components.js
        │   (fallback DEFAULT_USERNAME = "OwenMiner")
        ├─ Nitter search RSS (min_faves:100) then profile RSS
        ├─ skip RT / reply titles; enrich via api.fxtwitter.com
        ├─ keep original tweets with media (photo/video/gif) and likes >= 1
        └─ write Socials/data/x-top-posts.json (max 20, ranked by likes/views/comments/date)
```

Current dock handle: `https://x.com/OwenMiner` (`@OwenMiner`). Changing the dock URL changes the next sync target.

## Constraints

- Media-only: tweets without photo/video/gif are dropped.
- Author `screen_name` must match the resolved username (case-insensitive).
- RSS failures are swallowed per source so the other URL can still run.
- Ranking key: `(likeCount, viewCount, commentCount, publishedAt)` descending.

## Fail-closed ops pitfall (still on `main`)

`main()` **always overwrites** `Socials/data/x-top-posts.json`, including when `build_top_posts()` returns `[]` (Nitter down, FxTwitter empty, handle mismatch). That wipes committed cards.

Until a fail-closed fix lands (unmerged critical-bug PRs exist; do not assume they shipped):

1. Diff `Socials/data/x-top-posts.json` before committing.
2. If the file became `[]` or a tiny unexpected list, **do not commit**; restore the previous JSON.
3. Confirm Nitter RSS and FxTwitter still return the handle’s media posts.
4. Re-run only after sources look healthy.

## Manual verification

1. Confirm `DEFAULT_USERNAME` and the dock `https://x.com/…` match the intended public handle.
2. Run the script; stdout prints `Wrote N post(s) for @handle to …`.
3. Open `Socials/socials.html` and confirm X cards still render from the local JSON.
4. Never treat an empty write as a successful sync.
