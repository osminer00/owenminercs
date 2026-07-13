#!/usr/bin/env node
/**
 * Remove legacy inline black-border styles from .keep-board-intro on Gear category
 * sub-hubs (not the main Gear nav hub the-setup.html).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const setupDir = path.join(root, 'The Setup');
const skip = new Set(['the-setup.html']);

const inlineBorderRe =
	/\s+style="(?:border:\s*solid\s+black[^"]*|border:solid\s+black[^"]*)"/gi;

let count = 0;
for (const name of fs.readdirSync(setupDir)) {
	if (!name.endsWith('.html') || skip.has(name)) continue;
	const filePath = path.join(setupDir, name);
	const original = fs.readFileSync(filePath, 'utf8');
	if (!original.includes('keep-board-intro')) continue;
	const updated = original.replace(inlineBorderRe, '');
	if (updated === original) continue;
	fs.writeFileSync(filePath, updated, 'utf8');
	console.log(`stripped inline border: The Setup/${name}`);
	count += 1;
}

console.log(`done — ${count} file(s)`);
