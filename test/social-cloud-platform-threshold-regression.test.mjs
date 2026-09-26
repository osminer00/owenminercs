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

function extractConstAssignment(source, constName) {
	const start = source.indexOf(`const ${constName} = `);
	assert.notEqual(start, -1, `${constName} should exist`);
	const end = source.indexOf(';', start);
	assert.notEqual(end, -1, `${constName} assignment should end`);
	return source.slice(start, end + 1);
}

function titlesOf(catalog) {
	return Array.from(catalog, (card) => String(card.title));
}

function loadCatalog() {
	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		Array,
		Set,
		Date,
		URL,
		toContentCard(item) {
			return {
				title: item.title || '',
				url: item.url || '',
			};
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(socialCloudSource, 'MIN_SOCIAL_ENGAGEMENT')}
		${extractConstAssignment(socialCloudSource, 'X_MIN_LIKES')}
		${extractConstAssignment(socialCloudSource, 'REDDIT_MIN_UPVOTES')}
		${extractFunction(socialCloudSource, 'normalizePlatformKey')}
		${extractFunction(socialCloudSource, 'toSafeNumber')}
		${extractFunction(socialCloudSource, 'hasMinimumSocialEngagement')}
		${extractFunction(socialCloudSource, 'isLivestreamLikeContent')}
		${extractFunction(socialCloudSource, 'getYouTubeVideoId')}
		${extractFunction(socialCloudSource, 'getCuratedShortScore')}
		${extractFunction(socialCloudSource, 'interleaveCardGroups')}
		${extractFunction(socialCloudSource, 'getCardCatalog')}
		this.__helpers = { getCardCatalog, X_MIN_LIKES, REDDIT_MIN_UPVOTES };
		`,
		sandbox
	);

	return sandbox.__helpers;
}

const { getCardCatalog, X_MIN_LIKES, REDDIT_MIN_UPVOTES } = loadCatalog();

test('X cards keep the like floor, drop blank identities, and keep the first duplicate URL', () => {
	assert.equal(X_MIN_LIKES, 101);

	const titles = titlesOf(
		getCardCatalog([
			{
				platform: 'X',
				title: 'older tie',
				url: 'https://x.com/a',
				likeCount: 250,
				viewCount: 10,
				commentCount: 5,
				publishedAt: '2026-01-01T00:00:00Z',
			},
			{
				platform: 'x',
				title: 'newer tie',
				url: 'https://x.com/b',
				likeCount: 250,
				viewCount: 10,
				commentCount: 5,
				publishedAt: '2026-06-01T00:00:00Z',
			},
			{
				platform: 'x',
				title: 'more comments',
				url: 'https://x.com/c',
				likeCount: 250,
				viewCount: 10,
				commentCount: 9,
				publishedAt: '2026-01-01T00:00:00Z',
			},
			{
				platform: 'x',
				title: 'more views',
				url: 'https://x.com/d',
				likeCount: 250,
				viewCount: 40,
				commentCount: 1,
				publishedAt: '2026-01-01T00:00:00Z',
			},
			{
				platform: 'x',
				title: 'more likes',
				url: 'https://x.com/e',
				likeCount: 400,
				viewCount: 1,
				commentCount: 0,
				publishedAt: '2026-01-01T00:00:00Z',
			},
			{
				platform: 'x',
				title: 'floor',
				url: 'https://x.com/f',
				likeCount: 101,
				publishedAt: '2026-01-01T00:00:00Z',
			},
			{
				platform: 'x',
				title: 'below floor',
				url: 'https://x.com/g',
				likeCount: 100,
				publishedAt: '2026-08-01T00:00:00Z',
			},
			{
				platform: 'x',
				title: 'first copy',
				url: 'https://x.com/dup',
				likeCount: 180,
				publishedAt: '2026-01-01T00:00:00Z',
			},
			{
				platform: 'x',
				title: 'second copy',
				url: 'https://x.com/dup',
				likeCount: 900,
				publishedAt: '2026-08-01T00:00:00Z',
			},
			{
				platform: 'x',
				title: '',
				url: '',
				likeCount: 800,
				publishedAt: '2026-08-01T00:00:00Z',
			},
		])
	);

	assert.deepEqual(titles, [
		'more likes',
		'more views',
		'more comments',
		'newer tie',
		'older tie',
		'first copy',
		'floor',
	]);
});

test('Reddit cards qualify on upvotes, then sort upvotes before likes', () => {
	assert.equal(REDDIT_MIN_UPVOTES, 101);

	const titles = titlesOf(
		getCardCatalog([
			{
				platform: 'Reddit',
				title: 'high votes',
				url: 'https://www.reddit.com/r/x/comments/high',
				upvoteCount: 300,
				likeCount: 1,
				viewCount: 1,
				commentCount: 0,
				publishedAt: '2026-01-01T00:00:00Z',
			},
			{
				platform: 'reddit',
				title: 'lower votes',
				url: 'https://www.reddit.com/r/x/comments/lower',
				upvoteCount: 200,
				likeCount: 999,
				viewCount: 999,
				publishedAt: '2026-08-01T00:00:00Z',
			},
			{
				platform: 'reddit',
				title: 'same votes more likes',
				url: 'https://www.reddit.com/r/x/comments/likes',
				upvoteCount: 300,
				likeCount: 50,
				viewCount: 1,
				publishedAt: '2026-01-01T00:00:00Z',
			},
			{
				platform: 'reddit',
				title: 'below floor',
				url: 'https://www.reddit.com/r/x/comments/below',
				upvoteCount: 100,
				likeCount: 5000,
				publishedAt: '2026-08-01T00:00:00Z',
			},
			{
				platform: 'reddit',
				title: 'likes without upvotes',
				url: 'https://www.reddit.com/r/x/comments/likesonly',
				likeCount: 500,
				publishedAt: '2026-08-01T00:00:00Z',
			},
			{
				platform: 'reddit',
				title: 'floor votes',
				url: 'https://www.reddit.com/r/x/comments/floor',
				upvoteCount: 101,
				likeCount: 0,
				publishedAt: '2026-01-01T00:00:00Z',
			},
			{
				platform: 'reddit',
				title: 'kept dup',
				url: 'https://www.reddit.com/r/x/comments/dup',
				upvoteCount: 150,
				publishedAt: '2026-01-01T00:00:00Z',
			},
			{
				platform: 'reddit',
				title: 'dropped dup',
				url: 'https://www.reddit.com/r/x/comments/dup',
				upvoteCount: 800,
				publishedAt: '2026-08-01T00:00:00Z',
			},
		])
	);

	assert.deepEqual(titles, [
		'same votes more likes',
		'high votes',
		'lower votes',
		'kept dup',
		'floor votes',
	]);
});
