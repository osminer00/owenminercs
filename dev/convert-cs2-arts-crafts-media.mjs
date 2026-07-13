#!/usr/bin/env node
/**
 * Convert CS2 arts & crafts + Wallhack skates packaging source media.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DRIVE = String.raw`G:\My Drive\Media for owenminercs.com\put on website`;
const ROOT = path.resolve('.');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.heic', '.png', '.webp', '.gif']);
const VIDEO_EXT = new Set(['.mov', '.mp4', '.m4v']);

/** @type {{ key: string; srcRel: string; outRel: string; label: string; videoMap?: Record<string, string> }[]} */
const SETS = [
	{
		key: 'sewing',
		srcRel: 'sewing project',
		outRel: 'images/cs2-arts-crafts/sewing',
		label: 'CS2 screenshot blanket sewing',
	},
	{
		key: 'cs-joyer',
		srcRel: path.join('cs2 merch', 'cs joyer display'),
		outRel: 'images/cs2-arts-crafts/cs-joyer',
		label: 'CS Joyer display concept',
		videoMap: {
			'cs joyer display original concept video.MOV': 'concept-video.mp4',
		},
	},
	{
		key: 'wallhack-skates',
		srcRel: 'wallhack skates packaging',
		outRel: 'images/mouse/wallhack-skates-packaging',
		label: 'Wallhack Obsidian skates packaging',
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

function convertFolder({ srcRel, outRel, label, videoMap }) {
	const srcDir = path.join(DRIVE, srcRel);
	const outDir = path.join(ROOT, outRel);
	fs.mkdirSync(outDir, { recursive: true });

	const images = [];
	const videos = [];

	for (const baseName of listFiles(srcDir, IMAGE_EXT)) {
		const full = path.join(srcDir, baseName);
		const outFile = toOutName(baseName);
		const output = path.join(outDir, outFile);
		convertImage(full, output);
		images.push({ file: outFile, source: baseName });
	}

	for (const baseName of listFiles(srcDir, VIDEO_EXT)) {
		const full = path.join(srcDir, baseName);
		const outFile = toVideoOutName(baseName, videoMap);
		const output = path.join(outDir, outFile);
		convertVideo(full, output);
		videos.push({ file: outFile, source: baseName });
	}

	console.log(`${label}: ${images.length} image(s), ${videos.length} video(s)`);
	return { images, videos, outDir: outRel };
}

const manifest = { generated: new Date().toISOString(), sets: {} };

for (const set of SETS) {
	manifest.sets[set.key] = convertFolder(set);
}

fs.writeFileSync(
	path.join(ROOT, 'images/cs2-arts-crafts-manifest.json'),
	JSON.stringify(manifest, null, 2),
);
console.log('Done. Manifest: images/cs2-arts-crafts-manifest.json');
