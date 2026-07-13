#!/usr/bin/env python3
"""Quick optical-flow analysis for a spin source clip."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np

FPS = 30000 / 1001


def analyze(path: Path) -> dict:
    cap = cv2.VideoCapture(str(path))
    frames_gray = []
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
    cap.release()

    flow_x = [0.0]
    for i in range(1, len(frames_gray)):
        flow = cv2.calcOpticalFlowFarneback(
            frames_gray[i - 1], frames_gray[i], None, 0.5, 3, 15, 3, 5, 1.2, 0
        )
        flow_x.append(float(np.mean(flow[..., 0])))
    flow_x_arr = np.array(flow_x)
    cum = np.cumsum(flow_x_arr)

    thresh = np.percentile(np.abs(flow_x_arr[1:]), 25)
    signs = np.where(np.abs(flow_x_arr) < thresh, 0, np.sign(flow_x_arr))

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
        if j - i >= int(2.5 * FPS):
            span = abs(cum[j - 1] - cum[i])
            runs.append(
                {
                    "run": len(runs),
                    "start": i,
                    "end": j,
                    "sign": "CW" if s > 0 else "CCW",
                    "len": j - i,
                    "startSec": round(i / FPS, 2),
                    "endSec": round((j - 1) / FPS, 2),
                    "span": round(span, 1),
                }
            )
        i = j if j > i else i + 1

    cap = cv2.VideoCapture(str(path))
    first = last = None
    idx = 0
    while True:
        ok, bgr = cap.read()
        if not ok:
            break
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        if idx == 0:
            first = gray.astype(np.float32)
        last = gray.astype(np.float32)
        idx += 1
    cap.release()

    a, b = first, last
    mse = float(np.mean((a - b) ** 2))
    mu_a, mu_b = a.mean(), b.mean()
    sig_a, sig_b = a.var(), b.var()
    sig_ab = ((a - mu_a) * (b - mu_b)).mean()
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    ssim = float(
        ((2 * mu_a * mu_b + c1) * (2 * sig_ab + c2))
        / ((mu_a * mu_a + mu_b * mu_b + c1) * (sig_a + sig_b + c2))
    )

    return {
        "frames": len(frames_gray),
        "durationSec": round(len(frames_gray) / FPS, 2),
        "totalSpan": round(abs(cum[-1] - cum[0]), 1),
        "runs": runs,
        "boundary": {"mse": round(mse, 1), "ssim": round(ssim, 4)},
    }


if __name__ == "__main__":
    result = analyze(Path(sys.argv[1]))
    print(json.dumps(result, indent=2))
