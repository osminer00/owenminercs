# Donators Page Runbook

Last verified: 2026-09-21 against `main`.

## Purpose

`Donators/donators.html` is the public thank-you wall for **Ko-fi** and **StreamElements** supporters. Treat `TWITCH_DONATOR_HANDOFF.md` as EventSub **server** ops (Cloudflare functions, Redis, env vars). That handoff’s “already implemented” client polling is **not** what ships today.

Keep this document in sync with:

- `Donators/donators.html` — page markup.
- `scripts/donators.js` — JSON load, filtering, cards, donate dialogs.
- `scripts/support-links.js` — rewrites hero `href`s from `donation-links.json`.
- `Donators/donators.json` — static supporter list.
- `donation-links.json` — public Ko-fi / StreamElements / Steam trade URLs.
- `dev/sync-donators-from-csv.mjs` — CSV import into `donators.json`.

## Shipped client behavior

`scripts/donators.js` currently:

- Loads `donators.json` (override with `data-source` on the script tag).
- Fetches `/donation-links.json` for tip URLs (falls back to `ko-fi.com/owenminer` and `streamelements.com/owenminercs/tip`).
- Filters supporters with `ACTIVE_PLATFORMS = { kofi: true, streamelements: true }`. Twitch, YouTube, and other platforms in JSON are dropped from cards and totals.
- Calls `fetchTwitchFeed()` which is stubbed as `Promise.resolve(null)`. It does **not** hit `/api/twitch-feed` or `/.netlify/functions/twitch-feed`.
- Renders only `#donators-summary` and `#donators-list`. Follower and live-activity renderers exist in JS but the HTML has no `#donators-followers-list` or `#donators-activity-list`, so those functions return immediately.

Do not describe auto-refresh, live bits/subs, or follower totals as current UI.

## Public surface

Hero row (static HTML, URLs patched by `support-links.js`):

- `a[data-kofi-link]` — Ko-fi. Shared chrome also binds `data-kofi-link` clicks to the **floating overlay** when the Ko-fi iframe is same-origin (`scripts/components.js`).
- `a[data-streamelements-tip-link]` — StreamElements tip (new tab).
- `a[data-steam-trade-link]` — Steam trade offer. Hero only; not an `ACTIVE_PLATFORMS` card source.

Summary pills (JS): Ko-fi count and StreamElements count. Clicks open page-local dialogs, not the floating overlay:

- Ko-fi: centered `<dialog>` iframe of the profile URL with `hidefeed=true&widget=1&embed=1`.
- StreamElements: `window.open` popup (~520×700). Their tip page sends `X-Frame-Options: SAMEORIGIN`, so it is **not** iframed. If the popup is blocked, a dialog with a new-tab link is shown.

Empty list copy still mentions Twitch EventSub. That string is leftover; connecting EventSub alone will not show cards until `fetchTwitchFeed` and HTML hooks are restored.

## `donators.json` shape

```json
{
  "updatedAt": "2026-04-16",
  "notes": "Add entries manually or regenerate via dev/sync-donators-from-csv.mjs.",
  "followers": {
    "twitch": "",
    "youtube": "",
    "facebook": "",
    "instagram": "",
    "tiktok": ""
  },
  "supporters": [
    {
      "name": "Example",
      "platform": "streamelements",
      "kind": "donation",
      "amount": "$6.90",
      "currency": "USD",
      "date": "2026-04-16",
      "message": "optional note"
    }
  ]
}
```

Card rules:

- `platform` must be `kofi` or `streamelements` (after lowercase normalize) or the row is skipped.
- `kind`: `donation`/`tip`, `subscription`/`sub`/`membership`, `bits`/`cheer`. Unknown kinds with a numeric `amount` become donations.
- A row renders only if it has donations, bits, or subscribers `> 0`. A Ko-fi row with an empty `amount` will not appear.

`followers` is unused on the current page (missing DOM). Keep the object if you still want it for a future restore.

## CSV sync

```bash
node dev/sync-donators-from-csv.mjs --kofi-csv ./exports/kofi.csv --streamelements-csv ./exports/se.csv
```

Also accepts `--twitch-csv`, `--youtube-csv`, `--out`. Header matching is case-insensitive for `name` / `display name` / `username` / `amount` / `date` / `message` / `kind`.

**Pitfall:** the writer replaces the whole file with `{ updatedAt, notes, supporters }`. It does **not** merge or preserve existing `followers`. Twitch/YouTube CSV rows are written, then the page filters them out via `ACTIVE_PLATFORMS`.

Re-apply follower counts after a CSV run if you still store them, or edit JSON by hand for Ko-fi/SE-only updates.

## Constraints and pitfalls

- Do not re-enable Twitch cards by only deploying EventSub. You must restore `fetchTwitchFeed()`, add the activity/followers markup, and add `twitch` to `ACTIVE_PLATFORMS` (Twitch feed events currently bypass the platform filter, but static JSON rows do not).
- Ko-fi hero (`data-kofi-link`) and Ko-fi summary pills are different UX: overlay vs centered embed.
- `scripts/support-links.js` and `donators.js` both fetch `donation-links.json`; keep URLs https-only.
- Amount parsing strips non-numeric characters (`$6.9` works). Missing amount → no card.

## QA checklist

1. Load `/Donators/donators`. Only Ko-fi and StreamElements pills appear.
2. Known SE/Ko-fi JSON rows with amounts render; a `platform: "twitch"` row does not.
3. Ko-fi pill opens a modal iframe; StreamElements pill opens a popup or fallback dialog.
4. Hero Steam trade link still goes to `donation-links.json` `steam_trade_offer`.
5. Break `donators.json` fetch (rename) and confirm `#donators-error` unhides.
6. After CSV import, confirm `followers` is still present if you need it, then reload the page.
