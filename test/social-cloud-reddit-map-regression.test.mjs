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

function loadRedditHelpers() {
	const sandbox = {
		String,
		Number,
		Boolean,
		Date,
		JSON,
		URL,
		Array,
		Math,
		Object,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		const MIN_SOCIAL_ENGAGEMENT = 101;
		const REDDIT_MIN_UPVOTES = MIN_SOCIAL_ENGAGEMENT;
		${extractFunction(socialCloudSource, 'normalizePlatformKey')}
		${extractFunction(socialCloudSource, 'isHttpUrl')}
		${extractFunction(socialCloudSource, 'toSafeNumber')}
		${extractFunction(socialCloudSource, 'normalizeAspectRatio')}
		${extractFunction(socialCloudSource, 'decodeHtmlEntities')}
		${extractFunction(socialCloudSource, 'sanitizeRedditText')}
		${extractFunction(socialCloudSource, 'getRedditPreviewImage')}
		${extractFunction(socialCloudSource, 'getRedditGalleryImage')}
		${extractFunction(socialCloudSource, 'getRedditVideoData')}
		${extractFunction(socialCloudSource, 'getRedditHostedVideoFallbackUrl')}
		${extractFunction(socialCloudSource, 'isRedditProgressiveMp4Url')}
		${extractFunction(socialCloudSource, 'isRedditNonNativeVideoStreamUrl')}
		${extractFunction(socialCloudSource, 'redditPostUrlToMediaEmbed')}
		${extractFunction(socialCloudSource, 'toRedditContentItem')}
		${extractFunction(socialCloudSource, 'normalizeFeedItems')}
		${extractFunction(socialCloudSource, 'hasMinimumSocialEngagement')}
		this.__helpers = {
			MIN_SOCIAL_ENGAGEMENT,
			isHttpUrl,
			normalizeAspectRatio,
			decodeHtmlEntities,
			getRedditHostedVideoFallbackUrl,
			isRedditProgressiveMp4Url,
			isRedditNonNativeVideoStreamUrl,
			redditPostUrlToMediaEmbed,
			toRedditContentItem,
			normalizeFeedItems,
			hasMinimumSocialEngagement,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

function itemFields(item) {
	if (!item) return null;
	return {
		platform: String(item.platform),
		contentType: String(item.contentType),
		title: String(item.title),
		url: String(item.url),
		thumbnail: String(item.thumbnail),
		caption: String(item.caption),
		embedUrl: String(item.embedUrl),
		mediaKind: String(item.mediaKind),
		publishedAt: String(item.publishedAt),
		upvoteCount: Number(item.upvoteCount),
		commentCount: Number(item.commentCount),
		viewCount: Number(item.viewCount),
		likeCount: Number(item.likeCount),
		aspectRatio: String(item.aspectRatio),
	};
}

test('social cloud still uses a 101-engagement floor for Reddit posts', () => {
	assert.match(socialCloudSource, /const MIN_SOCIAL_ENGAGEMENT = 101;/);
	assert.match(socialCloudSource, /const REDDIT_MIN_UPVOTES = MIN_SOCIAL_ENGAGEMENT;/);
});

test('Reddit URL classifiers keep progressive MP4/WebM and reject HLS/DASH streams', () => {
	const {
		isRedditProgressiveMp4Url,
		isRedditNonNativeVideoStreamUrl,
		getRedditHostedVideoFallbackUrl,
		redditPostUrlToMediaEmbed,
		isHttpUrl,
	} = loadRedditHelpers();

	assert.equal(isRedditProgressiveMp4Url('https://v.redd.it/abc/DASH_720.mp4'), true);
	assert.equal(isRedditProgressiveMp4Url('https://v.redd.it/abc/DASH_720.mp4?source=fallback'), true);
	assert.equal(isRedditProgressiveMp4Url('https://v.redd.it/abc/clip.webm'), true);
	assert.equal(isRedditProgressiveMp4Url('https://v.redd.it/abc/HLSPlaylist.m3u8'), false);
	assert.equal(isRedditProgressiveMp4Url(''), false);

	assert.equal(isRedditNonNativeVideoStreamUrl('https://v.redd.it/abc/HLSPlaylist.m3u8'), true);
	assert.equal(isRedditNonNativeVideoStreamUrl('https://v.redd.it/abc/DASHPlaylist.mpd'), true);
	assert.equal(isRedditNonNativeVideoStreamUrl('https://v.redd.it/abc/DASH_720.mp4'), false);

	assert.equal(
		getRedditHostedVideoFallbackUrl({ url: 'https://v.redd.it/abc123xyz' }),
		'https://v.redd.it/abc123xyz/DASH_720.mp4?source=fallback'
	);
	assert.equal(
		getRedditHostedVideoFallbackUrl({
			crosspost_parent_list: [{ url_overridden_by_dest: 'https://v.redd.it/parentvid' }],
		}),
		'https://v.redd.it/parentvid/DASH_720.mp4?source=fallback'
	);
	assert.equal(getRedditHostedVideoFallbackUrl({ url: 'https://i.redd.it/pic.jpg' }), '');

	assert.equal(
		redditPostUrlToMediaEmbed('https://www.reddit.com/r/cs2/comments/abc/title/'),
		'https://www.redditmedia.com/r/cs2/comments/abc/title?ref_source=embed&ref=share&embed=true'
	);
	assert.equal(redditPostUrlToMediaEmbed('https://example.com/r/cs2/comments/abc/title'), '');
	assert.equal(redditPostUrlToMediaEmbed('https://www.reddit.com/r/cs2'), '');
	assert.equal(redditPostUrlToMediaEmbed('javascript:alert(1)'), '');
	assert.equal(isHttpUrl('javascript:alert(1)'), false);
});

test('toRedditContentItem drops low scores and never feeds HLS into the video src', () => {
	const { toRedditContentItem } = loadRedditHelpers();

	assert.equal(
		toRedditContentItem({
			score: 100,
			permalink: '/r/cs2/comments/abc/title/',
			title: 'Too quiet',
		}),
		null
	);
	assert.equal(toRedditContentItem({ score: 200, title: 'No url' }), null);

	const mp4Item = itemFields(
		toRedditContentItem({
			score: 101,
			permalink: '/r/cs2/comments/vid1/clip/',
			title: '  Native  MP4  ',
			selftext: '  body   text  ',
			is_video: true,
			created_utc: 1_704_067_200,
			num_comments: '4',
			view_count: '9',
			secure_media: {
				reddit_video: {
					fallback_url: 'https://v.redd.it/clip1/DASH_720.mp4?source=fallback',
					width: 1920,
					height: 1080,
				},
			},
		})
	);
	assert.equal(mp4Item.platform, 'reddit');
	assert.equal(mp4Item.contentType, 'video');
	assert.equal(mp4Item.mediaKind, 'video');
	assert.equal(mp4Item.title, 'Native MP4');
	assert.equal(mp4Item.caption, 'body text');
	assert.equal(mp4Item.url, 'https://www.reddit.com/r/cs2/comments/vid1/clip/');
	assert.equal(mp4Item.embedUrl, 'https://v.redd.it/clip1/DASH_720.mp4?source=fallback');
	assert.equal(mp4Item.aspectRatio, '1920 / 1080');
	assert.equal(mp4Item.upvoteCount, 101);
	assert.equal(mp4Item.likeCount, 101);
	assert.equal(mp4Item.commentCount, 4);
	assert.equal(mp4Item.viewCount, 9);
	assert.equal(mp4Item.publishedAt, '2024-01-01T00:00:00.000Z');

	const hlsWithHostedFallback = itemFields(
		toRedditContentItem({
			score: 150,
			permalink: '/r/cs2/comments/vid2/hls/',
			title: 'HLS only',
			is_video: true,
			created_utc: 1_704_067_200,
			url: 'https://v.redd.it/clip2',
			secure_media: {
				reddit_video: {
					fallback_url: 'https://v.redd.it/clip2/HLSPlaylist.m3u8',
					hls_url: 'https://v.redd.it/clip2/HLSPlaylist.m3u8',
				},
			},
		})
	);
	assert.equal(hlsWithHostedFallback.contentType, 'video');
	assert.equal(
		hlsWithHostedFallback.embedUrl,
		'https://v.redd.it/clip2/DASH_720.mp4?source=fallback'
	);

	const hlsWithoutFallback = itemFields(
		toRedditContentItem({
			score: 150,
			permalink: '/r/cs2/comments/vid3/broken/',
			title: 'No progressive source',
			is_video: true,
			created_utc: 1_704_067_200,
			url: 'https://www.reddit.com/r/cs2/comments/vid3/broken/',
			secure_media: {
				reddit_video: {
					hls_url: 'https://v.redd.it/clip3/HLSPlaylist.m3u8',
					dash_url: 'https://v.redd.it/clip3/DASHPlaylist.mpd',
				},
			},
		})
	);
	assert.equal(hlsWithoutFallback.contentType, 'video');
	assert.equal(hlsWithoutFallback.embedUrl, '');

	const gallery = itemFields(
		toRedditContentItem({
			score: 200,
			permalink: '/r/cs2/comments/gal/shots/',
			title: 'Album',
			is_gallery: true,
			created_utc: 1_704_067_200,
			gallery_data: { items: [{ media_id: 'm1' }] },
			media_metadata: {
				m1: {
					s: { u: 'https://i.redd.it/pic.jpg?s=1&amp;foo=1', x: 800, y: 600 },
				},
			},
		})
	);
	assert.equal(gallery.contentType, 'gallery');
	assert.equal(gallery.mediaKind, 'image');
	assert.equal(gallery.embedUrl, '');
	assert.equal(gallery.thumbnail, 'https://i.redd.it/pic.jpg?s=1&foo=1');
	assert.equal(gallery.aspectRatio, '800 / 600');
});

test('normalizeFeedItems maps permalink/metrics and hasMinimumSocialEngagement uses the 101 floor', () => {
	const { normalizeFeedItems, hasMinimumSocialEngagement } = loadRedditHelpers();

	assert.deepEqual(Array.from(normalizeFeedItems(null)), []);
	assert.deepEqual(Array.from(normalizeFeedItems({})), []);

	const mapped = Array.from(normalizeFeedItems([
		{
			platform: 'Twitter',
			contentType: 'Video',
			title: 'Clip',
			permalink: 'https://x.com/OwenMiner/status/1',
			description: 'hello',
			publishedAt: '2026-01-01',
			media: {
				thumbnailUrl: 'https://img.example/1.jpg',
				embedUrl: 'https://video.example/1.mp4',
				kind: 'Video',
				aspectRatio: '16 / 9',
			},
			metrics: {
				viewCount: '10',
				upvoteCount: '12',
				replyCount: '3',
			},
			isLive: 1,
		},
	])).map((item) => ({
		platform: String(item.platform),
		contentType: String(item.contentType),
		url: String(item.url),
		thumbnail: String(item.thumbnail),
		embedUrl: String(item.embedUrl),
		caption: String(item.caption),
		viewCount: Number(item.viewCount),
		likeCount: Number(item.likeCount),
		upvoteCount: Number(item.upvoteCount),
		commentCount: Number(item.commentCount),
		mediaKind: String(item.mediaKind),
		aspectRatio: String(item.aspectRatio),
		isLive: Boolean(item.isLive),
	}));

	assert.equal(mapped.length, 1);
	assert.equal(mapped[0].platform, 'x');
	assert.equal(mapped[0].contentType, 'video');
	assert.equal(mapped[0].url, 'https://x.com/OwenMiner/status/1');
	assert.equal(mapped[0].thumbnail, 'https://img.example/1.jpg');
	assert.equal(mapped[0].embedUrl, 'https://video.example/1.mp4');
	assert.equal(mapped[0].caption, 'hello');
	assert.equal(mapped[0].viewCount, 10);
	assert.equal(mapped[0].likeCount, 12);
	assert.equal(mapped[0].upvoteCount, 12);
	assert.equal(mapped[0].commentCount, 3);
	assert.equal(mapped[0].mediaKind, 'video');
	assert.equal(mapped[0].aspectRatio, '16 / 9');
	assert.equal(mapped[0].isLive, true);

	assert.equal(hasMinimumSocialEngagement({ platform: 'reddit', upvoteCount: 100 }), false);
	assert.equal(hasMinimumSocialEngagement({ platform: 'reddit', upvoteCount: 101 }), true);
	assert.equal(hasMinimumSocialEngagement({ platform: 'youtube', likeCount: 100 }), false);
	assert.equal(hasMinimumSocialEngagement({ platform: 'youtube', likeCount: 101 }), true);
});
