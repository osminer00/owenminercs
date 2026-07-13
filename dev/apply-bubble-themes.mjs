#!/usr/bin/env node
/**
 * Apply bubble liquid glass theme to nav section HTML pages.
 * Usage: node dev/apply-bubble-themes.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');

/** @type {Record<string, { class: string; css: string; dirs?: string[]; files?: string[] }>} */
const SECTIONS = {
	gear: {
		class: 'bubble-theme--socials',
		css: 'socials.css',
		dirs: ['The Setup', 'Keyboard', 'PC', 'Upgrades'],
	},
	gaming: {
		class: 'bubble-theme--socials',
		css: 'socials.css',
		dirs: ['Gaming', 'Counter-Strike'],
	},
	donators: { class: 'bubble-theme--socials', css: 'socials.css', dirs: ['Donators'] },
	'garage-sale': {
		class: 'bubble-theme--socials',
		css: 'socials.css',
		dirs: ['Garage Sale'],
	},
	'help-wanted': {
		class: 'bubble-theme--socials',
		css: 'socials.css',
		dirs: ['Help Wanted'],
	},
	qa: { class: 'bubble-theme--socials', css: 'socials.css', dirs: ['QA'], files: ['site-map.html'] },
	dev: { class: 'bubble-theme--socials', css: 'socials.css', files: ['dev/dev-stack.html'] },
	achievements: {
		class: 'bubble-theme--achievements',
		css: 'achievements.css',
		dirs: ['Achievements'],
	},
	socials: { class: 'bubble-theme--socials', css: 'socials.css', dirs: ['Socials'] },
};

const SKIP_DIRS = new Set([
	'node_modules',
	'.git',
	'mockups',
	'backup-pre-the-setup-2026-04-08',
	'package',
	'.claude',
	'dev',
	'old photos',
]);

/** @type {Map<string, string>} */
const fileSection = new Map();

for (const [section, cfg] of Object.entries(SECTIONS)) {
	for (const dir of cfg.dirs || []) {
		walk(join(ROOT, dir), (file) => {
			if (file.endsWith('.html')) fileSection.set(file, section);
		});
	}
	for (const file of cfg.files || []) {
		fileSection.set(join(ROOT, file.replace(/\//g, '\\')), section);
	}
}

function walk(dir, cb) {
	let entries;
	try {
		entries = readdirSync(dir);
	} catch {
		return;
	}
	for (const name of entries) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) {
			if (!SKIP_DIRS.has(name)) walk(full, cb);
		} else {
			cb(full);
		}
	}
}

function assetPrefix(filePath) {
	const relDir = dirname(relative(ROOT, filePath));
	if (!relDir || relDir === '.') return '';
	const depth = relDir.split(/[/\\]/).length;
	return '../'.repeat(depth);
}

function bubbleVideoSection(section) {
	return section === 'achievements' ? 'achievements' : 'socials';
}

function bubbleMarkup(section) {
	const videoSection = bubbleVideoSection(section);
	return `\t\t<div class="bubble-bg" aria-hidden="true">
\t\t\t<div class="bubble-bg__media">
\t\t\t\t<video
\t\t\t\t\tid="bubble-bg-video"
\t\t\t\t\tclass="bubble-bg__video"
\t\t\t\t\tautoplay
\t\t\t\t\tmuted
\t\t\t\t\tloop
\t\t\t\t\tplaysinline
\t\t\t\t\tpreload="metadata"
\t\t\t\t\tposter="/images/bubble-themes/${videoSection}/poster.jpg"
\t\t\t\t>
\t\t\t\t\t<source src="/images/bubble-themes/${videoSection}/bg.mp4" type="video/mp4" />
\t\t\t\t</video>
\t\t\t</div>
\t\t\t<div class="bubble-bg__veil"></div>
\t\t</div>`;
}

function patchHtml(filePath, section) {
	let html = readFileSync(filePath, 'utf8');
	if (html.includes('bubble-theme--') || html.includes('home-liquid-glass-test')) {
		return { status: 'skip', reason: 'already themed' };
	}
	if (!html.includes('site-card-ui')) {
		return { status: 'skip', reason: 'no site-card-ui' };
	}

	const cfg = SECTIONS[section];
	const prefix = assetPrefix(filePath);
	const baseCss = `${prefix}css/bubble-theme-base.css`;
	const sectionCss = `${prefix}css/bubble-themes/${cfg.css}`;
	const scrollJs = `${prefix}scripts/bubble-scroll.js`;

	if (!html.includes('bubble-theme-base.css')) {
		const cssBlock = `\t\t<link rel="stylesheet" href="${baseCss}" />\n\t\t<link rel="stylesheet" href="${sectionCss}" />`;
		if (html.includes('owenminercs.css')) {
			html = html.replace(
				/(<link[^>]+href="[^"]*owenminercs\.css"[^>]*\/?>)/i,
				`$1\n${cssBlock}`,
			);
		} else {
			html = html.replace(/<\/head>/i, `${cssBlock}\n\t</head>`);
		}
	}

	html = html.replace(/<body([^>]*)class="([^"]*)"/i, (match, attrs, classes) => {
		if (classes.includes('bubble-theme')) return match;
		return `<body${attrs}class="${classes} bubble-theme ${cfg.class}"`;
	});

	if (!html.includes('bubble-bg')) {
		html = html.replace(/<body[^>]*>\s*/i, (m) => `${m}${bubbleMarkup(section)}\n`);
	}

	if (!html.includes('bubble-scroll.js')) {
		if (html.includes('components.js')) {
			html = html.replace(
				/(<script[^>]+components\.js[^>]*><\/script>)/i,
				`$1\n\t\t<script src="${scrollJs}" defer></script>`,
			);
		} else {
			html = html.replace(/<\/body>/i, `\t\t<script src="${scrollJs}" defer></script>\n\t</body>`);
		}
	}

	if (!DRY) writeFileSync(filePath, html, 'utf8');
	return { status: 'patched' };
}

const results = { patched: 0, skipped: 0, details: [] };

for (const [file, section] of fileSection) {
	const rel = relative(ROOT, file);
	const result = patchHtml(file, section);
	if (result.status === 'patched') {
		results.patched++;
		results.details.push(`+ ${rel} → ${section}`);
	} else {
		results.skipped++;
		results.details.push(`· ${rel} (${result.reason})`);
	}
}

console.log(`Bubble theme apply ${DRY ? '(dry run) ' : ''}— patched ${results.patched}, skipped ${results.skipped}`);
for (const line of results.details) console.log(line);
