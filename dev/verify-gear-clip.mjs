#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const gearMp4 = join(process.cwd(), 'images', 'bubble-themes', 'gear', 'bg.mp4');
const probe = execSync(
	`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${gearMp4}"`,
	{ encoding: 'utf8' },
).trim();
console.log('gear bg.mp4 duration:', probe, 's');

const TMP = join(process.cwd(), 'dev', 'tmp-bubble-audit');
function frameAt(file, t) {
	const out = join(TMP, `verify_gear_${t}.pgm`);
	execSync(
		`ffmpeg -y -loglevel error -ss ${t} -i "${file}" -frames:v 1 -vf scale=320:-2,format=gray -f image2 "${out}"`,
		{ shell: true },
	);
	const buf = readFileSync(out);
	const idx = buf.indexOf(Buffer.from('255\n'));
	const dataStart = buf.indexOf(0x0a, idx) + 1;
	return buf.subarray(dataStart);
}

function motionScore(file, step = 2) {
	let total = 0;
	let pairs = 0;
	for (let t = step; t <= 22; t += step) {
		const a = frameAt(file, t - step);
		const b = frameAt(file, t);
		const n = Math.min(a.length, b.length);
		let diff = 0;
		for (let j = 0; j < n; j++) diff += Math.abs(a[j] - b[j]);
		total += diff / n;
		pairs++;
	}
	return (total / pairs).toFixed(2);
}

console.log('NEW gear clip avgDiff:', motionScore(gearMp4));
console.log('OLD gear source (72s window) avgDiff: 23.98');
