#!/usr/bin/env node
/**
 * Convert Google Drive source media for content batch items 7–16.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DRIVE = String.raw`G:\My Drive\Media for owenminercs.com\put on website`;
const ROOT = path.resolve('.');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.heic', '.png', '.webp', '.gif']);
const VIDEO_EXT = new Set(['.mov', '.mp4', '.m4v']);

function run(cmd) {
	execSync(cmd, { stdio: 'inherit', shell: true });
}

function toOutName(fileName) {
	const base = path.basename(fileName, path.extname(fileName));
	return `${base
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')}.webp`;
}

function toVideoOutName(fileName) {
	const base = path.basename(fileName, path.extname(fileName));
	return `${base
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

function convertFolder({ srcRel, outRel, label, recursive = false }) {
	const srcDir = path.join(DRIVE, srcRel);
	const outDir = path.join(ROOT, outRel);
	fs.mkdirSync(outDir, { recursive: true });

	const files = [];
	const walk = (dir) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory() && recursive) walk(full);
			else if (entry.isFile()) files.push(full);
		}
	};
	if (recursive) walk(srcDir);
	else {
		files.push(...listFiles(srcDir, IMAGE_EXT).map((f) => path.join(srcDir, f)));
		files.push(...listFiles(srcDir, VIDEO_EXT).map((f) => path.join(srcDir, f)));
	}

	const images = [];
	const videos = [];

	for (const full of files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
		const ext = path.extname(full).toLowerCase();
		if (IMAGE_EXT.has(ext)) {
			const outFile = toOutName(path.basename(full));
			const output = path.join(outDir, outFile);
			convertImage(full, output);
			images.push({ file: outFile, source: path.basename(full) });
		} else if (VIDEO_EXT.has(ext)) {
			const outFile = toVideoOutName(path.basename(full));
			const output = path.join(outDir, outFile);
			convertVideo(full, output);
			videos.push({ file: outFile, source: path.basename(full) });
		}
	}

	console.log(`${label}: ${images.length} image(s), ${videos.length} video(s)`);
	return { images, videos, outDir: outRel };
}

const SETS = [
	{ key: 'handwarmer', srcRel: 'handwarmer', outRel: 'images/gadgets/handwarmer', label: 'Hand warmers' },
	{
		key: 'inferno-bookend',
		srcRel: 'cs2 merch/inferno bannana bookend',
		outRel: 'images/cs2-merch/inferno-bookend',
		label: 'Inferno bookend',
	},
	{ key: 'pins', srcRel: 'cs2 merch/pins', outRel: 'images/cs2-merch/pins', label: 'CS2 pins' },
	{
		key: 'christmas-2024',
		srcRel: 'christimas gift perfect world merch',
		outRel: 'images/cs2-merch/christmas-2024',
		label: 'Christmas 2024 merch',
	},
	{
		key: 'steel-plate',
		srcRel: 'wooting 60he v1 steel plate close up',
		outRel: 'Keyboard/images/60he-v1-mods/steel-plate',
		label: '60HE steel plate',
	},
	{
		key: 'foam-pad',
		srcRel: 'wooting 60he v1 foam pad close up',
		outRel: 'Keyboard/images/60he-v1-mods/foam-pad',
		label: '60HE foam pad',
		recursive: true,
	},
	{
		key: 'silicone-pad',
		srcRel: 'wooting 60 he v1 silicone pad - NOT friction fit, i never used it but loved the friction fit',
		outRel: 'Keyboard/images/60he-v1-mods/silicone-pad',
		label: '60HE silicone pad',
	},
	{
		key: 'crosshair-alpha',
		srcRel: 'pbt fans crosshair alpha add on set close up',
		outRel: 'Keyboard/images/60he-v1-mods/crosshair-alpha',
		label: 'Crosshair Alpha keycaps',
	},
	{
		key: 'silicone-mold-case',
		srcRel: 'my first keyboard case with silicone mold and tabe bottom from the crosshair alpha wooting build',
		outRel: 'Keyboard/images/60he-v1-mods/silicone-mold-case',
		label: 'Silicone mold case',
	},
	{
		key: 'gpro-stock',
		srcRel: 'unmodified gpro superlight photos',
		outRel: 'images/mouse/gpro-superlight/stock',
		label: 'G Pro stock photos',
	},
	{
		key: 'gpro-mod',
		srcRel: 'original gpro superlight mous click and scroll wheel board that i replaces with quick swithces',
		outRel: 'images/mouse/gpro-superlight/mod',
		label: 'G Pro mod photos',
		recursive: true,
	},
	{
		key: 'nikon-d3100',
		srcRel: 'New folder',
		outRel: 'images/cameras/nikon-d3100',
		label: 'Nikon D3100',
	},
	{ key: 'nintendo-ds', srcRel: 'ds', outRel: 'images/consoles/nintendo-ds', label: 'Nintendo DS' },
	{ key: 'setup-2018', srcRel: '2018 setup', outRel: 'images/archive/setups/2018', label: '2018 setup' },
	{
		key: 'apartment-merch-2025',
		srcRel: 'setting up my cs2 merch in my aprtment when I moved in in june of 2025 right after the cs2 major',
		outRel: 'images/cs2-merch/apartment-setup-2025',
		label: 'June 2025 apartment merch setup',
	},
];

const manifest = { generated: new Date().toISOString(), sets: {} };

for (const set of SETS) {
	manifest.sets[set.key] = convertFolder(set);
}

fs.mkdirSync(path.join(ROOT, 'images'), { recursive: true });
fs.writeFileSync(
	path.join(ROOT, 'images/content-batch-7-16-manifest.json'),
	JSON.stringify(manifest, null, 2),
);
console.log('Done. Manifest: images/content-batch-7-16-manifest.json');
