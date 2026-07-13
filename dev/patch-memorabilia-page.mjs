#!/usr/bin/env node
/**
 * Patch Gaming/gaming-memorabilia.html: swap static grids for carousel fragments.
 */
import fs from 'node:fs';
import path from 'node:path';

const htmlPath = path.resolve('Gaming/gaming-memorabilia.html');
const fragments = JSON.parse(
	fs.readFileSync(path.resolve('images/gaming-memorabilia/carousel-fragments.json'), 'utf8'),
);

let html = fs.readFileSync(htmlPath, 'utf8');

function replaceGallery(id, replacement) {
	const startRe = new RegExp(
		`\\t\\t\\t\\t\\t<div class="photogallery memorabilia-gallery[^"]*" id="${id}"[\\s\\S]*?</div>\\n\\t\\t\\t\\t\\t</div>`,
	);
	const wrapped = `\t\t\t\t\t<div class="memorabilia-carousel-grid" id="${id}">\n${replacement}\n\t\t\t\t\t</div>`;
	if (!startRe.test(html)) {
		console.error('Could not find gallery', id);
		process.exit(1);
	}
	html = html.replace(startRe, wrapped);
}

replaceGallery('gallery-ac', fragments.ac);
replaceGallery('gallery-bf', fragments.bf);
replaceGallery('gallery-skyrim', fragments.skyrim);

if (!html.includes('memorabilia-carousel.js')) {
	html = html.replace(
		'<script src="../scripts/bubble-scroll.js" defer></script>',
		'<script src="../scripts/bubble-scroll.js" defer></script>\n\t\t<script src="../scripts/memorabilia-carousel.js" defer></script>',
	);
}

// Restore user-written em dashes in midnight release story
html = html.replace(
	'from my first, and only, midnight release',
	'from my first—and only—midnight release',
);
html = html.replace(
	'take the rest home, which made the whole night',
	'take the rest home—which made the whole night',
);

// Agent em dash in BF intro line
html = html.replace('Same midnight event—the Battlefield', 'Same midnight event. The Battlefield');
html = html.replace('Same midnight event, the Battlefield', 'Same midnight event. The Battlefield');

// Skyrim era line
html = html.replace('from around the same era—another piece', 'from around the same era, another piece');
html = html.replace('from around the same era, another piece', 'from around the same era, another piece');

// Placeholder aria labels
html = html.replace(
	'aria-label="Game Informer magazine wall display — photos coming soon"',
	'aria-label="Game Informer magazine wall display, photos coming soon"',
);
html = html.replace(
	'<h2>Call of Duty: Black Ops — broken disc shrine</h2>',
	'<h2>Call of Duty: Black Ops broken disc shrine</h2>',
);
html = html.replace(
	'aria-label="Call of Duty Black Ops broken disc shrine display — photo coming soon"',
	'aria-label="Call of Duty Black Ops broken disc shrine display, photo coming soon"',
);

fs.writeFileSync(htmlPath, html);
console.log('Patched', htmlPath);
