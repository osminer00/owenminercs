#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT_FILE = path.join(ROOT, 'data', 'site-search-index.json');
const EXCLUDED_DIRS = new Set([
	'.git',
	'.claude',
	'.cursor',
	'.vscode',
	'backup-pre-the-setup-2026-04-08',
	'memory',
	'mockups',
	'node_modules',
	'package',
]);
const EXCLUDED_RELATIVE_DIRS = new Set(['dev/affiliate-idea-board']);

function decodeEntities(value) {
	return String(value || '')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#(\d+);/g, (_, code) => {
			const n = Number(code);
			return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : _;
		})
		.replace(/&#x([0-9a-f]+);/gi, (_, code) => {
			const n = Number.parseInt(code, 16);
			return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : _;
		});
}

function normalizeText(value) {
	return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

function stripHtml(value) {
	return normalizeText(
		String(value || '')
			.replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
			.replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
			.replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
			.replace(/<shared-header\b[\s\S]*?<\/shared-header>/gi, ' ')
			.replace(/<shared-footer\b[\s\S]*?<\/shared-footer>/gi, ' ')
			.replace(/<[^>]+>/g, ' ')
	);
}

function getAttribute(tag, name) {
	const pattern = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
	const match = String(tag || '').match(pattern);
	return match ? match[2] || match[3] || match[4] || '' : '';
}

function getMetaDescription(html) {
	for (const match of String(html || '').matchAll(/<meta\b[^>]*>/gi)) {
		const tag = match[0];
		if (getAttribute(tag, 'name').toLowerCase() !== 'description') continue;
		return normalizeText(getAttribute(tag, 'content'));
	}
	return '';
}

function getTitle(html, fallback) {
	const match = String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
	const title = match ? stripHtml(match[1]) : '';
	return title || fallback;
}

function toSitePath(relPath) {
	const withoutExt = relPath.replace(/\.html$/i, '');
	if (withoutExt === 'index') return '';
	return withoutExt
		.split('/')
		.map((part) => encodeURIComponent(part))
		.join('/');
}

function makeSnippet(description, text) {
	const source = description || text;
	if (source.length <= 220) return source;
	const truncated = source.slice(0, 217).replace(/\s+\S*$/, '');
	return `${truncated}...`;
}

async function* walk(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		if (EXCLUDED_DIRS.has(entry.name)) continue;

		const abs = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			const relDir = path.relative(ROOT, abs).split(path.sep).join('/');
			if (EXCLUDED_RELATIVE_DIRS.has(relDir)) continue;
			yield* walk(abs);
			continue;
		}
		if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
			yield abs;
		}
	}
}

async function buildEntries() {
	const entries = [];
	for await (const abs of walk(ROOT)) {
		const rel = path.relative(ROOT, abs).split(path.sep).join('/');
		const html = await fs.readFile(abs, 'utf8');
		const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
		const bodyText = stripHtml(bodyMatch ? bodyMatch[1] : html);
		const description = getMetaDescription(html);
		const fallbackTitle = rel.replace(/\.html$/i, '').replace(/[-_/]+/g, ' ');
		const title = getTitle(html, fallbackTitle);
		const text = [description, bodyText].filter(Boolean).join(' ').slice(0, 6000);
		entries.push({
			path: toSitePath(rel),
			title,
			snippet: makeSnippet(description, bodyText),
			text,
		});
	}
	entries.sort((a, b) => String(a.path).localeCompare(String(b.path)));
	return entries;
}

const entries = await buildEntries();
await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
await fs.writeFile(
	OUTPUT_FILE,
	`${JSON.stringify(
		{
			version: 1,
			generatedBy: 'dev/build-site-search-index.mjs',
			entries,
		},
		null,
		2
	)}\n`
);

console.log(`Wrote ${path.relative(ROOT, OUTPUT_FILE)} with ${entries.length} entries.`);
