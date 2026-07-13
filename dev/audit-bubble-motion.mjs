#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = String.raw`J:\Bubble logo folder\(Footage)\C0103.MP4`;
const TMP = join(process.cwd(), 'dev', 'tmp-bubble-audit');
mkdirSync(TMP, { recursive: true });

function frameAt(t) {
	const out = join(TMP, `motion_${t}.pgm`);
	execSync(
		`ffmpeg -y -loglevel error -ss ${t} -i "${SRC}" -frames:v 1 -vf scale=320:-2,format=gray -f image2 "${out}"`,
		{ shell: true },
	);
	const buf = readFileSync(out);
	const idx = buf.indexOf(Buffer.from('255\n'));
	const dataStart = buf.indexOf(0x0a, idx) + 1;
	return buf.subarray(dataStart);
}

function motionScore(start, dur = 24, step = 2) {
	const times = [];
	for (let t = start; t <= start + dur; t += step) times.push(t);
	let total = 0;
	let pairs = 0;
	for (let i = 1; i < times.length; i++) {
		const a = frameAt(times[i - 1]);
		const b = frameAt(times[i]);
		const n = Math.min(a.length, b.length);
		let diff = 0;
		for (let j = 0; j < n; j++) diff += Math.abs(a[j] - b[j]);
		total += diff / n;
		pairs++;
	}
	return { avgDiff: total / pairs, pairs };
}

const current = {
	gear: 72,
	gaming: 12,
	dev: 82,
	donators: 168,
	'garage-sale': 148,
	'help-wanted': 192,
	qa: 252,
	achievements: 262,
	socials: 218,
	home: 108,
};

console.log('=== CURRENT SEGMENTS ===');
for (const [name, start] of Object.entries(current)) {
	const s = motionScore(start);
	console.log(`${name.padEnd(14)} start=${String(start).padStart(3)}s avgDiff=${s.avgDiff.toFixed(2)}`);
}

console.log('\n=== SCAN every 6s windows ===');
const candidates = [];
for (let start = 0; start <= 276; start += 6) {
	const s = motionScore(start, 24, 3);
	candidates.push({ start, ...s });
}
candidates.sort((a, b) => a.avgDiff - b.avgDiff);
console.log('LOWEST motion (likely static cam):');
for (const c of candidates.slice(0, 25)) {
	console.log(`  ${String(c.start).padStart(3)}s avgDiff=${c.avgDiff.toFixed(2)}`);
}
console.log('\nHIGHEST motion:');
for (const c of candidates.slice(-12)) {
	console.log(`  ${String(c.start).padStart(3)}s avgDiff=${c.avgDiff.toFixed(2)}`);
}
