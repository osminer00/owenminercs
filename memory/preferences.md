# Preferences

Last reviewed: 2026-04-28

## Durable User Preferences

- User wants a real cross-platform memory layer shared by Codex, Claude, Cursor, Gemini, Antigravity, Ollama, and similar tools.
- Keep memory token-light: short canonical files, not long duplicated handoffs.
- Keep memories updated when the user gives durable site facts, bug patterns, design ratios, layout preferences, or workflow rules.
- Track issues in a memory file so future chats can diagnose recurring problems.
- Prefer a practical "growing brain" over isolated assistant-specific notes.
- On this project, prefer delegating lightweight AI work to local Ollama/GPU first when it will not slow progress; keep cloud models available for harder reasoning and final critical passes to reduce monthly hosted usage.
- Cursor usage limits are driven mainly by **hosted** chat/agent models; **local Ollama inference does not replace that** unless each chat’s **model picker** is set to a **local/Ollama** model (watch GPU under **`ollama`**, not only `Cursor`). Built-in subagents may still use **automatic/fast cloud** models unless configured otherwise.
- Cross-workspace memory routing: user-level Cursor hook writes `%USERPROFILE%\.cursor\active-memory-root.txt` when the opened workspace contains `AGENTS.md` + `memory/`; global Cursor rules follow that pointer so non-site repos do not keep pulling OwenMinerCS context.

## UI / Design Preferences

- **Under-construction notice:** First visit shows a modal (`components.js` + `owenminercs.css`) with timeline: backend push ~this weekend for testing; design/theme in ~1–2 weeks; new content late May; setup tour video ~July; dismiss stored in `localStorage` key `owenminercs-construction-notice-dismissed-v1`.
- If the user gives a specific card ratio, component size, layout density, color direction, or interaction rule, add it here.
- **Socials cloud (`Socials/social-cloud.css` + `Socials/scripts/social-cloud.js`):** published date and the stats line (views / likes / upvotes / comments — whatever `scoreLabel` shows) must stay **on one horizontal row** above the title, separated by a middle dot when both are present. Do not revert to stacking date and stats on separate lines unless the user explicitly changes this.
- **Socials cloud card chrome reveal:** top text chrome (title/date/stats/details) should reveal as an overlay animation that expands up from the media area without shifting card/video layout; keep it hidden when not hovered/focused/pinned.
- **Socials cloud idle behavior:** after 15 minutes with no interaction, cards should enter a fidget-spinner rotation mode and keep spinning until the user interacts again.
- **Content page social cards:** include cards for every post at/over 100 likes (or upvotes for Reddit) across all linked social platforms whenever post data exists in `Socials/data/`.
- **Footer social bar:** include a static, button-only social profile bar in the footer (no drag/rotate movement controls there).
- **Ko-fi floating donate button:** keep it draggable anywhere in the viewport and persist its last position across page navigation and future visits.
- Current explicit ratio preferences: none recorded yet.
- Donators page support-logo hover notes should reveal below the logos, not follow the mouse cursor.

## Content Preferences

- Preserve affiliate/support/legal disclosure accuracy.
- Do not guess real affiliate IDs or private account details.
- Public profile copy should stay channel/content focused; do not restore the old home-page personal bio block or DMACC/alumni copy on production pages unless the user explicitly asks.
- Person JSON-LD on production pages should not include `alumniOf` unless there is a new explicit content decision; archived mockups/backups may still contain old bio/DMACC copy.
- Public FAQ scope is intentionally short: height questions and website bug reporting. Livestream discovery, CS configs, and merch links belong in navigation/Socials/Gaming/content pages, not the embedded FAQ.
- CS2 skins page preference: focus on expensive/cool skins (not full inventory dump), and include case/container counts.
- For CS2 Perfect World merch callouts on `Gaming/cs2-merch.html`, use the user's preferred source link: `https://pwrdesports.aliexpress.com/store/1103775565?spm=a2g0o.store_pc_allItems_or_groupList.pcShopHead_2009118762807.0`.
- Coaching is deferred for later; do not show or add coaching language on public site pages unless the user asks to restore it.
- Shop preference: PayPal first for small physical drops; Stripe Payment Links are acceptable when card-first checkout, custom fields, inventory limits, or tax handling matter.
- Shop roadmap: signed sticker packs, signed photography/art prints with optional short notes, and future custom sewing projects (clothing, pillows, handmade pieces) marked TBD until ready.
- Shop fulfillment: stickers and prints can be printed at home and self-shipped via USPS/UPS; prefer prices that include shipping, packaging, materials, and payment fees.
- Shop shipping defaults: stickers use the cheapest USPS stamped envelope route by default with no tracking; prints use protective rigid mailers with USPS Ground Advantage tracking. UPS is a backup by request.
