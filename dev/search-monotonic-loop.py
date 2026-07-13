#!/usr/bin/env python3
"""Fast monotonic spin loop search — flow precomputed once."""
from pathlib import Path

import cv2
import numpy as np

FPS = 30000 / 1001
PATH = Path("images/cs2-merch/knife-case-spin/knife-case-spin.full.mp4")
MIN_FLOW = 0.15
MIN_LOOP = 3.0
MAX_LOOP = 8.0


def load_frames(path):
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


def precompute_flow(frames):
    flows = [0.0]
    for i in range(1, len(frames)):
        flow = cv2.calcOpticalFlowFarneback(
            frames[i - 1], frames[i], None, 0.5, 3, 15, 3, 5, 1.2, 0
        )
        flows.append(float(np.mean(flow[..., 0])))
    return np.array(flows)


def diff(a, b):
    return float(np.mean(cv2.absdiff(a, b)))


def seg_stats(flows, a, b):
    seg = flows[a + 1 : b]
    if len(seg) == 0:
        return 0.0, 0.0
    signs = np.sign(seg)
    nz = signs[signs != 0]
    mono = max(np.sum(nz > 0), np.sum(nz < 0)) / len(nz) if len(nz) else 0.0
    return float(np.mean(np.abs(seg))), float(mono)


def search(frames, flows, run_start, run_end, label):
    results = []
    min_f = int(MIN_LOOP * FPS)
    max_f = min(int(MAX_LOOP * FPS), run_end - run_start)
    for length in range(min_f, max_f + 1, 2):
        for in_f in range(run_start, run_end - length, 2):
            out_f = in_f + length
            mf, mono = seg_stats(flows, in_f, out_f)
            if mf < MIN_FLOW or mono < 0.92:
                continue
            bd = diff(frames[in_f], frames[out_f - 1])
            results.append((bd, in_f, out_f, mf, mono))
    results.sort()
    print(f"\n=== {label} {run_start}-{run_end} candidates={len(results)} ===")
    for row in results[:8]:
        bd, a, b, mf, mono = row
        print(
            f"  diff={bd:.2f} {a/FPS:.3f}-{(b-1)/FPS:.3f}s "
            f"dur={(b-a)/FPS:.2f}s flow={mf:.3f} mono={mono:.0%}"
        )
    return results


def refine(frames, in_f, length, rad=15):
    best = (1e9, in_f)
    for i in range(max(0, in_f - rad), in_f + rad + 1):
        d = diff(frames[i], frames[i + length - 1])
        if d < best[0]:
            best = (d, i)
    return best[1], best[0]


def main():
    frames = load_frames(PATH)
    flows = precompute_flow(frames)
    print(f"{len(frames)} frames, flow computed")

    runs = [("run2", 506, 600), ("run3", 621, 826), ("run4", 906, 1125)]
    tops = []
    for label, a, b in runs:
        res = search(frames, flows, a, b, label)
        if res:
            tops.append((label, res[0]))

    cur_a, cur_b = 556, 700
    print(
        f"\nCURRENT diff={diff(frames[cur_a], frames[cur_b-1]):.2f} "
        f"{cur_a/FPS:.3f}-{(cur_b-1)/FPS:.3f}s"
    )

    print("\n=== REFINED ===")
    picks = []
    for label, (bd, a, b, mf, mono) in tops:
        L = b - a
        ri, rbd = refine(frames, a, L)
        picks.append((rbd, label, ri, ri + L, mf, mono))
    picks.sort()
    for rbd, label, a, b, mf, mono in picks:
        print(
            f"{label}: diff={rbd:.2f} in={a/FPS:.3f}s out={(b-1)/FPS:.3f}s "
            f"dur={(b-a)/FPS:.2f}s"
        )

    # also try full run3 and run4 as-is
    for label, a, b in [("run3_full", 621, 826), ("run4_full", 906, 1125)]:
        d = diff(frames[a], frames[b - 1])
        mf, mono = seg_stats(flows, a, b)
        print(f"{label}: diff={d:.2f} dur={(b-a)/FPS:.2f}s flow={mf:.3f} mono={mono:.0%}")

    best = picks[0]
    cap = cv2.VideoCapture(str(PATH))
    full = [f for ok, f in iter(lambda: cap.read(), (False, None)) if ok]
    cap.release()
    out = Path("dev/spin-loop-compare")
    out.mkdir(parents=True, exist_ok=True)
    for tag, a, b in [
        ("pick", best[2], best[3]),
        ("current", 556, 700),
    ]:
        cv2.imwrite(str(out / f"{tag}_in.jpg"), full[a])
        cv2.imwrite(str(out / f"{tag}_out.jpg"), full[b - 1])
    print(f"\nPICK for encode: in={best[2]/FPS:.3f}s out={best[3]/FPS:.3f}s (frame {best[2]}-{best[3]})")


if __name__ == "__main__":
    main()
