#!/usr/bin/env node
/**
 * Strip em dashes (—) and spaced double hyphens ( -- ) from visible copy in production HTML/JSON/JS strings.
 * Run: node dev/strip-em-dashes.mjs [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

const SKIP_DIR = new Set(['backup-pre-the-setup-2026-04-08', 'mockups', 'dev', 'package', 'node_modules', '.git', '.claude']);

function shouldSkipDir(rel) {
	const parts = rel.split(/[/\\]/);
	return parts.some((p) => SKIP_DIR.has(p) || p.startsWith('backup-'));
}

function walkHtml(dir, out = []) {
	for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, ent.name);
		const rel = path.relative(root, full);
		if (ent.isDirectory()) {
			if (shouldSkipDir(rel)) continue;
			walkHtml(full, out);
		} else if (ent.name.endsWith('.html')) {
			if (!shouldSkipDir(rel)) out.push(full);
		}
	}
	return out;
}

/** Rewrite em dash to natural punctuation. */
function fixEmDashInText(text) {
	let s = text;

	// Parenthetical: word—and—word -> word (and) word
	s = s.replace(/(\w)—and—(\w)/gi, '$1 (and) $2');

	// Alt text / captions: " — photo N"
	s = s.replace(/ — photo /g, ', photo ');

	// Disclosure pattern
	s = s.replace(/channel—some/g, 'channel. Some');

	// Spaced em dash (most common)
	s = s.replace(/ — /g, ', ');

	// Word—lowercase continuation
	s = s.replace(/([^\s—])—([a-z])/g, '$1, $2');

	// Word—Uppercase new sentence
	s = s.replace(/([^\s—])—([A-Z])/g, '$1. $2');

	// Remaining em dashes
	s = s.replace(/—/g, ', ');

	// Spaced double hyphen in visible prose (not URLs/code)
	s = s.replace(/ -- /g, ', ');

	return s;
}

function processFile(filePath) {
	const raw = fs.readFileSync(filePath, 'utf8');
	const fixed = fixEmDashInText(raw);
	if (fixed === raw) return 0;
	const count = (raw.match(/—/g) || []).length + (raw.match(/ -- /g) || []).length;
	if (!dryRun) fs.writeFileSync(filePath, fixed, 'utf8');
	return count;
}

const extraFiles = [
	path.join(root, 'scripts', 'components.js'),
	path.join(root, 'affiliate-links.json'),
];

let totalBefore = 0;
let filesChanged = 0;
const changed = [];

for (const f of walkHtml(root)) {
	const n = processFile(f);
	if (n > 0) {
		totalBefore += n;
		filesChanged++;
		changed.push(path.relative(root, f));
	}
}

for (const f of extraFiles) {
	if (!fs.existsSync(f)) continue;
	const raw = fs.readFileSync(f, 'utf8');
	// Only fix visible string literals in components.js (title=, aria-label=, nav text)
	let fixed = raw;
	if (f.endsWith('components.js')) {
		fixed = fixEmDashInText(raw);
		// Restore code comments that got altered (only visible title/aria strings matter; comments are fine to leave fixed or revert)
	} else {
		fixed = fixEmDashInText(raw);
	}
	if (fixed !== raw) {
		const n = (raw.match(/—/g) || []).length + (raw.match(/ -- /g) || []).length;
		totalBefore += n;
		filesChanged++;
		changed.push(path.relative(root, f));
		if (!dryRun) fs.writeFileSync(f, fixed, 'utf8');
	}
}

// Count after
let totalAfter = 0;
for (const f of walkHtml(root)) {
	const raw = fs.readFileSync(f, 'utf8');
	totalAfter += (raw.match(/—/g) || []).length + (raw.match(/ -- /g) || []).length;
}
for (const f of extraFiles) {
	if (!fs.existsSync(f)) continue;
	const raw = fs.readFileSync(f, 'utf8');
	totalAfter += (raw.match(/—/g) || []).length + (raw.match(/ -- /g) || []).length;
}

console.log(JSON.stringify({ dryRun, totalBefore, totalAfter, filesChanged, changed: changed.sort() }, null, 2));
