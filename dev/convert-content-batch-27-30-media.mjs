#!/usr/bin/env node
/**
 * Convert Google Drive source media for content batch items 27–30.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DRIVE = String.raw`G:\My Drive\Media for owenminercs.com\put on website`;
const ROOT = path.resolve('.');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.heic', '.png', '.webp', '.gif']);

/** @type {{ key: string; srcRel: string; outRel: string; label: string }[]} */
const SETS = [
	{
		key: 'govee-edison',
		srcRel: 'govee',
		outRel: 'images/lighting/govee-edison',
		label: 'Govee Edison / Lowe inspiration',
	},
	{
		key: 'plants-real',
		srcRel: 'plants',
		outRel: 'images/plants/real',
		label: 'Real plants',
	},
	{
		key: 'pny-enthusiast',
		srcRel: 'pny enthusiast edition',
		outRel: 'images/archive/old-pcs/pny-enthusiast-edition',
		label: 'PNY Enthusiast Edition GPU',
	},
	{
		key: 'rog-gladius',
		srcRel: 'rog gladius mouse',
		outRel: 'images/archive/peripherals/rog-gladius',
		label: 'ROG Gladius mouse (480Hz bundle)',
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

function listFiles(dir) {
	if (!fs.existsSync(dir)) {
		console.error('Missing source dir:', dir);
		return [];
	}
	return fs
		.readdirSync(dir)
		.filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
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

function convertFolder({ srcRel, outRel, label }) {
	const srcDir = path.join(DRIVE, srcRel);
	const outDir = path.join(ROOT, outRel);
	fs.mkdirSync(outDir, { recursive: true });

	const images = [];
	for (const f of listFiles(srcDir)) {
		const full = path.join(srcDir, f);
		const outFile = toOutName(f);
		const output = path.join(outDir, outFile);
		convertImage(full, output);
		images.push({ file: outFile, source: f });
	}

	console.log(`${label}: ${images.length} image(s)`);
	return { images, outDir: outRel };
}

const manifest = { generated: new Date().toISOString(), sets: {} };
for (const set of SETS) {
	manifest.sets[set.key] = convertFolder(set);
}

fs.writeFileSync(
	path.join(ROOT, 'images/content-batch-27-30-manifest.json'),
	JSON.stringify(manifest, null, 2),
);
console.log('Done. Manifest: images/content-batch-27-30-manifest.json');
