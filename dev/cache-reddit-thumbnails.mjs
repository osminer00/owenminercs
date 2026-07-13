import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const thumbDir = resolve(root, 'Socials/images/content-thumbs/reddit');
const USER_AGENT = 'Mozilla/5.0 (compatible; OwenMinerCS-site-builder/1.0)';

/** Post id from a reddit.com comments URL. */
export function redditPostIdFromUrl(url) {
	const match = String(url || '').match(/\/comments\/([a-z0-9]+)\//i);
	return match?.[1] || '';
}

function localThumbWebPath(postId, ext = '.jpg') {
	return `/Socials/images/content-thumbs/reddit/${postId}${ext}`;
}

function localThumbFilePath(postId, ext = '.jpg') {
	return resolve(thumbDir, `${postId}${ext}`);
}

function findExistingThumb(postId) {
	for (const ext of ['.jpg', '.png', '.webp', '.gif']) {
		const file = localThumbFilePath(postId, ext);
		if (existsSync(file)) return localThumbWebPath(postId, ext);
	}
	return '';
}

function isFreshFile(filePath, maxAgeDays = 30) {
	if (!filePath || !existsSync(filePath)) return false;
	const ageMs = Date.now() - statSync(filePath).mtimeMs;
	return ageMs < maxAgeDays * 24 * 60 * 60 * 1000;
}

function cleanPreviewUrl(raw) {
	let url = String(raw || '')
		.replace(/&amp;/g, '&')
		.replace(/\\u0026/g, '&')
		.trim();
	url = url.replace(/&quot;.*$/, '').replace(/["'<>].*$/, '');
	return url;
}

/** Scrape preview image from redditmedia embed HTML (works when .json API is 403). */
export async function fetchRedditPreviewUrl(postUrl) {
	const postId = redditPostIdFromUrl(postUrl);
	if (!postId) return '';

	let embedPath = '';
	try {
		const parsed = new URL(postUrl);
		embedPath = parsed.pathname.replace(/\/?$/, '/');
	} catch (_err) {
		return '';
	}

	const embedUrl = `https://www.redditmedia.com${embedPath}?ref_source=embed&ref=share&embed=true`;
	const response = await fetch(embedUrl, {
		headers: { 'User-Agent': USER_AGENT, accept: 'text/html' },
	});
	if (!response.ok) return '';

	const html = await response.text();
	const patterns = [
		/https:\/\/external-preview\.redd\.it\/[^"'\s<>]+/gi,
		/https:\/\/preview\.redd\.it\/[^"'\s<>]+/gi,
		/https:\/\/i\.redd\.it\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp|gif)/gi,
		/https:\/\/b\.thumbs\.redditmedia\.com\/[^"'\s<>]+\.(?:jpg|jpeg|png|webp|gif)/gi,
	];
	for (const pattern of patterns) {
		for (const match of html.matchAll(pattern)) {
			const url = cleanPreviewUrl(match[0]);
			if (url && !/avatar|styles\.redditmedia|emoji/i.test(url)) return url;
		}
	}
	return '';
}

export async function downloadThumb(sourceUrl, destPath) {
	const response = await fetch(sourceUrl, {
		headers: { 'User-Agent': USER_AGENT, referer: 'https://www.reddit.com/' },
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const buffer = Buffer.from(await response.arrayBuffer());
	if (buffer.length < 256) throw new Error('Thumbnail too small');
	const contentType = String(response.headers.get('content-type') || '').toLowerCase();
	const ext = contentType.includes('png')
		? '.png'
		: contentType.includes('webp')
			? '.webp'
			: contentType.includes('gif')
				? '.gif'
				: '.jpg';
	const resolvedDest = destPath.replace(/\.(jpg|jpeg|png|webp|gif)$/i, ext);
	writeFileSync(resolvedDest, buffer);
	return resolvedDest;
}

export async function cacheRedditPostThumb(postUrl, { force = false } = {}) {
	const postId = redditPostIdFromUrl(postUrl);
	if (!postId) return '';

	const existing = findExistingThumb(postId);
	const existingFile = existing ? resolve(root, existing.replace(/^\//, '')) : '';
	if (!force && isFreshFile(existingFile)) return existing;

	const sourceUrl = await fetchRedditPreviewUrl(postUrl);
	if (!sourceUrl) {
		return existing;
	}

	try {
		const destFile = await downloadThumb(sourceUrl, localThumbFilePath(postId, '.jpg'));
		const ext = destFile.slice(destFile.lastIndexOf('.'));
		return localThumbWebPath(postId, ext);
	} catch (_err) {
		return existing;
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const urls = process.argv.slice(2);
	if (!urls.length) {
		console.error('Usage: node dev/cache-reddit-thumbnails.mjs <reddit-post-url> [...]');
		process.exit(1);
	}
	mkdirSync(thumbDir, { recursive: true });
	for (const url of urls) {
		const local = await cacheRedditPostThumb(url, { force: true });
		console.log(redditPostIdFromUrl(url), local || '(no thumb)');
	}
}
