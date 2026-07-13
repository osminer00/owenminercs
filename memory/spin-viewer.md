# Spin Viewer Workflow

Last reviewed: 2026-07-11

Interactive turntable spin viewers on `Gaming/cs2-merch.html` (test section). Drag left/right to scrub; infinite wrap via virtual rotation + modulo loop duration.

## Simple workflow (canonical)

1. **User provides pre-trimmed full spin mp4** — one spin + ~0.5s clearance tail at the end.
2. **Find loop seam** — compare frame 0 to frames in the last 1–2 seconds; pick the end frame with the best SSIM match (same display case position). Tool: `python dev/find-spin-loop-seam.py VIDEO --out-dir dev/spin-loop-compare/{slug}/`
3. **Encode loop** — trim frame 0 → matched end frame; portrait 1080w all-I-frame H.264 + `poster.webp`.
4. **Video turntable viewer** — same pattern as `nade-plushie-spin` (`data-spin-viewer` + `<video>`). Frame-sequence canvas is fallback only when video loop seam cannot be made acceptable.

## Requirements

- **Portrait 9:16** — respect camera rotation metadata (`-90°` display matrix on Sony clips); ffmpeg auto-rotate on encode with `scale=1080:-2`.
- **All-I-frame H.264** — smooth `video.fastSeek()` during drag (`-g 1 -keyint_min 1 -sc_threshold 0`).
- **Poster** — `poster.webp` from first loop frame.
- **No autoplay** — paused on load; grab/grabbing cursor; pointer drag + arrow keys; `prefers-reduced-motion` click-to-step fallback.
- **Multi-instance** — one `[data-spin-viewer]` root per clip; `scripts/cs2-merch-spin-viewer.js` inits all via `querySelectorAll`.
- **Layout** — `.merch-spin-viewer-grid`: 2-up desktop, stack at `max-width: 700px`.
- **Copy** — structural labels / aria only; no marketing prose.

## Asset layout

```
images/cs2-merch/{slug}/
  source/             # raw user recording (archive)
  {slug}.full.mp4     # full portrait encode (archive / re-trim)
  {slug}.mp4          # trimmed loop (served)
  poster.webp
```

## Encode commands

**Full portrait encode** from source:

```powershell
ffmpeg -y -i "SOURCE.MP4" -an -vf "scale=1080:-2:flags=lanczos" `
  -c:v libx264 -crf 23 -pix_fmt yuv420p -g 1 -keyint_min 1 -sc_threshold 0 `
  -x264-params "keyint=1:min-keyint=1:scenecut=0" -movflags +faststart `
  "images/cs2-merch/{slug}/{slug}.full.mp4"
```

**Loop trim** (replace `FRAME_COUNT` with end frame index + 1):

```powershell
ffmpeg -y -i "images/cs2-merch/{slug}/{slug}.full.mp4" -frames:v FRAME_COUNT -an `
  -c:v libx264 -profile:v high -pix_fmt yuv420p -g 1 -keyint_min 1 -sc_threshold 0 `
  -crf 17 -movflags +faststart "images/cs2-merch/{slug}/{slug}.mp4"
ffmpeg -y -i "images/cs2-merch/{slug}/{slug}.mp4" -vframes 1 -q:v 85 `
  "images/cs2-merch/{slug}/poster.webp"
```

## Add a new spin (checklist)

1. Copy source to `images/cs2-merch/{slug}/source/`.
2. `ffprobe` width/height, rotation, duration, fps.
3. Full portrait encode → `{slug}.full.mp4`.
4. `python dev/find-spin-loop-seam.py {slug}.full.mp4 --out-dir dev/spin-loop-compare/{slug}/` — verify `frame0-vs-end.jpg`.
5. Loop encode → `{slug}.mp4` + `poster.webp`.
6. HTML — duplicate `.merch-spin-viewer` block with `<video>` (match nade plushie pattern).
7. `node dev/test-spin-viewer.mjs`.

## Published clips

| Slug | Source | Mode | Loop trim | Duration |
|------|--------|------|-----------|----------|
| `nade-plushie-spin` | C0184.MP4 | video | 2.60s – 10.21s (monotonic optical-flow trim) | ~7.64s |
| `agent-k-inferno-bookend-case-spin` | `agent K figure and inferno bookend with case on.mp4` (website spins) | video | f0 – f201, boundary SSIM 0.9878 | ~6.74s |

### Unpublished / queued

- `knife-case-spin` (C0186): removed from page; assets kept
- **Website spins queue** (alphabetical): `agent K figure and inferno bookend with no case.mp4`, `agent k tea pot display.mp4`, `C0186 - Trim.mp4`, `chicken case display.mp4`, `ct chicken head.mp4`, `diffuse kit bag.mp4`, `killowatt travel case.mp4`, `knif plush pendants.mp4`

## Code references

- JS: `scripts/cs2-merch-spin-viewer.js`
- Loop seam: `dev/find-spin-loop-seam.py`
- Test: `dev/test-spin-viewer.mjs`
- CSS: `css/owenminercs.css` (`.merch-spin-viewer`, `.merch-spin-viewer-grid`)
- Page: `Gaming/cs2-merch.html` (`#nade-plushie-spin-test`)
