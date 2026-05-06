# Shared Site Chrome Guide

This guide documents the shared header, footer, Social Cloud layout overrides, and verification
metadata that are easy to break when changing page chrome.

## Source of truth

- `scripts/components.js` defines the `shared-header` and `shared-footer` custom elements.
- `css/owenminercs.css` owns global `site-card-ui` chrome, shared footer layout, and footer social
  buttons.
- `Socials/social-cloud.css` owns Social Cloud-specific overrides for `body.socials-cloud-bg`.
- `Socials/scripts/social-cloud.js` measures header/footer height and renders Social Cloud card
  metadata.
- `index.html` currently contains the home-page Impact site verification meta tag.

## Using shared chrome on a page

Load the global stylesheet and components script, add `site-card-ui` to the body, then place the
custom elements around the page content:

```html
<link rel="stylesheet" href="../css/owenminercs.css" />
<script src="../scripts/components.js" defer></script>

<body id="top" class="site-card-ui">
	<shared-header></shared-header>
	<main class="container">...</main>
	<shared-footer></shared-footer>
</body>
```

`shared-footer` accepts an optional `disclosure` attribute for page-specific affiliate or support
copy. If the disclosure says "This page includes Amazon shopping links", the footer treats it as the
right-column disclosure and does not add the cross-page Amazon byline.

## Footer layout contract

The footer markup from `SharedFooter` is intentionally structured in two aligned bands:

1. `.site-footer-top-row`
   - Left: `.site-footer-social-bar`, which renders `socialNavMarkup('site-social-nav--footer')`.
   - Right: `.site-footer-bug-report`, two short Discord bug/suggestion lines.
2. `.site-footer-meta`
   - Left: creator byline and content-usage rights copy.
   - Right: disclosure copy and small home logo.

Global footer CSS keeps `.site-footer-top-row` and `.site-footer-meta` on matching two-column grids
with the same horizontal inset so the social buttons line up with credits and the bug report lines
up with disclosure. Below `52rem`, both grids collapse to one column and the bug report becomes
left-aligned.

Footer social buttons reuse the same social link markup as the draggable dock, but footer behavior is
static:

- No drag, rotate, reset, or floating-dock controls are shown in the footer.
- `.site-social-nav--footer .site-social-nav__links-level` is a 4 by 2 grid of eight social buttons.
- `.site-footer-social-bar` reserves vertical padding for custom tooltips. Row 1 tooltips open
  upward; row 2 tooltips open downward.
- Hover/focus fills use each brand's tooltip accent. Instagram has a multi-stop gradient override.

When adjusting footer spacing, keep the nav row, social/bug-report band, and disclosure band visually
tight. Large vertical padding makes short `site-card-ui` pages feel empty and can reduce visible
Social Cloud card space.

## Social Cloud chrome overrides

`Socials/socials.html` uses:

```html
<body id="top" class="site-card-ui socials-cloud-bg">
```

The page loads `owenminercs.css` first and `Socials/social-cloud.css` second. The Social Cloud CSS
intentionally overrides global footer chrome to keep moving cards visible:

- Header/footer backgrounds become lighter glass gradients with reduced padding.
- Footer nav, back-to-top, horizontal rules, and credits copy are hidden on this page.
- `.site-footer-top-row` switches from `1fr 1fr` to `auto minmax(0, 1fr)` so the compact 4 by 2 icon
  block does not create a large dead band before the Discord copy.
- `.site-footer-meta` becomes one column because only the disclosure/home mark remains visible.
- `.site-footer-social-bar` uses smaller tooltip padding than the global footer while preserving
  usable hover/focus labels.

Do not hard-code Social Cloud header or footer heights. `updatePageHeightBudget()` in
`Socials/scripts/social-cloud.js` measures `shared-header` and `shared-footer`, then writes
`--smc-header-h` and `--smc-footer-h` to `document.body`. Card clamping, status placement, and
portrait video max-height rules consume those variables.

### Card metadata row

`toContentCard()` formats each item into `publishedLabel` and `scoreLabel`. Rendering places those
values into a single `.smc-meta-trail` row above the title:

- Date text goes in `.smc-meta-line-marquee--date`.
- Metrics text goes in `.smc-meta-line-marquee--stats`.
- `.smc-meta-byline-sep` is hidden unless both date and stats exist.

The layout expectation is one horizontal date + stats row. Long date text can scroll horizontally;
stats overflow is clipped/scrollable without marquee clones. Avoid stacking date and stats on
separate lines unless the site preference changes.

## Impact verification metadata

`index.html` contains:

```html
<meta name="impact-site-verification" content="c2720152-1086-48f5-be5e-2dd0f0988bde" />
```

Keep the exact `name` and `content` values unless the affiliate platform issues a replacement token.
Before adding another verification tag, search the repo for `impact-site-verification` and verify
whether the platform requires a home-page-only tag or every HTML page.

## Change checklist

For footer or Social Cloud chrome changes:

1. Verify the rendered markup in `scripts/components.js`; CSS class names are shared by header,
   footer, and dock variants.
2. Check both global pages (`body.site-card-ui`) and `Socials/socials.html`
   (`body.socials-cloud-bg`).
3. Preserve the footer 4 by 2 icon grid, two-line bug report, disclosure copy, and usage-rights copy.
4. Preserve Social Cloud's measured height budget (`--smc-header-h`, `--smc-footer-h`) and single-row
   date/stats metadata.
5. Run relevant checks:

```powershell
npm run format:check
npm run lint:css
```

For verification meta changes, a text check is usually enough:

```powershell
rg "impact-site-verification|Impact|Govee" .
```
