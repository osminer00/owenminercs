#!/usr/bin/env node
/**
 * One-off: convert OwenMinerCS stickers source media to web assets.
 * Source: G:\My Drive\Media for owenminercs.com\put on website\stickers\
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SRC = String.raw`G:\My Drive\Media for owenminercs.com\put on website\stickers`;
const OUT = path.resolve('images/stickers');

const PHOTOS = [
	[
		'owenminercs sticker pack - I used to give these out to twitch subscribers and ebay orrders for fun let me know if they should return.HEIC',
		'sticker-pack-photo.webp',
	],
];

const COPY = [['stickers owenminercs printable.png', 'owenminercs-stickers-printable.png']];

function run(cmd) {
	execSync(cmd, { stdio: 'inherit', shell: true });
}

fs.mkdirSync(OUT, { recursive: true });

for (const [srcName, outName] of PHOTOS) {
	const input = path.join(SRC, srcName);
	const output = path.join(OUT, outName);
	if (!fs.existsSync(input)) {
		console.error('Missing source:', input);
		process.exitCode = 1;
		continue;
	}
	if (fs.existsSync(output)) {
		console.log('Skip (exists):', outName);
		continue;
	}
	run(`ffmpeg -y -i "${input}" -update 1 -frames:v 1 -c:v libwebp -quality 88 "${output}"`);
}

for (const [srcName, outName] of COPY) {
	const input = path.join(SRC, srcName);
	const output = path.join(OUT, outName);
	if (!fs.existsSync(input)) {
		console.error('Missing source:', input);
		process.exitCode = 1;
		continue;
	}
	if (fs.existsSync(output)) {
		console.log('Skip (exists):', outName);
		continue;
	}
	fs.copyFileSync(input, output);
	console.log('Copied:', outName);
}

console.log('Done. Assets in', OUT);
