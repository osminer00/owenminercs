#!/usr/bin/env node
/**
 * Convert Google Drive source media for content batch items 31–34.
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
		key: 'ssd-2020-sold',
		srcRel: 'ssd from 2020 build which i wiped and sold on ebay',
		outRel: 'images/archive/old-pcs/ssd-2020-sold',
		label: '2020 build SSD (sold on eBay)',
	},
	{
		key: 'aliexpress-merch',
		srcRel: 'perfect world merch I was able to get on ali express',
		outRel: 'images/cs2-merch/aliexpress',
		label: 'Perfect World AliExpress merch',
	},
	{
		key: 'supreme-rankup',
		srcRel: 'first time hitting supreme',
		outRel: 'images/gaming/supreme-rankup',
		label: 'First time hitting Supreme',
	},
	{
		key: 'agent-k-photoshoot',
		srcRel: 'agent k background photo shoot',
		outRel: 'images/agent-k/photoshoot',
		label: 'Agent K background photoshoot',
		videoMap: {
			'Agent K photoshoot 2 - havent done anything with this yet other than practice photo shop this one shows the mirage palace photoshop on the bench.MOV':
				'mirage-palace-photoshop-on-bench.mp4',
			'editing the agent k backgrounds- unused footage for video.MOV': 'editing-backgrounds-unused-footage.mp4',
		},
	},
	{
		key: 'summer-2025-agent-k-setup',
		srcRel: 'agent k background photo shoot/summer 2025 desk setup with agent K backgrounds',
		outRel: 'images/archive/setups/summer-2025-agent-k',
		label: 'Summer 2025 desk setup with Agent K backgrounds',
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
	path.join(ROOT, 'images/content-batch-31-34-manifest.json'),
	JSON.stringify(manifest, null, 2),
);
console.log('Done. Manifest: images/content-batch-31-34-manifest.json');
