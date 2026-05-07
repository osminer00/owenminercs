# Developer Workflow

This site is mostly static HTML, CSS, and browser JavaScript. The repository
also includes a small Node toolchain for formatting, linting, and regression
checks.

## Setup

From the repository root:

```sh
npm install
```

The package scripts are defined in `package.json`. They do not build the site;
they validate the hand-written source files and public content.

## Validation commands

Use the checks that match the files you changed:

| Command | Covers | When to run |
| --- | --- | --- |
| `npm run format:check` | Prettier over `html`, `css`, `js`, `json`, and `md` files | Before publishing broad edits or documentation changes |
| `npm run lint:css` | Stylelint over CSS, honoring `.stylelintignore` | After CSS changes |
| `npm run lint:html` | HTMLHint over site HTML, excluding `.claude/**` | After HTML structure changes |
| `npm test` | Node test files in `test/*.test.mjs` | After shared component, CSS, or homepage metadata changes |
| `npm run test:content` | Public HTML/JSON content regression rules | After public page or data changes that could reintroduce removed bio/schema content |

## Current automated tests

`npm test` runs Node's built-in test runner against files in `test/`.

Current coverage:

- `test/social-dock-regression.test.mjs` reads `scripts/components.js`,
  `css/owenminercs.css`, and `index.html`.
- It verifies social dock drag-lock behavior, matching CSS for the first-drag
  horizontal state, and the homepage Impact site-verification meta tag.

When adding a regression test, keep it focused on stable behavior and source
contracts. These tests currently inspect source text rather than running a full
browser.

## Public content regression check

`npm run test:content` executes `dev/public-content-regression-check.mjs`.

Intent:

- protect public pages and public JSON data from restoring removed DMACC/alumni
  biography content;
- catch accidental `schema.org` `alumniOf` fields on production-facing content;
- avoid scanning implementation files, memory notes, mockups, vendored package
  content, and generated search indexes.

The checker walks public `.html` and `.json` files from the repo root, excluding
directories such as `dev`, `memory`, `mockups`, `node_modules`, and `package`.
It also skips generated search artifacts by basename:

- `site-search-index.json`
- `search-manual-keywords.json`

If the check fails, prefer fixing the public content that triggered it. Only
change the forbidden patterns when the underlying content policy has changed.

## Common pitfalls

- Paths are case-sensitive on production-style static hosting. Match actual
  directory casing when editing links, redirects, sitemap entries, or canonical
  URLs.
- Some project paths contain spaces, such as `The Setup/`; quote paths in shell
  commands and scripts.
- `package/` contains vendor/package documentation and should not be treated as
  active OwenMinerCS project docs.
- The worktree may already contain user-owned changes. Check `git status
  --short` before and after scoped edits.
