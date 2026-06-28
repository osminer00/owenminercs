#!/usr/bin/env node
/**
 * Remove legacy data-affiliate-product placeholder markup (AI retailer shortcut buttons).
 * Keeps all primary product links intact.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const skipDirs = new Set(['backup-pre-the-setup-2026-04-08', 'node_modules', '.git', 'package']);

function walk(dir, out = []) {
	for (const name of fs.readdirSync(dir)) {
		if (skipDirs.has(name)) continue;
		const full = path.join(dir, name);
		const stat = fs.statSync(full);
		if (stat.isDirectory()) walk(full, out);
		else if (name.endsWith('.html')) out.push(full);
	}
	return out;
}

const productDivRe =
	/<div\b[^>]*\bdata-affiliate-product\s*=\s*["'][^"']*["'][^>]*>\s*<\/div>\s*/gi;
const keyboardHubRe =
	/<div\b[^>]*\bclass\s*=\s*["'][^"']*affiliate-keyboard-hub[^"']*["'][^>]*>[\s\S]*?<\/div>\s*/gi;

let changedFiles = 0;
let removedDivs = 0;

for (const file of walk(root)) {
	let html = fs.readFileSync(file, 'utf8');
	const before = html;
	html = html.replace(keyboardHubRe, '');
	const productMatches = html.match(productDivRe);
	if (productMatches) removedDivs += productMatches.length;
	html = html.replace(productDivRe, '');
	if (html !== before) {
		fs.writeFileSync(file, html, 'utf8');
		changedFiles += 1;
		console.log(path.relative(root, file));
	}
}

console.log(`Updated ${changedFiles} file(s); removed ${removedDivs} placeholder div(s).`);
