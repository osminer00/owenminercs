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

function loadTikTokSyncHelpers() {
	const source = readWorkspaceFile('scripts/sync-tiktok-posts.mjs');
	const sandbox = {
		String,
		Number,
		Date,
		Math,
		Array,
		Set,
	};

	vm.runInNewContext(
		[
			extractFunction(source, 'safeNumber'),
			extractFunction(source, 'normalizePublishedAt'),
			extractFunction(source, 'normalizeRatio'),
			extractFunction(source, 'parseJsonLines'),
			extractFunction(source, 'dedupeByUrl'),
			extractFunction(source, 'normalizeTikTokEntry'),
			`this.__helpers = {
				safeNumber,
				normalizePublishedAt,
				normalizeRatio,
				parseJsonLines,
				dedupeByUrl,
				normalizeTikTokEntry,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'tiktok sync helpers should load');
	return sandbox.__helpers;
}

test('TikTok sync safeNumber and ratio/date normalization handle bad inputs', () => {
	const { safeNumber, normalizePublishedAt, normalizeRatio } = loadTikTokSyncHelpers();

	assert.equal(safeNumber('12'), 12);
	assert.equal(safeNumber('12.9'), 12);
	assert.equal(safeNumber('nope'), 0);
	assert.equal(safeNumber(null), 0);

	assert.equal(normalizePublishedAt({ timestamp: 1720000000 }), new Date(1720000000 * 1000).toISOString());
	assert.equal(normalizePublishedAt({ timestamp: 'not-a-number' }), '');
	assert.equal(normalizePublishedAt({}), '');

	assert.equal(normalizeRatio(1080, 1920), '1080 / 1920');
	assert.equal(normalizeRatio(0, 1920), '9 / 16');
	assert.equal(normalizeRatio('bad', 'data', '1 / 1'), '1 / 1');
});

test('TikTok sync JSONL parse skips corrupt lines and keeps valid entries', () => {
	const { parseJsonLines } = loadTikTokSyncHelpers();

	const parsed = parseJsonLines('{"id":"a"}\nnot-json\n{"id":"b"}\n\n{"id":"c"}');
	assert.equal(parsed.length, 3);
	assert.equal(parsed[0].id, 'a');
	assert.equal(parsed[1].id, 'b');
	assert.equal(parsed[2].id, 'c');
	assert.deepEqual(parseJsonLines(''), []);
});

test('TikTok normalizeTikTokEntry drops URL-less rows and maps engagement fields', () => {
	const { normalizeTikTokEntry } = loadTikTokSyncHelpers();

	assert.equal(normalizeTikTokEntry({ title: 'missing url' }), null);
	assert.equal(normalizeTikTokEntry({ webpage_url: '   ' }), null);

	const entry = normalizeTikTokEntry({
		title: '  Clip  ',
		webpage_url: 'https://www.tiktok.com/@owenminercs/video/1',
		thumbnail: 'https://cdn.example/thumb.jpg',
		description: 'hello',
		timestamp: 1720000000,
		like_count: '10',
		digg_count: '99',
		comment_count: '3',
		view_count: '1000',
		play_count: '2000',
		width: 1080,
		height: 1920,
	});

	assert.equal(entry.platform, 'tiktok');
	assert.equal(entry.contentType, 'video');
	assert.equal(entry.title, 'Clip');
	assert.equal(entry.url, 'https://www.tiktok.com/@owenminercs/video/1');
	assert.equal(entry.thumbnail, 'https://cdn.example/thumb.jpg');
	assert.equal(entry.caption, 'hello');
	assert.equal(entry.likeCount, 10);
	assert.equal(entry.diggCount, 10);
	assert.equal(entry.commentCount, 3);
	assert.equal(entry.viewCount, 1000);
	assert.equal(entry.aspectRatio, '1080 / 1920');
	assert.equal(entry.publishedAt, new Date(1720000000 * 1000).toISOString());

	const diggFallback = normalizeTikTokEntry({
		webpage_url: 'https://www.tiktok.com/@owenminercs/video/2',
		digg_count: '7',
		play_count: '50',
	});
	assert.equal(diggFallback.title, 'TikTok post');
	assert.equal(diggFallback.likeCount, 7);
	assert.equal(diggFallback.viewCount, 50);
	assert.equal(diggFallback.aspectRatio, '9 / 16');
});

test('TikTok sync dedupeByUrl keeps first occurrence and drops blank URLs', () => {
	const { dedupeByUrl } = loadTikTokSyncHelpers();

	const deduped = dedupeByUrl([
		{ url: 'https://www.tiktok.com/@owenminercs/video/1', title: 'first' },
		{ url: 'https://www.tiktok.com/@owenminercs/video/1', title: 'duplicate' },
		{ url: '  ', title: 'blank' },
		{ url: 'https://www.tiktok.com/@owenminercs/video/2', title: 'second' },
		{ title: 'missing' },
	]);

	assert.equal(deduped.length, 2);
	assert.equal(deduped[0].title, 'first');
	assert.equal(deduped[1].title, 'second');
});
