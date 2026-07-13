#!/usr/bin/env python3
"""Find best monotonic spin loop trim for turntable viewer."""
import json
import sys
from pathlib import Path

import cv2
import numpy as np

FPS = 30000 / 1001
MIN_LOOP_SEC = 3.0
MAX_LOOP_SEC = 10.0
CROP_FRAC = 0.55  # center crop for rotation signal


def load_frames(path: Path, step: int = 1):
    cap = cv2.VideoCapture(str(path))
    frames = []
    idx = 0
    while True:
        ok, bgr = cap.read()
        if not ok:
            break
        if idx % step == 0:
            gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
            h, w = gray.shape
            ch, cw = int(h * CROP_FRAC), int(w * CROP_FRAC)
            y0, x0 = (h - ch) // 2, (w - cw) // 2
            crop = gray[y0 : y0 + ch, x0 : x0 + cw]
            small = cv2.resize(crop, (160, 160), interpolation=cv2.INTER_AREA)
            frames.append(small)
        idx += 1
    cap.release()
    return frames, idx


def frame_diff(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.mean(cv2.absdiff(a, b)))


def rotation_signal(frames):
    """Signed mean horizontal flow per step (positive = object spins CW on screen)."""
    signals = [0.0]
    for i in range(1, len(frames)):
        flow = cv2.calcOpticalFlowFarneback(
            frames[i - 1],
            frames[i],
            None,
            0.5,
            3,
            15,
            3,
            5,
            1.2,
            0,
        )
        signals.append(float(np.mean(flow[..., 0])))
    return np.array(signals)


def monotonic_runs(signs, min_len: int):
    """Return list of (start, end_exclusive) index ranges with same non-zero sign."""
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


def best_loop_in_run(frames, start: int, end: int, min_frames: int, max_frames: int):
    """Search in/out within run for minimum boundary frame diff."""
    best = None
    span = end - start
    lo = max(min_frames, int(MIN_LOOP_SEC * FPS))
    hi = min(max_frames, span, int(MAX_LOOP_SEC * FPS))
    for length in range(lo, hi + 1):
        out_idx = start + length
        if out_idx >= end:
            break
        # coarse: only test a few in positions, then refine around best
        candidates = list(range(start, min(start + span - length, start + 30)))
        if span - length > 60:
            candidates += list(range(start + 30, end - length, 5))
        for in_idx in candidates:
            d = frame_diff(frames[in_idx], frames[in_idx + length])
            score = d
            if best is None or score < best["diff"]:
                best = {
                    "in_frame": in_idx,
                    "out_frame": in_idx + length,
                    "length_frames": length,
                    "diff": score,
                }
    # refine ±8 frames around best in
    if best:
        b = best["in_frame"]
        L = best["length_frames"]
        for in_idx in range(max(start, b - 8), min(end - L, b + 9)):
            d = frame_diff(frames[in_idx], frames[in_idx + L])
            if d < best["diff"]:
                best = {
                    "in_frame": in_idx,
                    "out_frame": in_idx + L,
                    "length_frames": L,
                    "diff": d,
                }
    return best


def sec(frame_idx: int) -> float:
    return frame_idx / FPS


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
        "images/cs2-merch/knife-case-spin/knife-case-spin.full.mp4"
    )
    print(f"Loading {path}...")
    frames, total = load_frames(path)
    print(f"Loaded {len(frames)} frames (source ~{total} @ {FPS:.3f} fps)")

    sig = rotation_signal(frames)
    thresh = np.percentile(np.abs(sig[1:]), 25)
    signs = np.where(np.abs(sig) < thresh, 0, np.sign(sig))

    min_len = int(MIN_LOOP_SEC * FPS)
    runs = monotonic_runs(signs, min_len)
    print(f"\nMonotonic runs (>= {MIN_LOOP_SEC}s): {len(runs)}")
    for i, (a, b, s) in enumerate(runs):
        print(
            f"  run {i}: frames {a}-{b} ({sec(a):.2f}s-{sec(b):.2f}s) "
            f"len={b-a} ({(b-a)/FPS:.2f}s) sign={'CW' if s > 0 else 'CCW'}"
        )

    # Also evaluate current trim
    cur_in = int(round(18.55 * FPS))
    cur_out = int(round(23.36 * FPS))
    if cur_out < len(frames) and cur_in < cur_out:
        cur_diff = frame_diff(frames[cur_in], frames[cur_out - 1])
        print(
            f"\nCurrent trim frames {cur_in}-{cur_out-1} "
            f"({sec(cur_in):.2f}s-{sec(cur_out-1):.2f}s) boundary diff={cur_diff:.3f}"
        )

    results = []
    for ri, (a, b, s) in enumerate(runs):
        best = best_loop_in_run(frames, a, b, min_len, int(MAX_LOOP_SEC * FPS))
        if best:
            best["run"] = ri
            best["sign"] = "CW" if s > 0 else "CCW"
            best["in_sec"] = sec(best["in_frame"])
            best["out_sec"] = sec(best["out_frame"])
            best["duration_sec"] = best["length_frames"] / FPS
            results.append(best)

    results.sort(key=lambda x: x["diff"])

    print("\nTop loop candidates (lowest boundary diff):")
    for r in results[:8]:
        print(
            f"  diff={r['diff']:.3f} run={r['run']} {r['sign']} "
            f"in={r['in_sec']:.3f}s (f{r['in_frame']}) "
            f"out={r['out_sec']:.3f}s (f{r['out_frame']}) "
            f"dur={r['duration_sec']:.2f}s"
        )

    # Search full video sliding windows (any segment, not just monotonic)
    print("\nGlobal sliding-window search (3-8s)...")
    global_best = []
    for length in range(int(3 * FPS), int(8 * FPS) + 1, int(0.25 * FPS)):
        for in_idx in range(0, len(frames) - length, 3):
            d = frame_diff(frames[in_idx], frames[in_idx + length])
            global_best.append((d, in_idx, in_idx + length, length))
    global_best.sort(key=lambda x: x[0])
    for d, a, b, L in global_best[:6]:
        print(
            f"  diff={d:.3f} in={sec(a):.3f}s (f{a}) out={sec(b):.3f}s (f{b}) "
            f"dur={L/FPS:.2f}s"
        )

    if results:
        pick = results[0]
        print("\nRECOMMENDED:")
        print(json.dumps(pick, indent=2))


if __name__ == "__main__":
    main()
