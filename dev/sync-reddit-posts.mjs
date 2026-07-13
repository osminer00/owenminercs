import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = resolve(root, 'Socials/data/reddit-posts.json');
const REDDIT_MIN_UPVOTES = 100;
const REDDIT_FETCH_LIMIT = 100;
const username = 'OwenMCS';

/** Top Reddit posts (all-time); used when submitted.json is blocked. */
const REDDIT_TOP_POSTS_SEED = [
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/1mv03i2/im_so_excited_to_support_north_american/',
		subreddit: 'GlobalOffensive',
		title: "I'm so excited to support North American Counter-Strike with the new T-shirt I just bought! 🇺🇸🦅",
	},
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/1jgxch2/inferno_bookend_d/',
		subreddit: 'GlobalOffensive',
		title: 'Inferno Bookend :D',
	},
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/16t80up/dear_valve_1_vote_to_surrender_is_not_okay/',
		subreddit: 'GlobalOffensive',
		title: 'Dear Valve, 1 vote to surrender is not okay.',
	},
	{
		url: 'https://www.reddit.com/r/ohnePixel/comments/1nx7pom/everyone_fix_game_please_valve/',
		subreddit: 'ohnePixel',
		title: 'Everyone: "Fix Game PLEASE" Valve:',
	},
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/15fehzt/hopefully_this_tip_helps_someone_out/',
		subreddit: 'GlobalOffensive',
		title: 'Hopefully This Tip Helps Someone Out!',
	},
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/1i0fcm4/ive_been_practicing_my_wallbangs_on_train_the/',
		subreddit: 'GlobalOffensive',
		title: "I've been practicing my Wall-Bangs on Train the last two days 😄",
	},
	{
		url: 'https://www.reddit.com/r/ohnePixel/comments/1nl8li3/you_know_what_bro/',
		subreddit: 'ohnePixel',
		title: 'You know what bro…',
	},
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/1dql5e7/heads_up_this_wall_crack_reveals_your_position_on/',
		subreddit: 'GlobalOffensive',
		title: 'Heads Up: This Wall Crack Reveals Your Position on Dust II!',
	},
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/1jkdzr0/1v5_deagle/',
		subreddit: 'GlobalOffensive',
		title: '1v5 Deagle',
	},
	{
		url: 'https://www.reddit.com/r/GlobalOffensive/comments/1cmehf8/43_moment/',
		subreddit: 'GlobalOffensive',
		title: '4:3 Moment',
	},
];

function toSafeNumber(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeRedditText(value) {
	return String(value || '')
		.replace(/\s+/g, ' ')
		.trim();
}

function normalizeAspectRatio(width, height, fallback = '16 / 9') {
	const safeWidth = Number(width);
	const safeHeight = Number(height);
	if (
		!Number.isFinite(safeWidth) ||
		!Number.isFinite(safeHeight) ||
		safeWidth <= 0 ||
		safeHeight <= 0
	) {
		return fallback;
	}
	return `${safeWidth} / ${safeHeight}`;
}

function getRedditGalleryImage(postData) {
	const items = postData?.media_metadata;
	const galleryOrder = postData?.gallery_data?.items;
	if (!items || !Array.isArray(galleryOrder) || !galleryOrder.length) {
		return { url: '', aspectRatio: '' };
	}
	for (const entry of galleryOrder) {
		const mediaId = entry?.media_id;
		const candidate = mediaId ? items[mediaId] : null;
		const source = candidate?.s || candidate?.p?.[candidate.p.length - 1];
		const url = String(source?.u || source?.gif || '').replace(/&amp;/g, '&');
		if (!url.startsWith('http')) continue;
		return {
			url,
			aspectRatio: normalizeAspectRatio(source?.x, source?.y, '4 / 3'),
		};
	}
	return { url: '', aspectRatio: '' };
}

function getRedditPreviewImage(postData) {
	const images = postData?.preview?.images;
	if (!Array.isArray(images) || !images.length) return { url: '', aspectRatio: '' };
	const source = images[0]?.source;
	const url = String(source?.url || '').replace(/&amp;/g, '&');
	if (!url.startsWith('http')) return { url: '', aspectRatio: '' };
	return {
		url,
		aspectRatio: normalizeAspectRatio(source?.width, source?.height, '4 / 3'),
	};
}

function getRedditVideoData(postData) {
	const candidates = [
		postData?.secure_media?.reddit_video,
		postData?.media?.reddit_video,
		postData?.preview?.reddit_video_preview,
	];
	for (const candidate of candidates) {
		if (candidate && (candidate.fallback_url || candidate.hls_url || candidate.dash_url)) {
			return candidate;
		}
	}
	return null;
}

function isRedditProgressiveMp4Url(value) {
	const raw = String(value || '').trim();
	return raw.includes('.mp4') && !raw.includes('.m3u8') && !raw.includes('.mpd');
}

function toRedditPostItem(postData) {
	const score = toSafeNumber(postData?.score);
	if (score < REDDIT_MIN_UPVOTES) return null;

	const permalink = String(postData?.permalink || '').trim();
	const absoluteUrl = permalink
		? `https://www.reddit.com${permalink}`
		: String(postData?.url || '').trim();
	if (!absoluteUrl) return null;

	const secureVideo = getRedditVideoData(postData);
	const postHint = String(postData?.post_hint || '').toLowerCase();
	const hasAnyVideoUrl = Boolean(
		secureVideo?.fallback_url || secureVideo?.hls_url || secureVideo?.dash_url
	);
	const isVideo =
		Boolean(postData?.is_video) ||
		hasAnyVideoUrl ||
		postHint === 'hosted:video' ||
		postHint === 'rich:video';
	const galleryImage = getRedditGalleryImage(postData);
	const previewImage = getRedditPreviewImage(postData);
	const thumbnail =
		galleryImage.url ||
		previewImage.url ||
		(String(postData?.thumbnail || '').startsWith('http') ? String(postData.thumbnail) : '');
	const rawFallback = String(secureVideo?.fallback_url || '').trim();
	const videoFallbackUrl = isRedditProgressiveMp4Url(rawFallback) ? rawFallback : '';
	const isGallery = Boolean(postData?.is_gallery) || Boolean(galleryImage.url);
	const contentType = isVideo
		? 'video'
		: isGallery
			? 'gallery'
			: thumbnail
				? 'image'
				: 'post';
	const aspectRatio = isVideo
		? normalizeAspectRatio(secureVideo?.width || 16, secureVideo?.height || 9, '16 / 9')
		: galleryImage.aspectRatio || previewImage.aspectRatio || '4 / 3';
	const createdUtc = Number(postData?.created_utc || 0);

	return {
		platform: 'reddit',
		contentType,
		title: sanitizeRedditText(postData?.title) || 'Untitled Reddit post',
		url: absoluteUrl,
		thumbnail,
		embedUrl: isVideo ? videoFallbackUrl : '',
		caption: sanitizeRedditText(postData?.selftext) || sanitizeRedditText(postData?.title),
		publishedAt:
			createdUtc > 0 ? new Date(createdUtc * 1000).toISOString() : new Date().toISOString(),
		viewCount: toSafeNumber(postData?.view_count),
		likeCount: score,
		upvoteCount: score,
		commentCount: toSafeNumber(postData?.num_comments),
		mediaKind: isVideo ? 'video' : 'image',
		aspectRatio,
	};
}

function redditPostIdFromUrl(url) {
	const match = String(url || '').match(/\/comments\/([^/]+)/i);
	return match ? match[1] : '';
}

function localRedditThumb(postId) {
	if (!postId) return '';
	const rel = `Socials/images/content-thumbs/reddit/${postId}.jpg`;
	const abs = resolve(root, rel);
	if (existsSync(abs)) {
		return `/Socials/images/content-thumbs/reddit/${postId}.jpg`;
	}
	return '';
}

const KNOWN_REDDIT_SCORES = {
	'15fehzt': 499,
	'1jkdzr0': 123,
};

async function fetchPullpushScore(postId) {
	if (!postId) return 0;
	if (KNOWN_REDDIT_SCORES[postId]) return KNOWN_REDDIT_SCORES[postId];
	try {
		await new Promise((resolve) => setTimeout(resolve, 350));
		const response = await fetch(`https://api.pullpush.io/reddit/search/submission/?ids=${encodeURIComponent(postId)}`);
		if (!response.ok) return KNOWN_REDDIT_SCORES[postId] || 0;
		const payload = await response.json();
		const score = toSafeNumber(payload?.data?.[0]?.score);
		return score || KNOWN_REDDIT_SCORES[postId] || 0;
	} catch {
		return KNOWN_REDDIT_SCORES[postId] || 0;
	}
}

async function verifyRedditPostExists(url) {
	try {
		const oembedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`;
		const response = await fetch(oembedUrl, {
			headers: { 'User-Agent': 'OwenMinerCS-site-builder/1.0', accept: 'application/json' },
		});
		if (!response.ok) return null;
		const payload = await response.json();
		const title = sanitizeRedditText(payload?.title);
		return title || null;
	} catch {
		return null;
	}
}

async function buildSeedFallbackItems(existingByUrl) {
	const items = [];
	const removed = [];
	for (const seed of REDDIT_TOP_POSTS_SEED) {
		const url = String(seed.url || '').trim();
		if (!url) continue;
		const liveTitle = await verifyRedditPostExists(url);
		if (!liveTitle) {
			removed.push(seed.title || url);
			continue;
		}
		const postId = redditPostIdFromUrl(url);
		const existingScore = toSafeNumber(
			existingByUrl.get(url)?.upvoteCount ?? existingByUrl.get(url)?.likeCount,
		);
		const score = Math.max(await fetchPullpushScore(postId), existingScore);
		if (score < REDDIT_MIN_UPVOTES) {
			removed.push(`${seed.title || url} (${score || 'unknown'} upvotes)`);
			continue;
		}
		const thumb = localRedditThumb(postId);
		items.push({
			platform: 'reddit',
			contentType: 'post',
			title: liveTitle || sanitizeRedditText(seed.title) || 'Untitled Reddit post',
			url,
			thumbnail: thumb,
			embedUrl: '',
			caption: liveTitle || sanitizeRedditText(seed.title),
			publishedAt: '',
			viewCount: 0,
			likeCount: score,
			upvoteCount: score,
			commentCount: 0,
			mediaKind: 'image',
			aspectRatio: '16 / 9',
			subreddit: seed.subreddit || String(url).match(/\/r\/([^/]+)\//i)?.[1] || '',
		});
	}
	if (removed.length) {
		console.warn(
			`[reddit-sync] removed ${removed.length} deleted/unavailable seed post(s): ${removed.join('; ')}`,
		);
	}
	return items;
}

async function fetchSubmittedItems() {
	const endpoint = `https://www.reddit.com/user/${encodeURIComponent(username)}/submitted.json?limit=${REDDIT_FETCH_LIMIT}&sort=top&t=all&raw_json=1`;
	const response = await fetch(endpoint, {
		headers: { 'User-Agent': 'OwenMinerCS-site-builder/1.0', accept: 'application/json' },
	});
	if (!response.ok) {
		throw new Error(`Reddit fetch failed: ${response.status} ${response.statusText}`);
	}
	const payload = await response.json();
	const children = Array.isArray(payload?.data?.children) ? payload.data.children : [];
	return children.map((entry) => toRedditPostItem(entry?.data || {})).filter(Boolean);
}

let items = [];
let usedFallback = false;
const existingPosts = existsSync(outPath)
	? JSON.parse(readFileSync(outPath, 'utf8'))
	: [];
const existingByUrl = new Map(
	(Array.isArray(existingPosts) ? existingPosts : [])
		.filter((item) => item?.url)
		.map((item) => [item.url, item]),
);
try {
	items = await fetchSubmittedItems();
} catch (error) {
	console.warn(`[reddit-sync] submitted.json unavailable (${String(error?.message || error)}); using oembed-verified seed list.`);
	items = await buildSeedFallbackItems(existingByUrl);
	usedFallback = true;
}

const mergedByUrl = new Map();
for (const item of existingPosts) {
	if (!item?.url) continue;
	if (toSafeNumber(item.upvoteCount ?? item.likeCount) >= REDDIT_MIN_UPVOTES) {
		mergedByUrl.set(item.url, item);
	}
}
for (const item of items) {
	if (item?.url) mergedByUrl.set(item.url, item);
}
items = [...mergedByUrl.values()];

items.sort((a, b) => {
	const scoreDelta = toSafeNumber(b?.upvoteCount) - toSafeNumber(a?.upvoteCount);
	if (scoreDelta !== 0) return scoreDelta;
	return Date.parse(b?.publishedAt || 0) - Date.parse(a?.publishedAt || 0);
});

writeFileSync(outPath, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
console.log(
	`Wrote ${items.length} Reddit posts to ${outPath}${usedFallback ? ' (oembed-verified seed fallback)' : ''}`,
);
