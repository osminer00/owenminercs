#!/usr/bin/env node
/**
 * One-off: convert 2022–2023 setup archive source media to web assets.
 * Source: G:\My Drive\Media for owenminercs.com\put on website\2022-2023 setup\
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SRC = String.raw`G:\My Drive\Media for owenminercs.com\put on website\2022-2023 setup`;
const OUT = path.resolve('images/archive/setup-2022-2023');

const PHOTOS = [
	['IMG_4269.HEIC', 'img-4269.webp'],
	['IMG_4270.HEIC', 'img-4270.webp'],
	['IMG_4271.HEIC', 'img-4271.webp'],
	['IMG_4272.HEIC', 'img-4272.webp'],
	['IMG_4273.HEIC', 'img-4273.webp'],
	[
		'also watching ohnepixel during a blast event where ohne yapped about cs2 coming out- one of the last blast tournaments on csgo before cs2.HEIC',
		'ohnepixel-blast-cs2.webp',
	],
	[
		'2023 gaming mode when i had my 240hz monitor in the center of the dessk and ultrawide moved to vertical with monitor arms four monitor setup.HEIC',
		'gaming-mode-four-monitors.webp',
	],
];

const VIDEOS = [
	[
		'mute sound, contains copyrighted music - gaming setup from 2022 or 2023, this is my workstation mode with the ultrawide horizontal and Im doing coding homework from college.MOV',
		'workstation-mode-college-homework.mp4',
	],
];

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
	run(`ffmpeg -y -i "${input}" -update 1 -frames:v 1 -c:v libwebp -quality 85 "${output}"`);
}

for (const [srcName, outName] of VIDEOS) {
	const input = path.join(SRC, srcName);
	const output = path.join(OUT, outName);
	const poster = path.join(OUT, outName.replace(/\.mp4$/, '-poster.jpg'));
	if (!fs.existsSync(input)) {
		console.error('Missing source:', input);
		process.exitCode = 1;
		continue;
	}
	if (!fs.existsSync(output)) {
		run(
			`ffmpeg -y -i "${input}" -c:v libx264 -crf 28 -pix_fmt yuv420p -an -movflags +faststart "${output}"`,
		);
	}
	if (!fs.existsSync(poster)) {
		run(`ffmpeg -y -ss 0.5 -i "${output}" -frames:v 1 -q:v 2 -update 1 "${poster}"`);
	}
}

console.log('Done. Assets in', OUT);
