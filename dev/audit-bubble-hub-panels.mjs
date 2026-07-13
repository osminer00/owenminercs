#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const okSibling =
	/^(shared-footer|script|aside|section|style|link|meta|div class="intro|div class="bubble)/i;
const knownGlass =
	/hub-content-panel|help-wanted-section|qa-section|achievements-panel|dev-stack-section|donators-wall|donators-body|garage-sale-body|gear-hub__seo/;

function walk(dir, out = []) {
	for (const name of fs.readdirSync(dir)) {
		const p = path.join(dir, name);
		const st = fs.statSync(p);
		if (st.isDirectory() && !name.startsWith('.') && name !== 'node_modules') walk(p, out);
		else if (name.endsWith('.html')) out.push(p);
	}
	return out;
}

function findDivRange(html, startIndex) {
	let depth = 0;
	let i = startIndex;
	while (i < html.length) {
		if (html.slice(i).match(/^<div(\s|>)/)) {
			depth++;
			i += html.slice(i).match(/^<div(\s|>)/)[0].length;
			continue;
		}
		if (html.slice(i).startsWith('</div>')) {
			depth--;
			i += 6;
			if (depth === 0) return i;
			continue;
		}
		i++;
	}
	return -1;
}

const issues = [];
const ok = [];

for (const file of walk(root)) {
	if (file.includes(`${path.sep}dev${path.sep}`) || file.includes(`${path.sep}mockups${path.sep}`)) continue;
	const html = fs.readFileSync(file, 'utf8');
	if (!html.includes('bubble-theme')) continue;
	const rel = path.relative(root, file).replace(/\\/g, '/');

	const containerMatch = html.match(/<div class="container">/);
	if (!containerMatch) {
		ok.push(`${rel} (no .container)`);
		continue;
	}

	const introIdx = html.search(/<div class="intro[^"]*">/);
	if (introIdx < 0) {
		ok.push(`${rel} (no .intro)`);
		continue;
	}

	const introEnd = findDivRange(html, introIdx);
	const containerStart = containerMatch.index;
	const containerEnd = findDivRange(html, containerStart);
	const afterIntro = html.slice(introEnd, containerEnd).trim();

	if (!afterIntro) {
		ok.push(`${rel} (intro-only)`);
		continue;
	}

	if (knownGlass.test(afterIntro)) {
		ok.push(`${rel}`);
		continue;
	}

	// strip known safe trailing blocks
	const stripped = afterIntro
		.replace(/<aside class="gear-hub__seo"[\s\S]*$/i, '')
		.replace(/<div class="intro"[\s\S]*$/i, '') // second intro blocks (FAQ)
		.trim();

	if (!stripped) {
		ok.push(`${rel} (intro + known extras)`);
		continue;
	}

	if (/hub-content-panel/.test(afterIntro)) {
		ok.push(`${rel}`);
		continue;
	}

	issues.push({ rel, snippet: stripped.slice(0, 120).replace(/\s+/g, ' ') });
}

console.log('=== NEEDS REVIEW ===');
issues.forEach(({ rel, snippet }) => console.log(rel, '→', snippet));
console.log('\n=== OK COUNT ===', ok.length);
