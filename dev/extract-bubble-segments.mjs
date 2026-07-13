#!/usr/bin/env node
/**
 * Extract per-section bubble background clips + poster frames from C0103.MP4.
 * Segments chosen for static camera + no metal straw (2026-06-28 ffmpeg analysis).
 * Each clip is post-processed to a ping-pong loop (forward + reverse concat) for seamless color transitions.
 * Usage: node dev/extract-bubble-segments.mjs
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = String.raw`J:\Bubble logo folder\(Footage)\C0103.MP4`;
const OUT_ROOT = join(ROOT, 'images', 'bubble-themes');
const DURATION = 24;

/** @type {Record<string, { start: number; poster: number }>} */
export const BUBBLE_SEGMENTS = {
	// Distinct color windows on C0103.MP4 (avoid 96–124s straw + 264s+ metal straw).
	gaming: { start: 12, poster: 15 }, // red + blue (reference look)
	gear: { start: 72, poster: 75 }, // cyan / teal / blue
	socials: { start: 132, poster: 135 }, // purple + cyan accents
	'help-wanted': { start: 156, poster: 159 }, // deep purple
	donators: { start: 180, poster: 183 }, // violet / magenta
	dev: { start: 204, poster: 207 }, // purple + teal
	qa: { start: 210, poster: 213 }, // electric blue
	achievements: { start: 237, poster: 240 }, // neon green + purple
	'garage-sale': { start: 288, poster: 291 }, // red + magenta (avoid 4:12 straw window)
};

function run(cmd) {
	execSync(cmd, { stdio: 'inherit', shell: true });
}

/** Forward + reversed concat for seamless loop (no harsh color jump at loop point). */
export function makePingPongMp4(inputPath, outputPath = inputPath) {
	const tmp = outputPath === inputPath ? `${inputPath}.pingpong.tmp.mp4` : outputPath;
	run(
		`ffmpeg -y -i "${inputPath}" -filter_complex "[0:v]split[forward][tmp];[tmp]reverse[backward];[forward][backward]concat=n=2:v=1:a=0[outv]" -map "[outv]" -c:v libx264 -crf 28 -pix_fmt yuv420p -an -movflags +faststart "${tmp}"`,
	);
	if (tmp !== outputPath) return;
	renameSync(tmp, outputPath);
}

if (!existsSync(SRC)) {
	console.error(`Source video not found: ${SRC}`);
	process.exit(1);
}

for (const [section, { start, poster }] of Object.entries(BUBBLE_SEGMENTS)) {
	const dir = join(OUT_ROOT, section);
	mkdirSync(dir, { recursive: true });
	const mp4 = join(dir, 'bg.mp4');
	const jpg = join(dir, 'poster.jpg');

	console.log(`\n=== ${section} (${start}s -> ${start + DURATION}s, poster ${poster}s) ===`);

	run(
		`ffmpeg -y -ss ${start} -t ${DURATION} -i "${SRC}" -vf "scale=1280:-2" -c:v libx264 -crf 28 -pix_fmt yuv420p -an -movflags +faststart "${mp4}.forward.tmp.mp4"`,
	);
	makePingPongMp4(`${mp4}.forward.tmp.mp4`, mp4);
	unlinkSync(`${mp4}.forward.tmp.mp4`);
	run(`ffmpeg -y -ss ${poster} -i "${SRC}" -frames:v 1 -q:v 2 "${jpg}"`);
}

console.log('\nDone - bubble theme assets written to images/bubble-themes/');
