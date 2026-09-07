# Site Assistant Runbook

Last verified: 2026-09-07

## Purpose

`POST /api/site-assistant` is a small OpenAI proxy that answers from a client-supplied knowledge blob. The intended UI is `scripts/ai-assistant.js` plus `AI/knowledge-base.json`.

**Shipped status on `main`:** no HTML page includes `ai-assistant.js`. `_redirects` sends `/assistant` and `/assistant.html` to `/`. The function can still be called directly. Do not describe a public chat widget as live.

Keep this document in sync with:

- `functions/api/site-assistant.js`
- `netlify/functions/site-assistant.js`
- `scripts/ai-assistant.js`
- `AI/knowledge-base.json`

## Intended client flow

If a page hosted next to `AI/` (so `../AI/knowledge-base.json` resolves) included the script and markup:

- `[data-assistant-form]`, `[data-assistant-input]`, `[data-assistant-messages]`, `[data-assistant-status]`
- Load `AI/knowledge-base.json` (`entries[]` with `title`, `url`, `summary`)
- `POST /api/site-assistant` with `{ messages, knowledgeEntries }`
- Keep the last 10 history turns in the browser only

`scripts/ai-assistant.js` has **no Netlify fallback URL**.

## API contract

`POST /api/site-assistant` (OPTIONS allowed for CORS: `POST, OPTIONS` + `Content-Type`).

Limits:

| Constraint | Value |
| --- | --- |
| Body Content-Length | 100_000 bytes (413 if larger) |
| History messages | last 10 |
| Message text | 1200 chars |
| Knowledge entries | 80 |
| Knowledge field | 1000 chars |
| Knowledge blob in system prompt | 20_000 chars |
| Model | `OPENAI_MODEL` or `gpt-4.1-mini` |
| Completion | temperature 0.3, max_tokens 500 |

Env:

- `OPENAI_API_KEY` (required; missing → 500 with that name in the error text)
- `OPENAI_MODEL` (optional)

System prompt instructs the model to answer **only** from the provided site knowledge and to suggest a nearby page when unsure. The server does not read `AI/knowledge-base.json` itself — the client must send `knowledgeEntries`.

Success: `{ "reply": "…" }`. Invalid JSON / empty messages → 400. Upstream failure or empty completion → 502. Non-POST → 405.

## Knowledge file

`AI/knowledge-base.json` is a curated map of public pages (home, setup hub, PC, gaming, keyboard, donators, shop, Q&A). Update summaries when those pages’ purpose changes. It is not a scrape of the whole site.

## Pitfalls

- Wiring a page under a different directory breaks `fetch('../AI/knowledge-base.json')` unless the relative path is changed.
- Knowledge is client-visible. Do not put secrets or unpublished URLs in the JSON.
- Dual Pages/Netlify copies.
- Pretty `/assistant` URL is parked on home; adding nav without changing `_redirects` will 301 away from any new page.

## Checks

```text
POST /api/site-assistant
Content-Type: application/json

{"messages":[{"role":"user","content":"What is the Q&A page for?"}],"knowledgeEntries":[{"title":"Q&A","url":"/QA/qa","summary":"Height questions and website bug reporting."}]}
```

Expect `{ "reply": "…" }` when `OPENAI_API_KEY` is set. `grep` the repo for `ai-assistant.js` in `*.html` before claiming the widget is on a page.
