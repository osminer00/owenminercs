import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const paramsStart = source.indexOf('(', start);
	assert.notEqual(paramsStart, -1, `${functionName} should have parameters`);

	let parenDepth = 0;
	let paramsEnd = -1;
	for (let i = paramsStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '(') parenDepth += 1;
		if (char === ')') {
			parenDepth -= 1;
			if (parenDepth === 0) {
				paramsEnd = i;
				break;
			}
		}
	}
	assert.notEqual(paramsEnd, -1, `${functionName} parameter list should close`);

	const braceStart = source.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${functionName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(start, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function loadYouTubeSyncHelpers() {
	const source = readWorkspaceFile('scripts/sync-youtube-local-feed.mjs');
	const sandbox = {
		String,
		Number,
		Boolean,
		Date,
		Math,
		Array,
		Set,
		encodeURIComponent,
		LIVESTREAM_MARKERS: [
			' live',
			'livestream',
			'live stream',
			'premiere',
			'premiering',
			'24/7',
			'stream',
		],
	};

	vm.runInNewContext(
		[
			`const LIVESTREAM_MARKERS = ${JSON.stringify(sandbox.LIVESTREAM_MARKERS)};`,
			extractFunction(source, 'safeNumber'),
			extractFunction(source, 'normalizePublishedAt'),
			extractFunction(source, 'buildYouTubeUrl'),
			extractFunction(source, 'isShort'),
			extractFunction(source, 'isLivestreamLike'),
			extractFunction(source, 'normalizeEntry'),
			extractFunction(source, 'parseJsonLines'),
			extractFunction(source, 'dedupeByVideoId'),
			extractFunction(source, 'sanitizeForOutput'),
			`this.__helpers = {
				safeNumber,
				normalizePublishedAt,
				buildYouTubeUrl,
				isShort,
				isLivestreamLike,
				normalizeEntry,
				parseJsonLines,
				dedupeByVideoId,
				sanitizeForOutput,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'youtube sync helpers should load');
	return sandbox.__helpers;
}

test('YouTube short detection uses duration and shorts URL markers', () => {
	const { isShort } = loadYouTubeSyncHelpers();

	assert.equal(isShort({ duration: 45, title: 'Quick tip' }), true);
	assert.equal(isShort({ duration: 70, title: 'Boundary short' }), true);
	assert.equal(isShort({ duration: 71, title: 'Too long' }), false);
	assert.equal(
		isShort({
			duration: 180,
			webpage_url: 'https://www.youtube.com/shorts/abc123',
		}),
		true
	);
	assert.equal(isShort({ duration: 180, title: 'This is #Shorts content' }), true);
	assert.equal(isShort({ duration: 180, title: 'Normal VOD' }), false);
});

test('YouTube livestream detection covers status flags and title markers', () => {
	const { isLivestreamLike } = loadYouTubeSyncHelpers();

	assert.equal(isLivestreamLike({ live_status: 'is_live' }), true);
	assert.equal(isLivestreamLike({ live_status: 'was_live' }), true);
	assert.equal(isLivestreamLike({ is_live: true }), true);
	assert.equal(isLivestreamLike({ was_live: true }), true);
	assert.equal(
		isLivestreamLike({ webpage_url: 'https://www.youtube.com/live/xyz' }),
		true
	);
	assert.equal(isLivestreamLike({ title: 'CS2 livestream tonight' }), true);
	assert.equal(isLivestreamLike({ title: '24/7 chill music' }), true);
	assert.equal(isLivestreamLike({ title: 'Edited highlight reel' }), false);
});

test('YouTube normalizeEntry builds short/video URLs and drops empty ids', () => {
	const { normalizeEntry, normalizePublishedAt, buildYouTubeUrl, safeNumber } =
		loadYouTubeSyncHelpers();

	assert.equal(normalizeEntry({ id: '' }), null);
	assert.equal(safeNumber('12'), 12);
	assert.equal(safeNumber('nope'), 0);

	assert.equal(normalizePublishedAt({ upload_date: '20260715' }), '2026-07-15T00:00:00.000Z');
	assert.equal(normalizePublishedAt({ timestamp: 1720000000 }), new Date(1720000000 * 1000).toISOString());
	assert.equal(normalizePublishedAt({}), '');

	assert.equal(
		buildYouTubeUrl({ id: 'abc', webpage_url: 'https://www.youtube.com/watch?v=abc' }),
		'https://www.youtube.com/watch?v=abc'
	);
	assert.equal(buildYouTubeUrl({ id: 'abc' }), 'https://www.youtube.com/watch?v=abc');
	assert.equal(buildYouTubeUrl({ id: '' }), '');

	const shortFromSource = normalizeEntry(
		{
			id: 'short1',
			title: 'Clip',
			description: 'desc',
			view_count: '10',
			like_count: '2',
			comment_count: '1',
			upload_date: '20260701',
		},
		'shorts'
	);
	assert.equal(shortFromSource.contentType, 'short');
	assert.equal(shortFromSource.url, 'https://www.youtube.com/shorts/short1');
	assert.equal(shortFromSource.viewCount, 10);
	assert.equal(shortFromSource.likeCount, 2);

	const inferredShort = normalizeEntry({
		id: 'short2',
		duration: 30,
		title: 'Quick',
	});
	assert.equal(inferredShort.contentType, 'short');
	assert.equal(inferredShort.url, 'https://www.youtube.com/shorts/short2');

	const video = normalizeEntry(
		{
			id: 'vid1',
			title: 'Long form',
			duration: 600,
		},
		'videos'
	);
	assert.equal(video.contentType, 'video');
	assert.equal(video.url, 'https://www.youtube.com/watch?v=vid1');
	assert.equal(video.thumbnail, 'https://i.ytimg.com/vi/vid1/hqdefault.jpg');
});

test('YouTube sync JSONL parse and video-id dedupe keep first occurrence', () => {
	const { parseJsonLines, dedupeByVideoId, sanitizeForOutput } = loadYouTubeSyncHelpers();

	const parsed = parseJsonLines('{"id":"a"}\nnot-json\n{"id":"b"}\n\n{"id":"c"}');
	assert.equal(parsed.length, 3);
	assert.equal(parsed[0].id, 'a');
	assert.equal(parsed[2].id, 'c');

	const deduped = dedupeByVideoId([
		{ _videoId: 'a', title: 'first' },
		{ _videoId: 'a', title: 'duplicate' },
		{ _videoId: 'b', title: 'second' },
		{ title: 'missing-id' },
	]);
	assert.equal(deduped.length, 2);
	assert.equal(deduped[0].title, 'first');
	assert.equal(deduped[1].title, 'second');

	const sanitized = sanitizeForOutput({
		platform: 'youtube',
		contentType: 'video',
		title: 'Keep',
		url: 'https://www.youtube.com/watch?v=x',
		thumbnail: 'https://i.ytimg.com/vi/x/hqdefault.jpg',
		caption: 'cap',
		publishedAt: '2026-07-01T00:00:00.000Z',
		viewCount: 9,
		likeCount: 3,
		commentCount: 1,
		_videoId: 'x',
		extra: 'drop-me',
	});
	assert.equal(sanitized._videoId, undefined);
	assert.equal(sanitized.extra, undefined);
	assert.equal(sanitized.title, 'Keep');
	assert.equal(sanitized.viewCount, 9);
});
