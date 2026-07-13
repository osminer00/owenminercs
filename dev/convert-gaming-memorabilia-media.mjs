#!/usr/bin/env node
/**
 * Convert GameStop midnight release + Skyrim promo source media to web assets.
 * Source: G:\My Drive\Media for owenminercs.com\put on website\
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DRIVE = String.raw`G:\My Drive\Media for owenminercs.com\put on website`;
const OUT = path.resolve('images/gaming-memorabilia');

const SETS = [
	{
		key: 'ac',
		label: "Assassin's Creed",
		srcDir: path.join(DRIVE, 'assassins creed promotional stuff'),
		altPrefix: "Assassin's Creed GameStop midnight release promotional box",
	},
	{
		key: 'bf',
		label: 'Battlefield 4',
		srcDir: path.join(DRIVE, 'battle field promotinal stuff'),
		altPrefix: 'Battlefield 4 GameStop midnight release promotional box',
	},
	{
		key: 'skyrim',
		label: 'Skyrim',
		srcDir: path.join(DRIVE, 'skyrim promotional box'),
		altPrefix: 'Skyrim GameStop promotional box',
	},
	{
		key: 'black-ops',
		label: 'Call of Duty Black Ops',
		srcDir: path.join(DRIVE, 'Black ops shrine'),
		altPrefix: 'Call of Duty Black Ops broken disc shrine display',
	},
];

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.heic', '.png', '.webp']);
const SKIP_OUT = new Set(['img-4781.webp', 'img-4834.webp']);

function run(cmd) {
	execSync(cmd, { stdio: 'inherit', shell: true });
}

function toOutName(fileName) {
	const base = path.basename(fileName, path.extname(fileName));
	return `${base.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.webp`;
}

function listImages(dir) {
	if (!fs.existsSync(dir)) {
		console.error('Missing source dir:', dir);
		return [];
	}
	return fs
		.readdirSync(dir)
		.filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
		.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function convertOne(input, output) {
	if (fs.existsSync(output)) {
		console.log('Skip (exists):', path.basename(output));
		return;
	}
	const ext = path.extname(input).toLowerCase();
	const quality = ext === '.png' ? 88 : 85;
	run(`ffmpeg -y -i "${input}" -update 1 -frames:v 1 -c:v libwebp -quality ${quality} "${output}"`);
}

function buildGalleryHtml(images, sectionId) {
	// Legacy grid builder kept for reference; carousels use dev/build-memorabilia-carousels.mjs
	if (!images.length) return '';
	const cols = [[], []];
	images.forEach((img, i) => cols[i % 2].push(img));
	const renderImg = (img) => `								<img
									class="photogallery-img"
									src="../images/gaming-memorabilia/${img.key}/${img.file}"
									alt="${img.alt}"
									loading="lazy"
									decoding="async"
									onclick="window.open(this.src)"
								/>`;
	const colHtml = cols
		.filter((col) => col.length)
		.map(
			(col) => `							<div class="photogallery-col">
${col.map(renderImg).join('\n')}
							</div>`,
		)
		.join('\n');
	return `					<div class="photogallery memorabilia-gallery" id="${sectionId}" style="margin-top: 1rem; width: 100%">
						<div class="photogallery-row">
${colHtml}
						</div>
					</div>`;
}

fs.mkdirSync(OUT, { recursive: true });

const manifest = { generated: new Date().toISOString(), sets: {} };

for (const set of SETS) {
	const outDir = path.join(OUT, set.key);
	fs.mkdirSync(outDir, { recursive: true });
	const files = listImages(set.srcDir);
	const images = [];
	for (const file of files) {
		const outFile = toOutName(file);
		if (SKIP_OUT.has(outFile)) {
			console.log('Skip (blurry):', outFile);
			continue;
		}
		const input = path.join(set.srcDir, file);
		const output = path.join(outDir, outFile);
		convertOne(input, output);
		images.push({
			key: set.key,
			file: outFile,
			alt: `${set.altPrefix}, photo ${images.length + 1}`,
			source: file,
		});
	}
	manifest.sets[set.key] = { label: set.label, count: images.length, images };
	console.log(`${set.label}: ${images.length} image(s)`);
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Done. Assets in', OUT);
console.log('Run: node dev/build-memorabilia-carousels.mjs (then patch or generate page)');
