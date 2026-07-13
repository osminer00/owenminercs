/**
 * One-off: rewrite gaming-memorabilia.html box carousels → home-style photo carousels.
 * Run: node dev/transform-memorabilia-carousels.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const htmlPath = path.resolve('Gaming/gaming-memorabilia.html');

function extractCarouselBlocks(html) {
	const marker = 'data-memorabilia-carousel';
	const blocks = [];
	let searchFrom = 0;

	while (true) {
		const start = html.indexOf('<div class="memorabilia-box-carousel"', searchFrom);
		if (start === -1) break;

		let depth = 0;
		let i = start;
		let end = -1;
		while (i < html.length) {
			const open = html.indexOf('<div', i);
			const close = html.indexOf('</div>', i);
			if (close === -1) break;
			if (open !== -1 && open < close) {
				depth += 1;
				i = open + 4;
			} else {
				depth -= 1;
				i = close + 6;
				if (depth === 0) {
					end = i;
					break;
				}
			}
		}
		if (end === -1) break;
		blocks.push({ start, end, block: html.slice(start, end) });
		searchFrom = end;
	}
	return blocks;
}

function extractCarousel(block) {
	const titleMatch = block.match(
		/<h4 class="memorabilia-box-carousel__title">([\s\S]*?)<\/h4>/,
	);
	const idMatch = block.match(/\bid="([^"]+)"/);
	const title = titleMatch ? titleMatch[1].trim() : '';
	const id = idMatch ? idMatch[1] : '';

	const images = [];
	const thumbRe =
		/<button[^>]*class="memorabilia-box-carousel__thumb[^"]*"[^>]*>[\s\S]*?<img\s+([^>]+)\/>/g;
	let m;
	while ((m = thumbRe.exec(block))) {
		const attrs = m[1];
		const src = attrs.match(/src="([^"]+)"/)?.[1] || '';
		const alt = attrs.match(/alt="([^"]*)"/)?.[1] || '';
		if (src) images.push({ src, alt });
	}

	return { title, id, images };
}

function renderCarousel({ title, id, images }) {
	const slides = images
		.map((img, i) => {
			const loading = i === 0 ? 'eager' : 'lazy';
			return `\t\t\t\t\t\t<figure class="memorabilia-photo-slide" role="listitem">
\t\t\t\t\t\t\t<div class="memorabilia-photo-slide__media">
\t\t\t\t\t\t\t\t<img src="${img.src}" alt="${img.alt}" loading="${loading}" decoding="async" draggable="false" />
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t</figure>`;
		})
		.join('\n');

	const idAttr = id ? ` id="${id}"` : '';
	return `\t\t\t\t\t<div class="memorabilia-photo-carousel" data-memorabilia-photo-carousel${idAttr}>
\t\t\t\t\t\t<h4 class="memorabilia-photo-carousel__title">${title}</h4>
\t\t\t\t\t\t<div class="memorabilia-photo-carousel__row" role="list">
${slides}
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<span class="memorabilia-photo-carousel__counter" aria-live="polite">1 / ${images.length}</span>
\t\t\t\t\t</div>`;
}

// Restore from git if already broken, then transform
let html = fs.readFileSync(htmlPath, 'utf8');

if (!html.includes('data-memorabilia-carousel')) {
	console.error('No memorabilia-box-carousel blocks found. Restore HTML from git first.');
	process.exit(1);
}

const blocks = extractCarouselBlocks(html);
if (!blocks.length) {
	console.error('Could not parse carousel blocks.');
	process.exit(1);
}

let out = '';
let cursor = 0;
for (const { start, end, block } of blocks) {
	out += html.slice(cursor, start);
	const data = extractCarousel(block);
	out += renderCarousel(data);
	cursor = end;
}
out += html.slice(cursor);

out = out.replace(
	'<script src="../scripts/memorabilia-carousel.js" defer></script>',
	'<script src="../scripts/memorabilia-photo-carousel.js" defer></script>',
);

fs.writeFileSync(htmlPath, out);
console.log(`Transformed ${blocks.length} carousels in ${htmlPath}`);
