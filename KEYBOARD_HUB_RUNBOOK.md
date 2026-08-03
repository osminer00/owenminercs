# Keyboard Hub Runbook

Last verified: 2026-08-03

## Purpose

`Keyboard/60he.html` is an intentional **chooser hub**, not a missing long-form guide. Build detail lives on year-specific child pages. Do not “restore” a monolith into `60he.html` unless product explicitly asks to collapse the split again.

## Page map

| URL | Role |
| --- | --- |
| `Keyboard/60he.html` | Hub landing: pick 2025 Kilowatt or 2023 Crosshair/v1 |
| `Keyboard/60he-2025.html` | 2025 Kilowatt write-up (parts, photos, notes) |
| `Keyboard/60he-2023.html` | 2023 Crosshair Alpha + v1 archive (parts, photos, lubing clips) |

Inbound links, sitemap entries, and search-index paths that point at `Keyboard/60he` should land on the hub. Deep-link to `60he-2025` / `60he-2023` when a specific build is intended.

## Nav / tour behavior

Shared chrome in `scripts/components.js` treats Keyboard 60HE URLs as part of the **Gaming Setups** section:

- Active highlight: `/Keyboard/…60he…` → `data-nav="The Setup"`
- Main-nav tour slot: same (`The Setup`); Keyboard is not its own tour slot

Visible main-nav label for that section is **Gaming Setups**; stable key remains `The Setup`.

## Constraints

- Keep hub copy short: one job (choose a build page). Full parts lists belong on the child pages.
- Affiliate disclosure on the hub footer matches Amazon Associates usage on these pages.
- Search index may list all three paths with `manualTerms` boosts; update all three when titles or routes change.
- Case-sensitive hosting: directory is `Keyboard/` (capital K).

## Manual verification

1. Open `/Keyboard/60he` and confirm two cards/links to `60he-2025.html` and `60he-2023.html`.
2. Confirm each child page loads and still has the detailed guide content.
3. Confirm shared header highlights **Gaming Setups** on hub and child pages.
4. Confirm search hits for “wooting” / “kilowatt” still resolve to useful Keyboard paths after index edits.

## Pitfalls

- Automations that paste the old combined guide back into `60he.html` undo the hub UX shipped in commit `64af4a4`. Prefer fixing inbound copy that still promises “full parts list” at the hub URL, or deep-linking to the correct year page.
- Do not rename `Keyboard/` or drop year pages without updating `_redirects`, sitemap, search index, and setup-hub cards.
