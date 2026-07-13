#!/usr/bin/env python3
"""Refined loop search + monotonicity check for C0186."""
import json
from pathlib import Path

import cv2
import numpy as np

FPS = 30000 / 1001
PATH = Path("images/cs2-merch/knife-case-spin/knife-case-spin.full.mp4")


def load_gray_small(path):
    cap = cv2.VideoCapture(str(path))
    frames = []
    while True:
        ok, bgr = cap.read()
        if not ok:
            break
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        ch, cw = int(h * 0.55), int(w * 0.55)
        y0, x0 = (h - ch) // 2, (w - cw) // 2
        crop = gray[y0 : y0 + ch, x0 : x0 + cw]
        frames.append(cv2.resize(crop, (200, 200), interpolation=cv2.INTER_AREA))
    cap.release()
    return frames


def diff(a, b):
    return float(np.mean(cv2.absdiff(a, b)))


def flow_x(prev, curr):
    flow = cv2.calcOpticalFlowFarneback(prev, curr, None, 0.5, 3, 15, 3, 5, 1.2, 0)
    return float(np.mean(flow[..., 0]))


def analyze_segment(frames, in_f, out_f, label):
    length = out_f - in_f
    boundary = diff(frames[in_f], frames[out_f - 1])
    step_diffs = [diff(frames[i], frames[i + 1]) for i in range(in_f, out_f - 1)]
    flows = [flow_x(frames[i], frames[i + 1]) for i in range(in_f, out_f - 1)]
    signs = [int(np.sign(f)) for f in flows if abs(f) > 0.02]
    mono_frac = max(signs.count(1), signs.count(-1)) / len(signs) if signs else 0
    print(f"\n{label}")
    print(f"  frames {in_f}-{out_f-1} ({in_f/FPS:.3f}s - {(out_f-1)/FPS:.3f}s) dur={length/FPS:.2f}s")
    print(f"  boundary diff={boundary:.3f}")
    print(f"  mean step diff={np.mean(step_diffs):.3f} min={np.min(step_diffs):.3f} max={np.max(step_diffs):.3f}")
    print(f"  mean |flow_x|={np.mean(np.abs(flows)):.3f} mono_frac={mono_frac:.2%}")
    return boundary


def fine_search(frames, center_in, length_frames, radius=40):
    best = None
    for in_f in range(max(0, center_in - radius), center_in + radius):
        out_f = in_f + length_frames
        if out_f >= len(frames):
            continue
        d = diff(frames[in_f], frames[out_f - 1])
        if best is None or d < best[0]:
            best = (d, in_f, out_f)
    return best


def main():
    frames = load_gray_small(PATH)
    print(f"{len(frames)} frames")

    # Current trim
    analyze_segment(frames, 556, 700, "CURRENT (18.55-23.36s approx)")

    # Monotonic run 3 best from prior
    analyze_segment(frames, 697, 815, "RUN3 BEST (23.26-27.19s)")

    # Global best coarse
    analyze_segment(frames, 1161, 1250, "GLOBAL BEST coarse (38.74-41.71s)")

    # Fine search around global best for multiple durations
    print("\n--- Fine search 37.5s - 42.5s ---")
    candidates = []
    for dur_sec in [2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5]:
        L = int(round(dur_sec * FPS))
        for center in range(int(37.5 * FPS), int(41.0 * FPS), 5):
            r = fine_search(frames, center, L, radius=80)
            if r:
                candidates.append((*r, L))
    candidates.sort(key=lambda x: x[0])
    seen = set()
    for d, a, b, L in candidates[:15]:
        key = (a, b)
        if key in seen:
            continue
        seen.add(key)
        mono = analyze_segment(frames, a, b, f"  cand diff={d:.3f}")

    # Also search run 4 (30-37.5s) monotonic CW
    print("\n--- Fine search run4 CW region 30-38s ---")
    candidates2 = []
    for dur_sec in [3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0, 7.5]:
        L = int(round(dur_sec * FPS))
        for center in range(int(30.0 * FPS), int(38.0 * FPS), 8):
            r = fine_search(frames, center, L, radius=60)
            if r:
                candidates2.append((*r, L))
    candidates2.sort(key=lambda x: x[0])
    seen2 = set()
    for d, a, b, L in candidates2[:12]:
        key = (a, b)
        if key in seen2:
            continue
        seen2.add(key)
        analyze_segment(frames, a, b, f"  run4 cand diff={d:.3f}")

    # Save boundary pair images for top picks
    out_dir = Path("dev/spin-loop-compare")
    out_dir.mkdir(parents=True, exist_ok=True)
    picks = [
        ("current", 556, 700),
        ("run3", 697, 815),
        ("global1161", 1161, 1250),
    ]
    # add best from fine search
    if candidates:
        d, a, b, L = candidates[0]
        picks.append(("best_end", a, b))
    cap = cv2.VideoCapture(str(PATH))
    full_frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        full_frames.append(f)
    cap.release()
    for name, a, b in picks:
        cv2.imwrite(str(out_dir / f"{name}_in.jpg"), full_frames[a])
        cv2.imwrite(str(out_dir / f"{name}_out.jpg"), full_frames[b - 1])
    print(f"\nWrote comparison frames to {out_dir}/")


if __name__ == "__main__":
    main()
