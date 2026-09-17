import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}(`);
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

function copyFeedItem(item) {
	return {
		platform: item.platform,
		contentType: item.contentType,
		title: item.title,
		url: item.url,
		thumbnail: item.thumbnail,
		embedUrl: item.embedUrl,
		caption: item.caption,
		publishedAt: item.publishedAt,
		viewCount: item.viewCount,
		likeCount: item.likeCount,
		upvoteCount: item.upvoteCount,
		commentCount: item.commentCount,
		mediaKind: item.mediaKind,
		aspectRatio: item.aspectRatio,
		isLive: item.isLive,
	};
}

function loadFeedHelpers() {
	const source = readWorkspaceFile('Socials/scripts/social-cloud.js');
	const sandbox = { String, Number, Boolean, Array };

	vm.runInNewContext(
		[
			extractFunction(source, 'normalizePlatformKey'),
			extractFunction(source, 'toSafeNumber'),
			extractFunction(source, 'normalizeFeedItems'),
			extractFunction(source, 'isLivestreamLikeContent'),
			`this.__helpers = {
				normalizePlatformKey,
				toSafeNumber,
				normalizeFeedItems,
				isLivestreamLikeContent,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'social-cloud feed helpers should load');
	return sandbox.__helpers;
}

test('toSafeNumber parses integers and treats missing or non-numeric values as 0', () => {
	const { toSafeNumber } = loadFeedHelpers();

	assert.equal(toSafeNumber(12), 12);
	assert.equal(toSafeNumber('40'), 40);
	assert.equal(toSafeNumber('12.9'), 12);
	assert.equal(toSafeNumber('-3'), -3);
	assert.equal(toSafeNumber(null), 0);
	assert.equal(toSafeNumber(undefined), 0);
	assert.equal(toSafeNumber(''), 0);
	assert.equal(toSafeNumber('abc'), 0);
	assert.equal(toSafeNumber({}), 0);
});

test('normalizeFeedItems maps live-feed payloads onto catalog fields and rejects non-arrays', () => {
	const { normalizeFeedItems } = loadFeedHelpers();

	assert.equal(normalizeFeedItems(null).length, 0);
	assert.equal(normalizeFeedItems(undefined).length, 0);
	assert.equal(normalizeFeedItems({ items: [] }).length, 0);

	const mapped = Array.from(
		normalizeFeedItems([
			{
				platform: 'Twitter',
				contentType: 'VIDEO',
				title: 'Match recap',
				permalink: 'https://x.com/owenminer/status/1',
				description: 'Finals night',
				publishedAt: '2026-09-01T12:00:00.000Z',
				isLive: 1,
				media: {
					thumbnailUrl: 'https://img.example/thumb.jpg',
					embedUrl: 'https://embed.example/1',
					kind: 'Video',
					aspectRatio: '16 / 9',
				},
				metrics: {
					viewCount: '1000',
					upvoteCount: '42',
					replyCount: '7',
				},
			},
			{
				platform: 'reddit',
				contentType: 'post',
				title: 'Setup shot',
				permalink: 'https://www.reddit.com/r/setups/comments/abc',
				metrics: {
					likeCount: '9',
					commentCount: '3',
				},
			},
		])
	).map(copyFeedItem);

	assert.equal(mapped.length, 2);
	assert.equal(mapped[0].platform, 'x');
	assert.equal(mapped[0].contentType, 'video');
	assert.equal(mapped[0].url, 'https://x.com/owenminer/status/1');
	assert.equal(mapped[0].caption, 'Finals night');
	assert.equal(mapped[0].thumbnail, 'https://img.example/thumb.jpg');
	assert.equal(mapped[0].embedUrl, 'https://embed.example/1');
	assert.equal(mapped[0].viewCount, 1000);
	assert.equal(mapped[0].likeCount, 42, 'likeCount falls back to upvoteCount');
	assert.equal(mapped[0].upvoteCount, 42);
	assert.equal(mapped[0].commentCount, 7, 'commentCount falls back to replyCount');
	assert.equal(mapped[0].mediaKind, 'video');
	assert.equal(mapped[0].aspectRatio, '16 / 9');
	assert.equal(mapped[0].isLive, true);

	assert.equal(mapped[1].platform, 'reddit');
	assert.equal(mapped[1].url, 'https://www.reddit.com/r/setups/comments/abc');
	assert.equal(mapped[1].likeCount, 9);
	assert.equal(mapped[1].upvoteCount, 0);
	assert.equal(mapped[1].commentCount, 3);
	assert.equal(mapped[1].viewCount, 0);
	assert.equal(mapped[1].isLive, false);
	assert.equal(mapped[1].caption, '');
	assert.equal(mapped[1].thumbnail, '');
	assert.equal(mapped[1].embedUrl, '');
});

test('isLivestreamLikeContent matches live URL and phrase markers used to drop YouTube lives from the catalog', () => {
	const { isLivestreamLikeContent } = loadFeedHelpers();

	assert.equal(isLivestreamLikeContent({ url: 'https://www.youtube.com/live/abc123' }), true);
	assert.equal(isLivestreamLikeContent({ embedUrl: 'https://youtube.com/embed/live/xyz' }), true);
	assert.equal(isLivestreamLikeContent({ title: 'CS2 live stream tonight' }), true);
	assert.equal(isLivestreamLikeContent({ caption: 'Join the livestream later' }), true);
	assert.equal(isLivestreamLikeContent({ title: 'YouTube Shorts live stream' }), true);
	assert.equal(
		isLivestreamLikeContent({ title: 'Livestream later' }),
		true,
		'empty url/embed/caption fields join with spaces, so a title that starts with livestream still matches'
	);

	assert.equal(isLivestreamLikeContent({ title: 'Highlight reel' }), false);
	assert.equal(isLivestreamLikeContent({ title: 'nonlivestream highlights' }), false);
	assert.equal(isLivestreamLikeContent({ url: 'https://www.youtube.com/watch?v=abc' }), false);
	assert.equal(
		isLivestreamLikeContent({ isLive: true, title: 'Match vod' }),
		false,
		'isLive is not this helper; getCardCatalog checks that flag separately'
	);
	assert.equal(isLivestreamLikeContent({}), false);
});
