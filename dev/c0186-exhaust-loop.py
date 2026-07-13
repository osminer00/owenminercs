#!/usr/bin/env python3
"""Exhaustive C0186 loop search: all monotonic runs, multi-metric scoring."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

FPS = 30000 / 1001
PATH = Path("images/cs2-merch/knife-case-spin/knife-case-spin.full.mp4")
OUT = Path("dev/spin-loop-compare/c0186")
MIN_LOOP_SEC = 1.0
MAX_LOOP_SEC = 8.0
MIN_FLOW = 0.08
MIN_MONO = 0.88


def load_frames(path: Path):
    cap = cv2.VideoCapture(str(path))
    gray_small: list[np.ndarray] = []
    full: list[np.ndarray] = []
    while True:
        ok, bgr = cap.read()
        if not ok:
            break
        full.append(bgr)
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        ch, cw = int(h * 0.55), int(w * 0.55)
        y0, x0 = (h - ch) // 2, (w - cw) // 2
        crop = gray[y0 : y0 + ch, x0 : x0 + cw]
        gray_small.append(cv2.resize(crop, (240, 240), interpolation=cv2.INTER_AREA))
    cap.release()
    return gray_small, full


def precompute_flow(frames: list[np.ndarray]):
    flows = [0.0]
    angles = [0.0]
    for i in range(1, len(frames)):
        flow = cv2.calcOpticalFlowFarneback(
            frames[i - 1], frames[i], None, 0.5, 3, 15, 3, 5, 1.2, 0
        )
        fx = flow[..., 0]
        fy = flow[..., 1]
        flows.append(float(np.mean(fx)))
        angles.append(float(np.degrees(np.arctan2(np.mean(fy), np.mean(fx)))))
    return np.array(flows), np.array(angles)


def mse(a: np.ndarray, b: np.ndarray) -> float:
    d = a.astype(np.float32) - b.astype(np.float32)
    return float(np.mean(d * d))


def ssim_simple(a: np.ndarray, b: np.ndarray) -> float:
    a = a.astype(np.float64)
    b = b.astype(np.float64)
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    mu_a, mu_b = a.mean(), b.mean()
    sig_a, sig_b = a.var(), b.var()
    sig_ab = ((a - mu_a) * (b - mu_b)).mean()
    num = (2 * mu_a * mu_b + c1) * (2 * sig_ab + c2)
    den = (mu_a * mu_a + mu_b * mu_b + c1) * (sig_a + sig_b + c2)
    return float(num / den)


def phash(img: np.ndarray, hash_size: int = 16) -> np.ndarray:
    resized = cv2.resize(img, (hash_size + 1, hash_size), interpolation=cv2.INTER_AREA)
    diff = resized[:, 1:] > resized[:, :-1]
    return diff.flatten()


def phash_dist(a: np.ndarray, b: np.ndarray) -> int:
    return int(np.count_nonzero(a != b))


def find_runs(flows: np.ndarray, min_len: int = 15):
    """Return monotonic CW (+1) and CCW (-1) runs as (sign, start, end_exclusive)."""
    signs = np.zeros(len(flows), dtype=np.int8)
    for i in range(1, len(flows)):
        f = flows[i]
        if abs(f) < 0.02:
            signs[i] = signs[i - 1] if i > 1 else 0
        else:
            signs[i] = 1 if f > 0 else -1

    runs: list[tuple[int, int, int]] = []
    i = 1
    while i < len(signs):
        if signs[i] == 0:
            i += 1
            continue
        s = signs[i]
        start = i
        while i < len(signs) and signs[i] == s:
            i += 1
        if i - start >= min_len:
            runs.append((int(s), start, i))
    return runs


@dataclass
class Candidate:
    in_f: int
    out_f: int
    mse: float
    ssim: float
    phash: int
    flow_delta: float
    mean_flow: float
    mono: float
    run_sign: int

    @property
    def duration(self) -> float:
        return (self.out_f - self.in_f) / FPS

    @property
    def composite(self) -> float:
        # lower is better; normalize phash ~0-256, flow_delta ~0-180
        return (
            self.mse / 500.0
            + (1.0 - self.ssim) * 10.0
            + self.phash / 80.0
            + abs(self.flow_delta) / 45.0
        )


def search_run(
    frames: list[np.ndarray],
    flows: np.ndarray,
    angles: np.ndarray,
    sign: int,
    run_start: int,
    run_end: int,
    hashes: list[np.ndarray],
) -> list[Candidate]:
    results: list[Candidate] = []
    min_f = max(2, int(MIN_LOOP_SEC * FPS))
    max_f = min(int(MAX_LOOP_SEC * FPS), run_end - run_start)
    for length in range(min_f, max_f + 1):
        for in_f in range(run_start, run_end - length):
            out_f = in_f + length
            seg = flows[in_f + 1 : out_f]
            if len(seg) == 0:
                continue
            mean_flow = float(np.mean(np.abs(seg)))
            nz = np.sign(seg)
            nz = nz[nz != 0]
            mono = max(np.sum(nz > 0), np.sum(nz < 0)) / len(nz) if len(nz) else 0.0
            if mean_flow < MIN_FLOW or mono < MIN_MONO:
                continue

            in_frame = frames[in_f]
            out_frame = frames[out_f - 1]
            boundary_flow = flows[in_f + 1 : out_f]
            in_angle = float(np.mean(angles[in_f + 1 : in_f + 6])) if in_f + 6 < len(angles) else angles[in_f]
            out_angle = float(np.mean(angles[out_f - 6 : out_f])) if out_f - 6 > in_f else angles[out_f - 2]
            flow_delta = out_angle - in_angle

            results.append(
                Candidate(
                    in_f=in_f,
                    out_f=out_f,
                    mse=mse(in_frame, out_frame),
                    ssim=ssim_simple(in_frame, out_frame),
                    phash=phash_dist(hashes[in_f], hashes[out_f - 1]),
                    flow_delta=flow_delta,
                    mean_flow=mean_flow,
                    mono=mono,
                    run_sign=sign,
                )
            )
    return results


def main():
    frames, full = load_frames(PATH)
    flows, angles = precompute_flow(frames)
    hashes = [phash(f) for f in frames]
    runs = find_runs(flows)
    print(f"{len(frames)} frames ({len(frames)/FPS:.2f}s), {len(runs)} monotonic runs")
    for sign, a, b in runs:
        label = "CW" if sign > 0 else "CCW"
        print(f"  {label}: {a/FPS:.2f}s - {(b-1)/FPS:.2f}s ({b-a} frames)")

    all_cands: list[Candidate] = []
    for sign, a, b in runs:
        all_cands.extend(search_run(frames, flows, angles, sign, a, b, hashes))

    all_cands.sort(key=lambda c: c.composite)
    print(f"\nSearched {len(all_cands)} boundary pairs")

    # Current trim
    cur_in, cur_out = 697, 815
    cur = Candidate(
        cur_in,
        cur_out,
        mse(frames[cur_in], frames[cur_out - 1]),
        ssim_simple(frames[cur_in], frames[cur_out - 1]),
        phash_dist(hashes[cur_in], hashes[cur_out - 1]),
        0,
        0,
        0,
        1,
    )
    print(f"\nCURRENT 23.26-27.19s: mse={cur.mse:.1f} ssim={cur.ssim:.4f} phash={cur.phash}")

    print("\nTop 15 by composite score:")
    for i, c in enumerate(all_cands[:15]):
        label = "CW" if c.run_sign > 0 else "CCW"
        print(
            f"  #{i+1} {label} in={c.in_f/FPS:.3f}s out={(c.out_f-1)/FPS:.3f}s "
            f"dur={c.duration:.2f}s mse={c.mse:.1f} ssim={c.ssim:.4f} "
            f"phash={c.phash} flow_delta={c.flow_delta:.1f}deg comp={c.composite:.3f}"
        )

    # Short loops only (1-3s)
    short = [c for c in all_cands if c.duration <= 3.05]
    short.sort(key=lambda c: c.composite)
    print(f"\nTop 8 SHORT loops (≤3s):")
    for i, c in enumerate(short[:8]):
        label = "CW" if c.run_sign > 0 else "CCW"
        print(
            f"  #{i+1} {label} {c.in_f/FPS:.3f}-{(c.out_f-1)/FPS:.3f}s "
            f"dur={c.duration:.2f}s mse={c.mse:.1f} ssim={c.ssim:.4f} phash={c.phash}"
        )

    OUT.mkdir(parents=True, exist_ok=True)
    export = all_cands[:3]
    meta = []
    for i, c in enumerate(export):
        tag = f"top{i+1}"
        cv2.imwrite(str(OUT / f"{tag}_in.jpg"), full[c.in_f])
        cv2.imwrite(str(OUT / f"{tag}_out.jpg"), full[c.out_f - 1])
        # side-by-side
        h = max(full[c.in_f].shape[0], full[c.out_f - 1].shape[0])
        pair = np.hstack([full[c.in_f], full[c.out_f - 1]])
        cv2.imwrite(str(OUT / f"{tag}_pair.jpg"), pair)
        meta.append(
            {
                "rank": i + 1,
                "in_sec": round(c.in_f / FPS, 3),
                "out_sec": round((c.out_f - 1) / FPS, 3),
                "duration": round(c.duration, 3),
                "mse": round(c.mse, 2),
                "ssim": round(c.ssim, 4),
                "phash": c.phash,
                "flow_delta_deg": round(c.flow_delta, 2),
                "sign": "CW" if c.run_sign > 0 else "CCW",
            }
        )

    cv2.imwrite(str(OUT / "current_in.jpg"), full[cur_in])
    cv2.imwrite(str(OUT / "current_out.jpg"), full[cur_out - 1])
    cv2.imwrite(str(OUT / "current_pair.jpg"), np.hstack([full[cur_in], full[cur_out - 1]]))

    (OUT / "results.json").write_text(json.dumps({"top3": meta, "current": {"mse": cur.mse, "ssim": cur.ssim, "phash": cur.phash}}, indent=2))
    print(f"\nExported top 3 boundary pairs to {OUT}/")


if __name__ == "__main__":
    main()
