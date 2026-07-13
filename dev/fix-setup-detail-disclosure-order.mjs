#!/usr/bin/env node
/**
 * Move affiliate-disclosure to immediately after the first h1 inside .ultrawide
 * on legacy setup detail pages (title → disclosure → content).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const setupDir = path.join(root, 'The Setup');

const disclosureRe =
	/<p class="affiliate-disclosure"[\s\S]*?<\/p>\s*(?=\s*<div class="ultrawide">)/;

const h1Re = /(<div class="ultrawide">[\s\S]*?<h1>[\s\S]*?<\/h1>)/;

function fixFile(filePath) {
	const rel = path.relative(root, filePath);
	const original = fs.readFileSync(filePath, 'utf8');
	if (!original.includes('setup-detail-page') || !original.includes('class="ultrawide"')) {
		return false;
	}

	const disclosureMatch = original.match(
		/<p class="affiliate-disclosure"[\s\S]*?<\/p>/
	);
	if (!disclosureMatch) return false;

	const disclosure = disclosureMatch[0];
	const beforeUltrawide = original.replace(disclosureRe, '');
	if (beforeUltrawide === original.replace(disclosureMatch[0], '')) {
		// disclosure not directly before ultrawide
		if (!original.includes('affiliate-disclosure') || !disclosureRe.test(original)) {
			return false;
		}
	}

	let next = original.replace(disclosureRe, '');
	if (next === original) return false;

	if (next.includes(disclosure)) {
		// already moved or duplicate — only proceed if disclosure still outside ultrawide before h1
		const ultraStart = next.indexOf('<div class="ultrawide">');
		const discIdx = next.indexOf(disclosure);
		if (ultraStart === -1 || discIdx === -1 || discIdx > ultraStart) {
			return false;
		}
		next = next.replace(disclosure, '');
	}

	const h1Match = next.match(h1Re);
	if (!h1Match) {
		console.warn(`skip (no h1 in ultrawide): ${rel}`);
		return false;
	}

	const updated = next.replace(h1Match[1], `${h1Match[1]}\n\t\t\t\t\t${disclosure}`);
	if (updated === original) return false;

	let withCompact = updated;
	if (
		withCompact.includes('<div class="intro">') &&
		!withCompact.includes('intro setup-page-compact')
	) {
		withCompact = withCompact.replace(
			'<div class="intro">',
			'<div class="intro setup-page-compact">'
		);
	}

	fs.writeFileSync(filePath, withCompact, 'utf8');
	console.log(`fixed: ${rel}`);
	return true;
}

let count = 0;
for (const name of fs.readdirSync(setupDir)) {
	if (!name.endsWith('.html')) continue;
	if (fixFile(path.join(setupDir, name))) count += 1;
}

console.log(`done — ${count} file(s) updated`);
