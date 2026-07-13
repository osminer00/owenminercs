#!/usr/bin/env python3
"""Exhaustive boundary match in run3/run4 using MSE + SSIM."""
from pathlib import Path

import cv2
import numpy as np

FPS = 30000 / 1001
PATH = Path("images/cs2-merch/knife-case-spin/knife-case-spin.full.mp4")


def load_frames(path):
    cap = cv2.VideoCapture(str(path))
    frames = []
    while True:
        ok, bgr = cap.read()
        if not ok:
            break
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        ch, cw = int(h * 0.6), int(w * 0.6)
        y0, x0 = (h - ch) // 2, (w - cw) // 2
        crop = gray[y0 : y0 + ch, x0 : x0 + cw]
        frames.append(cv2.resize(crop, (240, 240), interpolation=cv2.INTER_AREA))
    cap.release()
    return frames


def mse(a, b):
    d = a.astype(np.float32) - b.astype(np.float32)
    return float(np.mean(d * d))


def ssim_simple(a, b):
    a = a.astype(np.float64)
    b = b.astype(np.float64)
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    mu_a, mu_b = a.mean(), b.mean()
    sig_a, sig_b = a.var(), b.var()
    sig_ab = ((a - mu_a) * (b - mu_b)).mean()
    num = (2 * mu_a * mu_b + c1) * (2 * sig_ab + c2)
    den = (mu_a * mu_a + mu_b * mu_b + c1) * (sig_a + sig_b + c2)
    return float(num / den)


def exhaust(frames, a, b, label, min_sec=3.0, max_sec=7.5):
    results = []
    min_l = int(min_sec * FPS)
    max_l = int(max_sec * FPS)
    for length in range(min_l, max_l + 1):
        for in_f in range(a, b - length):
            out_f = in_f + length
            score_mse = mse(frames[in_f], frames[out_f - 1])
            score_ssim = ssim_simple(frames[in_f], frames[out_f - 1])
            results.append((score_mse, -score_ssim, in_f, out_f))
    results.sort()
    print(f"\n{label} ({len(results)} combos)")
    for row in results[:12]:
        m, neg_s, i, o = row
        print(
            f"  mse={m:.1f} ssim={-neg_s:.4f} "
            f"in={i/FPS:.3f}s out={(o-1)/FPS:.3f}s dur={(o-i)/FPS:.2f}s"
        )
    return results


def main():
    frames = load_frames(PATH)
    r3 = exhaust(frames, 621, 826, "run3")
    r4 = exhaust(frames, 906, 1125, "run4")

    # current
    i, o = 556, 700
    print(
        f"\nCURRENT mse={mse(frames[i], frames[o-1]):.1f} "
        f"ssim={ssim_simple(frames[i], frames[o-1]):.4f}"
    )

    best = r3[0]
    print(f"\nBEST run3: in={best[2]/FPS:.3f}s out={(best[3]-1)/FPS:.3f}s mse={best[0]:.1f}")

    # save top 3 run3 boundary pairs
    cap = cv2.VideoCapture(str(PATH))
    full = [f for ok, f in iter(lambda: cap.read(), (False, None)) if ok]
    cap.release()
    out = Path("dev/spin-loop-compare")
    for n, row in enumerate(r3[:3]):
        _, _, i, o = row
        cv2.imwrite(str(out / f"r3top{n}_in.jpg"), full[i])
        cv2.imwrite(str(out / f"r3top{n}_out.jpg"), full[o - 1])


if __name__ == "__main__":
    main()
