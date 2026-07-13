#!/usr/bin/env node
/**
 * One-off: convert Austin TX Major source media to web assets.
 * Source: G:\My Drive\Media for owenminercs.com\put on website\austin texas major\
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SRC = String.raw`G:\My Drive\Media for owenminercs.com\put on website\austin texas major`;
const OUT = path.resolve('images/austin-major');

const PHOTOS = [
	['austin cs drunk selfie- I was first in line for the meet and greet and asked some cringe question lol but it was really cool to meet one of my youtube inspirations.HEIC', 'meet-greet-selfie.webp'],
	['IMG_6183.HEIC', 'img-6183.webp'],
	["duwap's dream austin major set ft vypa photoshop on ios app.PNG", 'duwap-dream-vypa-photoshop.webp'],
	['rooftop patio view from my airbnb.HEIC', 'rooftop-patio.webp'],
	['bbq at the airbnb.HEIC', 'bbq-airbnb.webp'],
	// HEIC is the full balcony wide shot; PNG is the phone crop of Twistzz + siuhy.
	['twistzz and suihy close up.HEIC', 'twistzz-siuhy-wide.webp'],
	['mouz walkout.HEIC', 'mouz-walkout-1.webp'],
	['mouz walkout 2.HEIC', 'mouz-walkout-2.webp'],
	['mouz walkout 3.HEIC.HEIC', 'mouz-walkout-3.webp'],
	['before quarter finals as the arena fills up.HEIC', 'quarter-finals-arena.webp'],
	['Jimphatt one of my favorite players walking up to the arena.HEIC', 'jimpphatt-walking-arena.webp'],
	['rooftop patio view from my airbnb panoramic.HEIC', 'rooftop-patio-panoramic.webp'],
	['twistzz and suihy close up.PNG', 'twistzz-siuhy-close-up.webp'],
];

const VIDEOS = [
	['anouncer yap.MOV', 'announcer-yap.mp4'],
	['more announcer crowd hype.MOV', 'announcer-crowd-hype.mp4'],
	['banks hyping up crowd.MOV', 'banks-hyping-crowd.mp4'],
	['vitality walkout with lots of boos.MOV', 'vitality-walkout-boos.mp4'],
	['mongolz walkout.MOV', 'mongolz-walkout.mp4'],
	['apex middle finger.MOV', 'apex-middle-finger.mp4'],
	['apex middle finger close up.MOV', 'apex-middle-finger-close-up.mp4'],
	['show match with team usa walkout.MOV', 'show-match-team-usa-walkout.mp4'],
	['navi walkout.MOV', 'navi-walkout.mp4'],
	['show match walkout with ohnepixel dona etc.MOV', 'show-match-ohnepixel-dona-walkout.mp4'],
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
	const ext = path.extname(srcName).toLowerCase();
	if (ext === '.png') {
		const upscale = outName === 'twistzz-siuhy-close-up.webp' || outName === 'duwap-dream-vypa-photoshop.webp';
		const vf = upscale ? '-vf "scale=1400:-1:flags=lanczos" ' : '';
		const q = outName === 'twistzz-siuhy-close-up.webp' ? 92 : 90;
		run(`ffmpeg -y -i "${input}" ${vf}-update 1 -frames:v 1 -c:v libwebp -quality ${q} "${output}"`);
	} else {
		run(`ffmpeg -y -i "${input}" -update 1 -frames:v 1 -c:v libwebp -quality 85 "${output}"`);
	}
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
			`ffmpeg -y -i "${input}" -c:v libx264 -crf 28 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "${output}"`,
		);
	}
	if (!fs.existsSync(poster)) {
		run(`ffmpeg -y -ss 0.5 -i "${output}" -frames:v 1 -q:v 2 -update 1 "${poster}"`);
	}
}

console.log('Done. Assets in', OUT);
