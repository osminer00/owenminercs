#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DRIVE = String.raw`G:\My Drive\Media for owenminercs.com\put on website`;
const SETS = [
	['handwarmer', 'images/gadgets/handwarmer', false],
	['cs2 merch/pins', 'images/cs2-merch/pins', false],
	['cs2 merch/inferno bannana bookend', 'images/cs2-merch/inferno-bookend', false],
	['wooting 60he v1 foam pad close up', 'Keyboard/images/60he-v1-mods/foam-pad', true],
	[
		'setting up my cs2 merch in my aprtment when I moved in in june of 2025 right after the cs2 major',
		'images/cs2-merch/apartment-setup-2025',
		false,
	],
];

const imgExt = new Set(['.jpg', '.jpeg', '.heic', '.png', '.webp', '.gif']);
const vidExt = new Set(['.mov', '.mp4', '.m4v']);

function run(cmd) {
	execSync(cmd, { stdio: 'inherit', shell: true });
}

function slugBase(fileName) {
	return path
		.basename(fileName, path.extname(fileName))
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

for (const [srcRel, outRel, recursive] of SETS) {
	const src = path.join(DRIVE, srcRel);
	const out = path.resolve(outRel);
	fs.mkdirSync(out, { recursive: true });
	const files = [];
	const walk = (dir) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory() && recursive) walk(full);
			else if (entry.isFile()) files.push(full);
		}
	};
	if (recursive) walk(src);
	else files.push(...fs.readdirSync(src).map((f) => path.join(src, f)));

	for (const f of files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
		const ext = path.extname(f).toLowerCase();
		if (imgExt.has(ext)) {
			const o = path.join(out, `${slugBase(path.basename(f))}.webp`);
			if (fs.existsSync(o)) continue;
			run(`ffmpeg -y -i "${f}" -update 1 -frames:v 1 -c:v libwebp -quality 85 "${o}"`);
		} else if (vidExt.has(ext)) {
			const o = path.join(out, `${slugBase(path.basename(f))}.mp4`);
			if (fs.existsSync(o)) continue;
			run(`ffmpeg -y -i "${f}" -c:v libx264 -crf 28 -pix_fmt yuv420p -an -movflags +faststart "${o}"`);
		}
	}
	console.log('Done', outRel, '→', fs.readdirSync(out).length, 'files');
}
