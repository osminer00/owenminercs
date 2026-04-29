# Social Cloud Click-to-Play Bug Handoff

## Goal

Fix the Social Cloud bug where some YouTube cards (example: **"Must Know Mechanics"**) do not start playback when clicked.

## User-Reported Symptom

- On `Socials/socials.html`, a visible YouTube video card can appear normally but clicking it does not open/play the embedded player.
- Example shown by user: card with text/title context `"Must Know Mechanics"`.

## Current System Context

- Social cloud renderer: `Socials/scripts/social-cloud.js`
- Social cloud styles: `Socials/social-cloud.css`
- Local YouTube feed files:
    - `Socials/data/youtube-shorts.json`
    - `Socials/data/youtube-videos.json`
- Feed generation script:
    - `scripts/sync-youtube-local-feed.mjs`

## Recent Changes Already Made

1. Added local YouTube sync from channel via `yt-dlp`.
2. Switched cloud to a wave/queue model (limited active cards, rotating catalog).
3. Forced canonical URL output in sync script:
    - shorts -> `/shorts/<id>`
    - videos -> `/watch?v=<id>`
4. Adjusted ratio behavior:
    - shorts should be `9:16`
    - videos should be `16:9`
5. Attempted fix for thumbnail + player overlap when pinned:
    - hide/show media nodes in pin/unpin flow.

## What Is Still Broken

- Click-to-play fails for at least some cards (notably `"Must Know Mechanics"` visual card).

## High-Probability Debug Targets

Focus first in `Socials/scripts/social-cloud.js`:

1. **Card click handler path**
    - `card.addEventListener("click", ...)`
    - verify branch conditions:
        - `cardState.isPinned`
        - `cardState.embed`
        - `cardState.inlinePlayerWrap`
        - `cardState.playerWrap`
    - confirm `pinCard(cardState.embed)` is being reached.

2. **Embed config generation**
    - `getEmbedConfig(item)`
    - `getYouTubeEmbedUrl(rawUrl, { contentType })`
    - verify `state.embed.src` exists for the failing card at click time.

3. **State updates in wave recycle**
    - `state.setItem(...)`
    - `resetState(...)`
    - ensure recycled cards always refresh:
        - `state.item`
        - `state.embed`
        - existing media/player DOM nodes.

4. **Pointer and drag interactions blocking click**
    - `pointerdown` / `pointermove` / `pointerup` logic
    - ensure drag/capture flow is not swallowing normal click behavior.

5. **Layering / hit target / overlay**
    - check if any element overlays card and intercepts click
    - especially resize handles, pinned controls, or adjacent cards.

## Suggested Debug Method (Fast)

1. Add temporary `console.debug` inside:
    - click handler
    - `pinCard`
    - `setItem`
2. Log a stable ID for each card (video id + title).
3. On failing card click, verify:
    - click event fires
    - `state.embed` is non-null and has a valid `src`
    - player iframe gets inserted into DOM.
4. If click event does not fire, inspect z-index/pointer-events overlap in DevTools.
5. Remove logs after fix.

## Data Validation Checks

- Confirm problematic entry exists in either:
    - `youtube-videos.json` with `contentType: "video"` and `watch?v=` URL, or
    - `youtube-shorts.json` with `contentType: "short"` and `/shorts/` URL.
- Confirm no malformed URL/id for the failing card.

## Done Definition

- Clicking `"Must Know Mechanics"` reliably opens the player in-card.
- No card shows both thumbnail and player simultaneously when pinned.
- Shorts remain `9:16`; regular videos remain `16:9`.
- Behavior remains stable after cards recycle in wave mode.

## Suggested Prompt For New Agent

Use this prompt with another agent:

> Fix Social Cloud click-to-play bug on `Socials/socials.html`.  
> Repro: some visible YouTube cards (example "Must Know Mechanics") do not play when clicked.  
> Context files: `Socials/scripts/social-cloud.js`, `Socials/social-cloud.css`, `Socials/data/youtube-shorts.json`, `Socials/data/youtube-videos.json`, and `scripts/sync-youtube-local-feed.mjs`.  
> Please:
>
> 1. Debug click flow (`click` handler -> `pinCard`) and confirm embed src exists for failing cards.
> 2. Fix any state/DOM reuse issue from wave recycling so card click always pins and inserts iframe.
> 3. Ensure no thumbnail+player overlap when pinned.
> 4. Preserve ratio rules: only shorts `9:16`, videos `16:9`.
> 5. Provide exact root cause and patch summary.
