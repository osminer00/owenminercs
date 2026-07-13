/**
 * Replace keep-card__thumb--empty placeholders with logo globe screenshots.
 * Run: node dev/replace-placeholder-globes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const GLOBES = [
	{
		file: 'globe-red.jpg',
		alt: 'OwenMinerCS logo with red globe and green foliage',
	},
	{
		file: 'globe-red-text.jpg',
		alt: 'OwenMinerCS logo with red globe and orange text ring',
	},
	{
		file: 'globe-blue.jpg',
		alt: 'OwenMinerCS logo with blue globe and orange text ring',
	},
	{
		file: 'globe-purple.jpg',
		alt: 'OwenMinerCS logo with purple globe and orange text ring',
	},
	{
		file: 'globe-purple-dark.jpg',
		alt: 'OwenMinerCS logo with dark purple globe and orange text ring',
	},
	{
		file: 'globe-purple-red.jpg',
		alt: 'OwenMinerCS logo with purple and red globe',
	},
	{
		file: 'globe-dark-blue.jpg',
		alt: 'OwenMinerCS logo with dark blue globe and orange text ring',
	},
	{
		file: 'globe-silver.jpg',
		alt: 'OwenMinerCS logo with silver globe and orange text ring',
	},
];

const HTML_DIRS = ['The Setup', 'Upgrades', 'Help Wanted'];

const PLACEHOLDER_RE =
	/<div\b[^>]*\bkeep-card__thumb--empty\b[^>]*>[\s\S]*?<\/div>/g;

let globalIndex = 0;
const updatedFiles = [];

function globeImg() {
	const g = GLOBES[globalIndex % GLOBES.length];
	globalIndex += 1;
	return `<img class="keep-card__thumb" src="/images/logo/globes/${g.file}" alt="${g.alt}" loading="lazy" decoding="async" />`;
}

function processFile(filePath) {
	const rel = path.relative(ROOT, filePath);
	if (rel.startsWith('dev' + path.sep) || rel.startsWith('mockups' + path.sep)) return 0;

	let html = fs.readFileSync(filePath, 'utf8');
	const before = (html.match(PLACEHOLDER_RE) || []).length;
	if (!before) return 0;

	html = html.replace(PLACEHOLDER_RE, () => globeImg());
	fs.writeFileSync(filePath, html, 'utf8');
	updatedFiles.push({ file: rel, count: before });
	return before;
}

function walkHtml(dir) {
	let total = 0;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === 'node_modules') continue;
			total += walkHtml(full);
		} else if (entry.isFile() && entry.name.endsWith('.html')) {
			total += processFile(full);
		}
	}
	return total;
}

let total = 0;
for (const dir of HTML_DIRS) {
	total += walkHtml(path.join(ROOT, dir));
}

// Music page loading artwork placeholder
const musicPath = path.join(ROOT, 'Music', 'music.html');
if (fs.existsSync(musicPath)) {
	let music = fs.readFileSync(musicPath, 'utf8');
	const musicRe =
		/(<img\b[^>]*data-track-artwork[^>]*\bsrc=")[^"]*("[^>]*\balt=")Album art placeholder(")/;
	if (musicRe.test(music)) {
		music = music.replace(
			musicRe,
			'$1/images/logo/globes/globe-purple.jpg$2OwenMinerCS logo with purple globe — album art fallback$3',
		);
		fs.writeFileSync(musicPath, music, 'utf8');
		updatedFiles.push({ file: 'Music/music.html', count: 1, note: 'track artwork fallback' });
		total += 1;
	}
}

// Garage sale empty-state card
const garageJs = path.join(ROOT, 'scripts', 'garage-sale.js');
if (fs.existsSync(garageJs)) {
	let js = fs.readFileSync(garageJs, 'utf8');
	const oldSrc = "img.src = '../images/coming-soon-card.svg';";
	const newSrc =
		"img.src = '/images/logo/globes/globe-red.jpg';";
	if (js.includes(oldSrc)) {
		js = js.replace(
			oldSrc,
			newSrc,
		);
		js = js.replace(
			"img.alt = 'Nothing for sale placeholder graphic';",
			"img.alt = 'OwenMinerCS logo with red globe — nothing listed right now';",
		);
		fs.writeFileSync(garageJs, js, 'utf8');
		updatedFiles.push({ file: 'scripts/garage-sale.js', count: 1, note: 'empty sale card' });
		total += 1;
	}
}

console.log(JSON.stringify({ totalReplacements: total, updatedFiles }, null, 2));
