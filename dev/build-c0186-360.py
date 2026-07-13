#!/usr/bin/env python3
"""Map C0186 rotation coverage and pick best 360 frame sequence.

The knife case spins fast enough that many source frames carry motion blur.
Pure angle sampling (nearest frame to each target angle) does not care whether
that frame is sharp, so the exported sequence ends up soft. This build scores
every candidate frame with Laplacian variance and, within a small angular
window around each target angle, keeps the sharpest frame instead of the
closest one.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

FPS = 30000 / 1001
SOURCE = Path(
    r"c:\Users\n3mog\Videos\Owenminercs content\cs2 merch collection\b roll spins\C0186.MP4"
)
FULL_MP4 = Path("images/cs2-merch/knife-case-spin/knife-case-spin.full.mp4")
OUT_DIR = Path("images/cs2-merch/knife-case-spin/frames")
TARGET_FRAMES = 150
WRAP_BRIDGE_COUNT = 5
SINGLE_RUN_INDEX = 4  # longest CW run (f907-f1120, ~95 deg)
WEBP_QUALITY = 92  # higher quality preserves edge detail (was 88)
SHARPNESS_WINDOW = 4  # search +/- N frames around each angle bin for the sharpest pick
SHARPNESS_MIN_PERCENTILE = 20  # deprioritize frames blurrier than this segment percentile


def load_flow_signal(path: Path):
    cap = cv2.VideoCapture(str(path))
    frames_gray = []
    n = 0
    while True:
        ok, bgr = cap.read()
        if not ok:
            break
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        ch, cw = int(h * 0.55), int(w * 0.55)
        y0, x0 = (h - ch) // 2, (w - cw) // 2
        crop = gray[y0 : y0 + ch, x0 : x0 + cw]
        frames_gray.append(cv2.resize(crop, (200, 200), interpolation=cv2.INTER_AREA))
        n += 1
    cap.release()
    print(f"Loaded {n} frames from {path}")

    flow_x = [0.0]
    for i in range(1, len(frames_gray)):
        flow = cv2.calcOpticalFlowFarneback(
            frames_gray[i - 1], frames_gray[i], None, 0.5, 3, 15, 3, 5, 1.2, 0
        )
        flow_x.append(float(np.mean(flow[..., 0])))
    return np.array(flow_x), len(frames_gray)


def cumulative_rotation(flow_x: np.ndarray) -> np.ndarray:
    return np.cumsum(flow_x)


def monotonic_runs(signs: np.ndarray, min_len: int):
    runs = []
    i = 0
    n = len(signs)
    while i < n:
        s = int(np.sign(signs[i]))
        if s == 0:
            i += 1
            continue
        j = i + 1
        while j < n and int(np.sign(signs[j])) == s:
            j += 1
        if j - i >= min_len:
            runs.append((i, j, s))
        i = j if j > i else i + 1
    return runs


def rotation_span(cum: np.ndarray, start: int, end: int) -> float:
    return abs(cum[end - 1] - cum[start])


def pick_evenly_spaced(source_indices: list[int], target: int) -> list[int]:
    if len(source_indices) <= target:
        return source_indices
    positions = np.linspace(0, len(source_indices) - 1, target)
    return [source_indices[int(round(p))] for p in positions]


def center_crop_gray(bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    ch, cw = int(h * 0.7), int(w * 0.7)
    y0, x0 = (h - ch) // 2, (w - cw) // 2
    return gray[y0 : y0 + ch, x0 : x0 + cw]


def laplacian_sharpness(gray: np.ndarray) -> float:
    """Variance of the Laplacian: high for crisp edges, low for motion blur."""
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def load_sharpness_map(path: Path, start: int, end: int) -> dict[int, float]:
    """Laplacian variance on a center crop for each frame in [start, end)."""
    cap = cv2.VideoCapture(str(path))
    scores: dict[int, float] = {}
    idx = 0
    while idx < end:
        ok, bgr = cap.read()
        if not ok:
            break
        if idx >= start:
            scores[idx] = laplacian_sharpness(center_crop_gray(bgr))
        idx += 1
    cap.release()
    return scores


def pick_sharpest_per_angle(
    start: int,
    end: int,
    cum: np.ndarray,
    sharpness: dict[int, float],
    target: int,
    window: int = SHARPNESS_WINDOW,
    min_sharpness: float = 0.0,
) -> list[int]:
    """Angle-sample `target` frames, keeping the sharpest frame per bin.

    For each evenly spaced target angle, look at frames within +/- `window` of
    the nearest-angle frame and keep the crispest one (Laplacian variance),
    preferring frames above `min_sharpness`. Picks are forced strictly
    increasing so spin direction/angle order is preserved and no frame repeats.
    """
    local_cum = cum[start:end] - cum[start]
    span = float(local_cum[-1]) if len(local_cum) else 0.0
    if span <= 0:
        return list(range(start, min(start + target, end)))

    picked: list[int] = []
    prev_local = -1
    for t in np.linspace(0, span, target):
        closest = int(np.argmin(np.abs(local_cum - t)))
        lo = max(prev_local + 1, closest - window)
        hi = min(len(local_cum), closest + window + 1)
        window_frames = list(range(lo, hi))
        if not window_frames:
            # Window fully consumed by earlier picks; step forward by one.
            nxt = prev_local + 1
            if nxt >= len(local_cum):
                break
            picked.append(start + nxt)
            prev_local = nxt
            continue
        sharp_enough = [i for i in window_frames if sharpness.get(start + i, 0.0) >= min_sharpness]
        pool = sharp_enough or window_frames
        best = max(pool, key=lambda i: sharpness.get(start + i, 0.0))
        picked.append(start + best)
        prev_local = best
    return picked


def sharpness_stats(sharpness: dict[int, float], indices: list[int]) -> dict:
    vals = [sharpness[i] for i in indices if i in sharpness]
    if not vals:
        return {"min": 0, "max": 0, "mean": 0, "median": 0}
    arr = np.array(vals)
    return {
        "min": round(float(arr.min()), 1),
        "max": round(float(arr.max()), 1),
        "mean": round(float(arr.mean()), 1),
        "median": round(float(np.median(arr)), 1),
    }


def boundary_metrics(path: Path, in_f: int, out_f: int) -> dict:
    cap = cv2.VideoCapture(str(path))
    frames = []
    idx = 0
    while True:
        ok, bgr = cap.read()
        if not ok:
            break
        if idx == in_f or idx == out_f - 1:
            gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
            frames.append(gray)
        if idx >= out_f - 1:
            break
        idx += 1
    cap.release()
    if len(frames) < 2:
        return {"mse": 9999, "ssim": 0}
    a, b = frames[0].astype(np.float32), frames[1].astype(np.float32)
    mse = float(np.mean((a - b) ** 2))
    mu_a, mu_b = a.mean(), b.mean()
    sig_a, sig_b = a.var(), b.var()
    sig_ab = ((a - mu_a) * (b - mu_b)).mean()
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    ssim = float(
        ((2 * mu_a * mu_b + c1) * (2 * sig_ab + c2))
        / ((mu_a * mu_a + mu_b * mu_b + c1) * (sig_a + sig_b + c2))
    )
    return {"mse": mse, "ssim": ssim}


def center_crop_bgr(bgr: np.ndarray) -> np.ndarray:
    h, w = bgr.shape[:2]
    ch, cw = int(h * 0.7), int(w * 0.7)
    y0, x0 = (h - ch) // 2, (w - cw) // 2
    return bgr[y0 : y0 + ch, x0 : x0 + cw]


def frame_l_mean(bgr: np.ndarray) -> float:
    """Mean L channel on center crop (matches spin viewer subject area)."""
    lab = cv2.cvtColor(center_crop_bgr(bgr), cv2.COLOR_BGR2LAB)
    return float(lab[:, :, 0].mean())


def luminance_stats(frames_bgr: list) -> dict:
    ls = [frame_l_mean(f) for f in frames_bgr]
    if not ls:
        return {"min": 0, "max": 0, "mean": 0, "median": 0, "std": 0, "maxAdjDelta": 0}
    arr = np.array(ls)
    deltas = np.abs(np.diff(arr))
    return {
        "min": round(float(arr.min()), 2),
        "max": round(float(arr.max()), 2),
        "mean": round(float(arr.mean()), 2),
        "median": round(float(np.median(arr)), 2),
        "std": round(float(arr.std()), 2),
        "maxAdjDelta": round(float(deltas.max()) if deltas.size else 0.0, 2),
    }


def normalize_luminance_to_target(bgr: np.ndarray, target_l: float) -> np.ndarray:
    """Scale full-frame LAB L so center-crop mean matches target."""
    current = frame_l_mean(bgr)
    if current < 1e-3:
        return bgr
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    lab[:, :, 0] = np.clip(lab[:, :, 0] * (target_l / current), 0, 255)
    return cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR)


def normalize_sequence_luminance(
    frames_bgr: list, reference: str = "median"
) -> tuple[list, dict, dict]:
    """Match each frame to median (or first-frame) L; return frames + before/after stats."""
    before = luminance_stats(frames_bgr)
    if not frames_bgr:
        return frames_bgr, before, before
    ls = [frame_l_mean(f) for f in frames_bgr]
    target = float(np.median(ls)) if reference == "median" else ls[0]
    normalized = [normalize_luminance_to_target(f, target) for f in frames_bgr]
    after = luminance_stats(normalized)
    return normalized, before, after


def insert_wrap_bridges(frames_bgr: list, count: int) -> list:
    """Blend last->first so the canvas wrap crossfade is seamless."""
    if count <= 0 or len(frames_bgr) < 2:
        return frames_bgr
    first, last = frames_bgr[0], frames_bgr[-1]
    bridges = [
        cv2.addWeighted(last, 1 - t, first, t, 0)
        for t in (i / (count + 1) for i in range(1, count + 1))
    ]
    return frames_bgr + bridges


def main():
    path = FULL_MP4 if FULL_MP4.exists() else SOURCE
    flow_x, total = load_flow_signal(path)
    cum = cumulative_rotation(flow_x)

    thresh = np.percentile(np.abs(flow_x[1:]), 25)
    signs = np.where(np.abs(flow_x) < thresh, 0, np.sign(flow_x))
    runs = monotonic_runs(signs, int(2.5 * FPS))

    print("\n=== Monotonic runs ===")
    run_stats = []
    for i, (a, b, s) in enumerate(runs):
        span = rotation_span(cum, a, b)
        print(
            f"  run {i}: f{a}-f{b-1} ({a/FPS:.2f}s-{(b-1)/FPS:.2f}s) "
            f"len={b-a} sign={'CW' if s > 0 else 'CCW'} rot_span={span:.1f}"
        )
        run_stats.append({"run": i, "start": a, "end": b, "sign": s, "span": span})

    # Prefer the single longest CW run + wrap bridges (smooth drag, seamless loop).
    run4 = run_stats[SINGLE_RUN_INDEX] if len(run_stats) > SINGLE_RUN_INDEX else None
    if not (run4 and run4["sign"] > 0):
        raise SystemExit(
            f"Expected CW run at index {SINGLE_RUN_INDEX}; got {run_stats[:SINGLE_RUN_INDEX + 1]}"
        )

    a, b = run4["start"], run4["end"]
    local_cum = cum[a:b] - cum[a]

    # Sharpness-aware angle sampling: keep the crispest frame per angle bin.
    sharp = load_sharpness_map(path, a, b)
    seg_vals = np.array([sharp[i] for i in range(a, b) if i in sharp])
    min_sharp = float(np.percentile(seg_vals, SHARPNESS_MIN_PERCENTILE)) if seg_vals.size else 0.0
    pi = pick_sharpest_per_angle(a, b, cum, sharp, TARGET_FRAMES, SHARPNESS_WINDOW, min_sharp)

    # Compare against naive nearest-angle sampling to report the sharpness gain.
    naive = []
    for t in np.linspace(0, float(local_cum[-1]), TARGET_FRAMES):
        naive.append(a + int(np.argmin(np.abs(local_cum - t))))

    best = {
        "type": "single_run_sharp_wrap_bridges",
        "run": SINGLE_RUN_INDEX,
        "source_start": a,
        "source_end": b - 1,
        "picked_indices": pi,
        "rotation_span": float(local_cum[-1]),
        "boundary": boundary_metrics(path, pi[0], pi[-1] + 1),
        "sharpness": sharpness_stats(sharp, pi),
        "sharpness_naive": sharpness_stats(sharp, naive),
        "sharpness_min_threshold": round(min_sharp, 1),
    }

    print("\n=== SELECTED: single run + sharpness pick + wrap bridges ===")
    print(json.dumps({k: v for k, v in best.items() if k != "picked_indices"}, indent=2))
    print(
        f"Sharpness median: sharp-pick={best['sharpness']['median']} "
        f"vs naive={best['sharpness_naive']['median']}"
    )

    if "--extract" in sys.argv:
        pi = best["picked_indices"]
        index_set = set(pi)
        cap = cv2.VideoCapture(str(path))
        frame_map: dict[int, np.ndarray] = {}
        idx = 0
        max_idx = max(pi)
        while idx <= max_idx:
            ok, bgr = cap.read()
            if not ok:
                break
            if idx in index_set:
                frame_map[idx] = bgr
            idx += 1
        cap.release()
        ordered_bgr = [frame_map[i] for i in pi]
        ordered_bgr, lum_before, lum_after = normalize_sequence_luminance(ordered_bgr)
        bridged_bgr = insert_wrap_bridges(ordered_bgr, WRAP_BRIDGE_COUNT)
        lum_final = luminance_stats(bridged_bgr)

        out_dir = OUT_DIR
        out_dir.mkdir(parents=True, exist_ok=True)
        for old in out_dir.glob("frame-*.webp"):
            old.unlink()
        for i, bgr in enumerate(bridged_bgr, start=1):
            cv2.imwrite(
                str(out_dir / f"frame-{i:03d}.webp"),
                bgr,
                [cv2.IMWRITE_WEBP_QUALITY, WEBP_QUALITY],
            )
        count = len(bridged_bgr)

        in_sec = pi[0] / FPS
        out_sec = pi[-1] / FPS
        manifest = {
            "frameCount": count,
            "frameRate": round(FPS, 2),
            "pattern": "frame-{index}.webp",
            "source": "C0186.MP4",
            "mode": "frame-sequence-360",
            "targetFrames": TARGET_FRAMES,
            "wrapBridgeCount": WRAP_BRIDGE_COUNT,
            "selection": best["type"],
            "webpQuality": WEBP_QUALITY,
            "sourceFrames": {"first": pi[0], "last": pi[-1]},
            "trimSec": {"first": round(in_sec, 3), "last": round(out_sec, 3)},
            "rotationSpan": round(best["rotation_span"], 2),
            "boundarySsim": round(best["boundary"]["ssim"], 4),
            "boundaryMse": round(best["boundary"]["mse"], 2),
            "sharpness": best["sharpness"],
            "luminanceBefore": lum_before,
            "luminanceAfter": lum_after,
            "luminanceFinal": lum_final,
        }
        (OUT_DIR / "manifest.json").write_text(
            json.dumps(manifest, indent="\t") + "\n", encoding="utf-8"
        )
        print(f"\nExtracted {count} frames to {OUT_DIR}")
        print(json.dumps(manifest, indent=2))

        # Poster from first frame
        poster = Path("images/cs2-merch/knife-case-spin/poster.webp")
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(OUT_DIR / "frame-001.webp"),
                "-q:v", "90", str(poster),
            ],
            check=True,
            capture_output=True,
        )


if __name__ == "__main__":
    main()
