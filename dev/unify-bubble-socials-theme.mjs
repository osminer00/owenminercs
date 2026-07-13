#!/usr/bin/env node
/**
 * Unify all bubble-themed pages to Content (socials) purple theme + video.
 * Usage: node dev/unify-bubble-socials-theme.mjs [--dry-run]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');

const SKIP_DIRS = new Set([
	'node_modules',
	'.git',
	'mockups',
	'backup-pre-the-setup-2026-04-08',
	'package',
	'.claude',
	'old photos',
]);

const THEME_CLASS_RE = /\bbubble-theme--[a-z0-9-]+\b/g;
const SECTION_CSS_RE = /href="([^"]*bubble-themes\/)(?!socials\.css)[^"]+\.css"/g;
const BUBBLE_MEDIA_RE = /\/images\/bubble-themes\/(?!socials\/)[a-z0-9-]+\//g;
const HOME_POSTER_RE = /\/images\/home\/bubble-bg-poster\.jpg/g;
const HOME_VIDEO_RE = /\/images\/home\/bubble-bg\.mp4/g;

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
		} else if (name.endsWith('.html')) {
			cb(full);
		}
	}
}

function patchHtml(filePath) {
	let html = readFileSync(filePath, 'utf8');
	const before = html;

	if (relative(ROOT, filePath).replace(/\\/g, '/').startsWith('Achievements/')) return null;

	if (
		!html.includes('bubble-theme--') &&
		!html.includes('home-liquid-glass-test') &&
		!html.includes('bubble-themes/')
	) {
		return null;
	}

	html = html.replace(THEME_CLASS_RE, 'bubble-theme--socials');
	html = html.replace(SECTION_CSS_RE, 'href="$1socials.css"');
	html = html.replace(BUBBLE_MEDIA_RE, '/images/bubble-themes/socials/');
	html = html.replace(HOME_POSTER_RE, '/images/bubble-themes/socials/poster.jpg');
	html = html.replace(HOME_VIDEO_RE, '/images/bubble-themes/socials/bg.mp4');

	if (html === before) return null;
	if (!DRY) writeFileSync(filePath, html, 'utf8');
	return relative(ROOT, filePath);
}

const updated = [];
walk(ROOT, (file) => {
	const rel = patchHtml(file);
	if (rel) updated.push(rel);
});

console.log(`Unify socials theme ${DRY ? '(dry run) ' : ''}— updated ${updated.length} file(s)`);
for (const rel of updated.sort()) console.log(`+ ${rel}`);
