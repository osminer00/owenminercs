/**
 * Regenerates index.html home mosaic from synced Socials/data JSON (top engagement only).
 *
 *   node dev/sync-home-top-clips.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'index.html');

const MIN_YT_LIKES = 100;
const MIN_YT_VIEWS = 3000;
const MIN_SOCIAL_LIKES = 100;

/** Verified OwenMiner X posts when RSS sync is unavailable (fxtwitter likes). */
const X_VERIFIED_STATUS_IDS = ['1900576312365920513', '1899879947608424563'];

function readJson(relPath) {
	const full = path.join(root, relPath);
	if (!fs.existsSync(full)) return [];
	return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function escHtml(s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function escAttr(s) {
	return escHtml(s);
}

function oneLine(s) {
	return String(s).replace(/\s+/g, ' ').trim();
}

function engagementScore(item) {
	return (
		Number(item.viewCount || 0) +
		Number(item.likeCount || item.upvoteCount || 0) * 50
	);
}

function passesSocialBar(item) {
	return Number(item.likeCount || item.upvoteCount || 0) >= MIN_SOCIAL_LIKES;
}

function subredditFromUrl(url) {
	const match = String(url || '').match(/\/r\/([^/]+)\//i);
	return match ? match[1] : '';
}

function redditPostIdFromUrl(url) {
	const match = String(url || '').match(/\/comments\/([^/]+)/i);
	return match ? match[1] : '';
}

/** Curated OwenMiner Reddit posts (oembed + local thumb when live score APIs fail). */
const REDDIT_HOME_SEED = [
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

function localRedditThumb(postId) {
	if (!postId) return '';
	const rel = `Socials/images/content-thumbs/reddit/${postId}.jpg`;
	if (fs.existsSync(path.join(root, rel))) {
		return `/Socials/images/content-thumbs/reddit/${postId}.jpg`;
	}
	return '';
}

async function verifyRedditPostExists(url) {
	try {
		const oembedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(url)}`;
		const response = await fetch(oembedUrl, {
			headers: { 'User-Agent': 'OwenMinerCS-site-builder/1.0', accept: 'application/json' },
		});
		if (!response.ok) return null;
		const payload = await response.json();
		const title = oneLine(payload?.title || '');
		return title || null;
	} catch {
		return null;
	}
}

async function loadHomeRedditPosts(existingPosts) {
	const byUrl = new Map();
	for (const item of existingPosts) {
		if (item?.url && passesSocialBar(item)) byUrl.set(item.url, item);
	}

	for (const seed of REDDIT_HOME_SEED) {
		const url = String(seed.url || '').trim();
		if (!url || byUrl.has(url)) continue;
		const postId = redditPostIdFromUrl(url);
		const thumb = localRedditThumb(postId);
		if (!thumb) continue;
		const liveTitle = await verifyRedditPostExists(url);
		if (!liveTitle) continue;
		byUrl.set(url, {
			platform: 'reddit',
			title: liveTitle || oneLine(seed.title || ''),
			url,
			subreddit: seed.subreddit || subredditFromUrl(url),
			thumbnail: thumb,
		});
		await new Promise((resolve) => setTimeout(resolve, 250));
	}

	return [...byUrl.values()].sort((a, b) => engagementScore(b) - engagementScore(a));
}

function xAuthorOk(tweet) {
	const author = String(tweet?.author?.screen_name || '').toLowerCase();
	return author === 'owenminer' || author === 'owenminercs';
}

async function fetchFxTweet(statusId) {
	try {
		const response = await fetch(`https://api.fxtwitter.com/OwenMiner/status/${statusId}`);
		if (!response.ok) return null;
		const payload = await response.json();
		const tweet = payload?.tweet;
		if (!tweet || !xAuthorOk(tweet)) return null;

		const likes = Number(tweet.likes || 0);
		if (likes < MIN_SOCIAL_LIKES) return null;

		const media = Array.isArray(tweet.media?.all) ? tweet.media.all[0] : null;
		const mediaType = String(media?.type || '').toLowerCase();
		const isVideo = mediaType === 'video' || mediaType === 'gif';
		const thumb = String(media?.thumbnail_url || media?.url || '').trim();

		return {
			platform: 'x',
			contentType: isVideo ? 'video' : media ? 'photo' : 'text',
			title: oneLine(tweet.text || 'X post'),
			url: String(tweet.url || `https://x.com/owenminer/status/${statusId}`).trim(),
			thumbnail: thumb,
			embedUrl: isVideo ? String(media?.url || '').trim() : '',
			caption: String(tweet.text || '').trim(),
			publishedAt: String(tweet.created_at || '').trim(),
			viewCount: Number(tweet.views || 0),
			likeCount: likes,
			commentCount: Number(tweet.replies || 0),
			mediaKind: isVideo ? 'video' : media ? 'image' : 'text',
			aspectRatio: '',
		};
	} catch {
		return null;
	}
}

function passesYoutubeBar(item) {
	const likes = Number(item.likeCount || 0);
	const views = Number(item.viewCount || 0);
	return likes >= MIN_YT_LIKES && views >= MIN_YT_VIEWS;
}

function youtubeId(url) {
	const s = String(url || '');
	let m = s.match(/[?&]v=([^&]+)/);
	if (m) return m[1];
	m = s.match(/youtu\.be\/([^?&]+)/);
	if (m) return m[1];
	m = s.match(/\/shorts\/([^/?]+)/);
	return m ? m[1] : '';
}

function shortDisplayTitle(item) {
	const raw = oneLine(item.title || '');
	if (raw.length <= 72) return raw;
	return `${raw.slice(0, 69).trim()}…`;
}

function tileYoutubeShort(item) {
	const id = youtubeId(item.url);
	if (!id) return '';
	const title = escHtml(shortDisplayTitle(item));
	const embedTitle = escAttr(`${item.title}, YouTube Shorts`);
	return `\t\t\t\t\t\t<article class="home-yt-tile home-yt-tile--portrait" role="listitem">
\t\t\t\t\t\t\t<div class="home-yt-tile__media">
\t\t\t\t\t\t\t\t<iframe
\t\t\t\t\t\t\t\t\tdata-embed-src="https://www.youtube.com/embed/${escAttr(id)}"
\t\t\t\t\t\t\t\t\ttitle="${embedTitle}"
\t\t\t\t\t\t\t\t\tallow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
\t\t\t\t\t\t\t\t\treferrerpolicy="strict-origin-when-cross-origin"
\t\t\t\t\t\t\t\t\tallowfullscreen
\t\t\t\t\t\t\t\t></iframe>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<h3 class="home-yt-tile__title">${title}</h3>
\t\t\t\t\t\t</article>`;
}

function tileYoutubeVideo(item) {
	const id = youtubeId(item.url);
	if (!id) return '';
	const title = escHtml(shortDisplayTitle(item));
	const embedTitle = escAttr(`${item.title}, YouTube`);
	return `\t\t\t\t\t\t<article class="home-yt-tile home-yt-tile--landscape" role="listitem">
\t\t\t\t\t\t\t<div class="home-yt-tile__media">
\t\t\t\t\t\t\t\t<iframe
\t\t\t\t\t\t\t\t\tdata-embed-src="https://www.youtube.com/embed/${escAttr(id)}"
\t\t\t\t\t\t\t\t\ttitle="${embedTitle}"
\t\t\t\t\t\t\t\t\tallow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
\t\t\t\t\t\t\t\t\treferrerpolicy="strict-origin-when-cross-origin"
\t\t\t\t\t\t\t\t\tallowfullscreen
\t\t\t\t\t\t\t\t></iframe>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<h3 class="home-yt-tile__title">${title}</h3>
\t\t\t\t\t\t</article>`;
}

function xTweetId(url) {
	const m = String(url || '').match(/status\/(\d+)/);
	return m ? m[1] : '';
}

function tileXPost(item) {
	if (!passesSocialBar(item)) return '';
	const id = xTweetId(item.url);
	if (!id) return '';
	const title = escHtml(shortDisplayTitle(item));
	const embedTitle = escAttr(`${item.title}, X post`);
	const poster = escAttr(item.thumbnail || '');
	return `\t\t\t\t\t\t<article class="home-yt-tile home-yt-tile--portrait home-yt-tile--x" role="listitem">
\t\t\t\t\t\t\t<div class="home-yt-tile__media">
\t\t\t\t\t\t\t\t<iframe
\t\t\t\t\t\t\t\t\tdata-embed-src="https://platform.twitter.com/embed/Tweet.html?id=${escAttr(id)}&amp;theme=dark&amp;dnt=true"
\t\t\t\t\t\t\t\t\tdata-embed-poster="${poster}"
\t\t\t\t\t\t\t\t\ttitle="${embedTitle}"
\t\t\t\t\t\t\t\t\tallow="fullscreen"
\t\t\t\t\t\t\t\t\treferrerpolicy="strict-origin-when-cross-origin"
\t\t\t\t\t\t\t\t></iframe>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<h3 class="home-yt-tile__title">${title}</h3>
\t\t\t\t\t\t</article>`;
}

function redditMediaEmbedUrl(url) {
	const raw = String(url || '').trim();
	if (!raw) return '';
	try {
		const parsed = new URL(raw);
		const host = parsed.hostname.toLowerCase();
		if (!host.endsWith('reddit.com')) return '';
		const pathname = parsed.pathname.replace(/\/+$/, '');
		if (!pathname || pathname.split('/').length < 4) return '';
		return `https://www.redditmedia.com${pathname}?ref_source=embed&ref=share&embed=true`;
	} catch {
		return '';
	}
}

function tileRedditPost(item) {
	const postUrl = String(item.url || '').trim();
	const embedSrc = redditMediaEmbedUrl(postUrl);
	if (!embedSrc) return '';
	const postId = redditPostIdFromUrl(postUrl);
	const displayTitle = oneLine(item.title || postUrl);
	if (!displayTitle) return '';
	const title = escHtml(shortDisplayTitle({ title: displayTitle }));
	const embedTitle = escAttr(`${displayTitle}, Reddit post`);
	const poster = escAttr(
		item.thumbnail || (postId ? `/Socials/images/content-thumbs/reddit/${postId}.jpg` : ''),
	);
	if (!poster) return '';
	return `\t\t\t\t\t\t<article class="home-yt-tile home-yt-tile--landscape home-yt-tile--reddit" role="listitem">
\t\t\t\t\t\t\t<div class="home-yt-tile__media home-yt-tile__media--reddit">
\t\t\t\t\t\t\t\t<iframe
\t\t\t\t\t\t\t\t\tdata-embed-src="${escAttr(embedSrc)}"
\t\t\t\t\t\t\t\t\tdata-embed-poster="${poster}"
\t\t\t\t\t\t\t\t\ttitle="${embedTitle}"
\t\t\t\t\t\t\t\t\tallow="fullscreen"
\t\t\t\t\t\t\t\t\treferrerpolicy="strict-origin-when-cross-origin"
\t\t\t\t\t\t\t\t></iframe>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<h3 class="home-yt-tile__title">${title}</h3>
\t\t\t\t\t\t</article>`;
}

function tiktokVideoId(url) {
	const match = String(url || '').match(/\/video\/(\d+)/i);
	return match ? match[1] : '';
}

function tileTikTok(item) {
	const likes = Number(item.likeCount || item.diggCount || 0);
	if (likes < MIN_SOCIAL_LIKES) return '';
	const id = tiktokVideoId(item.url);
	if (!id) return '';
	const displayTitle = oneLine(item.title || item.caption || 'TikTok');
	if (!displayTitle) return '';
	const title = escHtml(shortDisplayTitle({ title: displayTitle }));
	const embedTitle = escAttr(`${displayTitle}, TikTok`);
	const poster = escAttr(
		item.thumbnail || `/Socials/images/content-thumbs/tiktok/${id}.jpg`,
	);
	const embedSrc = escAttr(
		`https://www.tiktok.com/player/v1/${id}?controls=1&progress_bar=1&play_button=1`,
	);
	return `\t\t\t\t\t\t<article class="home-yt-tile home-yt-tile--portrait home-yt-tile--tiktok" role="listitem">
\t\t\t\t\t\t\t<div class="home-yt-tile__media">
\t\t\t\t\t\t\t\t<iframe
\t\t\t\t\t\t\t\t\tdata-embed-src="${embedSrc}"
\t\t\t\t\t\t\t\t\tdata-embed-poster="${poster}"
\t\t\t\t\t\t\t\t\ttitle="${embedTitle}"
\t\t\t\t\t\t\t\t\tallow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
\t\t\t\t\t\t\t\t\treferrerpolicy="origin-when-cross-origin"
\t\t\t\t\t\t\t\t\tallowfullscreen
\t\t\t\t\t\t\t\t></iframe>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<h3 class="home-yt-tile__title">${title}</h3>
\t\t\t\t\t\t</article>`;
}

function tileInstagramReel(item) {
	const url = String(item.url || '').trim();
	if (!/\/reel\//i.test(url)) return '';
	const title = escHtml(shortDisplayTitle(item));
	const postUrl = escAttr(url);
	const thumb = escAttr(item.thumbnail || '');
	const alt = escAttr(shortDisplayTitle(item));
	const embedSrc = escAttr(item.embedUrl || '');
	if (embedSrc) {
		return `\t\t\t\t\t\t<article class="home-yt-tile home-yt-tile--portrait home-yt-tile--instagram" role="listitem">
\t\t\t\t\t\t\t<div class="home-yt-tile__media">
\t\t\t\t\t\t\t\t<iframe
\t\t\t\t\t\t\t\t\tdata-embed-src="${embedSrc}"
\t\t\t\t\t\t\t\t\tdata-embed-poster="${thumb}"
\t\t\t\t\t\t\t\t\ttitle="${escAttr(`${item.title}, Instagram reel`)}"
\t\t\t\t\t\t\t\t\tallow="fullscreen; encrypted-media; picture-in-picture"
\t\t\t\t\t\t\t\t\treferrerpolicy="strict-origin-when-cross-origin"
\t\t\t\t\t\t\t\t\tallowfullscreen
\t\t\t\t\t\t\t\t></iframe>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<h3 class="home-yt-tile__title">${title}</h3>
\t\t\t\t\t\t</article>`;
	}
	return `\t\t\t\t\t\t<article class="home-yt-tile home-yt-tile--portrait home-yt-tile--instagram" role="listitem">
\t\t\t\t\t\t\t<div class="home-yt-tile__media">
\t\t\t\t\t\t\t\t<a class="home-yt-tile__post-link" href="${postUrl}" target="_blank" rel="noopener noreferrer">
\t\t\t\t\t\t\t\t\t<img src="${thumb}" alt="${alt}" loading="lazy" decoding="async" />
\t\t\t\t\t\t\t\t</a>
\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t<h3 class="home-yt-tile__title">${title}</h3>
\t\t\t\t\t\t</article>`;
}

async function loadVerifiedXPosts(existingPosts) {
	const byUrl = new Map();
	for (const item of existingPosts) {
		if (item?.url && passesSocialBar(item)) byUrl.set(item.url, item);
	}

	const statusIds = new Set(X_VERIFIED_STATUS_IDS);
	for (const item of existingPosts) {
		const statusId = xTweetId(item?.url);
		if (statusId) statusIds.add(statusId);
	}

	for (const statusId of statusIds) {
		const item = await fetchFxTweet(statusId);
		if (item) byUrl.set(item.url, item);
	}

	return [...byUrl.values()].sort((a, b) => {
		const likeDelta = Number(b.likeCount || 0) - Number(a.likeCount || 0);
		if (likeDelta) return likeDelta;
		return engagementScore(b) - engagementScore(a);
	});
}

function rowBlock({ label, id, orientation, tiles }) {
	if (!tiles.length) return '';
	const orientClass = orientation === 'landscape' ? 'home-yt-row--landscape' : 'home-yt-row--portrait';
	return `\t\t\t\t\t<div class="home-yt-row-group">
\t\t\t\t\t\t<h3 class="home-yt-row-label" id="${escAttr(id)}">${escHtml(label)}</h3>
\t\t\t\t\t\t<div class="home-yt-row ${orientClass}" role="list" aria-labelledby="${escAttr(id)}">
${tiles.join('\n')}
\t\t\t\t\t\t</div>
\t\t\t\t\t</div>`;
}

const shorts = readJson('Socials/data/youtube-shorts.json')
	.filter(passesYoutubeBar)
	.sort((a, b) => engagementScore(b) - engagementScore(a))
	.map(tileYoutubeShort)
	.filter(Boolean);

const videos = readJson('Socials/data/youtube-videos.json')
	.filter(passesYoutubeBar)
	.sort((a, b) => engagementScore(b) - engagementScore(a))
	.map(tileYoutubeVideo)
	.filter(Boolean);

const xPosts = (await loadVerifiedXPosts(readJson('Socials/data/x-top-posts.json')))
	.map(tileXPost)
	.filter(Boolean);

const redditPosts = (await loadHomeRedditPosts(readJson('Socials/data/reddit-posts.json')))
	.map(tileRedditPost)
	.filter(Boolean);

const tiktokPosts = readJson('Socials/data/tiktok-posts.json')
	.filter((item) => Number(item.likeCount || item.diggCount || 0) >= MIN_SOCIAL_LIKES)
	.sort((a, b) => engagementScore(b) - engagementScore(a))
	.map(tileTikTok)
	.filter(Boolean);

const instagramReels = readJson('Socials/data/instagram-posts.json')
	.filter((item) => /\/reel\//i.test(String(item.url || '')))
	.filter((item) => {
		const likes = Number(item.likeCount || 0);
		const views = Number(item.viewCount || 0);
		return likes >= MIN_YT_LIKES || views >= MIN_YT_VIEWS;
	})
	.sort((a, b) => engagementScore(b) - engagementScore(a))
	.map(tileInstagramReel)
	.filter(Boolean);

const mosaic = [
	rowBlock({
		label: 'YouTube Shorts',
		id: 'home-yt-row-shorts',
		orientation: 'portrait',
		tiles: shorts,
	}),
	rowBlock({
		label: 'YouTube (16:9)',
		id: 'home-yt-row-longform',
		orientation: 'landscape',
		tiles: videos,
	}),
	rowBlock({
		label: 'TikTok',
		id: 'home-yt-row-tiktok',
		orientation: 'portrait',
		tiles: tiktokPosts,
	}),
	rowBlock({
		label: 'X posts and replies',
		id: 'home-yt-row-x',
		orientation: 'portrait',
		tiles: xPosts,
	}),
	rowBlock({
		label: 'Reddit posts',
		id: 'home-yt-row-reddit',
		orientation: 'landscape',
		tiles: redditPosts,
	}),
	rowBlock({
		label: 'Instagram reels',
		id: 'home-yt-row-instagram',
		orientation: 'portrait',
		tiles: instagramReels,
	}),
]
	.filter(Boolean)
	.join('\n');

const mosaicHtml = `\t\t\t\t<div class="home-yt-mosaic">
${mosaic}
\t\t\t\t</div>`;

const full = fs.readFileSync(indexPath, 'utf8');

const mosaicStart = full.indexOf('<div class="home-yt-mosaic">');

// Close mosaic: find the </div> that closes home-yt-mosaic (before site-feed-section)
const feedSection = full.indexOf('<section class="intro site-feed-section"', mosaicStart);
const mosaicClose = full.lastIndexOf('\t\t\t\t</div>', feedSection);
if (mosaicClose === -1) throw new Error('Could not locate home-yt-mosaic closing tag.');

let updated = full.slice(0, mosaicStart) + mosaicHtml + full.slice(mosaicClose + '\t\t\t\t</div>'.length);

updated = updated.replace(
	/<h2 id="home-yt-heading">[\s\S]*?<\/h2>\s*<p class="home-yt-lede">[\s\S]*?<\/p>/,
	`<h2 id="home-yt-heading">Top performing clips</h2>
\t\t\t\t\t<p class="home-yt-lede">
\t\t\t\t\t\t<a href="https://www.youtube.com/@OwenMinerCS" target="_blank" rel="noopener noreferrer"
\t\t\t\t\t\t\t>YouTube @OwenMinerCS</a
\t\t\t\t\t\t>
\t\t\t\t\t\tShorts and 16:9,
\t\t\t\t\t\t<a href="https://www.tiktok.com/@owenminercs" target="_blank" rel="noopener noreferrer">TikTok</a>,
\t\t\t\t\t\t<a href="https://x.com/OwenMiner" target="_blank" rel="noopener noreferrer">X</a>,
\t\t\t\t\t\t<a href="https://www.reddit.com/user/OwenMCS" target="_blank" rel="noopener noreferrer">Reddit</a>, and
\t\t\t\t\t\t<a href="https://www.instagram.com/owenminercs/" target="_blank" rel="noopener noreferrer"
\t\t\t\t\t\t\t>Instagram</a
\t\t\t\t\t\t>
\t\t\t\t\t\treels with the highest views and engagement. More on the
\t\t\t\t\t\t<a href="Gaming/cs2-videos.html">CS2 videos page</a>.
\t\t\t\t\t</p>`,
);

fs.writeFileSync(indexPath, updated);

console.log(
	`sync-home-top-clips: ${shorts.length} Shorts, ${videos.length} long-form, ${tiktokPosts.length} TikTok, ${xPosts.length} X, ${redditPosts.length} Reddit, ${instagramReels.length} Instagram reels`,
);
