# Discord Q&A Runbook

Last verified: 2026-09-07

## Purpose

The Q&A page (`QA/qa.html`) shows a short static FAQ plus a live feed of answered Discord posts. The feed is a public GET that never exposes the bot token.

Keep this document in sync with:

- `functions/api/discord-qa.js` — Cloudflare Pages Function
- `netlify/functions/discord-qa.js` — Netlify twin (same env names)
- `QA/scripts/qa-feed.js` — page client
- `QA/answered-qa.json` — committed static fallback
- `QA/DISCORD_TEST_PLAN.md` — community tester copy (not the API contract)

## Public surface

### Visitor path

1. Nav **Q&A** → `QA/qa` (`data-nav="QA"`).
2. Hardcoded FAQ in `QA/qa.html` (height + how to report a site bug).
3. `#discord-qa-feed` is filled by `qa-feed.js`.

Pretty URLs: `/qa` and `/qa.html` 301 to `/QA/qa` (`_redirects`).

### API

`GET /api/discord-qa`

Example success:

```json
{
  "source": "discord",
  "updated": "2026-09-07T16:00:00.000Z",
  "items": [
    {
      "id": "1234567890",
      "question": "How tall are you?",
      "answer": "…",
      "answeredAt": "2026-04-21T00:00:00.000Z",
      "url": "https://discord.com/channels/<guild>/<channel>/<message>"
    }
  ]
}
```

`source` is one of `discord`, `unconfigured` (no bot token), or `error` (500). Cache-Control is `public, max-age=45, s-maxage=120`. Non-GET returns 405.

## How answers are chosen

If `DISCORD_BOT_TOKEN` is missing, the function returns `{ source: "unconfigured", items: [] }` plus a setup `hint`.

Otherwise:

1. **Forum path** (when `DISCORD_QA_FORUM_CHANNEL_ID` and `DISCORD_GUILD_ID` are set): active + archived public threads on that forum. A thread is included only when it has more than one message (`message_count > 1`). Question = starter content (or thread name). Answer = remaining message contents joined with blank lines. Caps: 20 threads, 100 messages per thread, 25 archived threads listed.
2. **Text-channel path** if the forum path returned nothing: uses `DISCORD_QA_TEXT_CHANNEL_ID`, or finds a guild text channel (`type === 0`) named `DISCORD_QA_TEXT_CHANNEL_NAME` (default `questions-and-answers`). Last 30 messages. Each message must parse as markdown or embed Q&A.

Text-channel markdown:

```
**Q**: question text

**A**: answer text
```

Embed fallback: first embed `title` (optional `Q:` prefix) + `description` as the answer.

## Client merge rules

`QA/scripts/qa-feed.js`:

- On **localhost / 127.0.0.1 / file:** skip the live API (avoids calling Pages Functions from a static file server).
- On other hosts, fetch `{siteRoot}api/discord-qa` first.
- Always merge `QA/answered-qa.json` (`source: "static"`). Dedupe by `id` or `question`.
- Empty combined list shows the “No mirrored answers yet” copy that points at `#questions-and-answers` and the JSON fallback.

`QA/answered-qa.json` currently ships `{ "source": "static", "items": [] }`. Add static rows there when Discord env is down or a FAQ should stay in git.

## Environment

| Name | Required | Role |
| --- | --- | --- |
| `DISCORD_BOT_TOKEN` | yes for live items | Bot token (`Authorization: Bot …`) |
| `DISCORD_GUILD_ID` | yes for name lookup / Discord URLs | Server id |
| `DISCORD_QA_TEXT_CHANNEL_ID` | no | Skip name lookup |
| `DISCORD_QA_TEXT_CHANNEL_NAME` | no | Defaults to `questions-and-answers` |
| `DISCORD_QA_FORUM_CHANNEL_ID` | no | Prefer forum threads when set |

Bot needs permission to read the target channel/forum and its messages. Do not put the token in HTML or committed JSON.

## Pitfalls

- Local preview of `QA/qa.html` will not hit `/api/discord-qa`. Use a Pages/Functions deploy, or populate `QA/answered-qa.json`.
- Text-channel posts that are not `**Q**` / `**A**` (or a matching embed) are ignored.
- Forum threads with only the starter message never appear (`message_count > 1` is required).
- Dual path: change `functions/api/discord-qa.js` and `netlify/functions/discord-qa.js` together.
- `_redirects` rewrites `/.netlify/functions/:splat` → `/api/:splat` on Cloudflare. Prefer `/api/discord-qa` in new clients.

## Checks

```text
GET https://www.owenminercs.com/api/discord-qa
```

Expect JSON (not HTML). `source: "unconfigured"` means the bot token is missing in Pages env. Then load `/QA/qa` on production and confirm `#discord-qa-feed` is not stuck on the empty copy when Discord has matching posts.
