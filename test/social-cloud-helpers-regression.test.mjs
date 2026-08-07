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

function loadSocialCloudHelpers(options = {}) {
	const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.parse('2026-08-07T12:00:00Z');
	const RealDate = Date;
	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		Array,
		URL,
		console,
		window: {
			location: {
				origin: 'https://www.owenminercs.com',
				href: 'https://www.owenminercs.com/Socials/socials.html',
			},
		},
		Date: {
			now: () => nowMs,
			parse: (...args) => RealDate.parse(...args),
			UTC: (...args) => RealDate.UTC(...args),
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(socialCloudSource, 'MIN_SOCIAL_ENGAGEMENT')}
		${extractFunction(socialCloudSource, 'normalizePlatformKey')}
		${extractFunction(socialCloudSource, 'isHttpUrl')}
		${extractFunction(socialCloudSource, 'toSafeNumber')}
		${extractFunction(socialCloudSource, 'normalizeFeedItems')}
		${extractFunction(socialCloudSource, 'normalizeLocalSocialSourceItem')}
		${extractFunction(socialCloudSource, 'normalizeVisitedUrl')}
		${extractFunction(socialCloudSource, 'hasMinimumSocialEngagement')}
		${extractFunction(socialCloudSource, 'isBlockedSocialContentItem')}
		${extractFunction(socialCloudSource, 'sanitizeRedditText')}
		${extractFunction(socialCloudSource, 'parseRedditUsernameFromUrl')}
		${extractFunction(socialCloudSource, 'isShortFormVideo')}
		${extractFunction(socialCloudSource, 'getResolvedContentType')}
		${extractFunction(socialCloudSource, 'getYouTubeVideoId')}
		${extractFunction(socialCloudSource, 'getYouTubeEmbedUrl')}
		${extractFunction(socialCloudSource, 'getTikTokEmbedUrl')}
		${extractFunction(socialCloudSource, 'getCardMetrics')}
		${extractFunction(socialCloudSource, 'normalizeHashtagToken')}
		${extractFunction(socialCloudSource, 'extractHashtagsFromText')}
		${extractFunction(socialCloudSource, 'normalizeAspectRatio')}
		${extractFunction(socialCloudSource, 'fitIframeToBox')}
		${extractFunction(socialCloudSource, 'getCuratedShortScore')}
		this.__helpers = {
			MIN_SOCIAL_ENGAGEMENT,
			normalizePlatformKey,
			isHttpUrl,
			toSafeNumber,
			normalizeFeedItems,
			normalizeLocalSocialSourceItem,
			normalizeVisitedUrl,
			hasMinimumSocialEngagement,
			isBlockedSocialContentItem,
			sanitizeRedditText,
			parseRedditUsernameFromUrl,
			isShortFormVideo,
			getResolvedContentType,
			getYouTubeVideoId,
			getYouTubeEmbedUrl,
			getTikTokEmbedUrl,
			getCardMetrics,
			normalizeHashtagToken,
			extractHashtagsFromText,
			normalizeAspectRatio,
			fitIframeToBox,
			getCuratedShortScore,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('social-cloud normalizes platforms, HTTP URLs, and visited link URLs safely', () => {
	const { normalizePlatformKey, isHttpUrl, normalizeVisitedUrl } = loadSocialCloudHelpers();

	assert.equal(normalizePlatformKey(' Twitter '), 'x');
	assert.equal(normalizePlatformKey('YouTube'), 'youtube');
	assert.equal(normalizePlatformKey(null), '');

	assert.equal(isHttpUrl('https://www.youtube.com/watch?v=abc'), true);
	assert.equal(isHttpUrl('http://example.com'), true);
	assert.equal(isHttpUrl(' javascript:alert(1) '), false);
	assert.equal(isHttpUrl('mailto:owen@example.com'), false);
	assert.equal(isHttpUrl('/Socials/socials.html'), false);

	assert.equal(
		normalizeVisitedUrl('https://www.youtube.com/watch?v=abc'),
		'https://www.youtube.com/watch?v=abc'
	);
	assert.equal(
		normalizeVisitedUrl('/Socials/socials.html'),
		'https://www.owenminercs.com/Socials/socials.html'
	);
	assert.equal(normalizeVisitedUrl('javascript:alert(1)'), '');
	assert.equal(normalizeVisitedUrl('mailto:owen@example.com'), '');
	// Empty input resolves against the page origin (URL spec), so it stays an https URL.
	assert.equal(normalizeVisitedUrl(''), 'https://www.owenminercs.com/');
});

test('social-cloud feed normalization maps metrics and rejects non-array payloads', () => {
	const { normalizeFeedItems, normalizeLocalSocialSourceItem, toSafeNumber } =
		loadSocialCloudHelpers();

	assert.equal(toSafeNumber('42'), 42);
	assert.equal(toSafeNumber('nope'), 0);
	assert.equal(toSafeNumber(null), 0);

	assert.equal(Array.from(normalizeFeedItems(null)).length, 0);
	assert.equal(Array.from(normalizeFeedItems({})).length, 0);

	const local = normalizeLocalSocialSourceItem({
		platform: 'TikTok',
		contentType: 'short',
		title: 'Clip',
		url: 'https://www.tiktok.com/@owen/video/123',
		caption: 'hello',
		publishedAt: '2026-01-01',
		thumbnail: 'https://example.com/t.jpg',
		embedUrl: 'https://www.tiktok.com/player/v1/123',
		mediaKind: 'video',
		aspectRatio: '9 / 16',
		viewCount: '1000',
		likeCount: '250',
		commentCount: '12',
	});

	const [normalized] = normalizeFeedItems([local]);
	assert.equal(normalized.platform, 'tiktok');
	assert.equal(normalized.contentType, 'short');
	assert.equal(normalized.url, 'https://www.tiktok.com/@owen/video/123');
	assert.equal(normalized.thumbnail, 'https://example.com/t.jpg');
	assert.equal(normalized.embedUrl, 'https://www.tiktok.com/player/v1/123');
	assert.equal(normalized.viewCount, 1000);
	assert.equal(normalized.likeCount, 250);
	assert.equal(normalized.commentCount, 12);
	assert.equal(normalized.aspectRatio, '9 / 16');

	const [fromApiShape] = normalizeFeedItems([
		{
			platform: 'twitter',
			contentType: 'Post',
			permalink: 'https://x.com/owenminer/status/1',
			description: 'hi',
			publishedAt: '2026-02-01',
			media: { thumbnailUrl: 'https://example.com/x.jpg', kind: 'photo' },
			metrics: { likeCount: '99', replyCount: '3' },
		},
	]);
	assert.equal(fromApiShape.platform, 'x');
	assert.equal(fromApiShape.contentType, 'post');
	assert.equal(fromApiShape.url, 'https://x.com/owenminer/status/1');
	assert.equal(fromApiShape.likeCount, 99);
	assert.equal(fromApiShape.commentCount, 3);
});

test('social-cloud enforces engagement floor and blocks known junk content', () => {
	const {
		MIN_SOCIAL_ENGAGEMENT,
		hasMinimumSocialEngagement,
		isBlockedSocialContentItem,
	} = loadSocialCloudHelpers();

	assert.equal(MIN_SOCIAL_ENGAGEMENT, 101);

	assert.equal(hasMinimumSocialEngagement({ platform: 'youtube', likeCount: 101 }), true);
	assert.equal(hasMinimumSocialEngagement({ platform: 'youtube', likeCount: 100 }), false);
	assert.equal(hasMinimumSocialEngagement({ platform: 'x', likeCount: 200 }), true);
	assert.equal(
		hasMinimumSocialEngagement({ platform: 'reddit', upvoteCount: 101, likeCount: 0 }),
		true
	);
	assert.equal(
		hasMinimumSocialEngagement({ platform: 'reddit', upvoteCount: 50, likeCount: 200 }),
		false
	);
	assert.equal(hasMinimumSocialEngagement({ platform: 'tiktok', likeCount: 'n/a' }), false);

	assert.equal(
		isBlockedSocialContentItem({ title: 'Harman Kardon speaker haul' }),
		true
	);
	assert.equal(
		isBlockedSocialContentItem({ caption: 'Check the Harmon/Kardon Go + Play 3' }),
		true
	);
	assert.equal(
		isBlockedSocialContentItem({
			title: 'CS2 clutch',
			url: 'https://www.youtube.com/watch?v=abc12345',
		}),
		false
	);
});

test('social-cloud parses YouTube/TikTok embeds and short-form content types', () => {
	const {
		getYouTubeVideoId,
		getYouTubeEmbedUrl,
		getTikTokEmbedUrl,
		isShortFormVideo,
		getResolvedContentType,
	} = loadSocialCloudHelpers();

	assert.equal(getYouTubeVideoId('https://youtu.be/EmNTRsInyiA'), 'EmNTRsInyiA');
	assert.equal(
		getYouTubeVideoId('https://www.youtube.com/watch?v=ian1kvdwsEA&t=12'),
		'ian1kvdwsEA'
	);
	assert.equal(
		getYouTubeVideoId('https://www.youtube.com/shorts/EmNTRsInyiA'),
		'EmNTRsInyiA'
	);
	assert.equal(
		getYouTubeVideoId('https://www.youtube.com/embed/oxTFIYagz_w'),
		'oxTFIYagz_w'
	);
	assert.equal(getYouTubeVideoId('not-a-url-but-v=abcdefghijk'), 'abcdefghijk');
	assert.equal(getYouTubeVideoId(''), '');

	const embed = getYouTubeEmbedUrl('https://www.youtube.com/watch?v=ian1kvdwsEA');
	assert.match(embed, /^https:\/\/www\.youtube\.com\/embed\/ian1kvdwsEA\?/);
	assert.match(embed, /rel=0/);
	assert.match(embed, /playsinline=1/);
	assert.match(embed, /enablejsapi=1/);
	assert.match(embed, /origin=https%3A%2F%2Fwww\.owenminercs\.com/);

	assert.equal(
		getYouTubeEmbedUrl('https://www.youtube.com/@OwenMinerCS'),
		'https://www.youtube.com/embed?listType=user_uploads&list=OwenMinerCS&rel=0'
	);
	assert.equal(getYouTubeEmbedUrl('https://example.com'), '');

	assert.equal(
		getTikTokEmbedUrl('https://www.tiktok.com/@owen/video/7345123456789012345'),
		'https://www.tiktok.com/player/v1/7345123456789012345'
	);
	assert.equal(
		getTikTokEmbedUrl('https://www.tiktok.com/@owenminer'),
		'https://www.tiktok.com/embed/@owenminer'
	);
	assert.equal(getTikTokEmbedUrl(''), '');

	assert.equal(isShortFormVideo({ contentType: 'short' }), true);
	assert.equal(
		isShortFormVideo({
			contentType: 'video',
			url: 'https://www.youtube.com/shorts/EmNTRsInyiA',
		}),
		true
	);
	assert.equal(
		isShortFormVideo({ contentType: 'video', caption: 'full stream vod' }),
		false
	);
	assert.equal(
		getResolvedContentType({ contentType: 'gallery' }),
		'gallery'
	);
	assert.equal(
		getResolvedContentType({
			contentType: '',
			url: 'https://www.youtube.com/shorts/EmNTRsInyiA',
		}),
		'short'
	);
	assert.equal(
		getResolvedContentType({ contentType: '', url: 'https://www.youtube.com/watch?v=abc' }),
		'video'
	);
});

test('social-cloud metrics, hashtags, and layout helpers stay deterministic', () => {
	const {
		getCardMetrics,
		normalizeHashtagToken,
		extractHashtagsFromText,
		sanitizeRedditText,
		parseRedditUsernameFromUrl,
		normalizeAspectRatio,
		fitIframeToBox,
		getCuratedShortScore,
	} = loadSocialCloudHelpers({ nowMs: Date.parse('2026-08-07T12:00:00Z') });

	const youtubeMetrics = getCardMetrics({
		platform: 'youtube',
		contentType: 'video',
		viewCount: 1200,
		likeCount: 150,
		commentCount: 4,
	});
	assert.equal(youtubeMetrics.viewCount, 1200);
	assert.equal(youtubeMetrics.likeCount, 150);
	assert.equal(youtubeMetrics.commentCount, 4);
	assert.match(youtubeMetrics.label, /1,?200 views/);
	assert.match(youtubeMetrics.label, /150 likes/);
	assert.match(youtubeMetrics.label, /4 comments/);

	const redditMetrics = getCardMetrics({
		platform: 'reddit',
		contentType: 'post',
		upvoteCount: 220,
		likeCount: 1,
		commentCount: 0,
	});
	assert.equal(redditMetrics.likeCount, 220);
	assert.equal(redditMetrics.label, '220 upvotes');

	assert.equal(normalizeHashtagToken(' #CS2! '), 'cs2');
	const tags = Array.from(
		extractHashtagsFromText('Love #CS2 and #Counter_Strike clips #x')
	);
	assert.deepEqual(tags.sort(), ['counter_strike', 'cs2'].sort());

	assert.equal(sanitizeRedditText('  multi\n\tspace  text  '), 'multi space text');
	assert.equal(
		parseRedditUsernameFromUrl('https://www.reddit.com/user/OwenMinerCS/submitted/'),
		'OwenMinerCS'
	);
	assert.equal(parseRedditUsernameFromUrl('https://reddit.com/u/someone'), 'someone');
	assert.equal(parseRedditUsernameFromUrl('https://example.com'), '');

	assert.equal(normalizeAspectRatio(1920, 1080), '1920 / 1080');
	assert.equal(normalizeAspectRatio(0, 1080), '16 / 9');
	assert.equal(normalizeAspectRatio('bad', 'data', '4 / 3'), '4 / 3');

	const fitted = fitIframeToBox(400, 300, 1280, 720);
	assert.equal(fitted.w, 400);
	assert.equal(fitted.h, 225);
	const tallFit = fitIframeToBox(200, 100, 9, 16);
	assert.equal(tallFit.h, 100);
	assert.equal(tallFit.w, 56);

	const fresh = getCuratedShortScore({
		viewCount: 1000,
		likeCount: 200,
		publishedAt: '2026-08-01T00:00:00Z',
	});
	const stale = getCuratedShortScore({
		viewCount: 1000,
		likeCount: 200,
		publishedAt: '2024-01-01T00:00:00Z',
	});
	assert.ok(fresh > stale, 'newer posts should score higher when engagement matches');
});
