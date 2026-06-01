#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = path.join(ROOT, 'data', 'site-search-index.json');
const EXCLUDED_DIRS = new Set([
	'.git',
	'.claude',
	'.cursor',
	'.vscode',
	'backup-pre-the-setup-2026-04-08',
	'dev',
	'functions',
	'memory',
	'mockups',
	'netlify',
	'node_modules',
	'package',
	'shared',
]);
const EXCLUDED_FILES = new Set(['search.html']);

async function* walk(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	for (const entry of entries) {
		if (EXCLUDED_DIRS.has(entry.name)) continue;

		const abs = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walk(abs);
			continue;
		}
		if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.html') continue;
		if (EXCLUDED_FILES.has(entry.name)) continue;
		yield abs;
	}
}

function decodeEntities(text) {
	return text
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'");
}

function textFromHtml(html) {
	return decodeEntities(
		html
			.replace(/<shared-header\b[\s\S]*?<\/shared-header>/gi, ' ')
			.replace(/<shared-footer\b[\s\S]*?<\/shared-footer>/gi, ' ')
			.replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
			.replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
			.replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
			.replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
	);
}

function getTitle(html, fallback) {
	const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
	if (title) return decodeEntities(title.replace(/\s+/g, ' ').trim());
	const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
	if (h1) return textFromHtml(h1);
	return fallback;
}

function getDescription(html, text) {
	const meta =
		html.match(/<meta[^>]+name=(["'])description\1[^>]+content=(["'])(.*?)\2[^>]*>/i)?.[3] ||
		html.match(/<meta[^>]+content=(["'])(.*?)\1[^>]+name=(["'])description\3[^>]*>/i)?.[2];
	if (meta) return decodeEntities(meta.replace(/\s+/g, ' ').trim());
	return text.slice(0, 180);
}

function toSearchPath(abs) {
	const rel = path.relative(ROOT, abs).split(path.sep).join('/');
	if (rel === 'index.html') return '';
	const withoutExt = rel.replace(/\.html$/i, '');
	return withoutExt
		.split('/')
		.map((part) => encodeURIComponent(part))
		.join('/');
}

const entries = [];

for await (const file of walk(ROOT)) {
	const html = await fs.readFile(file, 'utf8');
	const pagePath = toSearchPath(file);
	const fallbackTitle = pagePath || 'Home';
	const text = textFromHtml(html);
	const title = getTitle(html, fallbackTitle);
	const description = getDescription(html, text);
	entries.push({
		path: pagePath,
		title,
		snippet: description,
		text,
	});
}

entries.sort((a, b) => a.path.localeCompare(b.path));

await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
await fs.writeFile(OUT_FILE, `${JSON.stringify({ entries }, null, 2)}\n`);
console.log(`Wrote ${entries.length} search entries to ${path.relative(ROOT, OUT_FILE)}`);
