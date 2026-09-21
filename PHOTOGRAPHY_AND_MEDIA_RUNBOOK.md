# Photography And Media Checks Runbook

Last verified: 2026-09-21 against `main`.

## Purpose

Photography is not a standalone public section. The old `/Photography/photography` URL redirects to the shop photography block. Alt-text helpers and two Node checks keep setup/photo pages scannable and keep retired personal-bio copy off production HTML/JSON.

Keep this document in sync with:

- `Garage Sale/garage-sale.html` — live gallery mount (`#photography`).
- `Photography/photography.html` — meta refresh + canonical to the shop.
- `Photography/scripts/photography.js` and `Photography/photos.json`.
- `scripts/accessible-media.js`.
- `dev/media-accessibility-check.mjs` and `dev/public-content-regression-check.mjs`.

## Where photos render

`Photography/photography.html` is a stub:

- `<meta http-equiv="refresh" content="0; url=/Garage%20Sale/garage-sale.html#photography">`
- `rel="canonical"` points at the shop hash.
- `_redirects` also 301s `/Photography/photography` and `.html` to `#photography`.

The shop page sets embed globals **before** the gallery script:

```html
<script>
  window.OWEN_PHOTOS_JSON = '../Photography/photos.json';
  window.OWEN_PHOTOS_BASE = '../Photography/';
</script>
<script src="../scripts/accessible-media.js"></script>
<script src="../Photography/scripts/photography.js"></script>
```

`photography.js` defaults to `photos.json` next to the HTML if those globals are unset. Relative `thumb` / `full` paths are prefixed with `OWEN_PHOTOS_BASE`. Absolute `http(s)`, `data:`, and root-relative paths are left alone.

Required DOM ids: `#photography-gallery`, `#photo-dialog`, plus dialog children (`#photo-dialog-img`, title, date, license, download, print, close). Optional: `#photography-empty`, `#photography-error`.

## `photos.json` shape

```json
{
  "signedPrintDefaultUrl": "/Garage%20Sale/garage-sale.html#for-sale",
  "freeUseNote": "You may download and use this image for personal, non-commercial purposes…",
  "years": [
    {
      "year": 2026,
      "photos": [
        {
          "title": "Desk at night",
          "alt": "Gaming desk with monitors and plants in low light",
          "caption": "Desk at night",
          "dateTaken": "2026-04-01",
          "thumb": "images/desk-thumb.webp",
          "full": "images/desk-full.webp",
          "downloadFilename": "desk-at-night.webp",
          "signedPrintUrl": ""
        }
      ]
    }
  ]
}
```

Behavior:

- Years sort descending. Empty `years` (current `main`) shows `#photography-empty`.
- Dialog license text is `freeUseNote`. Download uses `full` (fallback `thumb`) and `downloadFilename` or a slug from `title`.
- Print CTA: per-photo `signedPrintUrl` if the key exists (empty string hides the button); otherwise `signedPrintDefaultUrl`. Today that default is the shop For Sale hash.
- If `AccessibleMedia` is loaded, missing alt/title are filled from `describePhoto` / `captionPhoto`.

## Accessible media (runtime)

`scripts/accessible-media.js` exposes `window.AccessibleMedia` and on `DOMContentLoaded`:

- Strengthens keep-card thumbs (`.keep-card img.keep-card__thumb`) from `.keep-card__label`.
- Labels empty thumbs (`.keep-card__thumb--empty[role="img"]`) as “photo coming soon”.
- Strengthens `.setup-panorama img` and legacy `.bd4` / `.column` / `.column2` images; inserts `.auto-media-caption` after those images unless they sit in a keep-card or photography tile.

Weak alt = empty, shorter than 8 characters, or exactly `image|photo|picture|untitled|img|setup`. Suggested alt is clipped to 160 characters; captions to 92.

## Media accessibility preview (pre-publish)

```bash
node dev/media-accessibility-check.mjs
node dev/media-accessibility-check.mjs --fail-on-review
```

Scans:

- Every photo in `Photography/photos.json`.
- `<img>` tags in `The Setup/the-setup.html`, `Desk Setup/setup.html`, and `Photography/photography.html` (skips `#photo-dialog-img` and `.site-logo`).

It prints current vs suggested alt/caption. Default exit is `0` even when items need review. `--fail-on-review` exits `2` if any row is `REVIEW`.

The PowerShell wrapper `dev/publish-with-media-check.ps1` runs the preview, then requires typing `PUBLISH` before an optional `-PublishCommand`. The sample command in that script still says `netlify deploy --prod`. Live hosting is **GitHub + Cloudflare Pages**; pass the actual publish command or run the Node preview alone.

AGENTS.md: run this check when changing public setup/photo media.

## Public content regression

```bash
npm run test:content
```

Walks public `.html` / `.json` (skips `.git`, `.claude`, `.cursor`, `.vscode`, `backup-pre-the-setup-2026-04-08`, `dev`, `memory`, `mockups`, `node_modules`, `package`, plus `package.json`, `package-lock.json`, `site-search-index.json`, `search-manual-keywords.json`).

Fails if it finds:

- `DMACC`
- JSON-LD `"alumniOf"`
- Old graduate / “While at DMACC…” bio sentences

Archived mockups/backups are excluded from the walk, but production pages must stay clean. `npm test` is separate (currently `test/social-dock-regression.test.mjs`).

## Posts (not public)

`Posts/scripts/posts.js` expects `#site-posts-root` and a lightbox dialog. There is no production `posts.html`. `Posts/posts.json` is `{ "posts": [] }`. `Posts/post-builder.html` is a local authoring helper that downloads JSON; it is not linked from main nav. Do not treat Posts as a live route.

## Constraints and pitfalls

- Adding photos only under `Photography/` will not show them until `years[].photos` is filled; the standalone HTML page will still redirect to the shop.
- Shop embed paths are relative (`../Photography/…`). Do not copy `photography.js` onto a deeper page without resetting `OWEN_PHOTOS_JSON` / `OWEN_PHOTOS_BASE`.
- Media check does **not** scan every setup category HTML file — only the hub, legacy desk setup, photography stub, and `photos.json`. Category pages still rely on `accessible-media.js` at runtime.
- Empty `signedPrintUrl: ""` hides the print button even when `signedPrintDefaultUrl` is set, because the key is present.

## QA checklist

1. `/Photography/photography` lands on garage-sale `#photography`.
2. With `years: []`, the empty message is visible; after adding one photo, a year heading and tile appear.
3. Dialog: download filename, license note, print CTA visibility.
4. Run `node dev/media-accessibility-check.mjs` after photo/setup media edits.
5. Run `npm run test:content` before publishing HTML/JSON that might reintroduce bio/alumni copy.
