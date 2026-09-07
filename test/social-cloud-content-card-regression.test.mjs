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

function extractConstObject(source, constName) {
	const start = source.indexOf(`const ${constName} = `);
	assert.notEqual(start, -1, `${constName} should exist`);
	const braceStart = source.indexOf('{', start);
	assert.notEqual(braceStart, -1, `${constName} should have an object body`);

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(start, i + 1);
		}
	}

	assert.fail(`${constName} object should close`);
}

function loadContentCardHelpers() {
	const sandbox = {
		String,
		Number,
		Boolean,
		Array,
		Set,
		Math,
		Date,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstObject(socialCloudSource, 'platformMeta')}
		${extractFunction(socialCloudSource, 'normalizePlatformKey')}
		${extractFunction(socialCloudSource, 'toSafeNumber')}
		${extractFunction(socialCloudSource, 'isShortFormVideo')}
		${extractFunction(socialCloudSource, 'getResolvedContentType')}
		${extractFunction(socialCloudSource, 'parseAspectRatioValue')}
		${extractFunction(socialCloudSource, 'getVideoRatioForItem')}
		${extractFunction(socialCloudSource, 'formatDate')}
		${extractFunction(socialCloudSource, 'getCardMetrics')}
		${extractFunction(socialCloudSource, 'normalizeHashtagToken')}
		${extractFunction(socialCloudSource, 'extractHashtagsFromText')}
		${extractFunction(socialCloudSource, 'getContentItemHashtags')}
		${extractFunction(socialCloudSource, 'toContentCard')}
		this.__helpers = { toContentCard, getResolvedContentType };
		`,
		sandbox
	);

	return sandbox.__helpers;
}

function cardFields(card) {
	return {
		platform: String(card.platform),
		platformKey: String(card.platformKey),
		type: String(card.type),
		contentType: String(card.contentType),
		videoAspectRatio: Number(card.videoAspectRatio),
		videoAspectRatioCss: String(card.videoAspectRatioCss),
		title: String(card.title),
		blurb: String(card.blurb),
		url: String(card.url),
		accent: String(card.accent),
		thumbnail: String(card.thumbnail),
		embedUrl: String(card.embedUrl),
		mediaKind: String(card.mediaKind),
		aspectRatio: String(card.aspectRatio),
		hashtags: Array.from(card.hashtags || [], String).sort(),
	};
}

test('toContentCard maps a YouTube short onto video chrome and portrait ratio', () => {
	const { toContentCard } = loadContentCardHelpers();
	const card = toContentCard({
		platform: 'youtube',
		contentType: 'short',
		title: 'Bye Bye',
		caption: 'Clip dump #CS2 #shorts more later',
		url: 'https://www.youtube.com/shorts/EmNTRsInyiA',
		thumbnail: 'https://i.ytimg.com/vi/EmNTRsInyiA/hqdefault.jpg',
		embedUrl: 'https://www.youtube.com/embed/EmNTRsInyiA',
		mediaKind: 'VIDEO',
		aspectRatio: ' 9 / 16 ',
		publishedAt: '2026-02-13',
	});

	assert.deepEqual(cardFields(card), {
		platform: 'YouTube',
		platformKey: 'youtube',
		type: 'video',
		contentType: 'short',
		videoAspectRatio: 9 / 16,
		videoAspectRatioCss: ' 9 / 16 ',
		title: 'Bye Bye',
		blurb: 'Clip dump #CS2 #shorts more later',
		url: 'https://www.youtube.com/shorts/EmNTRsInyiA',
		accent: '#ff8f9d',
		thumbnail: 'https://i.ytimg.com/vi/EmNTRsInyiA/hqdefault.jpg',
		embedUrl: 'https://www.youtube.com/embed/EmNTRsInyiA',
		mediaKind: 'video',
		aspectRatio: '9 / 16',
		hashtags: ['cs2', 'shorts'],
	});
});

test('toContentCard treats reddit image posts as social cards and keeps explicit ratios', () => {
	const { toContentCard } = loadContentCardHelpers();
	const card = toContentCard({
		platform: 'reddit',
		contentType: 'image',
		title: 'Setup shot',
		caption: 'From the subreddit',
		url: 'https://www.reddit.com/r/setups/comments/abc/',
		thumbnail: 'https://preview.redd.it/setup.jpg',
		aspectRatio: '4 / 3',
	});

	assert.deepEqual(cardFields(card), {
		platform: 'Reddit',
		platformKey: 'reddit',
		type: 'social',
		contentType: 'image',
		videoAspectRatio: 4 / 3,
		videoAspectRatioCss: '4 / 3',
		title: 'Setup shot',
		blurb: 'From the subreddit',
		url: 'https://www.reddit.com/r/setups/comments/abc/',
		accent: '#ff9966',
		thumbnail: 'https://preview.redd.it/setup.jpg',
		embedUrl: '',
		mediaKind: '',
		aspectRatio: '4 / 3',
		hashtags: [],
	});
});

test('toContentCard infers TikTok portrait ratio and untitled/url fallbacks', () => {
	const { toContentCard } = loadContentCardHelpers();
	const card = toContentCard({
		platform: 'tiktok',
		url: '',
		title: '',
		caption: '',
	});

	assert.deepEqual(cardFields(card), {
		platform: 'TikTok',
		platformKey: 'tiktok',
		type: 'video',
		contentType: 'video',
		videoAspectRatio: 9 / 16,
		videoAspectRatioCss: '9 / 16',
		title: 'Untitled content',
		blurb: '',
		url: '#',
		accent: '#7de7ff',
		thumbnail: '',
		embedUrl: '',
		mediaKind: '',
		aspectRatio: '',
		hashtags: [],
	});
});

test('toContentCard looks up platformMeta by exact key and defaults unknown platforms', () => {
	const { toContentCard } = loadContentCardHelpers();
	const mixedCase = toContentCard({
		platform: 'YouTube',
		contentType: 'video',
		title: 'VOD',
		url: 'https://www.youtube.com/watch?v=abc',
	});
	assert.equal(mixedCase.platform, 'YouTube');
	assert.equal(mixedCase.platformKey, 'youtube');
	assert.equal(mixedCase.accent, '#69e3ff');
	assert.equal(mixedCase.type, 'video');

	const twitter = toContentCard({
		platform: 'twitter',
		contentType: 'post',
		title: 'Old handle post',
		url: 'https://twitter.com/owenminer/status/1',
	});
	assert.equal(twitter.platform, 'twitter');
	assert.equal(twitter.platformKey, 'twitter');
	assert.equal(twitter.type, 'social');
	assert.equal(twitter.contentType, 'post');
	assert.equal(twitter.accent, '#69e3ff');

	const unknown = toContentCard({});
	assert.equal(unknown.platform, 'Content');
	assert.equal(unknown.platformKey, '');
	assert.equal(unknown.type, 'video');
	assert.equal(unknown.contentType, 'video');
	assert.equal(unknown.url, '#');
});
