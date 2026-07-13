#!/usr/bin/env node
/**
 * Convert Google Drive source media for content batch items 17–26.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DRIVE = String.raw`G:\My Drive\Media for owenminercs.com\put on website`;
const ROOT = path.resolve('.');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.heic', '.png', '.webp', '.gif']);
const VIDEO_EXT = new Set(['.mov', '.mp4', '.m4v']);

/** @type {{ key: string; srcRel: string; outRel: string; label: string; recursive?: boolean; videoMap?: Record<string, string> }[]} */
const SETS = [
	{
		key: 'asus-tuf-280hz',
		srcRel: 'asus tuff 280 hz monitor',
		outRel: 'images/archive/monitors/asus-tuf-280hz',
		label: 'ASUS TUF 280Hz monitor',
	},
	{
		key: 'zve10-unboxing',
		srcRel: 'zve10 unboxing photo - purchused refurbished from bestbuy and was missing the lense cap and had the wrong cord lol',
		outRel: 'images/cameras/zve10-unboxing',
		label: 'ZV-E10 unboxing',
	},
	{
		key: 'cam-link-4k',
		srcRel: 'cam link 4k',
		outRel: 'images/audio/cam-link-4k',
		label: 'Elgato Cam Link 4K',
	},
	{
		key: 'razer-blade-2019',
		srcRel: 'razerblade 2019',
		outRel: 'images/archive/old-pcs/razer-blade-2019',
		label: 'Razer Blade 2019 faulty RAM',
	},
	{
		key: 'nzxt-phantom',
		srcRel: 'nzxt phantom',
		outRel: 'images/archive/old-pcs/nzxt-phantom',
		label: 'NZXT Phantom case',
	},
	{
		key: 'sound-blaster-z',
		srcRel: 'sound card first',
		outRel: 'images/archive/audio/sound-blaster-z',
		label: 'Sound Blaster Z',
		recursive: true,
	},
	{
		key: 'deerrun-internals',
		srcRel: 'broken deer run treadmill internals',
		outRel: 'images/workout/deerrun-internals',
		label: 'DeerRun treadmill internals',
	},
	{
		key: 'hyperx-duocast',
		srcRel: 'microphone before shure was a hyperx duocast',
		outRel: 'images/audio/hyperx-duocast',
		label: 'HyperX DuoCast',
	},
	{
		key: 'setup-2024-tour',
		srcRel: '2024 setup tour',
		outRel: 'images/archive/setup-2024/tour',
		label: '2024 setup tour videos',
		videoMap: {
			'2024 setup tour video.MOV': 'setup-tour-main.mp4',
			'2024 setup tour with cs2 merch closeup no audio.MOV': 'setup-tour-cs2-merch-closeup.mp4',
			'2024 setup tour with standing desk moving to sit mode and charging station next to bed.MOV':
				'setup-tour-standing-desk-sit-mode.mp4',
		},
	},
	{
		key: '4090-unboxing',
		srcRel: '4090 unboxing photo first time seeing my new beast',
		outRel: 'PC/images/4090-unboxing',
		label: 'RTX 4090 unboxing',
	},
	{
		key: '4090-vertical',
		srcRel: '4090 vertical attempt',
		outRel: 'PC/images/4090-vertical',
		label: 'RTX 4090 vertical mount attempt',
	},
];

function run(cmd) {
	execSync(cmd, { stdio: 'inherit', shell: true });
}

function toOutName(fileName) {
	return `${path
		.basename(fileName, path.extname(fileName))
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')}.webp`;
}

function toVideoOutName(fileName, videoMap) {
	if (videoMap?.[fileName]) return videoMap[fileName];
	return `${path
		.basename(fileName, path.extname(fileName))
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')}.mp4`;
}

function listFiles(dir, exts) {
	if (!fs.existsSync(dir)) {
		console.error('Missing source dir:', dir);
		return [];
	}
	return fs
		.readdirSync(dir)
		.filter((f) => exts.has(path.extname(f).toLowerCase()))
		.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function convertImage(input, output) {
	if (fs.existsSync(output)) {
		console.log('Skip (exists):', path.basename(output));
		return;
	}
	const ext = path.extname(input).toLowerCase();
	const quality = ext === '.png' ? 88 : 85;
	run(`ffmpeg -y -i "${input}" -update 1 -frames:v 1 -c:v libwebp -quality ${quality} "${output}"`);
}

function convertVideo(input, output) {
	if (fs.existsSync(output)) {
		console.log('Skip (exists):', path.basename(output));
		return;
	}
	run(
		`ffmpeg -y -i "${input}" -c:v libx264 -crf 28 -pix_fmt yuv420p -an -movflags +faststart "${output}"`,
	);
}

function posterForVideo(mp4Path) {
	const poster = mp4Path.replace(/\.mp4$/i, '-poster.jpg');
	if (!fs.existsSync(poster)) {
		run(`ffmpeg -y -ss 0.5 -i "${mp4Path}" -frames:v 1 -q:v 2 -update 1 "${poster}"`);
	}
}

function convertFolder({ srcRel, outRel, label, recursive = false, videoMap }) {
	const srcDir = path.join(DRIVE, srcRel);
	const outDir = path.join(ROOT, outRel);
	fs.mkdirSync(outDir, { recursive: true });

	const files = [];
	const walk = (dir, rel = '') => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory() && recursive) walk(full, path.join(rel, entry.name));
			else if (entry.isFile()) files.push({ full, rel });
		}
	};
	if (recursive) walk(srcDir);
	else {
		for (const f of listFiles(srcDir, IMAGE_EXT)) files.push({ full: path.join(srcDir, f), rel: '' });
		for (const f of listFiles(srcDir, VIDEO_EXT)) files.push({ full: path.join(srcDir, f), rel: '' });
	}

	const images = [];
	const videos = [];

	for (const { full, rel } of files.sort((a, b) => a.full.localeCompare(b.full, undefined, { numeric: true }))) {
		const baseName = path.basename(full);
		const ext = path.extname(full).toLowerCase();
		const subOut = rel ? path.join(outDir, rel.split(path.sep).join('/')) : outDir;
		fs.mkdirSync(subOut, { recursive: true });

		if (IMAGE_EXT.has(ext)) {
			const outFile = toOutName(baseName);
			const output = path.join(subOut, outFile);
			convertImage(full, output);
			images.push({
				file: rel ? `${rel.split(path.sep).join('/')}/${outFile}` : outFile,
				source: baseName,
			});
		} else if (VIDEO_EXT.has(ext)) {
			const outFile = toVideoOutName(baseName, videoMap);
			const output = path.join(subOut, outFile);
			convertVideo(full, output);
			posterForVideo(output);
			videos.push({
				file: rel ? `${rel.split(path.sep).join('/')}/${outFile}` : outFile,
				source: baseName,
			});
		}
	}

	console.log(`${label}: ${images.length} image(s), ${videos.length} video(s)`);
	return { images, videos, outDir: outRel };
}

const manifest = { generated: new Date().toISOString(), sets: {} };

for (const set of SETS) {
	manifest.sets[set.key] = convertFolder(set);
}

fs.writeFileSync(
	path.join(ROOT, 'images/content-batch-17-26-manifest.json'),
	JSON.stringify(manifest, null, 2),
);
console.log('Done. Manifest: images/content-batch-17-26-manifest.json');
