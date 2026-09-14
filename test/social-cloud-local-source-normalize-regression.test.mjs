import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const socialCloudSource = readFileSync(
	new URL('../Socials/scripts/social-cloud.js', import.meta.url),
	'utf8'
);

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

function loadLocalSourceHelper() {
	const sandbox = {};
	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'normalizeLocalSocialSourceItem')}
		this.__helpers = { normalizeLocalSocialSourceItem };
		`,
		sandbox
	);
	assert.ok(sandbox.__helpers, 'local source helper should load');
	return sandbox.__helpers;
}

function asPlain(value) {
	return JSON.parse(JSON.stringify(value));
}

test('normalizeLocalSocialSourceItem nests local JSON fields into the feed/media/metrics shape', () => {
	const { normalizeLocalSocialSourceItem } = loadLocalSourceHelper();
	const mapped = asPlain(
		normalizeLocalSocialSourceItem({
			platform: 'youtube',
			contentType: 'short',
			title: 'Warmup',
			url: 'https://www.youtube.com/watch?v=abc123',
			caption: 'Desk clip',
			publishedAt: '2026-04-01T12:00:00.000Z',
			thumbnail: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
			embedUrl: 'https://www.youtube.com/embed/abc123',
			mediaKind: 'video',
			aspectRatio: '9 / 16',
			viewCount: 1200,
			likeCount: 88,
			upvoteCount: 0,
			commentCount: 12,
		})
	);

	assert.deepEqual(mapped, {
		platform: 'youtube',
		contentType: 'short',
		title: 'Warmup',
		permalink: 'https://www.youtube.com/watch?v=abc123',
		description: 'Desk clip',
		publishedAt: '2026-04-01T12:00:00.000Z',
		media: {
			thumbnailUrl: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
			embedUrl: 'https://www.youtube.com/embed/abc123',
			kind: 'video',
			aspectRatio: '9 / 16',
		},
		metrics: {
			viewCount: 1200,
			likeCount: 88,
			upvoteCount: 0,
			commentCount: 12,
		},
	});
});

test('normalizeLocalSocialSourceItem keeps twitter as twitter and leaves missing fields undefined', () => {
	const { normalizeLocalSocialSourceItem } = loadLocalSourceHelper();
	const mapped = asPlain(normalizeLocalSocialSourceItem({ platform: 'twitter', title: 'Note' }));

	assert.equal(mapped.platform, 'twitter');
	assert.equal(mapped.contentType, undefined);
	assert.equal(mapped.permalink, undefined);
	assert.equal(mapped.description, undefined);
	assert.equal(mapped.media.thumbnailUrl, undefined);
	assert.equal(mapped.media.embedUrl, undefined);
	assert.equal(mapped.media.kind, undefined);
	assert.equal(mapped.media.aspectRatio, undefined);
	assert.equal(mapped.metrics.viewCount, undefined);
	assert.equal(mapped.metrics.likeCount, undefined);
	assert.equal(mapped.metrics.upvoteCount, undefined);
	assert.equal(mapped.metrics.commentCount, undefined);
});

test('normalizeLocalSocialSourceItem does not throw on a missing item', () => {
	const { normalizeLocalSocialSourceItem } = loadLocalSourceHelper();
	const mapped = asPlain(normalizeLocalSocialSourceItem(undefined));

	assert.equal(mapped.platform, undefined);
	assert.equal(mapped.title, undefined);
	assert.equal(mapped.permalink, undefined);
	assert.equal(mapped.media.thumbnailUrl, undefined);
	assert.equal(mapped.metrics.likeCount, undefined);
});
