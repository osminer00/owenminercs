#!/usr/bin/env python3
"""Measure adjacent-frame SSIM and luminance delta across a spin frame sequence."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def center_crop_gray(bgr: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    ch, cw = int(h * 0.7), int(w * 0.7)
    y0, x0 = (h - ch) // 2, (w - cw) // 2
    return gray[y0 : y0 + ch, x0 : x0 + cw]


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


def frame_l_mean(bgr: np.ndarray) -> float:
    h, w = bgr.shape[:2]
    ch, cw = int(h * 0.7), int(w * 0.7)
    y0, x0 = (h - ch) // 2, (w - cw) // 2
    crop = bgr[y0 : y0 + ch, x0 : x0 + cw]
    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)
    return float(lab[:, :, 0].mean())


def load_frames(frames_dir: Path, count: int) -> list[np.ndarray]:
    frames = []
    for i in range(1, count + 1):
        path = frames_dir / f"frame-{i:03d}.webp"
        bgr = cv2.imread(str(path))
        if bgr is None:
            raise SystemExit(f"Missing frame: {path}")
        frames.append(bgr)
    return frames


def analyze(frames: list[np.ndarray], wrap_bridge_count: int) -> dict:
    ssims: list[float] = []
    deltas: list[float] = []
    worst_ssim = (1.0, 0, 1)
    worst_delta = (0.0, 0, 1)

    for i in range(len(frames) - 1):
        g0 = center_crop_gray(frames[i])
        g1 = center_crop_gray(frames[i + 1])
        s = ssim_gray(g0, g1)
        ssims.append(s)
        if s < worst_ssim[0]:
            worst_ssim = (s, i + 1, i + 2)
        d = abs(frame_l_mean(frames[i + 1]) - frame_l_mean(frames[i]))
        deltas.append(d)
        if d > worst_delta[0]:
            worst_delta = (d, i + 1, i + 2)

    loop_count = len(frames) - wrap_bridge_count
    wrap_pair = (loop_count, 1) if loop_count >= 2 else (1, 1)
    wrap_ssim = ssim_gray(
        center_crop_gray(frames[wrap_pair[0] - 1]),
        center_crop_gray(frames[wrap_pair[1] - 1]),
    )

    return {
        "frameCount": len(frames),
        "loopFrames": loop_count,
        "wrapBridgeCount": wrap_bridge_count,
        "adjacent": {
            "minSsim": round(min(ssims), 4),
            "maxSsim": round(max(ssims), 4),
            "meanSsim": round(float(np.mean(ssims)), 4),
            "maxLumDelta": round(max(deltas), 2),
            "worstSsimPair": list(worst_ssim),
            "worstDeltaPair": list(worst_delta),
        },
        "wrapPair": list(wrap_pair),
        "wrapSsim": round(wrap_ssim, 4),
    }


def main() -> None:
    slug = sys.argv[1] if len(sys.argv) > 1 else "agent-k-inferno-bookend-case-spin"
    frames_dir = ROOT / "images" / "cs2-merch" / slug / "frames"
    manifest_path = frames_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    wrap = int(manifest.get("wrapBridgeCount", 5))
    frames = load_frames(frames_dir, int(manifest["frameCount"]))
    report = analyze(frames, wrap)
    print(json.dumps(report, indent=2))

    ok = report["wrapSsim"] >= 0.95 and report["adjacent"]["worstSsimPair"][2] >= 0.55
    print("PASS" if ok else "FAIL", file=sys.stderr)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
