#!/usr/bin/env node
/**
 * Convert Google Drive source media for content batch items 37–40.
 * Skips folders already ingested in batch 7–16 (inferno bookend, pins, cs joyer).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DRIVE = String.raw`G:\My Drive\Media for owenminercs.com\put on website`;
const ROOT = path.resolve('.');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.heic', '.png', '.webp', '.gif']);
const VIDEO_EXT = new Set(['.mov', '.mp4', '.m4v']);

/** @type {{ key: string; srcRel: string; outRel: string; label: string; recursive?: boolean; videoMap?: Record<string, string>; skipIfExists?: boolean }[]} */
const SETS = [
	{
		key: 'coolest-shoes',
		srcRel: "the coolest shoes i've ever owned but my feet dont really fit in them",
		outRel: 'images/setup/clothing/coolest-shoes',
		label: 'Coolest shoes (do not fit)',
	},
	{
		key: 'complexity-disband-meme',
		srcRel: 'complexity disband meme video',
		outRel: 'images/gaming/complexity-disband-meme',
		label: 'Complexity disband meme practice clip',
		videoMap: {
			'practicing for complexity disband meme video, has my original gaming setup from summer of 2025.MOV':
				'practice-summer-2025-setup.mp4',
		},
	},
	{
		key: 'complexity-disband-extras',
		srcRel: '',
		outRel: 'images/gaming/complexity-disband-meme',
		label: 'Complexity disband extras (drive root)',
		filesOnly: [
			'old pfp from complexity disband video.mp4',
			'somebody called me fps russia on the complexity disband video and I thought it was hilarous.PNG',
		],
		videoMap: {
			'old pfp from complexity disband video.mp4': 'old-pfp-from-complexity-disband-video.mp4',
		},
	},
	{
		key: 'cs2-skins-photoshop',
		srcRel: 'skins screenshots',
		outRel: 'images/gaming/cs2-skins',
		label: 'CS2 skins Photoshop showcase',
	},
	{
		key: 'kilowatt-keyboard-photos',
		srcRel: 'cs2 merch/kilowatt keyboard photos -  i think is already on website but double check',
		outRel: 'Keyboard/images/kilowatt-2025-extra',
		label: 'Kilowatt keyboard extra photos',
	},
	{
		key: 'cs2-merch-shelves-summer-2025',
		srcRel: 'cs2 merch/cs2 merch shelves - i think is already on website but double check',
		outRel: 'images/cs2-merch/shelf-summer-2025',
		label: 'CS2 merch shelves summer 2025 angles',
	},
	{
		key: 'kilowatt-cases-merch-bag',
		srcRel: 'cs2 merch/kilo watt cases and shangahi major merch bag that I got for free',
		outRel: 'images/cs2-merch/kilowatt-cases-merch-bag',
		label: 'Kilowatt cases and Shanghai Major merch bag',
	},
	{
		key: 'agent-k-box',
		srcRel: 'cs2 merch/agent k',
		outRel: 'images/cs2-merch/agent-k-box',
		label: 'Agent K figurine box',
	},
	{
		key: 'cs2-merch-loose',
		srcRel: 'cs2 merch',
		outRel: 'images/cs2-merch/leftovers',
		label: 'CS2 merch drive root leftovers',
		filesOnly: [
			'took this photo when rearanging my merch shelves to where it is at now but shows tha majority of my merch.HEIC',
			'counter strike 2 plushie stress ball miami daryl with the rest of the perfect world plushies behind in a display. Austin cs2 major poster and ikea white shelves.jpg',
			'cs2 merch shelves summer 2025.PNG',
			'kilowat keyboard video.MOV',
			'kilowatt keyboard close up and agent k inferno bookend chicken case and cs2 mini fig merch.MOV',
			'2024 merch setup tour.MOV',
			'2024 cs2 merch close up and kilowatt keyboard.MOV',
			'2024 cs2 merch close up and kilowatt keyboard close up.MOV',
		],
		videoMap: {
			'kilowat keyboard video.MOV': 'kilowatt-keyboard-video.mp4',
			'kilowatt keyboard close up and agent k inferno bookend chicken case and cs2 mini fig merch.MOV':
				'kilowatt-keyboard-close-up-agent-k-inferno-bookend-chicken-case.mp4',
			'2024 merch setup tour.MOV': '2024-merch-setup-tour.mp4',
			'2024 cs2 merch close up and kilowatt keyboard.MOV': '2024-cs2-merch-close-up-kilowatt-keyboard.mp4',
			'2024 cs2 merch close up and kilowatt keyboard close up.MOV':
				'2024-cs2-merch-close-up-kilowatt-keyboard-close-up.mp4',
		},
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

function convertFolder(set) {
	const { srcRel, outRel, label, recursive = false, videoMap, filesOnly } = set;
	const srcDir = path.join(DRIVE, srcRel);
	const outDir = path.join(ROOT, outRel);
	fs.mkdirSync(outDir, { recursive: true });

	const files = [];
	if (filesOnly?.length) {
		for (const name of filesOnly) {
			const full = path.join(DRIVE, srcRel || '.', name);
			if (fs.existsSync(full)) files.push({ full, rel: '' });
			else console.error('Missing file:', full);
		}
	} else {
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
	return { images, videos, outDir: outRel, skippedDuplicates: [] };
}

const manifest = {
	generated: new Date().toISOString(),
	skippedFolders: [
		'cs2 merch/inferno bannana bookend (batch 7–16 → images/cs2-merch/inferno-bookend)',
		'cs2 merch/pins (batch 7–16 → images/cs2-merch/pins)',
		'cs2 merch/cs joyer display (batch → images/cs2-arts-crafts/cs-joyer)',
	],
	sets: {},
};

for (const set of SETS) {
	manifest.sets[set.key] = convertFolder(set);
}

fs.writeFileSync(
	path.join(ROOT, 'images/content-batch-37-40-manifest.json'),
	JSON.stringify(manifest, null, 2),
);
console.log('Done. Manifest: images/content-batch-37-40-manifest.json');
