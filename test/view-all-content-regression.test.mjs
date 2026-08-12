import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(
	new URL('../Socials/scripts/view-all-content.js', import.meta.url),
	'utf8'
);

function extractFunction(src, functionName) {
	const start = src.indexOf(`function ${functionName}`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const paramsStart = src.indexOf('(', start);
	assert.notEqual(paramsStart, -1, `${functionName} should have parameters`);

	let parenDepth = 0;
	let paramsEnd = -1;
	for (let i = paramsStart; i < src.length; i += 1) {
		const char = src[i];
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

	const braceStart = src.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${functionName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < src.length; i += 1) {
		const char = src[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return src.slice(start, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function extractClass(src, className) {
	const start = src.indexOf(`class ${className}`);
	assert.notEqual(start, -1, `${className} should exist`);
	const braceStart = src.indexOf('{', start);
	assert.notEqual(braceStart, -1, `${className} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < src.length; i += 1) {
		const char = src[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return src.slice(start, i + 1);
		}
	}

	assert.fail(`${className} body should close`);
}

function extractConstAssignment(src, constName) {
	const start = src.indexOf(`const ${constName} = `);
	assert.notEqual(start, -1, `${constName} should exist`);
	const end = src.indexOf(';', start);
	assert.notEqual(end, -1, `${constName} assignment should end`);
	return src.slice(start, end + 1);
}

function loadHelpers() {
	const sandbox = {
		String,
		Number,
		Date,
		Math,
		Array,
		Map,
		JSON,
		Intl,
		RegExp,
		Object,
		console,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(source, 'CLUSTER_HOURS')}
		${extractConstAssignment(source, 'CLUSTER_TITLE_DAYS')}
		${extractFunction(source, 'normalizePlatform')}
		${extractFunction(source, 'extractYoutubeId')}
		${extractFunction(source, 'parseTime')}
		${extractFunction(source, 'utcDateKey')}
		${extractFunction(source, 'normalizeTitle')}
		${extractFunction(source, 'isVideoLike')}
		${extractFunction(source, 'isImageLike')}
		${extractFunction(source, 'canCrossMerge')}
		${extractClass(source, 'UnionFind')}
		${extractFunction(source, 'platformSortKey')}
		${extractFunction(source, 'pickPrimaryEntry')}
		${extractFunction(source, 'labelForEntry')}
		${extractFunction(source, 'escapeHtml')}
		${extractFunction(source, 'escapeAttr')}
		${extractFunction(source, 'flattenPayload')}
		${extractFunction(source, 'hintFromPath')}
		this.__helpers = {
			CLUSTER_HOURS,
			CLUSTER_TITLE_DAYS,
			normalizePlatform,
			extractYoutubeId,
			parseTime,
			utcDateKey,
			normalizeTitle,
			isVideoLike,
			isImageLike,
			canCrossMerge,
			UnionFind,
			platformSortKey,
			pickPrimaryEntry,
			labelForEntry,
			escapeHtml,
			escapeAttr,
			flattenPayload,
			hintFromPath,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'view-all-content helpers should load');
	return sandbox.__helpers;
}

test('view-all-content normalizes platforms and YouTube ids', () => {
	const h = loadHelpers();

	assert.equal(h.normalizePlatform(' Twitter '), 'x');
	assert.equal(h.normalizePlatform('YouTube'), 'youtube');
	assert.equal(h.normalizePlatform(''), '');

	assert.equal(h.extractYoutubeId('https://www.youtube.com/watch?v=abc123&t=10'), 'abc123');
	assert.equal(h.extractYoutubeId('https://youtu.be/shortId?si=1'), 'shortId');
	assert.equal(h.extractYoutubeId('https://www.youtube.com/shorts/clip99'), 'clip99');
	assert.equal(h.extractYoutubeId('https://example.com/nope'), '');
});

test('view-all-content media classifiers and cross-merge rules', () => {
	const h = loadHelpers();

	assert.equal(h.isVideoLike({ platform: 'youtube', url: 'https://youtu.be/a' }), true);
	assert.equal(h.isVideoLike({ platform: 'tiktok', url: 'https://tiktok.com/@x/video/1' }), true);
	assert.equal(
		h.isVideoLike({ platform: 'instagram', url: 'https://www.instagram.com/reel/xyz/' }),
		true
	);
	assert.equal(
		h.isVideoLike({ platform: 'x', mediaKind: 'video', contentType: 'status' }),
		true
	);
	assert.equal(
		h.isImageLike({ platform: 'instagram', mediaKind: 'image', contentType: 'photo' }),
		true
	);
	assert.equal(
		h.isImageLike({ platform: 'x', mediaKind: '', contentType: 'photo' }),
		true
	);

	assert.equal(
		h.canCrossMerge(
			{ platform: 'youtube', url: 'https://youtu.be/a' },
			{ platform: 'tiktok', url: 'https://tiktok.com/@x/video/1' }
		),
		true,
		'video+video across platforms can merge'
	);
	assert.equal(
		h.canCrossMerge(
			{ platform: 'x', mediaKind: 'image', contentType: 'photo' },
			{ platform: 'instagram', mediaKind: 'image', contentType: 'photo' }
		),
		true,
		'image+image across platforms can merge'
	);
	assert.equal(
		h.canCrossMerge(
			{ platform: 'youtube', url: 'https://youtu.be/a' },
			{ platform: 'youtube', url: 'https://youtu.be/b' }
		),
		false,
		'same platform never cross-merges'
	);
	assert.equal(
		h.canCrossMerge(
			{ platform: 'youtube', url: 'https://youtu.be/a' },
			{ platform: 'x', mediaKind: 'image', contentType: 'photo' }
		),
		false,
		'mixed media kinds do not cross-merge'
	);
});

test('view-all-content UnionFind and primary entry prefer YouTube long-form', () => {
	const h = loadHelpers();
	const uf = new h.UnionFind(4);
	uf.union(0, 1);
	uf.union(2, 3);
	uf.union(1, 2);
	assert.equal(uf.find(0), uf.find(3));

	const primary = h.pickPrimaryEntry([
		{ platform: 'x', publishedAt: '2026-08-10T12:00:00Z', contentType: 'video' },
		{ platform: 'youtube', publishedAt: '2026-08-09T12:00:00Z', contentType: 'video' },
		{ platform: 'youtube', publishedAt: '2026-08-11T12:00:00Z', contentType: 'short' },
		{ platform: 'tiktok', publishedAt: '2026-08-12T12:00:00Z' },
	]);

	assert.equal(primary.platform, 'youtube');
	assert.equal(primary.contentType, 'video');
	assert.equal(h.labelForEntry({ platform: 'youtube', contentType: 'short' }), 'YouTube Short');
	assert.equal(h.labelForEntry({ platform: 'twitter' }), 'X');
});

test('view-all-content escaping, flatten, and path hints stay safe', () => {
	const h = loadHelpers();

	assert.equal(h.escapeHtml('<b>"&</b>'), '&lt;b&gt;&quot;&amp;&lt;/b&gt;');
	assert.equal(h.escapeAttr('line\nbreak"'), 'line break&quot;');

	const fromArray = Array.from(h.flattenPayload([{ a: 1 }]));
	assert.equal(fromArray.length, 1);
	assert.equal(fromArray[0].a, 1);

	const fromItems = Array.from(h.flattenPayload({ items: [{ b: 2 }] }));
	assert.equal(fromItems.length, 1);
	assert.equal(fromItems[0].b, 2);

	assert.equal(Array.from(h.flattenPayload({ items: null })).length, 0);
	assert.equal(Array.from(h.flattenPayload(null)).length, 0);

	assert.equal(h.hintFromPath('data/youtube-shorts.json'), 'youtube');
	assert.equal(h.hintFromPath('data/x-top-posts.json'), 'x');
	assert.equal(h.hintFromPath('data/unknown.json'), '');

	assert.equal(h.normalizeTitle('Hello, World!!! 123'), 'hello world 123');
	assert.equal(h.utcDateKey('2026-08-12T15:30:00Z'), '2026-08-12');
	assert.equal(h.utcDateKey('not-a-date'), '');
	assert.equal(h.CLUSTER_HOURS, 20);
	assert.equal(h.CLUSTER_TITLE_DAYS, 14);
});
