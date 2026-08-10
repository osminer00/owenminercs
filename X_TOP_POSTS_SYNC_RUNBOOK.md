# X Top-Posts Sync Runbook

Last verified: 2026-08-10

## Purpose

`scripts/sync-x-top-posts.py` builds local Social Cloud card data for X/Twitter by ranking recent media posts and writing `Socials/data/x-top-posts.json`.

Keep this document in sync with:

- `scripts/sync-x-top-posts.py`
- `Socials/data/x-top-posts.json`
- `scripts/components.js` (`socialNavMarkup` X URL / `@OwenMiner`)
- `SOCIAL_DOCK_RUNBOOK.md` (profile URL table)

## Workflow

```text
Nitter RSS (timeline + min_faves search)
  → status IDs
  → api.fxtwitter.com enrichment (likes/media)
  → rank by score, cap MAX_ITEMS
  → Socials/data/x-top-posts.json
```

### Defaults (current source)

| Constant / input | Value | Notes |
| --- | --- | --- |
| `DEFAULT_USERNAME` | `OwenMiner` | Fallback when dock markup cannot be parsed |
| Username resolution | `resolve_username_from_nav()` | Prefers the X href in `scripts/components.js` |
| `MAX_ITEMS` | `20` | Max posts written |
| `MIN_LIKES` | `1` | Used in the Nitter search RSS query |
| Output | `Socials/data/x-top-posts.json` | Pretty-printed JSON + trailing newline |

### Run locally

```bash
python3 scripts/sync-x-top-posts.py
```

Success prints something like: `Wrote N post(s) for @OwenMiner to …/x-top-posts.json`.

Review the JSON diff before committing. Do not commit secrets; this script uses public Nitter/FxTwitter endpoints only.

## Constraints

- Public handle on dock/meta surfaces is `@OwenMiner` / `https://x.com/OwenMiner` (not `@owenminercs`). Keep sync default and dock URL aligned.
- Upstream (Nitter / FxTwitter) can fail or return empty; treat empty output as suspicious when the existing file still has posts.
- Social Cloud UI expects the committed JSON shape used elsewhere under `Socials/data/`—do not invent alternate field names without updating the cloud renderer.

## Known pitfall on `main` (verify before ops changes)

As of 2026-08-10, `main()` always writes the built list, including `[]`, with no fail-closed guard against wiping a non-empty committed file when upstream fetch fails. Before running sync in automation:

1. Diff `Socials/data/x-top-posts.json` after the script exits.
2. Reject / do not commit an unexpected empty array overwrite.
3. Prefer a fail-closed code change (refuse empty overwrite when existing posts remain) if one is available on a fix branch—do not document that fix as shipped until it is on `main`.

## Manual verification

1. Confirm dock X link is `https://x.com/OwenMiner`.
2. Run the script; confirm username in the success line is `OwenMiner` (or the intentional handle).
3. Open `Socials/socials.html` (or Content) and confirm X cards still render from the updated JSON.
4. If the script writes `0` posts, restore the previous JSON and investigate upstream before publishing.
