import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const marker = `function ${functionName}(`;
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, `${functionName} should exist`);
	const declaredAt = source.slice(Math.max(0, start - 6), start) === 'async ' ? start - 6 : start;

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
			if (depth === 0) return source.slice(declaredAt, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function hostify(value) {
	return JSON.parse(JSON.stringify(value));
}

function loadTikTokHelpers() {
	const source = readWorkspaceFile('scripts/sync-tiktok-posts.mjs');
	const sandbox = {};
	vm.runInNewContext(
		[
			extractFunction(source, 'safeNumber'),
			extractFunction(source, 'normalizePublishedAt'),
			extractFunction(source, 'normalizeRatio'),
			extractFunction(source, 'parseJsonLines'),
			extractFunction(source, 'dedupeByUrl'),
			extractFunction(source, 'normalizeTikTokEntry'),
			'this.__helpers = { safeNumber, normalizePublishedAt, normalizeRatio, parseJsonLines, dedupeByUrl, normalizeTikTokEntry };',
		].join('\n'),
		sandbox
	);
	assert.equal(typeof sandbox.__helpers.normalizeTikTokEntry, 'function');
	return sandbox.__helpers;
}

const helpers = loadTikTokHelpers();

test('TikTok entries drop missing URLs and map counts, captions, and aspect ratio', () => {
	const { normalizeTikTokEntry, normalizeRatio } = helpers;
	const publishedAt = new Date(1710000000 * 1000).toISOString();

	assert.equal(normalizeTikTokEntry(null), null);
	assert.equal(normalizeTikTokEntry({ title: 'No link' }), null);
	assert.equal(normalizeTikTokEntry({ webpage_url: '   ' }), null);

	assert.deepEqual(
		hostify(
			normalizeTikTokEntry({
				webpage_url: '  https://www.tiktok.com/@owenminercs/video/1  ',
				title: '   ',
				description: '  cap  ',
				like_count: '1200',
				view_count: 'nope',
				comment_count: 3,
				width: 1080.4,
				height: 1920.2,
				timestamp: 1710000000,
				thumbnail: ' https://cdn.example/cover.jpg ',
			})
		),
		{
			platform: 'tiktok',
			contentType: 'video',
			title: 'TikTok post',
			url: 'https://www.tiktok.com/@owenminercs/video/1',
			thumbnail: 'https://cdn.example/cover.jpg',
			embedUrl: '',
			caption: 'cap',
			publishedAt,
			viewCount: 0,
			likeCount: 1200,
			diggCount: 1200,
			commentCount: 3,
			mediaKind: 'video',
			aspectRatio: '1080 / 1920',
		}
	);

	const fromDigg = hostify(
		normalizeTikTokEntry({
			webpage_url: 'https://www.tiktok.com/@owenminercs/video/2',
			title: 'Clip',
			digg_count: 40,
			play_count: 90,
			timestamp: 'nope',
		})
	);
	assert.equal(fromDigg.likeCount, 40);
	assert.equal(fromDigg.diggCount, 40);
	assert.equal(fromDigg.viewCount, 90);
	assert.equal(fromDigg.publishedAt, '');
	assert.equal(fromDigg.aspectRatio, '9 / 16');
	assert.equal(normalizeRatio(0, 1920), '9 / 16');
	assert.equal(normalizeRatio(-1, 10, '1 / 1'), '1 / 1');
});

test('TikTok sync skips broken JSON lines and keeps the first copy of a URL', () => {
	const { parseJsonLines, dedupeByUrl } = helpers;

	assert.deepEqual(hostify(parseJsonLines('\n{"id":1}\r\nnot-json\n\n{"id":2}\n')), [
		{ id: 1 },
		{ id: 2 },
	]);
	assert.deepEqual(hostify(parseJsonLines('')), []);

	const unique = hostify(
		dedupeByUrl([
			{ url: ' https://www.tiktok.com/@owenminercs/video/1 ', title: 'first' },
			{ url: 'https://www.tiktok.com/@owenminercs/video/1', title: 'second' },
			{ url: '   ', title: 'blank' },
			{ url: 'https://www.tiktok.com/@owenminercs/video/2', title: 'other' },
		])
	);
	assert.deepEqual(
		unique.map((item) => item.title),
		['first', 'other']
	);
});
