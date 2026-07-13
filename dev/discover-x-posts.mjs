/**
 * Discover OwenMiner X status IDs from profile mirrors + repo, enrich via fxtwitter.
 *   node dev/discover-x-posts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIN_LIKES = 100;
const MAX_ITEMS = 20;

function collectStatusIdsFromText(text) {
	const ids = new Set();
	for (const match of String(text).matchAll(/status\/(\d{10,})/gi)) ids.add(match[1]);
	for (const match of String(text).matchAll(/Tweet\.html\?id=(\d{10,})/gi)) ids.add(match[1]);
	return ids;
}

function walkRepoFiles(dir, out = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'package') continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) walkRepoFiles(full, out);
		else if (/\.(html|json|js|mjs|md)$/i.test(entry.name)) out.push(full);
	}
	return out;
}

function collectRepoStatusIds() {
	const ids = new Set();
	for (const file of walkRepoFiles(root)) {
		try {
			const text = fs.readFileSync(file, 'utf8');
			for (const id of collectStatusIdsFromText(text)) ids.add(id);
		} catch {
			// ignore
		}
	}
	return ids;
}

async function collectMirrorStatusIds() {
	const ids = new Set();
	const urls = [
		'https://zamantika.com/profile/owenminer',
		'https://xcancel.com/owenminer/rss',
		'https://nitter.net/owenminer/rss',
	];
	for (const url of urls) {
		try {
			const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
			if (!response.ok) continue;
			const text = await response.text();
			for (const id of collectStatusIdsFromText(text)) ids.add(id);
		} catch {
			// ignore
		}
	}
	return ids;
}

function truncateText(text, maxLen = 120) {
	const compact = String(text || '').replace(/\s+/g, ' ').trim();
	if (compact.length <= maxLen) return compact;
	return `${compact.slice(0, maxLen - 3).trim()}...`;
}

function normalizeRatio(width, height) {
	const w = Number(width);
	const h = Number(height);
	if (!w || !h) return '';
	return `${Math.round(w)} / ${Math.round(h)}`;
}

function selectPrimaryMedia(tweet) {
	const all = tweet?.media?.all;
	if (!Array.isArray(all)) return null;
	return all.find((m) => ['photo', 'video', 'gif'].includes(String(m?.type || '').toLowerCase())) || null;
}

function buildContentItem(tweet) {
	const author = String(tweet?.author?.screen_name || '').toLowerCase();
	if (!['owenminer', 'owenminercs'].includes(author)) return null;

	const likes = Number(tweet?.likes || 0);
	if (likes < MIN_LIKES) return null;

	const primaryMedia = selectPrimaryMedia(tweet);
	const mediaType = String(primaryMedia?.type || '').toLowerCase();
	const isVideo = mediaType === 'video' || mediaType === 'gif';
	const thumb = String(primaryMedia?.thumbnail_url || primaryMedia?.url || '').trim();
	const videoUrl = isVideo ? String(primaryMedia?.url || '').trim() : '';
	const tweetText = String(tweet?.text || '').trim() || 'X post';
	const isReply = Boolean(tweet?.replying_to || tweet?.reply_to);

	return {
		platform: 'x',
		contentType: isVideo ? 'video' : primaryMedia ? 'photo' : 'text',
		title: truncateText(tweetText),
		url: String(tweet?.url || `https://x.com/${tweet?.author?.screen_name || 'owenminer'}/status/${tweet?.id || ''}`).trim(),
		thumbnail: thumb,
		embedUrl: videoUrl,
		caption: tweetText,
		publishedAt: String(tweet?.created_at || '').trim(),
		viewCount: Number(tweet?.views || 0),
		likeCount: likes,
		commentCount: Number(tweet?.replies || 0),
		mediaKind: isVideo ? 'video' : primaryMedia ? 'image' : 'text',
		aspectRatio: normalizeRatio(primaryMedia?.width, primaryMedia?.height),
		isReply,
	};
}

async function fetchTweet(statusId) {
	for (const user of ['OwenMiner', 'OwenMinerCS']) {
		try {
			const response = await fetch(`https://api.fxtwitter.com/${user}/status/${statusId}`);
			if (!response.ok) continue;
			const payload = await response.json();
			if (payload?.tweet) return payload.tweet;
		} catch {
			// ignore
		}
	}
	return null;
}

async function main() {
	const repoIds = collectRepoStatusIds();
	const mirrorIds = await collectMirrorStatusIds();
	const statusIds = [...new Set([...repoIds, ...mirrorIds])];
	console.log(`Scanning ${statusIds.length} status ID(s)...`);

	const byUrl = new Map();
	for (const statusId of statusIds) {
		const tweet = await fetchTweet(statusId);
		if (!tweet) continue;
		const item = buildContentItem(tweet);
		if (!item) continue;
		byUrl.set(item.url, item);
		await new Promise((resolve) => setTimeout(resolve, 120));
	}

	const posts = [...byUrl.values()]
		.sort((a, b) => {
			const likeDelta = Number(b.likeCount) - Number(a.likeCount);
			if (likeDelta) return likeDelta;
			return Number(b.viewCount) - Number(a.viewCount);
		})
		.slice(0, MAX_ITEMS)
		.map(({ isReply, ...item }) => item);

	const outPath = path.join(root, 'Socials/data/x-top-posts.json');
	fs.writeFileSync(outPath, `${JSON.stringify(posts, null, 2)}\n`, 'utf8');

	const likes = posts.map((p) => p.likeCount);
	console.log(`Wrote ${posts.length} post(s) to ${outPath}`);
	if (likes.length) {
		console.log(`Like range: ${Math.min(...likes)} – ${Math.max(...likes)}`);
		console.log(
			posts.map((p) => `${p.likeCount}\t${p.title}`).join('\n'),
		);
	} else {
		console.log('No posts met the 100+ likes threshold.');
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
