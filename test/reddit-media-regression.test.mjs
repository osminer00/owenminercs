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

function extractConst(source, name) {
	const marker = `const ${name} =`;
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, `${name} should exist`);
	const end = source.indexOf(';', start);
	assert.notEqual(end, -1, `${name} should end`);
	return source.slice(start, end + 1);
}

function hostify(value) {
	return JSON.parse(JSON.stringify(value));
}

function loadRedditMediaHelpers() {
	const source = readWorkspaceFile('Socials/scripts/social-cloud.js');
	const sandbox = { URL };
	vm.runInNewContext(
		[
			extractConst(source, 'MIN_SOCIAL_ENGAGEMENT'),
			extractConst(source, 'REDDIT_MIN_UPVOTES'),
			extractFunction(source, 'isHttpUrl'),
			extractFunction(source, 'toSafeNumber'),
			extractFunction(source, 'normalizeAspectRatio'),
			extractFunction(source, 'decodeHtmlEntities'),
			extractFunction(source, 'sanitizeRedditText'),
			extractFunction(source, 'getRedditPreviewImage'),
			extractFunction(source, 'getRedditGalleryImage'),
			extractFunction(source, 'getRedditVideoData'),
			extractFunction(source, 'getRedditHostedVideoFallbackUrl'),
			extractFunction(source, 'isRedditProgressiveMp4Url'),
			extractFunction(source, 'isRedditNonNativeVideoStreamUrl'),
			extractFunction(source, 'redditPostUrlToMediaEmbed'),
			extractFunction(source, 'toRedditContentItem'),
			extractFunction(source, 'isShortFormVideo'),
			extractFunction(source, 'getResolvedContentType'),
			extractFunction(source, 'getEmbedConfig'),
			extractFunction(source, 'isBlockedSocialContentItem'),
			'this.__helpers = { REDDIT_MIN_UPVOTES, getRedditVideoData, getRedditHostedVideoFallbackUrl, redditPostUrlToMediaEmbed, toRedditContentItem, getEmbedConfig, isBlockedSocialContentItem };',
		].join('\n'),
		sandbox
	);
	assert.equal(typeof sandbox.__helpers.toRedditContentItem, 'function');
	return sandbox.__helpers;
}

const helpers = loadRedditMediaHelpers();
const PUBLISHED_UTC = 1700000000;
const PUBLISHED_ISO = new Date(PUBLISHED_UTC * 1000).toISOString();

function basePost(overrides = {}) {
	return {
		score: 150,
		permalink: '/r/GlobalOffensive/comments/abc123',
		title: 'Clip',
		created_utc: PUBLISHED_UTC,
		...overrides,
	};
}

test('Reddit posts below the upvote floor are dropped', () => {
	const { toRedditContentItem, REDDIT_MIN_UPVOTES } = helpers;
	assert.equal(REDDIT_MIN_UPVOTES, 101);
	assert.equal(toRedditContentItem(basePost({ score: 100 })), null);
	assert.equal(toRedditContentItem(basePost({ score: '100' })), null);
	assert.equal(toRedditContentItem(basePost({ score: undefined })), null);
	assert.equal(toRedditContentItem(basePost({ score: 101, permalink: '', url: '' })), null);

	const kept = hostify(toRedditContentItem(basePost({ score: '101' })));
	assert.equal(kept.upvoteCount, 101);
	assert.equal(kept.likeCount, 101);
	assert.equal(kept.url, 'https://www.reddit.com/r/GlobalOffensive/comments/abc123');
	assert.equal(kept.publishedAt, PUBLISHED_ISO);
});

test('Reddit video embeds prefer a progressive MP4 over HLS or DASH', () => {
	const { toRedditContentItem, getRedditVideoData, getRedditHostedVideoFallbackUrl, getEmbedConfig } =
		helpers;

	const secure = {
		fallback_url: 'https://v.redd.it/secure/DASH_720.mp4?a=1&amp;b=2',
		hls_url: 'https://v.redd.it/secure/HLSPlaylist.m3u8',
		dash_url: 'https://v.redd.it/secure/DASHPlaylist.mpd',
		width: 1920,
		height: 1080,
	};
	const post = basePost({
		is_video: true,
		url: 'https://v.redd.it/otherid',
		secure_media: { reddit_video: secure },
		media: {
			reddit_video: { fallback_url: 'https://v.redd.it/media/DASH_480.mp4', width: 10, height: 10 },
		},
	});

	assert.equal(getRedditVideoData(post).fallback_url, secure.fallback_url);
	const card = hostify(toRedditContentItem(post));
	assert.equal(card.contentType, 'video');
	assert.equal(card.mediaKind, 'video');
	assert.equal(card.embedUrl, 'https://v.redd.it/secure/DASH_720.mp4?a=1&b=2');
	assert.equal(card.aspectRatio, '1920 / 1080');
	assert.deepEqual(hostify(getEmbedConfig(card)), {
		kind: 'video',
		src: card.embedUrl,
		className: 'reddit',
	});

	const hlsOnly = hostify(
		toRedditContentItem(
			basePost({
				post_hint: 'hosted:video',
				url_overridden_by_dest: 'https://example.com/watch',
				url: 'https://v.redd.it/AbC09',
				secure_media: {
					reddit_video: {
						fallback_url: 'https://v.redd.it/AbC09/HLSPlaylist.m3u8',
						hls_url: 'https://v.redd.it/AbC09/HLSPlaylist.m3u8',
						width: 1280,
						height: 720,
					},
				},
			})
		)
	);
	assert.equal(
		getRedditHostedVideoFallbackUrl(
			basePost({
				url_overridden_by_dest: 'https://example.com/watch',
				url: 'https://v.redd.it/AbC09',
			})
		),
		'https://v.redd.it/AbC09/DASH_720.mp4?source=fallback'
	);
	assert.equal(hlsOnly.embedUrl, 'https://v.redd.it/AbC09/DASH_720.mp4?source=fallback');
	assert.equal(hlsOnly.contentType, 'video');

	assert.equal(
		getEmbedConfig({ platform: 'reddit', contentType: 'video', embedUrl: 'https://v.redd.it/x/HLS.M3U8' }),
		null
	);
	assert.equal(
		getEmbedConfig({
			platform: 'reddit',
			contentType: 'video',
			embedUrl: 'https://v.redd.it/x/DASHPlaylist.mpd',
		}),
		null
	);
	assert.deepEqual(
		hostify(
			getEmbedConfig({
				platform: 'reddit',
				contentType: 'video',
				embedUrl: 'https://v.redd.it/x/clip.webm',
			})
		),
		{ kind: 'video', src: 'https://v.redd.it/x/clip.webm', className: 'reddit' }
	);
	assert.equal(
		getEmbedConfig({
			platform: 'reddit',
			contentType: 'image',
			embedUrl: 'https://v.redd.it/x/clip.mp4',
		}),
		null
	);
});

test('Reddit video data walks crossposts, then media, then the preview', () => {
	const { getRedditVideoData, getRedditHostedVideoFallbackUrl, toRedditContentItem } = helpers;

	const fromParent = hostify(
		toRedditContentItem(
			basePost({
				url: 'https://www.reddit.com/r/GlobalOffensive/comments/abc123',
				crosspost_parent_list: [
					null,
					{
						secure_media: {
							reddit_video: {
								fallback_url: 'https://v.redd.it/parent/DASH_480.mp4',
								width: 640,
								height: 360,
							},
						},
					},
				],
			})
		)
	);
	assert.equal(fromParent.embedUrl, 'https://v.redd.it/parent/DASH_480.mp4');
	assert.equal(fromParent.aspectRatio, '640 / 360');

	const mediaOnly = { media: { reddit_video: { fallback_url: 'https://cdn.example/media.mp4' } } };
	assert.equal(getRedditVideoData(mediaOnly).fallback_url, 'https://cdn.example/media.mp4');

	const previewOnly = {
		preview: { reddit_video_preview: { fallback_url: 'https://cdn.example/preview.mp4' } },
	};
	assert.equal(getRedditVideoData(previewOnly).fallback_url, 'https://cdn.example/preview.mp4');
	assert.deepEqual(hostify(getRedditVideoData({})), {});

	assert.equal(
		getRedditHostedVideoFallbackUrl({
			crosspost_parent_list: [null, { url: 'http://v.redd.it/fromparent' }],
		}),
		'https://v.redd.it/fromparent/DASH_720.mp4?source=fallback'
	);
	assert.equal(getRedditHostedVideoFallbackUrl({ url: 'https://example.com/post' }), '');
});

test('Reddit galleries, previews, and text posts keep distinct card fields', () => {
	const { toRedditContentItem } = helpers;

	const gallery = hostify(
		toRedditContentItem(
			basePost({
				is_gallery: true,
				title: '  Desk   \n photos  ',
				selftext: '  more   words ',
				gallery_data: { items: [{ media_id: '' }, { media_id: 'abc' }] },
				media_metadata: {
					abc: {
						s: { u: 'https://i.redd.it/full&amp;x=1.jpg', x: 800, y: 600 },
						p: [{ u: 'https://i.redd.it/small.jpg', x: 100, y: 80 }],
					},
				},
				thumbnail: 'https://example.com/thumb.jpg',
				num_comments: '12',
				view_count: 'nope',
			})
		)
	);
	assert.equal(gallery.contentType, 'gallery');
	assert.equal(gallery.mediaKind, 'image');
	assert.equal(gallery.embedUrl, '');
	assert.equal(gallery.thumbnail, 'https://i.redd.it/full&x=1.jpg');
	assert.equal(gallery.aspectRatio, '800 / 600');
	assert.equal(gallery.title, 'Desk photos');
	assert.equal(gallery.caption, 'more words');
	assert.equal(gallery.commentCount, 12);
	assert.equal(gallery.viewCount, 0);

	const preview = hostify(
		toRedditContentItem(
			basePost({
				post_hint: 'image',
				thumbnail: 'self',
				title: '',
				preview: {
					images: [
						{
							source: {
								url: 'https://preview.redd.it/a&amp;b.jpg',
								width: 4,
								height: 3,
							},
						},
					],
				},
			})
		)
	);
	assert.equal(preview.contentType, 'image');
	assert.equal(preview.thumbnail, 'https://preview.redd.it/a&b.jpg');
	assert.equal(preview.aspectRatio, '4 / 3');
	assert.equal(preview.title, 'Untitled Reddit post');
	assert.equal(preview.caption, '');

	const textPost = hostify(
		toRedditContentItem(
			basePost({
				permalink: '',
				url: 'https://www.reddit.com/r/GlobalOffensive/comments/text',
				title: 'Just text',
			})
		)
	);
	assert.equal(textPost.contentType, 'post');
	assert.equal(textPost.mediaKind, 'image');
	assert.equal(textPost.thumbnail, '');
	assert.equal(textPost.embedUrl, '');
	assert.equal(textPost.url, 'https://www.reddit.com/r/GlobalOffensive/comments/text');
	assert.equal(textPost.caption, 'Just text');
});

test('Reddit comment embeds stay on redditmedia and require a post path', () => {
	const { redditPostUrlToMediaEmbed } = helpers;
	assert.equal(
		redditPostUrlToMediaEmbed('https://old.reddit.com/r/GlobalOffensive/comments/abc123/title/'),
		'https://www.redditmedia.com/r/GlobalOffensive/comments/abc123/title?ref_source=embed&ref=share&embed=true'
	);
	assert.equal(redditPostUrlToMediaEmbed('https://www.reddit.com/r/GlobalOffensive'), '');
	assert.equal(redditPostUrlToMediaEmbed('https://www.reddit.com/user/OwenMCS'), '');
	assert.equal(redditPostUrlToMediaEmbed('https://example.com/r/GlobalOffensive/comments/abc'), '');
	assert.equal(redditPostUrlToMediaEmbed('javascript:alert(1)'), '');
	assert.equal(redditPostUrlToMediaEmbed(''), '');
	assert.equal(redditPostUrlToMediaEmbed(null), '');
});

test('blocked speaker names are removed from every social card field', () => {
	const { isBlockedSocialContentItem } = helpers;
	const clean = {
		title: 'Desk tour',
		caption: 'Monitor and keyboard',
		url: 'https://example.com/setup',
	};
	assert.equal(isBlockedSocialContentItem(clean), false);
	assert.equal(isBlockedSocialContentItem(null), false);
	assert.equal(isBlockedSocialContentItem({ title: 'play 3' }), false);

	for (const title of [
		'Harman Kardon review',
		'HARMON KARDON',
		'harman/kardon',
		'Harmon/Kardon',
		'harman-kardon',
		'harmon-kardon',
		'Go + Play 3',
		'GO+PLAY 3',
	]) {
		assert.equal(isBlockedSocialContentItem({ title }), true, title);
	}

	assert.equal(isBlockedSocialContentItem({ blurb: 'Reviewed the Harman Kardon' }), true);
	assert.equal(isBlockedSocialContentItem({ thumbnail: 'https://cdn.example/go+play 3.jpg' }), true);
	assert.equal(isBlockedSocialContentItem({ caption: 'harmon kardon speaker' }), true);
});
