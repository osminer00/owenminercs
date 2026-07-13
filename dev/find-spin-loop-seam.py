#!/usr/bin/env python3
"""Find loop seam: end frame that best matches frame 0 (display case position)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

FPS = 30.0
SEARCH_LAST_SEC = 2.0  # compare last N seconds against frame 0


def center_crop_gray(bgr: np.ndarray, frac: float = 0.7) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    ch, cw = int(h * frac), int(w * frac)
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


def load_frame(cap: cv2.VideoCapture, idx: int) -> np.ndarray | None:
    cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
    ok, bgr = cap.read()
    return bgr if ok else None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path)
    parser.add_argument("--out-dir", type=Path, help="Export comparison JPGs here")
    parser.add_argument("--search-last-sec", type=float, default=SEARCH_LAST_SEC)
    args = parser.parse_args()

    cap = cv2.VideoCapture(str(args.video))
    if not cap.isOpened():
        sys.exit(f"Cannot open {args.video}")

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or FPS

    frame0 = load_frame(cap, 0)
    if frame0 is None:
        sys.exit("Cannot read frame 0")
    g0 = center_crop_gray(frame0)

    search_start = max(1, total - int(args.search_last_sec * fps))
    results: list[dict] = []

    for idx in range(search_start, total):
        bgr = load_frame(cap, idx)
        if bgr is None:
            continue
        ssim = ssim_gray(g0, center_crop_gray(bgr))
        results.append(
            {
                "frame": idx,
                "sec": round(idx / fps, 3),
                "ssim": round(ssim, 4),
            }
        )

    cap.release()

    if not results:
        sys.exit("No candidate frames in search window")

    results.sort(key=lambda r: r["ssim"], reverse=True)
    best = results[0]

    report = {
        "video": str(args.video),
        "totalFrames": total,
        "fps": fps,
        "searchStartFrame": search_start,
        "searchStartSec": round(search_start / fps, 3),
        "loopInFrame": 0,
        "loopOutFrame": best["frame"],
        "loopOutSec": best["sec"],
        "loopDurationSec": round(best["sec"], 3),
        "boundarySsim": best["ssim"],
        "topCandidates": results[:10],
    }

    print(json.dumps(report, indent=2))

    if args.out_dir:
        args.out_dir.mkdir(parents=True, exist_ok=True)
        cap = cv2.VideoCapture(str(args.video))
        end_bgr = load_frame(cap, best["frame"])
        cap.release()

        h, w = frame0.shape[:2]
        gap = 8
        label_h = 40
        canvas = np.zeros((h + label_h, w * 2 + gap, 3), dtype=np.uint8)
        canvas[:] = (24, 24, 24)
        canvas[label_h : label_h + h, 0:w] = frame0
        canvas[label_h : label_h + h, w + gap : w + gap + w] = end_bgr

        cv2.putText(
            canvas,
            f"frame 0 (start)",
            (12, 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )
        cv2.putText(
            canvas,
            f"frame {best['frame']} SSIM {best['ssim']:.4f}",
            (w + gap + 12, 28),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )

        side_by_side = args.out_dir / "frame0-vs-end.jpg"
        cv2.imwrite(str(side_by_side), canvas, [int(cv2.IMWRITE_JPEG_QUALITY), 92])

        # Grid of top 6 candidates
        top_n = min(6, len(results))
        cols = 3
        rows = (top_n + cols - 1) // cols
        thumb_h, thumb_w = 320, int(320 * w / h)
        grid = np.zeros((rows * (thumb_h + 36), cols * (thumb_w + 8), 3), dtype=np.uint8)
        grid[:] = (24, 24, 24)
        cap = cv2.VideoCapture(str(args.video))
        for i, cand in enumerate(results[:top_n]):
            bgr = load_frame(cap, cand["frame"])
            if bgr is None:
                continue
            r, c = divmod(i, cols)
            thumb = cv2.resize(bgr, (thumb_w, thumb_h), interpolation=cv2.INTER_AREA)
            y0 = r * (thumb_h + 36)
            x0 = c * (thumb_w + 8)
            grid[y0 + 28 : y0 + 28 + thumb_h, x0 : x0 + thumb_w] = thumb
            cv2.putText(
                grid,
                f"f{cand['frame']} ssim {cand['ssim']:.4f}",
                (x0 + 4, y0 + 22),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45,
                (220, 220, 220),
                1,
                cv2.LINE_AA,
            )
        cap.release()
        cv2.imwrite(str(args.out_dir / "candidate-grid.jpg"), grid, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        print(f"Wrote {side_by_side}", file=sys.stderr)
        print(f"Wrote {args.out_dir / 'candidate-grid.jpg'}", file=sys.stderr)


if __name__ == "__main__":
    main()
