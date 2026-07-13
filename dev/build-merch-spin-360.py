#!/usr/bin/env python3
"""Generic merch spin frame-sequence builder.

Picks the longest monotonic optical-flow run, sharpness-samples frames,
normalizes luminance, and adds wrap bridges for seamless canvas looping.

Pre-trimmed website spins (--use-full-clip): export nearly the entire clip
from frame 0; trim only a short clearance tail at the end for loop seam.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

FPS = 30000 / 1001  # default; overridden per source via probe_video_fps()
TARGET_FRAMES = 90
MIN_LOOP_FRAMES = 45
WRAP_BRIDGE_COUNT = 5
WEBP_QUALITY = 92
SHARPNESS_WINDOW = 4
SHARPNESS_MIN_PERCENTILE = 20
MIN_BOUNDARY_SSIM = 0.85
FULL_CLIP_MAX_TAIL_SEC = 0.5
WEBSITE_SPINS_MARKER = "website spins"


def probe_video_fps(path: Path) -> float:
    cap = cv2.VideoCapture(str(path))
    fps = cap.get(cv2.CAP_PROP_FPS) or FPS
    cap.release()
    return float(fps) if fps > 1 else FPS


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
    while i < len(signs):
        s = int(np.sign(signs[i]))
        if s == 0:
            i += 1
            continue
        j = i + 1
        while j < len(signs) and int(np.sign(signs[j])) == s:
            j += 1
        if j - i >= min_len:
            runs.append((i, j, s))
        i = j if j > i else i + 1
    return runs


def rotation_span(cum: np.ndarray, start: int, end: int) -> float:
    return abs(cum[end - 1] - cum[start])


def center_crop_gray(bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    ch, cw = int(h * 0.7), int(w * 0.7)
    y0, x0 = (h - ch) // 2, (w - cw) // 2
    return gray[y0 : y0 + ch, x0 : x0 + cw]


def laplacian_sharpness(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def load_sharpness_map(path: Path, start: int, end: int) -> dict[int, float]:
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


def ssim_gray(a: np.ndarray, b: np.ndarray) -> float:
    a, b = a.astype(np.float32), b.astype(np.float32)
    mu_a, mu_b = a.mean(), b.mean()
    sig_a, sig_b = a.var(), b.var()
    sig_ab = ((a - mu_a) * (b - mu_b)).mean()
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    return float(
        ((2 * mu_a * mu_b + c1) * (2 * sig_ab + c2))
        / ((mu_a * mu_a + mu_b * mu_b + c1) * (sig_a + sig_b + c2))
    )


def border_hand_score(gray: np.ndarray) -> float:
    h, w = gray.shape
    border = np.concatenate(
        [
            gray[:40, :].ravel(),
            gray[-40:, :].ravel(),
            gray[:, :40].ravel(),
            gray[:, -40:].ravel(),
        ]
    )
    center = gray[h // 4 : 3 * h // 4, w // 4 : 3 * w // 4]
    return float(border.std() / max(center.std(), 1.0))


def load_center_crop_grays(path: Path) -> list[np.ndarray]:
    cap = cv2.VideoCapture(str(path))
    grays: list[np.ndarray] = []
    while True:
        ok, bgr = cap.read()
        if not ok:
            break
        grays.append(center_crop_gray(bgr))
    cap.release()
    return grays


def is_website_spins_source(path: Path) -> bool:
    return WEBSITE_SPINS_MARKER in str(path).lower()


def find_full_clip_end(
    center_grays: list[np.ndarray],
    total: int,
    max_tail_sec: float = FULL_CLIP_MAX_TAIL_SEC,
) -> dict:
    """Use nearly the entire pre-trimmed clip; trim only a short clearance tail."""
    start = 0
    max_tail = max(1, int(max_tail_sec * FPS))
    min_end = max(MIN_LOOP_FRAMES, total - max_tail)
    best_end = total
    best_boundary = ssim_gray(center_grays[0], center_grays[total - 1])
    for end in range(total, min_end - 1, -1):
        boundary = ssim_gray(center_grays[0], center_grays[end - 1])
        if boundary >= best_boundary:
            best_boundary = boundary
            best_end = end
    tail_trimmed = total - best_end
    return {
        "start": start,
        "end": best_end,
        "boundary": best_boundary,
        "rot_len": best_end - start,
        "tail_trimmed_frames": tail_trimmed,
        "tail_trimmed_sec": round(tail_trimmed / FPS, 3),
    }


def find_best_loop_segment(
    runs: list[tuple[int, int, int]],
    cum: np.ndarray,
    center_grays: list[np.ndarray],
) -> dict:
    candidates: list[dict] = []
    for a, b, s in runs:
        for i in range(a, b - MIN_LOOP_FRAMES):
            gi = center_grays[i]
            hand_i = border_hand_score(gi)
            for j in range(i + MIN_LOOP_FRAMES, b):
                boundary = ssim_gray(gi, center_grays[j - 1])
                rot_len = j - i
                rot_span = rotation_span(cum, i, j)
                hand_penalty = max(hand_i, border_hand_score(center_grays[j - 1])) - 1.0
                score = boundary * (rot_len**0.35) - 0.05 * hand_penalty
                candidates.append(
                    {
                        "run_start": a,
                        "run_end": b,
                        "run_sign": s,
                        "start": i,
                        "end": j,
                        "boundary": boundary,
                        "rot_len": rot_len,
                        "rot_span": rot_span,
                        "hand_penalty": hand_penalty,
                        "score": score,
                    }
                )

    if not candidates:
        raise SystemExit("No loop segments found")

    candidates.sort(key=lambda c: c["score"], reverse=True)
    best = candidates[0]
    if best["boundary"] < MIN_BOUNDARY_SSIM:
        print(
            f"Warning: best boundary SSIM {best['boundary']:.4f} < {MIN_BOUNDARY_SSIM}; "
            "using shortest high-score segment (wrap bridges will close the loop)."
        )
    return best


def pick_consecutive_frames(start: int, end: int, target: int) -> list[int]:
    """Evenly spaced source indices with strict monotonic increase (no sharpness jumps)."""
    seg_len = end - start
    if target <= 1:
        return [start]
    if target >= seg_len:
        return list(range(start, end))
    indices = np.linspace(start, end - 1, target, dtype=int)
    for i in range(1, len(indices)):
        if indices[i] <= indices[i - 1]:
            indices[i] = indices[i - 1] + 1
    indices[-1] = min(int(indices[-1]), end - 1)
    return [int(i) for i in indices]


def source_index_jump_stats(indices: list[int]) -> dict:
    if len(indices) < 2:
        return {"max": 0, "mean": 0.0, "worstPair": [0, 0]}
    jumps = [indices[i + 1] - indices[i] for i in range(len(indices) - 1)]
    max_j = max(jumps)
    worst_i = jumps.index(max_j)
    return {
        "max": int(max_j),
        "mean": round(float(np.mean(jumps)), 2),
        "worstPair": [worst_i, worst_i + 1],
    }


def adjacent_frame_metrics(frames_bgr: list) -> dict:
    if len(frames_bgr) < 2:
        return {
            "maxAdjSsim": 1.0,
            "minAdjSsim": 1.0,
            "meanAdjSsim": 1.0,
            "maxAdjDelta": 0.0,
            "worstSsimPair": [0, 0, 1.0],
            "worstDeltaPair": [0, 0, 0.0],
        }
    ssims: list[float] = []
    deltas: list[float] = []
    worst_ssim = (1.0, 0, 1)
    worst_delta = (0.0, 0, 1)
    for i in range(len(frames_bgr) - 1):
        g0 = center_crop_gray(frames_bgr[i])
        g1 = center_crop_gray(frames_bgr[i + 1])
        s = ssim_gray(g0, g1)
        ssims.append(s)
        if s < worst_ssim[0]:
            worst_ssim = (s, i, i + 1)
        d = abs(frame_l_mean(frames_bgr[i + 1]) - frame_l_mean(frames_bgr[i]))
        deltas.append(d)
        if d > worst_delta[0]:
            worst_delta = (d, i, i + 1)
    return {
        "maxAdjSsim": round(max(ssims), 4),
        "minAdjSsim": round(min(ssims), 4),
        "meanAdjSsim": round(float(np.mean(ssims)), 4),
        "maxAdjDelta": round(max(deltas), 2),
        "worstSsimPair": [worst_ssim[1] + 1, worst_ssim[2] + 1, round(worst_ssim[0], 4)],
        "worstDeltaPair": [worst_delta[1] + 1, worst_delta[2] + 1, worst_delta[0]],
    }


def pick_sharpest_per_angle(
    start: int,
    end: int,
    cum: np.ndarray,
    sharpness: dict[int, float],
    target: int,
    window: int = SHARPNESS_WINDOW,
    min_sharpness: float = 0.0,
    pin_endpoints: bool = False,
) -> list[int]:
    local_cum = cum[start:end] - cum[start]
    span = abs(float(local_cum[-1])) if len(local_cum) else 0.0
    if span <= 0:
        return pick_consecutive_frames(start, end, target)

    angle_targets = np.linspace(0, span, target)
    if pin_endpoints and target >= 2:
        angle_targets[0] = 0.0
        angle_targets[-1] = span

    picked: list[int] = []
    prev_local = -1
    for ti, t in enumerate(angle_targets):
        if pin_endpoints and target >= 2 and ti == 0:
            picked.append(start)
            prev_local = 0
            continue
        if pin_endpoints and target >= 2 and ti == len(angle_targets) - 1:
            picked.append(end - 1)
            break
        closest = int(np.argmin(np.abs(local_cum - t)))
        lo = max(prev_local + 1, closest - window)
        hi = min(len(local_cum), closest + window + 1)
        window_frames = list(range(lo, hi))
        if not window_frames:
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


def boundary_metrics_from_grays(first_gray: np.ndarray, last_gray: np.ndarray) -> dict:
    a, b = first_gray.astype(np.float32), last_gray.astype(np.float32)
    mse = float(np.mean((a - b) ** 2))
    return {"mse": mse, "ssim": ssim_gray(a, b)}


def wrap_ssim_after_bridges(frames_bgr: list, count: int) -> float:
    if len(frames_bgr) < 2 or count <= 0:
        return 1.0
    first, last = frames_bgr[0], frames_bgr[-1]
    final_bridge = cv2.addWeighted(last, 1 / (count + 1), first, count / (count + 1), 0)
    return ssim_gray(center_crop_gray(final_bridge), center_crop_gray(first))


def center_crop_bgr(bgr: np.ndarray) -> np.ndarray:
    h, w = bgr.shape[:2]
    ch, cw = int(h * 0.7), int(w * 0.7)
    y0, x0 = (h - ch) // 2, (w - cw) // 2
    return bgr[y0 : y0 + ch, x0 : x0 + cw]


def frame_l_mean(bgr: np.ndarray) -> float:
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
    current = frame_l_mean(bgr)
    if current < 1e-3:
        return bgr
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    lab[:, :, 0] = np.clip(lab[:, :, 0] * (target_l / current), 0, 255)
    return cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2BGR)


def normalize_sequence_luminance(
    frames_bgr: list, reference: str = "median"
) -> tuple[list, dict, dict]:
    before = luminance_stats(frames_bgr)
    if not frames_bgr:
        return frames_bgr, before, before
    ls = [frame_l_mean(f) for f in frames_bgr]
    target = float(np.median(ls)) if reference == "median" else ls[0]
    normalized = [normalize_luminance_to_target(f, target) for f in frames_bgr]
    after = luminance_stats(normalized)
    return normalized, before, after


def insert_wrap_bridges(frames_bgr: list, count: int) -> list:
    if count <= 0 or len(frames_bgr) < 2:
        return frames_bgr
    first, last = frames_bgr[0], frames_bgr[-1]
    bridges = [
        cv2.addWeighted(last, 1 - t, first, t, 0)
        for t in (i / (count + 1) for i in range(1, count + 1))
    ]
    return frames_bgr + bridges


def main():
    parser = argparse.ArgumentParser(description="Build merch spin frame sequence")
    parser.add_argument("--source", required=True, help="Source MP4 path")
    parser.add_argument("--slug", required=True, help="Output slug under images/cs2-merch/")
    parser.add_argument("--source-label", default="", help="Manifest source label")
    parser.add_argument("--target-frames", type=int, default=TARGET_FRAMES)
    parser.add_argument(
        "--use-full-clip",
        action="store_true",
        help="Pre-trimmed website spin: export nearly the entire clip, trim only clearance tail",
    )
    parser.add_argument(
        "--clearance-tail-sec",
        type=float,
        default=FULL_CLIP_MAX_TAIL_SEC,
        help="Max seconds trimmed from clip end in --use-full-clip mode",
    )
    parser.add_argument(
        "--sampling",
        choices=("sharp", "consecutive"),
        default="sharp",
        help="Frame pick: sharpness within angle bins, or evenly spaced consecutive indices",
    )
    parser.add_argument("--extract", action="store_true", help="Export frames + manifest")
    args = parser.parse_args()

    global FPS
    source = Path(args.source)
    slug = args.slug
    source_label = args.source_label or source.name
    out_root = Path(f"images/cs2-merch/{slug}")
    full_mp4 = out_root / f"{slug}.full.mp4"
    out_dir = out_root / "frames"

    path = full_mp4 if full_mp4.exists() else source
    FPS = probe_video_fps(path)
    print(f"Source FPS: {FPS:.3f}")
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

    center_grays = load_center_crop_grays(path)
    use_full_clip = args.use_full_clip or is_website_spins_source(source)

    if use_full_clip:
        segment = find_full_clip_end(center_grays, total, args.clearance_tail_sec)
        a, b = segment["start"], segment["end"]
        selection_type = (
            "full_clip_consecutive_wrap_bridges"
            if args.sampling == "consecutive"
            else "full_clip_sharp_wrap_bridges"
        )
        print("\n=== Full clip mode (pre-trimmed website spin) ===")
        print(
            f"  f{a}-f{b-1} ({a/FPS:.2f}s-{(b-1)/FPS:.2f}s) "
            f"tail_trimmed={segment['tail_trimmed_frames']}f "
            f"({segment['tail_trimmed_sec']}s) boundary={segment['boundary']:.4f}"
        )
    else:
        segment = find_best_loop_segment(runs, cum, center_grays)
        a, b = segment["start"], segment["end"]
        selection_type = (
            "single_run_consecutive_wrap_bridges"
            if args.sampling == "consecutive"
            else "single_run_sharp_wrap_bridges"
        )
        print("\n=== Best loop segment ===")
        print(
            f"  f{a}-f{b-1} ({a/FPS:.2f}s-{(b-1)/FPS:.2f}s) "
            f"boundary={segment['boundary']:.4f} len={segment['rot_len']}"
        )

    local_cum = cum[a:b] - cum[a]
    target = min(args.target_frames, b - a)
    sharp = load_sharpness_map(path, a, b)
    seg_vals = np.array([sharp[i] for i in range(a, b) if i in sharp])
    min_sharp = float(np.percentile(seg_vals, SHARPNESS_MIN_PERCENTILE)) if seg_vals.size else 0.0
    if args.sampling == "consecutive":
        pi = pick_consecutive_frames(a, b, target)
    else:
        pi = pick_sharpest_per_angle(
            a, b, cum, sharp, target, SHARPNESS_WINDOW, min_sharp, pin_endpoints=True
        )

    naive = []
    for t in np.linspace(0, float(local_cum[-1]), target):
        naive.append(a + int(np.argmin(np.abs(local_cum - t))))

    run_idx = None
    if not use_full_clip:
        run_idx = next(
            (r["run"] for r in run_stats if r["start"] == segment["run_start"]),
            segment["run_start"],
        )
    boundary = boundary_metrics_from_grays(center_grays[pi[0]], center_grays[pi[-1]])

    selection: dict = {
        "type": selection_type,
        "source_start": a,
        "source_end": b - 1,
        "picked_indices": pi,
        "rotation_span": float(local_cum[-1]),
        "boundary": boundary,
        "sharpness": sharpness_stats(sharp, pi),
        "sharpness_naive": sharpness_stats(sharp, naive),
        "sharpness_min_threshold": round(min_sharp, 1),
        "sampling": args.sampling,
        "sourceIndexJumps": source_index_jump_stats(pi),
    }
    if use_full_clip:
        selection["full_clip"] = {
            "tailTrimmedFrames": segment["tail_trimmed_frames"],
            "tailTrimmedSec": segment["tail_trimmed_sec"],
            "boundarySsim": round(segment["boundary"], 4),
            "sourceFrames": total,
        }
    else:
        selection["run"] = run_idx
        selection["loop_segment"] = {
            "start": a,
            "end": b - 1,
            "boundarySsim": round(segment["boundary"], 4),
            "rotLen": segment["rot_len"],
            "handPenalty": round(segment["hand_penalty"], 2),
        }

    print("\n=== SELECTED ===")
    print(json.dumps({k: v for k, v in selection.items() if k != "picked_indices"}, indent=2))
    print(
        f"Sharpness median: sharp-pick={selection['sharpness']['median']} "
        f"vs naive={selection['sharpness_naive']['median']}"
    )

    if not args.extract:
        return

    pi = selection["picked_indices"]
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
    adj_before = adjacent_frame_metrics(ordered_bgr)
    wrap_ssim = wrap_ssim_after_bridges(ordered_bgr, WRAP_BRIDGE_COUNT)
    bridged_bgr = insert_wrap_bridges(ordered_bgr, WRAP_BRIDGE_COUNT)
    lum_final = luminance_stats(bridged_bgr)
    adj_final = adjacent_frame_metrics(bridged_bgr)

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
        "source": source_label,
        "mode": "frame-sequence-360",
        "targetFrames": target,
        "wrapBridgeCount": WRAP_BRIDGE_COUNT,
        "selection": selection["type"],
        "webpQuality": WEBP_QUALITY,
        "sourceFrames": {"first": pi[0], "last": pi[-1]},
        "trimSec": {"first": round(in_sec, 3), "last": round(out_sec, 3)},
        "rotationSpan": round(selection["rotation_span"], 2),
        "boundarySsim": round(selection["boundary"]["ssim"], 4),
        "boundaryMse": round(selection["boundary"]["mse"], 2),
        "wrapSsim": round(wrap_ssim, 4),
        "sharpness": selection["sharpness"],
        "luminanceBefore": lum_before,
        "luminanceAfter": lum_after,
        "luminanceFinal": lum_final,
        "sampling": args.sampling,
        "sourceIndexJumps": selection["sourceIndexJumps"],
        "adjacentBefore": adj_before,
        "adjacentFinal": adj_final,
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, indent="\t") + "\n", encoding="utf-8"
    )
    print(f"\nExtracted {count} frames to {out_dir}")
    print(json.dumps(manifest, indent=2))

    poster = out_root / "poster.webp"
    poster.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg", "-y", "-i", str(out_dir / "frame-001.webp"),
            "-q:v", "90", str(poster),
        ],
        check=True,
        capture_output=True,
    )


if __name__ == "__main__":
    main()
