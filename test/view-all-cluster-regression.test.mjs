import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function readCards(html) {
	const chunks = String(html).split('<div class="keep-card keep-card--static"').slice(1);
	return chunks.map((chunk) => {
		const title = chunk.match(/class="keep-card__label">([^<]*)<\/p>/)?.[1] ?? '';
		const slot = chunk.match(/class="keep-card__video-slot">([^<]*)<\/div>/)?.[1] ?? '';
		const thumbHref = chunk.match(/class="vac-thumb-link" href="([^"]*)"/)?.[1] ?? '';
		const platforms = [
			...chunk.matchAll(/class="vac-platform-btn" href="([^"]*)"[^>]*>([^<]*)<\/a>/g),
		].map((match) => ({
			href: match[1],
			label: match[2],
		}));
		return { title, slot, thumbHref, platforms };
	});
}

async function renderViewAll(feeds) {
	const source = readWorkspaceFile('Socials/scripts/view-all-content.js');
	assert.match(source, /main\(\)\.catch\(/);
	const patched = source.replace('main().catch(', 'globalThis.__viewAllReady = main().catch(');
	const board = { innerHTML: '' };
	const statusEl = { textContent: '' };
	const sandbox = {
		document: {
			getElementById(id) {
				if (id === 'viewAllContentBoard') return board;
				if (id === 'viewAllContentStatus') return statusEl;
				return null;
			},
		},
		fetch: async (url) => {
			const key = String(url);
			if (!Object.prototype.hasOwnProperty.call(feeds, key)) {
				return { ok: false, status: 404 };
			}
			return {
				ok: true,
				json: async () => feeds[key],
			};
		},
		console,
	};

	vm.runInNewContext(patched, sandbox);
	await sandbox.__viewAllReady;
	return { html: board.innerHTML, status: statusEl.textContent, cards: readCards(board.innerHTML) };
}

test('view-all groups cross-posts by id, same-day window, and title, and keeps non-matches apart', async () => {
	const watchKeyboard = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
	const shortsKeyboard = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';
	const duplicateUrl = 'https://www.youtube.com/watch?v=uniqueVid01';
	const otherYoutube = 'https://www.youtube.com/watch?v=otherVid9999';
	const xssUrl = 'https://www.youtube.com/watch?v=xssvid0001';
	const tiktokDesk = 'https://www.tiktok.com/@owen/video/111';
	const xDesk = 'https://x.com/owen/status/222';
	const tiktokClip = 'https://www.tiktok.com/@owen/video/333';
	const xClip = 'https://x.com/owen/status/444';
	const tiktokWords = 'https://www.tiktok.com/@owen/video/555';
	const photoWords = 'https://www.instagram.com/p/DDD/';
	const morningReel = 'https://www.instagram.com/reel/AAA/';
	const rankedReel = 'https://www.instagram.com/reel/CCC/';
	const lateFacebook = 'https://facebook.com/watch/BBB';
	const twitchRanked = 'https://www.twitch.tv/videos/999';
	const boundaryTiktok = 'https://www.tiktok.com/@owen/video/777';
	const boundaryX = 'https://x.com/owen/status/888';

	const { html, status, cards } = await renderViewAll({
		'data/youtube-videos.json': [
			{
				platform: 'youtube',
				url: watchKeyboard,
				title: 'Keyboard sound test long',
				publishedAt: '2026-01-15T12:00:00.000Z',
				contentType: 'video',
				thumbnail: 'https://img.example/kb.jpg',
			},
			{
				platform: 'youtube',
				url: duplicateUrl,
				title: 'First copy',
				publishedAt: '2026-02-02T00:00:00.000Z',
				contentType: 'video',
			},
			{
				platform: 'youtube',
				url: duplicateUrl,
				title: 'Second copy',
				publishedAt: '2026-02-02T01:00:00.000Z',
				contentType: 'video',
			},
			{
				platform: 'youtube',
				url: otherYoutube,
				title: 'Another keyboard recording',
				publishedAt: '2026-01-15T12:00:00.000Z',
				contentType: 'video',
			},
			{
				platform: 'youtube',
				url: xssUrl,
				title: '<img src=x onerror=alert(1)>',
				publishedAt: '2026-08-01T00:00:00.000Z',
				contentType: 'video',
			},
			{ title: 'missing url', platform: 'youtube' },
			null,
		],
		'data/youtube-shorts.json': [
			{
				platform: 'youtube',
				url: shortsKeyboard,
				title: 'Keyboard sound test',
				publishedAt: '2026-01-15T12:01:00.000Z',
				contentType: 'short',
			},
		],
		'data/tiktok-posts.json': [
			{
				url: tiktokDesk,
				title: 'Desk tour',
				publishedAt: '2026-06-02T08:00:00.000Z',
			},
			{
				url: tiktokClip,
				title: 'CS clip',
				publishedAt: '2026-04-01T00:00:00.000Z',
			},
			{
				url: tiktokWords,
				title: 'Same words for both posts',
				publishedAt: '2026-07-01T11:00:00.000Z',
			},
			{
				url: boundaryTiktok,
				title: 'Boundary title for clustering',
				publishedAt: '2026-04-20T00:00:00.000Z',
			},
		],
		'data/x-top-posts.json': {
			items: [
				{
					platform: 'twitter',
					url: xDesk,
					title: 'Totally different caption',
					publishedAt: '2026-06-02T20:00:00.000Z',
					mediaKind: 'video',
				},
				{
					platform: 'x',
					url: xClip,
					title: 'CS clip',
					publishedAt: '2026-04-08T00:00:00.000Z',
					mediaKind: 'video',
				},
				{
					platform: 'x',
					url: boundaryX,
					title: 'Boundary title for clustering',
					publishedAt: '2026-05-04T00:00:00.001Z',
					mediaKind: 'video',
				},
			],
		},
		'data/instagram-posts.json': [
			{
				url: morningReel,
				title: 'Morning reel about switches',
				publishedAt: '2026-03-01T00:30:00.000Z',
			},
			{
				url: rankedReel,
				title: 'Ranked night on Ancient!!!',
				publishedAt: '2026-05-12T12:00:00.000Z',
			},
			{
				url: photoWords,
				title: 'Same words for both posts',
				publishedAt: '2026-07-01T10:00:00.000Z',
				mediaKind: 'image',
				contentType: 'photo',
			},
			{
				platform: 'facebook',
				url: lateFacebook,
				title: 'Late night ranked demo',
				publishedAt: '2026-03-01T23:45:00.000Z',
				mediaKind: 'video',
			},
		],
		'data/twitch-posts.json': [
			{
				url: twitchRanked,
				title: 'Ranked night on Ancient',
				publishedAt: '2026-05-01T12:00:00.000Z',
				mediaKind: 'video',
			},
		],
	});

	assert.equal(status, '14 grouped posts (18 total items from feeds).');
	assert.equal(html.includes('<img src=x'), false);
	assert.equal(html.includes('&lt;img src=x onerror=alert(1)&gt;'), true);
	assert.equal(html.includes('vac-error'), false);
	assert.equal(cards.length, 14);

	assert.deepEqual(cards[0], {
		title: '&lt;img src=x onerror=alert(1)&gt;',
		slot: 'YouTube',
		thumbHref: '',
		platforms: [{ href: xssUrl, label: 'YouTube' }],
	});

	assert.deepEqual(cards[1], {
		title: 'Same words for both posts',
		slot: 'TikTok',
		thumbHref: '',
		platforms: [{ href: tiktokWords, label: 'TikTok' }],
	});
	assert.deepEqual(cards[2], {
		title: 'Same words for both posts',
		slot: 'Instagram',
		thumbHref: '',
		platforms: [{ href: photoWords, label: 'Instagram' }],
	});

	assert.deepEqual(cards[3], {
		title: 'Totally different caption',
		slot: 'Cross-post · 2 places',
		thumbHref: '',
		platforms: [
			{ href: tiktokDesk, label: 'TikTok' },
			{ href: xDesk, label: 'X' },
		],
	});

	assert.deepEqual(cards[4], {
		title: 'Ranked night on Ancient!!!',
		slot: 'Cross-post · 2 places',
		thumbHref: '',
		platforms: [
			{ href: rankedReel, label: 'Instagram' },
			{ href: twitchRanked, label: 'Twitch' },
		],
	});

	assert.deepEqual(cards[5], {
		title: 'Boundary title for clustering',
		slot: 'X',
		thumbHref: '',
		platforms: [{ href: boundaryX, label: 'X' }],
	});
	assert.deepEqual(cards[6], {
		title: 'Boundary title for clustering',
		slot: 'TikTok',
		thumbHref: '',
		platforms: [{ href: boundaryTiktok, label: 'TikTok' }],
	});

	assert.deepEqual(cards[7], {
		title: 'CS clip',
		slot: 'X',
		thumbHref: '',
		platforms: [{ href: xClip, label: 'X' }],
	});
	assert.deepEqual(cards[8], {
		title: 'CS clip',
		slot: 'TikTok',
		thumbHref: '',
		platforms: [{ href: tiktokClip, label: 'TikTok' }],
	});

	assert.deepEqual(cards[9], {
		title: 'Late night ranked demo',
		slot: 'Facebook',
		thumbHref: '',
		platforms: [{ href: lateFacebook, label: 'Facebook' }],
	});
	assert.deepEqual(cards[10], {
		title: 'Morning reel about switches',
		slot: 'Instagram',
		thumbHref: '',
		platforms: [{ href: morningReel, label: 'Instagram' }],
	});

	assert.deepEqual(cards[11], {
		title: 'Second copy',
		slot: 'Cross-post · 2 places',
		thumbHref: '',
		platforms: [{ href: duplicateUrl, label: 'YouTube' }],
	});

	assert.deepEqual(cards[12], {
		title: 'Keyboard sound test long',
		slot: 'Cross-post · 2 places',
		thumbHref: watchKeyboard,
		platforms: [
			{ href: watchKeyboard, label: 'YouTube' },
			{ href: shortsKeyboard, label: 'YouTube Short' },
		],
	});
	assert.deepEqual(cards[13], {
		title: 'Another keyboard recording',
		slot: 'YouTube',
		thumbHref: '',
		platforms: [{ href: otherYoutube, label: 'YouTube' }],
	});
});

test('view-all keeps rendering when a feed file is missing and skips a page with no board', async () => {
	const { status, cards } = await renderViewAll({
		'data/youtube-videos.json': {
			items: [
				{
					url: 'https://www.youtube.com/watch?v=onlyOneVid',
					title: 'Only item',
					publishedAt: '2026-01-01T00:00:00.000Z',
				},
			],
		},
	});

	assert.equal(status, '1 grouped posts (1 total items from feeds).');
	assert.equal(cards.length, 1);
	assert.equal(cards[0].title, 'Only item');
	assert.equal(cards[0].platforms[0].label, 'YouTube');

	const source = readWorkspaceFile('Socials/scripts/view-all-content.js');
	const sandbox = {
		document: {
			getElementById() {
				return null;
			},
		},
		fetch() {
			throw new Error('fetch should not run without a board');
		},
	};
	assert.doesNotThrow(() => vm.runInNewContext(source, sandbox));
});
