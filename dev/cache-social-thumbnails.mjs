import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tiktokJsonPath = resolve(root, 'Socials/data/tiktok-posts.json');
const thumbDir = resolve(root, 'Socials/images/content-thumbs/tiktok');
const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

function sleep(ms) {
	return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function getTikTokVideoId(rawUrl) {
	const match = String(rawUrl || '').match(/\/video\/(\d+)/);
	return match?.[1] || '';
}

function isTikTokCdnUrl(url) {
	return /tiktokcdn/i.test(String(url || ''));
}

async function fetchOembedThumbUrl(postUrl) {
	const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(postUrl)}`;
	const response = await fetch(endpoint, {
		headers: { 'User-Agent': USER_AGENT, accept: 'application/json' },
	});
	if (!response.ok) return '';
	const payload = await response.json().catch(() => ({}));
	return String(payload?.thumbnail_url || '').trim();
}

async function downloadThumb(sourceUrl, destPath) {
	const response = await fetch(sourceUrl, {
		headers: { 'User-Agent': USER_AGENT, referer: 'https://www.tiktok.com/' },
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const buffer = Buffer.from(await response.arrayBuffer());
	if (buffer.length < 512) throw new Error('Thumbnail too small');
	writeFileSync(destPath, buffer);
}

function localThumbWebPath(videoId) {
	return `/Socials/images/content-thumbs/tiktok/${videoId}.jpg`;
}

function localThumbFilePath(videoId) {
	return resolve(thumbDir, `${videoId}.jpg`);
}

function isFreshFile(filePath, maxAgeDays = 21) {
	if (!existsSync(filePath)) return false;
	const ageMs = Date.now() - statSync(filePath).mtimeMs;
	return ageMs < maxAgeDays * 24 * 60 * 60 * 1000;
}

async function cacheTikTokItem(item) {
	const postUrl = String(item?.url || '').trim();
	const videoId = getTikTokVideoId(postUrl);
	if (!videoId) return item;

	const destFile = localThumbFilePath(videoId);
	const webPath = localThumbWebPath(videoId);

	if (isFreshFile(destFile)) {
		return { ...item, thumbnail: webPath };
	}

	let sourceUrl = isTikTokCdnUrl(item?.thumbnail) ? '' : String(item?.thumbnail || '').trim();
	if (!sourceUrl) {
		sourceUrl = await fetchOembedThumbUrl(postUrl);
	}
	if (!sourceUrl) {
		return { ...item, thumbnail: existsSync(destFile) ? webPath : '' };
	}

	try {
		await downloadThumb(sourceUrl, destFile);
		return { ...item, thumbnail: webPath };
	} catch (_err) {
		return { ...item, thumbnail: existsSync(destFile) ? webPath : '' };
	}
}

async function main() {
	mkdirSync(thumbDir, { recursive: true });
	const items = JSON.parse(readFileSync(tiktokJsonPath, 'utf8'));
	if (!Array.isArray(items)) {
		throw new Error('tiktok-posts.json must be an array');
	}

	const batchSize = 4;
	const updated = [];
	let cached = 0;
	let skipped = 0;
	let failed = 0;

	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize);
		const results = await Promise.all(batch.map((item) => cacheTikTokItem(item)));
		for (const result of results) {
			if (result.thumbnail?.startsWith('/Socials/images/content-thumbs/')) {
				if (existsSync(localThumbFilePath(getTikTokVideoId(result.url)))) {
					cached += 1;
				} else {
					failed += 1;
				}
			} else if (!result.thumbnail) {
				failed += 1;
			} else {
				skipped += 1;
			}
			updated.push(result);
		}
		process.stdout.write(`\r[cache-social-thumbnails] ${Math.min(i + batchSize, items.length)}/${items.length}`);
		await sleep(350);
	}

	writeFileSync(tiktokJsonPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
	console.log(
		`\n[cache-social-thumbnails] done: ${cached} local thumbs, ${failed} missing, ${skipped} legacy URLs kept`
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
