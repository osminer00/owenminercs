# Keyboard 60HE Hub Runbook

Last verified: 2026-08-24

## Purpose

`Keyboard/60he.html` is an **intentional chooser hub**, not a content-loss bug. It points at year-specific build write-ups instead of duplicating both builds in one document.

Keep this document in sync with:

- `Keyboard/60he.html` — landing / chooser
- `Keyboard/60he-2025.html` — Kilowatt (Tofu 60 Redux, Jade Pro)
- `Keyboard/60he-2023.html` — Crosshair Alpha + v1 archive (parts, photos, lubing clips)

## Architecture

```text
Shared nav / search / affiliates
        │
        ▼
Keyboard/60he.html     ← chooser only (two cards)
   ├── 60he-2025.html  ← 2025 Kilowatt
   └── 60he-2023.html  ← 2023 Crosshair Alpha & v1
```

Do **not** restore a monolith into `60he.html` unless the user explicitly asks. A previous duplicate-document bug was fixed by making this hub; treating the short landing page as accidental truncation reintroduces that merge conflict.

## Usage

- Hub H1: “Wooting 60HE Build Guides”.
- Cards link with relative `./60he-2025.html` and `./60he-2023.html` (local `.html` paths).
- Affiliate disclosure is on the hub footer (`shared-footer`).
- Search index `manualTerms` on all three paths boost queries like `lekker`, `kilowatt`, `crosshair alpha`.

## Pitfalls

- Paths are case-sensitive on production hosting; keep `Keyboard/` casing.
- Images live under `Keyboard/images/` (hub uses `killowattKeyboard.webp` and the wood-background top view).
- Nav “Gaming Setups” still routes to `The Setup/the-setup`, not this hub. Keyboard remains a setup-area page, not a main-nav slot.
