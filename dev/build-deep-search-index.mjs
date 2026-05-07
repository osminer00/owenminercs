/**
 * Build data/site-search-index.json from local HTML files (full visible text + meta).
 * Safe: runs at build time only; browser loads JSON and matches strings client-side (no HTML injection).
 *
 * Run: node dev/build-deep-search-index.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SKIP_DIR_NAMES = new Set([
	'node_modules',
	'.git',
	'.cursor',
	'.claude',
	'package',
	'mcps',
	'terminals',
]);

const SKIP_DIR_PREFIXES = ['backup-pre-'];

function shouldSkipDir(relDirPosix) {
	const base = path.posix.basename(relDirPosix);
	if (SKIP_DIR_NAMES.has(base)) return true;
	if (SKIP_DIR_PREFIXES.some((p) => base.startsWith(p))) return true;
	if (relDirPosix.includes('backup-pre-')) return true;
	if (relDirPosix.startsWith('shared')) return true;
	if (relDirPosix.startsWith('old photos')) return true;
	return false;
}

function walk(dirAbs, relPosix, acc) {
	let dirents;
	try {
		dirents = fs.readdirSync(dirAbs, { withFileTypes: true });
	} catch {
		return acc;
	}
	for (const ent of dirents) {
		if (ent.name.startsWith('.')) continue;
		const nextAbs = path.join(dirAbs, ent.name);
		const nextRel = relPosix ? `${relPosix}/${ent.name}` : ent.name;
		if (ent.isDirectory()) {
			if (shouldSkipDir(nextRel)) continue;
			walk(nextAbs, nextRel, acc);
		} else if (ent.name.endsWith('.html')) {
			if (ent.name.includes('PC_PAGE_EXAMPLE')) continue;
			if (ent.name.includes('sharedHeadSection') || ent.name.includes('sharedHeader')) continue;
			acc.push({ abs: nextAbs, rel: nextRel.replace(/\\/g, '/') });
		}
	}
	return acc;
}

/** Same shape as production URLs in getLink() / sitemap (segments encoded). */
function fileToSitePath(relPosix) {
	const noHtml = relPosix.replace(/\.html$/i, '');
	if (!noHtml) return '';
	return noHtml
		.split('/')
		.map((seg) => encodeURIComponent(decodeURIComponent(seg)))
		.join('/');
}

function extractSearchParts(html) {
	const $ = cheerio.load(html, { decodeEntities: true });
	const titleText = $('title').first().text().replace(/\s+/g, ' ').trim();
	const metaDesc = ($('meta[name="description"]').attr('content') || '').replace(/\s+/g, ' ').trim();
	const metaKw = ($('meta[name="keywords"]').attr('content') || '').replace(/\s+/g, ' ').trim();
	$('script, style, noscript, template, iframe').remove();
	$('shared-header, shared-footer').remove();
	const alts = [];
	$('img[alt]').each((_, el) => {
		const a = ($(el).attr('alt') || '').trim();
		if (a) alts.push(a);
	});
	const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
	const combined = [titleText, metaDesc, metaKw, bodyText, alts.join(' ')]
		.filter(Boolean)
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();
	return { titleText, metaDesc, combined };
}

function buildSnippet(metaDesc, combinedFallback, max = 380) {
	const m = (metaDesc || '').trim();
	if (m.length > 48) return m.slice(0, max);
	return combinedFallback.replace(/\s+/g, ' ').trim().slice(0, max);
}

const manualPath = path.join(ROOT, 'data', 'search-manual-keywords.json');
let manualEntries = {};
if (fs.existsSync(manualPath)) {
	try {
		const raw = JSON.parse(fs.readFileSync(manualPath, 'utf8'));
		if (raw && raw.entries && typeof raw.entries === 'object') manualEntries = raw.entries;
	} catch {
		manualEntries = {};
	}
}

const files = walk(ROOT, '', []);
const entries = [];
const MAX_TEXT = 120000;

for (const { abs, rel } of files) {
	let html;
	try {
		html = fs.readFileSync(abs, 'utf8');
	} catch {
		continue;
	}
	const { titleText, metaDesc, combined } = extractSearchParts(html);
	const sitePath = fileToSitePath(rel);
	let text = combined.toLowerCase();
	const extra = manualEntries[sitePath];
	let manualTerms = null;
	if (Array.isArray(extra) && extra.length) {
		text = `${text} ${extra.join(' ')}`.replace(/\s+/g, ' ').trim().toLowerCase();
		manualTerms = extra.map((t) => String(t).toLowerCase().trim()).filter(Boolean);
	} else if (typeof extra === 'string' && extra.trim()) {
		const s = extra.trim();
		text = `${text} ${s}`.replace(/\s+/g, ' ').trim().toLowerCase();
		manualTerms = [s.toLowerCase()];
	}
	if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT);
	const snippet = buildSnippet(metaDesc, combined, 400);
	const title = titleText || sitePath || rel;
	const row = {
		path: sitePath,
		title,
		snippet,
		text,
	};
	if (manualTerms && manualTerms.length) row.manualTerms = manualTerms;
	entries.push(row);
}

entries.sort((a, b) => a.path.localeCompare(b.path));

const out = {
	version: 2,
	generated: new Date().toISOString(),
	entryCount: entries.length,
	entries,
};

fs.writeFileSync(path.join(ROOT, 'data', 'site-search-index.json'), JSON.stringify(out) + '\n');
console.log(`Wrote data/site-search-index.json — ${entries.length} pages (deep text index v2)`);
