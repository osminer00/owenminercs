/**
 * One-shot helper: fold Keyboard/60he-202{6,5,3}.html into The Setup/keyboards.html
 * as collapsed bottom sections. Run: node dev/build-keyboards-hub.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const keyboardDir = path.join(root, 'Keyboard');
const setupDir = path.join(root, 'The Setup');

const BUILDS = [
	{
		id: 'build-2026',
		year: '2026',
		pageClass: 'keyboard-60he-2026-page',
		title: '2026 build: Kilowatt 60HE v2',
		source: '60he-2026.html',
		css: '60he-2026.css',
		cardHrefWas: '../Keyboard/60he-2026.html',
	},
	{
		id: 'build-2025',
		year: '2025',
		pageClass: 'keyboard-60he-2025-page',
		title: '2025 Build: Kilowatt',
		source: '60he-2025.html',
		css: '60he-2025.css',
		cardHrefWas: '../Keyboard/60he-2025.html',
	},
	{
		id: 'build-2023',
		year: '2023',
		pageClass: 'keyboard-60he-2023-page',
		title: '2023 Build with wooting 60he v1 deep breakdown',
		source: '60he-2023.html',
		css: '60he-2023.css',
		cardHrefWas: '../Keyboard/60he-2023.html',
	},
];

function rewriteCss(cssText, pageClass) {
	let out = cssText;
	// Scope former body.page selectors to the hub section wrapper
	out = out.replaceAll(
		`body.pc-build-page.keyboard-build-page.${pageClass}`,
		`.keyboard-hub-section.${pageClass}`,
	);
	out = out.replaceAll(`body.pc-build-page.${pageClass}`, `.keyboard-hub-section.${pageClass}`);
	out = out.replaceAll(
		`body.site-card-ui.setup-detail-page.${pageClass}`,
		`.keyboard-hub-section.${pageClass}`,
	);
	out = out.replaceAll(`body.site-card-ui.${pageClass}`, `.keyboard-hub-section.${pageClass}`);
	out = out.replaceAll(`body.${pageClass}`, `.keyboard-hub-section.${pageClass}`);
	return out;
}

function extractContainerInner(html) {
	const m = html.match(/<div class="container">([\s\S]*?)<\/div>\s*<shared-footer/);
	if (!m) throw new Error('Could not find .container before shared-footer');
	return m[1].trim();
}

function rewritePaths(html) {
	let out = html;
	// Keyboard-relative assets → from The Setup/
	out = out.replace(/(src|href)="images\//g, '$1="../Keyboard/images/');
	out = out.replace(/(src|href)='images\//g, "$1='../Keyboard/images/");
	// Sibling build pages → hub hashes
	out = out.replace(/href="\.\/60he-2026\.html"/g, 'href="#build-2026"');
	out = out.replace(/href="\.\/60he-2025\.html"/g, 'href="#build-2025"');
	out = out.replace(/href="\.\/60he-2023\.html"/g, 'href="#build-2023"');
	out = out.replace(/href="\.\.\/The%20Setup\/keyboards\.html"/g, 'href="#top"');
	out = out.replace(/href="\.\.\/The Setup\/keyboards\.html"/g, 'href="#top"');
	return out;
}

function stripHubChrome(html, build) {
	let out = html;
	// Drop back link + jump nav + duplicate affiliate disclosure in intros
	out = out.replace(/<nav class="keyboard-build-jump-nav"[\s\S]*?<\/nav>\s*/i, '');
	out = out.replace(/<p class="setup-detail__back">[\s\S]*?<\/p>\s*/i, '');
	// Remove intro block (title lives in section header); keep content panels
	out = out.replace(/<div class="intro[\s\S]*?<\/div>\s*(?=<section|<div class="keyboard)/i, '');
	// Remove gear-hub__seo that links to other builds / keyboards (hub already has SEO elsewhere)
	out = out.replace(/<p class="gear-hub__seo">[\s\S]*?<\/p>\s*/i, '');
	return out;
}

function prefixConflictingIds(html, year, allIdsByBuild) {
	// Prefix only ids that collide across builds (or with hub section ids)
	const myIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
	const conflicts = new Set();
	for (const id of myIds) {
		if (id.startsWith('build-')) {
			conflicts.add(id);
			continue;
		}
		for (const [otherYear, otherIds] of Object.entries(allIdsByBuild)) {
			if (otherYear === year) continue;
			if (otherIds.has(id)) conflicts.add(id);
		}
	}
	let out = html;
	for (const id of conflicts) {
		const next = `${year}-${id}`;
		out = out.replaceAll(`id="${id}"`, `id="${next}"`);
		out = out.replaceAll(`href="#${id}"`, `href="#${next}"`);
	}
	return out;
}

function wrapSection(build, innerHtml) {
	return `
		<section
			id="${build.id}"
			class="keyboard-hub-section setup-detail-page pc-build-page keyboard-build-page ${build.pageClass}"
			data-keyboard-hub-section
			data-keyboard-hub-collapsed="true"
			aria-labelledby="${build.id}-heading"
		>
			<header class="keyboard-hub-section__header">
				<button
					type="button"
					class="keyboard-hub-section__toggle"
					aria-expanded="false"
					aria-controls="${build.id}-body"
					data-keyboard-hub-toggle
				>
					<span class="keyboard-hub-section__title" id="${build.id}-heading">${build.title}</span>
					<span class="keyboard-hub-section__chevron" aria-hidden="true">▼</span>
				</button>
			</header>
			<div
				id="${build.id}-body"
				class="keyboard-hub-section__body"
				data-keyboard-hub-body
				hidden
			>
${innerHtml}
			</div>
			<div class="keyboard-hub-section__sentinel" data-keyboard-hub-sentinel aria-hidden="true"></div>
		</section>`;
}

function buildCombinedCss() {
	const parts = [
		`/* Auto-generated for keyboards hub consolidation. Do not edit leaf 60he-202*.css in place for hub; re-run build-keyboards-hub.mjs */\n`,
	];
	for (const build of BUILDS) {
		const raw = fs.readFileSync(path.join(keyboardDir, build.css), 'utf8');
		parts.push(`/* === ${build.css} (scoped) === */\n`);
		parts.push(rewriteCss(raw, build.pageClass));
		parts.push('\n');
	}
	parts.push(`
/* Hub accordion chrome */
.keyboard-hub-sections {
	display: grid;
	gap: 0.65rem;
	margin-top: 0.85rem;
	width: 100%;
	min-width: 0;
}
.keyboard-hub-section {
	scroll-margin-top: 5.5rem;
	width: 100%;
	min-width: 0;
	box-sizing: border-box;
	/* Thin dark-gray frame (matches 60HE V1 --kb-border) from title through bottom */
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: var(--lg-glass-radius-card, 6px);
	overflow: clip;
}
/* Beat global `header { max-width: 1180px; padding: 1rem 0 0.5rem; align-items: center }` */
.keyboard-hub-section__header {
	align-items: stretch;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	margin: 0;
	max-width: none;
	padding: 0;
	width: 100%;
}
.keyboard-hub-section__toggle {
	align-items: center;
	background: rgba(255, 255, 255, 0.05);
	border: none;
	border-radius: 0;
	box-sizing: border-box;
	color: inherit;
	cursor: pointer;
	display: flex;
	font: inherit;
	gap: 0.75rem;
	justify-content: space-between;
	max-width: none;
	padding: 0.65rem 0.85rem;
	text-align: left;
	width: 100%;
}
.keyboard-hub-section[data-keyboard-hub-collapsed="false"] .keyboard-hub-section__toggle {
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.keyboard-hub-section__toggle:hover,
.keyboard-hub-section__toggle:focus-visible {
	background: rgba(255, 255, 255, 0.08);
	outline: none;
}
.keyboard-hub-section__title {
	color: #f8b000;
	font-size: clamp(1rem, 2vw, 1.2rem);
	font-weight: 700;
	line-height: 1.2;
}
.keyboard-hub-section__chevron {
	flex: none;
	opacity: 0.75;
	transition: transform 0.18s ease;
}
.keyboard-hub-section[data-keyboard-hub-collapsed="false"] .keyboard-hub-section__chevron {
	transform: rotate(180deg);
}
.keyboard-hub-section__header + .keyboard-hub-section__body,
.keyboard-hub-section__body {
	margin-top: 0;
	padding-top: 0;
	width: 100%;
	min-width: 0;
	box-sizing: border-box;
}
.keyboard-hub-section__body > .hub-content-panel {
	margin-top: 0;
	max-width: none;
	width: 100%;
	box-sizing: border-box;
}
.keyboard-hub-section[data-keyboard-hub-collapsed="false"]
	.keyboard-hub-section__body
	> .hub-content-panel:first-child {
	border-top-left-radius: 0 !important;
	border-top-right-radius: 0 !important;
}
.keyboard-hub-section__body[hidden] {
	display: none !important;
}
.keyboard-hub-section__sentinel {
	height: 1px;
	pointer-events: none;
	width: 100%;
}
.keep-card[data-keyboard-hub-target].keep-card--hub-active {
	outline: 2px solid #39ff14;
	outline-offset: 2px;
}
.keep-card[data-keyboard-hub-target] .keep-card__cta {
	/* structural only; copy set in HTML */
}
`);
	return parts.join('\n');
}

function patchKeyboardsHtml(sectionsHtml) {
	const target = path.join(setupDir, 'keyboards.html');
	let html = fs.readFileSync(target, 'utf8');

	// Ensure stylesheets + scripts
	if (!html.includes('keyboards-hub-builds.css')) {
		html = html.replace(
			'<link rel="stylesheet" href="../css/affiliate-styles.css" />',
			`<link rel="stylesheet" href="../css/affiliate-styles.css" />
		<link rel="stylesheet" href="../css/keyboards-hub-builds.css" />`,
		);
	}
	if (!html.includes('memorabilia-photo-carousel.js')) {
		html = html.replace(
			'<script src="../scripts/affiliate-links.js" defer></script>',
			`<script src="../scripts/affiliate-links.js" defer></script>
		<script src="../scripts/memorabilia-photo-carousel.js" defer></script>
		<script src="../scripts/keyboard-parts-highlight.js" defer></script>
		<script src="../scripts/keyboard-hub-sections.js" defer></script>`,
		);
	}

	// Body classes: keep hub chrome only; per-build layout classes live on sections
	html = html.replace(
		/class="site-card-ui(?: setup-detail-page pc-build-page keyboard-build-page)? keyboard-hub-page bubble-theme bubble-theme--socials"/,
		'class="site-card-ui keyboard-hub-page bubble-theme bubble-theme--socials"',
	);
	html = html.replace(
		/class="site-card-ui bubble-theme bubble-theme--socials"/,
		'class="site-card-ui keyboard-hub-page bubble-theme bubble-theme--socials"',
	);

	// Cards: data-href → data-keyboard-hub-target
	for (const build of BUILDS) {
		const re = new RegExp(
			`data-href="${build.cardHrefWas.replace(/\./g, '\\.')}"`,
			'g',
		);
		html = html.replace(re, `data-keyboard-hub-target="${build.id}"`);
	}
	html = html.replace(/role="link"/g, 'role="button"');
	html = html.replace(/Open build page →/g, 'View build ↓');

	// Strip keep-card primary overlay navigation by removing data-href remnants already done
	// Insert / replace sections block before closing container
	const sectionsBlock = `
			<div class="keyboard-hub-sections" data-keyboard-hub-root>
${sectionsHtml}
			</div>
`;

	if (html.includes('data-keyboard-hub-root')) {
		html = html.replace(
			/<div class="keyboard-hub-sections" data-keyboard-hub-root>[\s\S]*?<\/div>\s*(?=<\/div>\s*<shared-footer)/,
			sectionsBlock.trim() + '\n\t\t',
		);
	} else {
		html = html.replace(
			/(\t\t)<\/div>\s*<shared-footer/,
			`${sectionsBlock}\t\t</div>\n\t\t<shared-footer`,
		);
	}

	// Soften hero lede: keep existing user copy; optional CTA note skipped (copy approval)
	fs.writeFileSync(target, html, 'utf8');
}

function main() {
	const prepared = [];
	const allIdsByBuild = {};

	for (const build of BUILDS) {
		const raw = fs.readFileSync(path.join(keyboardDir, build.source), 'utf8');
		let inner = extractContainerInner(raw);
		inner = rewritePaths(inner);
		inner = stripHubChrome(inner, build);
		allIdsByBuild[build.year] = new Set([...inner.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
		prepared.push({ build, inner });
	}

	const sectionChunks = [];
	for (const { build, inner } of prepared) {
		const fixed = prefixConflictingIds(inner, build.year, allIdsByBuild);
		sectionChunks.push(wrapSection(build, fixed));
		console.log(`Prepared ${build.id} (${fixed.length} chars)`);
	}

	const cssOut = path.join(root, 'css', 'keyboards-hub-builds.css');
	fs.writeFileSync(cssOut, buildCombinedCss(), 'utf8');
	console.log(`Wrote ${cssOut}`);

	patchKeyboardsHtml(sectionChunks.join('\n'));
	console.log('Patched The Setup/keyboards.html');
}

main();
