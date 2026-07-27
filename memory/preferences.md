# Preferences

Last reviewed: 2026-07-27

## Durable User Preferences

- **Hosting:** The live site is **GitHub + Cloudflare** (not Netlify). Do not tell the user to wait for or check Netlify deploys.
- User wants a real cross-platform memory layer shared by Codex, Claude, Cursor, Gemini, Antigravity, Ollama, and similar tools.
- Keep memory token-light: short canonical files, not long duplicated handoffs.
- Keep memories updated when the user gives durable site facts, bug patterns, design ratios, layout preferences, or workflow rules.
- Track issues in a memory file so future chats can diagnose recurring problems.
- Prefer a practical "growing brain" over isolated assistant-specific notes.
- On this project, prefer delegating lightweight AI work to local Ollama/GPU first when it will not slow progress; keep cloud models available for harder reasoning and final critical passes to reduce monthly hosted usage.
- **Programs page** (`dev/dev-stack.html`, nav label **Programs**): sections for coding stack (Cursor Pro+, Codex/VS Code/VS, Claude paused, Antigravity+Gemini, Ollama), Adobe (Premiere, Photoshop, After Effects / projection mapping → Upgrades), GIMP origins, OBS + open-source multi-RTMP (GitHub). Video history on page: Windows bundled editor first → Vegas Movie Studio (Amazon, ~early teens) → YouTube phase → Premiere now.
- Cursor usage limits are driven mainly by **hosted** chat/agent models; **local Ollama inference does not replace that** unless each chat’s **model picker** is set to a **local/Ollama** model (watch GPU under **`ollama`**, not only `Cursor`). Built-in subagents may still use **automatic/fast cloud** models unless configured otherwise.
- Cross-workspace memory routing: user-level Cursor hook writes `%USERPROFILE%\.cursor\active-memory-root.txt` when the opened workspace contains `AGENTS.md` + `memory/`; global Cursor rules follow that pointer so non-site repos do not keep pulling OwenMinerCS context.

## UI / Design Preferences

- **Setup hub** (`The Setup/the-setup.html`): main-nav label is **Gaming Setups** (stable `data-nav="The Setup"`); hub path/URLs stay under `The Setup/`. `.keep-board--hub` uses normal thumbs + `keep-thumbs.js` album transitions; category titles are **large** type placed in `.keep-card__body` directly under `.keep-card__video-slot` (not overlaid on images).
- **Accent colors:** Green glow/fill for non-link UI (hero H1, buttons, social tip chrome, dock fidget FX); keep blue/purple for real link affordances (`a`, `.site-nav-link`, card-ui link hovers).
- **Site chrome:** Main nav’s first item is **Home** (`/`), not “About”; hover title is “Home — bio, intro, and what’s new”. Full Q&A lives on `QA/qa.html` only.
- **Under-construction notice:** First visit shows a modal (`components.js` + `owenminercs.css`) with timeline: backend push ~this weekend for testing; design/theme in ~1–2 weeks; new content late May; setup tour video ~July; dismiss stored in `localStorage` key `owenminercs-construction-notice-dismissed-v1`.
- If the user gives a specific card ratio, component size, layout density, color direction, or interaction rule, add it here.
- **Socials cloud (`Socials/social-cloud.css` + `Socials/scripts/social-cloud.js`):** published date and the stats line (views / likes / upvotes / comments — whatever `scoreLabel` shows) must stay **on one horizontal row** above the title, separated by a middle dot when both are present. Do not revert to stacking date and stats on separate lines unless the user explicitly changes this.
- **Socials cloud card chrome reveal:** top text chrome (title/date/stats/details) should reveal as an overlay animation that expands up from the media area without shifting card/video layout; keep it hidden when not hovered/focused/pinned.
- **Socials cloud idle behavior:** after 15 minutes with no interaction, cards should enter a fidget-spinner rotation mode and keep spinning until the user interacts again.
- **Content page social cards:** include cards for every post at/over 100 likes (or upvotes for Reddit) across all linked social platforms whenever post data exists in `Socials/data/`.
- **Footer social bar:** include a static, button-only social profile bar in the footer (no drag/rotate movement controls there). Icons use a **4×2 grid** (two rows of four) filling the left column width; bug report / Discord copy sits **right** (two lines) in the same band (`site-footer-top-row`). Use the same two-column grid and horizontal inset as `site-footer-meta` so those cells line up with credits / disclosure. **Hover:** pill fill uses each brand’s tooltip accent (Instagram = multi-stop gradient like the callout); footer is excluded from generic card-ui social hover `!important` grays so those fills apply.
- **Footer vertical rhythm (global `site-card-ui`):** Keep the nav pill row, social/bug-report band, and credits/disclosure block visually tight—moderate `.site-footer-social-bar` padding for hover tips (not ~6rem), smaller `.site-rule--spaced` gaps, `align-items: start` on `.site-footer-top-row`, and modest meta `margin`/`h4` spacing so the footer card does not read as overly airy.
- **Floating social dock:** stays in **`.site-header-dock-cluster`** until the user **manually** drags it; then it uses **`position: fixed`** on `body` (`site-support-dock--placed`) and persists. Reset (or double-click) clears `localStorage`, removes `--placed` / drag state, and re-mounts the dock in the header slot (no default bottom-of-viewport strip). **Rotate/resize:** outer rim; **move:** interior when floating.
- **Ko-fi floating donate button:** keep it draggable anywhere in the viewport and persist its last position across page navigation and future visits.
- Current explicit ratio preferences: none recorded yet.
- Donators page support-logo hover notes should reveal below the logos, not follow the mouse cursor.
- **Reading bookmarks** (`components.js` per-word click + `.text-word-glow--bookmark` in `owenminercs.css`): neon green highlight (`#39FF14`-based glow on dark; emerald green tint on light). Drag text selection styled to match.
- **Main nav return helper:** after navigating with a header/footer main-nav pill, show a floating "Back" button on the destination page; clicking should jump back to the previous nested page and restore the saved scroll position.
- **Mobile header order:** on phones, place the social bar at the very top of the page (respecting notch/safe-area inset), then show the site logo below it, then the rest of the page content.

## Content Preferences

- **Privacy on archived social screenshots:** The first PC build Instagram PNG (`images/archive/old-pcs/first-pc-build-instagram.png`) must not show readable **usernames or profile photos**—keep them blurred/redacted when replacing the file.
- **Page content usage:** Footer asks visitors to contact on Discord for usage rights for any content on the page; small creators/individuals often get rights free; large companies pay for commercial use (including training AI models).
- Preserve affiliate/support/legal disclosure accuracy.
- **Govee — affiliate vs referral (Refr):** On-site “shop this” / product CTAs use **affiliate or approved program links** when enrolled (and terms allow public use). Do **not** pair a **Refr post-purchase referral** link on the same button or competing primary CTA. Reserve Refr/customer referral for contexts that match that program (DMs, post-purchase share, “I bought it—here’s my referral”). Confirm Govee + network + Refr terms before combining channels; disclose whenever compensation applies (extend `lighting.html`-style copy if Govee affiliate or referral credit applies).
- Do not guess real affiliate IDs or private account details.
- Public profile copy should stay channel/content focused; do not restore the old home-page personal bio block or DMACC/alumni copy on production pages unless the user explicitly asks.
- Person JSON-LD on production pages should not include `alumniOf` unless there is a new explicit content decision; archived mockups/backups may still contain old bio/DMACC copy.
- Public FAQ scope is intentionally short: height questions and website bug reporting. Livestream discovery, CS configs, and merch links belong in navigation/Socials/Gaming/content pages, not the embedded FAQ.
- **Setup Tools page** (`The Setup/tools.html`): physical tools only—links to the cordless drill page and iFixit write-up. CS2 inventory calculator, expensive skins browser, Major merch, and client-side CS tools stay on `Gaming/gaming.html`; OBS multi-camera fit check lives under **Outfits** (`The Setup/clothing.html`) with a shortcut on the hub Outfits card.
- CS2 skins page preference: focus on expensive/cool skins (not full inventory dump), and include case/container counts.
- For CS2 Perfect World merch callouts on `Gaming/cs2-merch.html`, use the user's preferred source link: `https://pwrdesports.aliexpress.com/store/1103775565?spm=a2g0o.store_pc_allItems_or_groupList.pcShopHead_2009118762807.0`.
- Coaching is deferred for later; do not show or add coaching language on public site pages unless the user asks to restore it.
- Shop preference: PayPal first for small physical drops; Stripe Payment Links are acceptable when card-first checkout, custom fields, inventory limits, or tax handling matter.
- For sale / listings: prefer **in-house direct checkout** (PayPal, Stripe, etc.) when linked on an item; keep **eBay as optional** for the same inventory so buyers can compare — user wants to avoid eBay’s fee-heavy middleman when possible.
- Shop roadmap: signed sticker packs, signed photography/art prints with optional short notes, and future custom sewing projects (clothing, pillows, handmade pieces) marked TBD until ready.
- Shop fulfillment: stickers and prints can be printed at home and self-shipped via USPS/UPS; prefer prices that include shipping, packaging, materials, and payment fees.
- Shop shipping defaults: stickers use the cheapest USPS stamped envelope route by default with no tracking; prints use protective rigid mailers with USPS Ground Advantage tracking. UPS is a backup by request.
