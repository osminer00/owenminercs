#!/usr/bin/env node
/**
 * Wrap sibling .keep-board blocks in .hub-content-panel on bubble-theme hub pages.
 * Skips pages already fixed or needing manual edits (the-setup, gaming, upgrades).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const skip = new Set([
	'The Setup/the-setup.html',
	'Gaming/gaming.html',
	'Upgrades/upgrades.html',
]);

function walk(dir, out = []) {
	for (const name of fs.readdirSync(dir)) {
		const p = path.join(dir, name);
		const st = fs.statSync(p);
		if (st.isDirectory() && name !== 'node_modules' && !name.startsWith('.')) walk(p, out);
		else if (name.endsWith('.html')) out.push(p);
	}
	return out;
}

function findDivRange(html, startIndex) {
	let depth = 0;
	let i = startIndex;
	while (i < html.length) {
		const open = html.slice(i).match(/^<div(\s|>)/);
		const close = html.slice(i).startsWith('</div>');
		if (open) {
			depth++;
			i += open[0].length;
			continue;
		}
		if (close) {
			depth--;
			i += 6;
			if (depth === 0) return i;
			continue;
		}
		i++;
	}
	return -1;
}

function wrapSiblingKeepBoard(html) {
	if (!html.includes('bubble-theme') || html.includes('hub-content-panel')) return null;

	const introIdx = html.search(/<div class="intro[^"]*">/);
	const keepIdx = html.search(/<div class="keep-board[^"]*"/);
	if (introIdx < 0 || keepIdx < 0) return null;

	const introEnd = findDivRange(html, introIdx);
	if (introEnd < 0 || keepIdx < introEnd) return null;

	const between = html.slice(introEnd, keepIdx);
	if (!/^\s*$/.test(between)) return null;

	const keepEnd = findDivRange(html, keepIdx);
	if (keepEnd < 0) return null;

	const indent = (between.match(/\n(\s*)$/) || ['', '\t\t\t'])[1] || '\t\t\t';
	const open = `${indent}<section class="hub-content-panel">\n`;
	const close = `\n${indent}</section>`;

	return html.slice(0, keepIdx) + open + html.slice(keepIdx, keepEnd) + close + html.slice(keepEnd);
}

const files = walk(root).filter((f) => !f.includes(`${path.sep}dev${path.sep}`));
const fixed = [];

for (const file of files) {
	const rel = path.relative(root, file).replace(/\\/g, '/');
	if (skip.has(rel)) continue;
	const html = fs.readFileSync(file, 'utf8');
	const next = wrapSiblingKeepBoard(html);
	if (next && next !== html) {
		fs.writeFileSync(file, next);
		fixed.push(rel);
	}
}

console.log('Fixed', fixed.length, 'files:');
fixed.sort().forEach((f) => console.log(' ', f));
