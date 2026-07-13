/**
 * Build data/site-map-order.json: ordered page paths per section for site-map.html.
 * Run: node dev/build-site-map-order.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function fileToSitePath(relPosix) {
	const noHtml = relPosix.replace(/\.html$/i, '');
	if (!noHtml) return '';
	return noHtml
		.split('/')
		.map((seg) => encodeURIComponent(decodeURIComponent(seg)))
		.join('/');
}

function decodePath(p) {
	try {
		return decodeURIComponent(p);
	} catch {
		return p;
	}
}

function normalizePathKey(p) {
	return decodePath(p).replace(/\\/g, '/').replace(/\.html$/i, '').toLowerCase();
}

function extractHubLinks(html, baseRelDir) {
	const $ = cheerio.load(html);
	const links = [];
	$('[data-href]').each((_, el) => {
		const raw = ($(el).attr('data-href') || '').trim();
		if (!raw || raw.startsWith('http') || raw.startsWith('#')) return;
		const resolved = path.posix.normalize(path.posix.join(baseRelDir, raw));
		const sitePath = fileToSitePath(resolved);
		if (sitePath) links.push(sitePath);
	});
	return links;
}

function pathMatchesSection(sitePath, section) {
	const key = normalizePathKey(sitePath);
	for (const prefix of section.pathPrefixes || []) {
		const decoded = normalizePathKey(decodePath(prefix));
		const withSlash = decoded.endsWith('/') ? decoded : `${decoded}/`;
		if (key === decoded || key.startsWith(withSlash)) return true;
	}
	return false;
}

function shouldExclude(sitePath, config) {
	const key = normalizePathKey(sitePath);
	for (const p of config.excludePaths || []) {
		if (key === normalizePathKey(p)) return true;
	}
	for (const prefix of config.excludePathPrefixes || []) {
		if (key.startsWith(normalizePathKey(decodePath(prefix)))) return true;
	}
	return false;
}

function collectHubOrder(hubFiles) {
	const ordered = [];
	const seen = new Set();
	for (const rel of hubFiles || []) {
		const abs = path.join(ROOT, rel);
		if (!fs.existsSync(abs)) continue;
		const html = fs.readFileSync(abs, 'utf8');
		const baseDir = path.posix.dirname(rel.replace(/\\/g, '/'));
		for (const link of extractHubLinks(html, baseDir)) {
			const k = normalizePathKey(link);
			if (seen.has(k)) continue;
			seen.add(k);
			ordered.push(link);
		}
	}
	return ordered;
}

function sortSectionPaths(paths, section, hubOrder) {
	const hubRank = new Map();
	hubOrder.forEach((p, i) => hubRank.set(normalizePathKey(p), i));
	const pinned = section.pinnedFirst || [];
	const pinnedRank = new Map(pinned.map((p, i) => [normalizePathKey(p), i]));

	return [...paths].sort((a, b) => {
		const ak = normalizePathKey(a);
		const bk = normalizePathKey(b);
		const ap = pinnedRank.has(ak) ? pinnedRank.get(ak) : Infinity;
		const bp = pinnedRank.has(bk) ? pinnedRank.get(bk) : Infinity;
		if (ap !== bp) return ap - bp;
		const ah = hubRank.has(ak) ? hubRank.get(ak) : Infinity;
		const bh = hubRank.has(bk) ? hubRank.get(bk) : Infinity;
		if (ah !== bh) return ah - bh;
		return ak.localeCompare(bk, undefined, { sensitivity: 'base' });
	});
}

function isPlaceholderSrc(src) {
	const lower = String(src || '')
		.trim()
		.toLowerCase();
	if (!lower || /^data:/i.test(lower)) return true;
	if (lower.includes('coming-soon-card')) return true;
	if (lower.includes('owenminercs-logo')) return true;
	if (lower.includes('/images/logo/globes/') || lower.includes('logo/globes/globe-')) return true;
	if (/\/images\/logo\/(favicon|apple-touch)/.test(lower)) return true;
	if (lower.endsWith('.svg')) return true;
	return false;
}

function resolveUrl(src, baseHref) {
	try {
		return new URL(src, baseHref).href;
	} catch {
		return src;
	}
}

/** Store site-root paths (/foo.webp) or absolute https URLs for off-site thumbs. */
function normalizeThumbUrl(absUrl) {
	try {
		const u = new URL(absUrl);
		if (u.hostname === 'www.owenminercs.com' || u.hostname === 'owenminercs.com') {
			return u.pathname;
		}
		return u.href;
	} catch {
		return absUrl;
	}
}

function sitePathToRelFile(sitePath) {
	const key = normalizePathKey(sitePath);
	if (!key || key === 'index') return 'index.html';
	return `${decodePath(sitePath).replace(/\\/g, '/')}.html`;
}

function extractThumbFromHtml(html, relFile, depth = 0) {
	const $ = cheerio.load(html, { decodeEntities: true });
	const sitePath = fileToSitePath(relFile);
	const baseHref = sitePath
		? `https://www.owenminercs.com/${sitePath}`
		: 'https://www.owenminercs.com/';

	function trySrc(src) {
		if (!src || isPlaceholderSrc(src)) return null;
		return normalizeThumbUrl(resolveUrl(src, baseHref));
	}

	const metaOg = $('meta[property="og:image"]').attr('content');
	const fromOg = trySrc(metaOg);
	if (fromOg) return fromOg;

	const metaTw = $('meta[name="twitter:image"]').attr('content');
	const fromTw = trySrc(metaTw);
	if (fromTw) return fromTw;

	const selectors = [
		'.photogallery-img[src]',
		'.photogallery img[src]',
		'.keep-board img.keep-card__thumb[src]',
		'.home-explore-card__media img[src]',
		'.gallery2 img[src]',
		'.pc-build-gallery img[src]',
		'.site-feed-item__media img[src]',
		'.setup-hero-split img[src]',
		'img[src]',
	];

	for (const selector of selectors) {
		const nodes = $(selector);
		for (let i = 0; i < nodes.length; i++) {
			const src = $(nodes[i]).attr('src');
			const thumb = trySrc(src);
			if (thumb) return thumb;
		}
	}

	if (depth >= 2) return null;

	const baseDir = path.posix.dirname(relFile.replace(/\\/g, '/'));
	const childRels = [];
	$('[data-href]').each((_, el) => {
		const raw = ($(el).attr('data-href') || '').trim();
		if (!raw || raw.startsWith('http') || raw.startsWith('#')) return;
		childRels.push(path.posix.normalize(path.posix.join(baseDir, raw)));
	});

	for (const childRel of childRels) {
		const childAbs = path.join(ROOT, childRel);
		if (!fs.existsSync(childAbs)) continue;
		let childHtml;
		try {
			childHtml = fs.readFileSync(childAbs, 'utf8');
		} catch {
			continue;
		}
		const childThumb = extractThumbFromHtml(childHtml, childRel, depth + 1);
		if (childThumb) return childThumb;
	}

	return null;
}

function posterFallbackForPath(sitePath) {
	const key = normalizePathKey(sitePath);
	if (
		key.startsWith('the setup/') ||
		key.startsWith('keyboard/') ||
		key.startsWith('pc/') ||
		key.startsWith('desk setup/') ||
		key.startsWith('upgrades/')
	) {
		return '/images/bubble-themes/socials/poster.jpg';
	}
	if (key.startsWith('gaming/') || key.startsWith('counter-strike/')) {
		return '/images/bubble-themes/gaming/poster.jpg';
	}
	if (key.startsWith('socials/') || key.startsWith('photography/') || key.startsWith('posts/') || key.startsWith('music/')) {
		return '/images/bubble-themes/socials/poster.jpg';
	}
	if (key.startsWith('donators/')) return '/images/bubble-themes/donators/poster.jpg';
	if (key.startsWith('garage sale/')) return '/images/bubble-themes/garage-sale/poster.jpg';
	if (key.startsWith('help wanted/')) return '/images/bubble-themes/help-wanted/poster.jpg';
	if (key.startsWith('qa/')) return '/images/bubble-themes/qa/poster.jpg';
	if (key.startsWith('dev/')) return '/images/bubble-themes/dev/poster.jpg';
	if (key.startsWith('achievements/')) return '/images/bubble-themes/achievements/poster.jpg';
	if (key.startsWith('services/')) return '/About/Images/owenProfile.webp';
	if (key === 'index') return '/About/Images/owenProfile.webp';
	return null;
}

function buildThumbMap(paths, overrides = {}) {
	const thumbs = {};
	for (const [rawKey, value] of Object.entries(overrides)) {
		thumbs[normalizePathKey(rawKey)] = value;
	}
	for (const sitePath of paths) {
		const key = normalizePathKey(sitePath);
		if (thumbs[key]) continue;
		const relFile = sitePathToRelFile(sitePath);
		const abs = path.join(ROOT, relFile);
		if (!fs.existsSync(abs)) continue;
		let html;
		try {
			html = fs.readFileSync(abs, 'utf8');
		} catch {
			continue;
		}
		const thumb = extractThumbFromHtml(html, relFile);
		if (thumb) thumbs[normalizePathKey(sitePath)] = thumb;
	}
	for (const sitePath of paths) {
		const key = normalizePathKey(sitePath);
		if (thumbs[key]) continue;
		const poster = posterFallbackForPath(sitePath);
		if (poster) thumbs[key] = poster;
	}
	return thumbs;
}

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site-map-sections.json'), 'utf8'));
const searchIndex = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site-search-index.json'), 'utf8'));
const allPaths = (searchIndex.entries || [])
	.map((e) => e.path)
	.filter((p) => p && !shouldExclude(p, config));

const assigned = new Set();
const sections = [];

for (const section of config.sections) {
	const hubOrder = collectHubOrder(section.hubFiles);
	const sectionPaths = allPaths.filter((p) => {
		if (assigned.has(normalizePathKey(p))) return false;
		return pathMatchesSection(p, section);
	});
	sectionPaths.forEach((p) => assigned.add(normalizePathKey(p)));
	const ordered = sortSectionPaths(sectionPaths, section, hubOrder);
	if (section.hubPath) {
		const hubKey = normalizePathKey(section.hubPath);
		const hubIdx = ordered.findIndex((p) => normalizePathKey(p) === hubKey);
		if (hubIdx > 0) {
			ordered.splice(hubIdx, 1);
			ordered.unshift(section.hubPath);
		} else if (hubIdx < 0) {
			ordered.unshift(section.hubPath);
		}
	}
	sections.push({
		id: section.id,
		label: section.label,
		hubPath: section.hubPath || null,
		paths: ordered,
	});
}

const leftover = allPaths.filter((p) => !assigned.has(normalizePathKey(p)));
if (leftover.length) {
	let other = sections.find((s) => s.id === 'other');
	if (!other) {
		other = { id: 'other', label: 'Other', hubPath: null, paths: [] };
		sections.push(other);
	}
	other.paths.push(...leftover.sort((a, b) => normalizePathKey(a).localeCompare(normalizePathKey(b))));
}

const out = {
	generatedAt: new Date().toISOString().slice(0, 10),
	totalPages: sections.reduce((n, s) => n + s.paths.length, 0),
	sections: sections.filter((s) => s.paths.length > 0),
};

const allOrderedPaths = out.sections.flatMap((s) => s.paths);
out.thumbs = buildThumbMap(allOrderedPaths, config.thumbOverrides || {});

const thumbAlts = {};
for (const [rawKey, value] of Object.entries(config.thumbAltOverrides || {})) {
	if (typeof value === 'string' && value.trim()) thumbAlts[normalizePathKey(rawKey)] = value.trim();
}
if (Object.keys(thumbAlts).length) out.thumbAlts = thumbAlts;

const titleOverrides = {};
for (const [rawKey, value] of Object.entries(config.titleOverrides || {})) {
	if (typeof value === 'string' && value.trim()) titleOverrides[normalizePathKey(rawKey)] = value.trim();
}
if (Object.keys(titleOverrides).length) out.titleOverrides = titleOverrides;

const thumbCount = Object.keys(out.thumbs).length;
fs.writeFileSync(path.join(ROOT, 'data', 'site-map-order.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
console.log(
	`Wrote ${out.totalPages} paths in ${out.sections.length} sections (${thumbCount} thumbs) to data/site-map-order.json`
);
