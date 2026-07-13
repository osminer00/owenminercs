import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const PROFILE_URL = 'https://www.instagram.com/owenminercs/';
const USERNAME = 'owenminercs';
const MAX_ITEMS = 120;
const YT_DLP_BASE_ARGS = ['--no-update', '--ignore-errors', '--skip-download', '--dump-json'];

function getRepoRoot() {
	const currentFilePath = fileURLToPath(import.meta.url);
	return resolve(dirname(currentFilePath), '..');
}

function safeNumber(value) {
	const parsed = Number.parseInt(String(value ?? ''), 10);
	return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePublishedAt(entry) {
	if (entry?.timestamp) {
		const fromUnix = new Date(Number(entry.timestamp) * 1000);
		if (!Number.isNaN(fromUnix.getTime())) return fromUnix.toISOString();
	}
	const uploadDate = String(entry?.upload_date || '').trim();
	if (/^\d{8}$/.test(uploadDate)) {
		const iso = `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}T00:00:00.000Z`;
		const parsed = new Date(iso);
		if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
	}
	return '';
}

function normalizeRatio(width, height, fallback = '9 / 16') {
	const w = Number(width || 0);
	const h = Number(height || 0);
	if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
		return `${Math.round(w)} / ${Math.round(h)}`;
	}
	return fallback;
}

function parseJsonLines(stdout) {
	return String(stdout || '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => {
			try {
				return JSON.parse(line);
			} catch {
				return null;
			}
		})
		.filter(Boolean);
}

function spawnCommand(command, args) {
	return new Promise((resolvePromise, rejectPromise) => {
		const child = spawn(command, args, {
			shell: process.platform === 'win32',
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk) => {
			stdout += String(chunk);
		});
		child.stderr.on('data', (chunk) => {
			stderr += String(chunk);
		});
		child.on('error', (error) => rejectPromise(error));
		child.on('close', (code) => {
			resolvePromise({ code: Number(code || 0), stdout, stderr });
		});
	});
}

async function runYtDlp(maxItems = MAX_ITEMS) {
	const args = [...YT_DLP_BASE_ARGS, '--playlist-end', String(maxItems), PROFILE_URL];
	const commandCandidates = [
		{ command: 'yt-dlp', commandArgs: args },
		{ command: 'py', commandArgs: ['-m', 'yt_dlp', ...args] },
		{ command: 'python', commandArgs: ['-m', 'yt_dlp', ...args] },
	];
	let lastErrorText = '';
	for (const candidate of commandCandidates) {
		const result = await spawnCommand(candidate.command, candidate.commandArgs);
		const entries = parseJsonLines(result.stdout);
		if (entries.length > 0) {
			return entries;
		}
		const stderrText = String(result.stderr || '').trim();
		if (stderrText) lastErrorText = stderrText;
	}
	throw new Error(
		`Could not run yt-dlp for Instagram. Last error: ${lastErrorText || 'Unknown execution failure.'}`,
	);
}

const IG_WEB_HEADERS = {
	'User-Agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
	'X-IG-App-ID': '936619743392459',
	Accept: '*/*',
	'Accept-Language': 'en-US,en;q=0.9',
	Referer: PROFILE_URL,
};

function normalizeInstagramApiNode(node) {
	const shortcode = String(node?.shortcode || node?.code || '').trim();
	if (!shortcode) return null;
	const isVideo = Boolean(node?.is_video);
	const isReel = isVideo || Number(node?.product_type) === 0;
	const caption =
		String(node?.edge_media_to_caption?.edges?.[0]?.node?.text || node?.caption || '').trim() ||
		'Instagram post';
	const thumbnail =
		String(
			node?.thumbnail_src ||
				node?.display_url ||
				node?.thumbnail_resources?.[node.thumbnail_resources.length - 1]?.src ||
				'',
		).trim();
	const likeCount = safeNumber(node?.edge_liked_by?.count ?? node?.like_count);
	const viewCount = safeNumber(node?.video_view_count ?? node?.play_count ?? node?.view_count);
	const timestamp = safeNumber(node?.taken_at_timestamp ?? node?.taken_at);
	const width = safeNumber(node?.dimensions?.width ?? node?.original_width);
	const height = safeNumber(node?.dimensions?.height ?? node?.original_height);
	const pathKind = isReel ? 'reel' : 'p';
	return {
		platform: 'instagram',
		contentType: isReel ? 'reel' : 'photo',
		title: caption.slice(0, 120),
		url: `https://www.instagram.com/${pathKind}/${encodeURIComponent(shortcode)}/`,
		thumbnail,
		embedUrl: '',
		caption,
		publishedAt: timestamp > 0 ? new Date(timestamp * 1000).toISOString() : '',
		viewCount,
		likeCount,
		commentCount: safeNumber(node?.edge_media_to_comment?.count ?? node?.comment_count),
		mediaKind: isVideo ? 'video' : 'image',
		aspectRatio: normalizeRatio(width, height, isReel ? '9 / 16' : '1 / 1'),
	};
}

async function fetchInstagramViaWebApi(maxItems = MAX_ITEMS) {
	const apiUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(USERNAME)}`;
	const response = await fetch(apiUrl, { headers: IG_WEB_HEADERS });
	if (!response.ok) {
		throw new Error(`Instagram web_profile_info failed: ${response.status} ${response.statusText}`);
	}
	const payload = await response.json().catch(() => ({}));
	const edges = payload?.data?.user?.edge_owner_to_timeline_media?.edges || [];
	const normalized = edges
		.map((edge) => normalizeInstagramApiNode(edge?.node || {}))
		.filter(Boolean)
		.sort(
			(a, b) =>
				Number(b.viewCount || 0) - Number(a.viewCount || 0) ||
				Number(b.likeCount || 0) - Number(a.likeCount || 0),
		)
		.slice(0, maxItems);
	if (!normalized.length) {
		throw new Error('Instagram web_profile_info returned no timeline posts.');
	}
	return normalized;
}

function sortInstagramPosts(items) {
	return [...items].sort(
		(a, b) =>
			Number(b.viewCount || 0) - Number(a.viewCount || 0) ||
			Number(b.likeCount || 0) - Number(a.likeCount || 0),
	);
}

function normalizeInstagramEntry(entry) {
	const webpageUrl = String(entry?.webpage_url || entry?.url || '').trim();
	if (!webpageUrl.includes('instagram.com')) return null;
	const likeCount = safeNumber(entry?.like_count);
	const isReel = /\/reel\//i.test(webpageUrl);
	const title = String(entry?.title || entry?.description || '').trim() || 'Instagram post';
	const thumbnail = String(entry?.thumbnail || '').trim();
	const width = safeNumber(entry?.width);
	const height = safeNumber(entry?.height);
	return {
		platform: 'instagram',
		contentType: isReel ? 'reel' : 'photo',
		title: title.slice(0, 120),
		url: webpageUrl,
		thumbnail,
		embedUrl: '',
		caption: String(entry?.description || '').trim(),
		publishedAt: normalizePublishedAt(entry),
		viewCount: safeNumber(entry?.view_count ?? entry?.play_count),
		likeCount,
		commentCount: safeNumber(entry?.comment_count),
		mediaKind: isReel ? 'video' : 'image',
		aspectRatio: normalizeRatio(width, height, isReel ? '9 / 16' : '1 / 1'),
	};
}

async function readExistingPosts(path) {
	try {
		const raw = await readFile(path, 'utf8');
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

async function writeJson(path, payload) {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function main() {
	const root = getRepoRoot();
	const outPath = resolve(root, 'Socials/data/instagram-posts.json');
	const existing = await readExistingPosts(outPath);

	try {
		let normalized = [];
		try {
			const raw = await runYtDlp(MAX_ITEMS);
			normalized = raw.map(normalizeInstagramEntry).filter(Boolean);
		} catch (ytDlpError) {
			console.warn(
				`[instagram-local-sync] yt-dlp unavailable (${String(ytDlpError?.message || ytDlpError)}); trying Instagram web API.`,
			);
			normalized = await fetchInstagramViaWebApi(MAX_ITEMS);
		}
		normalized = sortInstagramPosts(normalized);
		if (normalized.length === 0 && existing.length > 0) {
			console.error(
				`[instagram-local-sync] yt-dlp returned 0 qualifying posts; preserving ${existing.length} existing post(s).`,
			);
			process.exitCode = 1;
			return;
		}
		await writeJson(outPath, normalized);
		console.log(`[instagram-local-sync] wrote ${normalized.length} posts -> Socials/data/instagram-posts.json`);
	} catch (error) {
		if (existing.length > 0) {
			console.error('[instagram-local-sync] failed:', String(error?.message || error));
			console.error(
				`[instagram-local-sync] preserving ${existing.length} existing post(s) in Socials/data/instagram-posts.json`,
			);
			process.exitCode = 1;
			return;
		}
		console.error('[instagram-local-sync] failed:', String(error?.message || error));
		console.error(
			'[instagram-local-sync] Instagram extraction is often blocked by yt-dlp; add posts manually to Socials/data/instagram-posts.json or retry after updating yt-dlp.',
		);
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error('[instagram-local-sync] failed:', String(error?.message || error));
	process.exitCode = 1;
});
