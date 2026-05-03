const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadHooks() {
	const source = fs.readFileSync(
		path.join(__dirname, '..', 'Socials', 'scripts', 'view-all-content.js'),
		'utf8'
	);
	const document = {
		getElementById(id) {
			if (id === 'viewAllContentBoard') {
				return { innerHTML: '' };
			}
			if (id === 'viewAllContentStatus') {
				return { textContent: '' };
			}
			return null;
		},
	};
	const context = {
		console,
		document,
		fetch: async () => ({ ok: false, status: 404, json: async () => ({}) }),
		Intl,
		URL,
		window: { __OWEN_ENABLE_TEST_HOOKS__: true },
	};
	context.globalThis = context;
	vm.runInNewContext(source, context, { filename: 'view-all-content.js' });
	return context.window.__owenViewAllContentTestHooks;
}

function ids(cluster) {
	return cluster.map((entry) => entry.id).sort();
}

function groupedIds(clusters) {
	return clusters.map(ids).sort((a, b) => a.join('|').localeCompare(b.join('|')));
}

const { clusterEntries, extractYoutubeId, normalizePlatform } = loadHooks();

assert.equal(normalizePlatform(' Twitter '), 'x');
assert.equal(extractYoutubeId('https://www.youtube.com/watch?v=abc123&utm=1'), 'abc123');
assert.equal(extractYoutubeId('https://youtu.be/short-id?si=abc'), 'short-id');
assert.equal(extractYoutubeId('https://www.youtube.com/shorts/shorts-id?feature=share'), 'shorts-id');

{
	const clusters = clusterEntries([
		{
			id: 'yt-long',
			platform: 'youtube',
			url: 'https://www.youtube.com/watch?v=same-video',
			publishedAt: '2026-04-30T12:00:00Z',
			title: 'Setup tour',
			contentType: 'video',
		},
		{
			id: 'yt-short',
			platform: 'youtube',
			url: 'https://youtu.be/same-video?t=3',
			publishedAt: '2026-04-30T12:03:00Z',
			title: 'Setup tour clip',
			contentType: 'short',
		},
	]);

	assert.deepEqual(groupedIds(clusters), [['yt-long', 'yt-short']]);
}

{
	const clusters = clusterEntries([
		{
			id: 'youtube',
			platform: 'youtube',
			url: 'https://www.youtube.com/watch?v=clip-a',
			publishedAt: '2026-05-01T10:00:00Z',
			title: 'Apartment setup walkaround',
			contentType: 'video',
		},
		{
			id: 'tiktok',
			platform: 'tiktok',
			url: 'https://www.tiktok.com/@owenminercs/video/1',
			publishedAt: '2026-05-01T18:30:00Z',
			title: 'Different caption',
			mediaKind: 'video',
		},
		{
			id: 'instagram-image',
			platform: 'instagram',
			url: 'https://www.instagram.com/p/photo1/',
			publishedAt: '2026-05-01T18:35:00Z',
			title: 'Different image post',
			mediaKind: 'image',
		},
	]);

	assert.deepEqual(groupedIds(clusters), [['instagram-image'], ['tiktok', 'youtube']]);
}

{
	const clusters = clusterEntries([
		{
			id: 'x-old',
			platform: 'x',
			url: 'https://x.com/OwenMinerCS/status/1',
			publishedAt: '2026-04-01T10:00:00Z',
			title: 'This title is definitely the same',
			mediaKind: 'image',
		},
		{
			id: 'instagram-too-late',
			platform: 'instagram',
			url: 'https://www.instagram.com/p/later/',
			publishedAt: '2026-04-20T10:00:00Z',
			title: 'This title is definitely the same',
			mediaKind: 'image',
		},
		{
			id: 'facebook-reel',
			platform: 'facebook',
			url: 'https://www.facebook.com/reel/1',
			publishedAt: '2026-04-01T12:00:00Z',
			title: 'This title is definitely the same',
			mediaKind: 'video',
		},
	]);

	assert.deepEqual(groupedIds(clusters), [
		['facebook-reel'],
		['instagram-too-late'],
		['x-old'],
	]);
}

console.log('view-all-content clustering tests passed');
