/**
 * Fix broken memorabilia grid nesting after first transform pass.
 * Run: node dev/fix-memorabilia-html.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const htmlPath = path.resolve('Gaming/gaming-memorabilia.html');
let html = fs.readFileSync(htmlPath, 'utf8');

function extractPhotoCarousels(html) {
	const marker = 'data-memorabilia-photo-carousel';
	const blocks = [];
	let searchFrom = 0;

	while (true) {
		const start = html.indexOf('<div class="memorabilia-photo-carousel"', searchFrom);
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
		const block = html.slice(start, end);
		const id = block.match(/\bid="([^"]+)"/)?.[1] || '';
		blocks.push({ id, block });
		searchFrom = end;
	}
	return blocks;
}

const carousels = extractPhotoCarousels(html);
const byId = Object.fromEntries(carousels.map((c) => [c.id, c.block]));

function indent(block) {
	return block
		.split('\n')
		.map((line) => (line.trim() ? '\t\t\t\t\t' + line.trim() : ''))
		.join('\n');
}

function renderGrid(id, carouselIds) {
	const items = carouselIds.map((cid) => indent(byId[cid])).join('\n');
	return `\t\t\t\t\t<div class="memorabilia-carousel-grid" id="${id}">\n${items}\n\t\t\t\t\t</div>`;
}

const acGrid = renderGrid('gallery-ac', ['ac-black', 'ac-white']);
const bfGrid = renderGrid('gallery-bf', ['bf-box-1', 'bf-box-2', 'bf-box-3', 'bf-poster']);
const skyrimGrid = renderGrid('gallery-skyrim', ['skyrim-box']);
const blackOpsGrid = renderGrid('gallery-black-ops', ['black-ops-shrine']);

const acStart = html.indexOf('<h3 class="memorabilia-subsection__title">Assassin');
const bfStart = html.indexOf('<h3 class="memorabilia-subsection__title">Battlefield');
const skyrimStart = html.indexOf('<article class="memorabilia-section" id="skyrim-promo-box">');
const gameInformerStart = html.indexOf('<article class="memorabilia-section memorabilia-section--placeholder" id="game-informer-wall">');
const blackOpsStart = html.indexOf('<article class="memorabilia-section" id="black-ops-disc-shrine">');
const sectionEnd = html.indexOf('</section>', blackOpsStart);

if ([acStart, bfStart, skyrimStart, gameInformerStart, blackOpsStart, sectionEnd].some((n) => n === -1)) {
	console.error('Could not locate section markers.');
	process.exit(1);
}

const acHeader = html.slice(acStart, html.indexOf('<div class="memorabilia-carousel-grid"', acStart));
const bfHeader = html.slice(bfStart, html.indexOf('<div class="memorabilia-carousel-grid"', bfStart));
const skyrimSection = html.slice(skyrimStart, gameInformerStart);
const skyrimHeaderEnd = skyrimSection.indexOf('<div class="memorabilia-carousel-grid"');
const skyrimHeader = skyrimSection.slice(0, skyrimHeaderEnd);
const gameInformerSection = html.slice(gameInformerStart, blackOpsStart);
const blackOpsSection = html.slice(blackOpsStart, sectionEnd);
const blackOpsHeaderEnd = blackOpsSection.indexOf('<div class="memorabilia-carousel-grid"');
const blackOpsHeader = blackOpsSection.slice(0, blackOpsHeaderEnd);

const rebuilt =
	html.slice(0, acStart) +
	acHeader +
	acGrid +
	'\n\n' +
	bfHeader +
	bfGrid +
	'\n' +
	skyrimHeader +
	skyrimGrid +
	'\n' +
	gameInformerSection +
	blackOpsHeader +
	blackOpsGrid +
	'\n' +
	html.slice(sectionEnd);

fs.writeFileSync(htmlPath, rebuilt);
console.log(`Rebuilt ${carousels.length} carousels into 4 grids.`);
