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

function loadCatalogHelpers(options = {}) {
	const catalogItems = Array.isArray(options.catalogItems) ? options.catalogItems : [];
	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		Array,
		URL,
		Map,
		Set,
		console,
		config: {
			enabledNoteTypes: options.enabledNoteTypes || ['video', 'social'],
			preferredYouTubeContentTypes: options.preferredYouTubeContentTypes || [],
		},
		selectedHashtagFilter: options.selectedHashtagFilter || '',
		getCardCatalog(contentItems) {
			return options.getCardCatalog
				? options.getCardCatalog(contentItems)
				: catalogItems;
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'isHttpUrl')}
		${extractFunction(socialCloudSource, 'normalizeAspectRatio')}
		${extractFunction(socialCloudSource, 'decodeHtmlEntities')}
		${extractFunction(socialCloudSource, 'normalizeHashtagToken')}
		${extractFunction(socialCloudSource, 'extractHashtagsFromText')}
		${extractFunction(socialCloudSource, 'getContentItemHashtags')}
		${extractFunction(socialCloudSource, 'isBlockedSocialContentItem')}
		${extractFunction(socialCloudSource, 'getRedditPreviewImage')}
		${extractFunction(socialCloudSource, 'getRedditGalleryImage')}
		${extractFunction(socialCloudSource, 'getRedditVideoData')}
		${extractFunction(socialCloudSource, 'getRedditHostedVideoFallbackUrl')}
		${extractFunction(socialCloudSource, 'getRedditIframeFallbackUrl')}
		${extractFunction(socialCloudSource, 'isRedditProgressiveMp4Url')}
		${extractFunction(socialCloudSource, 'isRedditNonNativeVideoStreamUrl')}
		${extractFunction(socialCloudSource, 'redditPostUrlToMediaEmbed')}
		${extractFunction(socialCloudSource, 'getEnabledCatalog')}
		${extractFunction(socialCloudSource, 'getHashtagFilterCounts')}
		this.__helpers = {
			isHttpUrl,
			normalizeAspectRatio,
			decodeHtmlEntities,
			normalizeHashtagToken,
			extractHashtagsFromText,
			getContentItemHashtags,
			isBlockedSocialContentItem,
			getRedditPreviewImage,
			getRedditGalleryImage,
			getRedditVideoData,
			getRedditHostedVideoFallbackUrl,
			getRedditIframeFallbackUrl,
			isRedditProgressiveMp4Url,
			isRedditNonNativeVideoStreamUrl,
			redditPostUrlToMediaEmbed,
			getEnabledCatalog,
			getHashtagFilterCounts,
			get selectedHashtagFilter() { return selectedHashtagFilter; },
			set selectedHashtagFilter(value) { selectedHashtagFilter = value; },
			config,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('social-cloud hashtag helpers normalize tags from title/caption/description', () => {
	const { normalizeHashtagToken, getContentItemHashtags } = loadCatalogHelpers();

	assert.equal(normalizeHashtagToken('#CS2'), 'cs2');
	assert.equal(normalizeHashtagToken(' Counter-Strike! '), 'counterstrike');
	assert.equal(normalizeHashtagToken('#'), '');

	const tags = Array.from(
		getContentItemHashtags({
			title: 'Desk tour #Setup',
			caption: 'More #setup and #CS2',
			description: 'Ignore ## and #x',
		})
	);
	assert.deepEqual(tags.sort(), ['cs2', 'setup'].sort());
});

test('social-cloud hashtag filter counts sort by frequency then tag name', () => {
	const { getHashtagFilterCounts } = loadCatalogHelpers({
		catalogItems: [
			{ type: 'video', hashtags: ['cs2', 'setup'] },
			{ type: 'video', hashtags: ['cs2'] },
			{ type: 'social', hashtags: ['ignored'] },
			{ type: 'video', hashtags: ['#Alpha', 'setup'] },
			{ type: 'video', hashtags: [''] },
		],
	});

	const counts = Array.from(getHashtagFilterCounts([])).map(([tag, count]) => ({
		tag,
		count,
	}));
	assert.deepEqual(counts, [
		{ tag: 'cs2', count: 2 },
		{ tag: 'setup', count: 2 },
		{ tag: 'alpha', count: 1 },
	]);
});

test('social-cloud enabled catalog filters by type, YouTube preference, blocks, and active hashtag', () => {
	const catalogItems = [
		{ type: 'video', platform: 'TikTok', contentType: 'short', hashtags: ['cs2'] },
		{ type: 'video', platform: 'YouTube', contentType: 'short', hashtags: ['cs2'] },
		{ type: 'video', platform: 'YouTube', contentType: 'video', hashtags: ['setup'] },
		{ type: 'social', platform: 'x', contentType: 'post', hashtags: ['cs2'] },
		{
			type: 'video',
			platform: 'reddit',
			contentType: 'video',
			title: 'Harman Kardon speaker',
			hashtags: ['cs2'],
		},
	];

	const helpers = loadCatalogHelpers({
		catalogItems,
		enabledNoteTypes: ['video', 'social'],
		preferredYouTubeContentTypes: ['short'],
	});

	const enabled = Array.from(helpers.getEnabledCatalog([])).map((item) => ({
		platform: item.platform,
		contentType: item.contentType,
		type: item.type,
	}));
	assert.deepEqual(enabled, [
		{ platform: 'TikTok', contentType: 'short', type: 'video' },
		{ platform: 'YouTube', contentType: 'short', type: 'video' },
		{ platform: 'x', contentType: 'post', type: 'social' },
	]);

	helpers.selectedHashtagFilter = 'CS2';
	const filtered = Array.from(helpers.getEnabledCatalog([])).map((item) => item.platform);
	assert.deepEqual(filtered, ['TikTok', 'YouTube']);
});

test('social-cloud Reddit media extractors decode previews, galleries, and video fallbacks', () => {
	const {
		getRedditPreviewImage,
		getRedditGalleryImage,
		getRedditVideoData,
		getRedditHostedVideoFallbackUrl,
		getRedditIframeFallbackUrl,
		isRedditProgressiveMp4Url,
		isRedditNonNativeVideoStreamUrl,
		redditPostUrlToMediaEmbed,
	} = loadCatalogHelpers();

	const preview = getRedditPreviewImage({
		preview: {
			images: [
				{
					source: {
						url: 'https://i.redd.it/a.jpg?width=1200&amp;format=pjpg',
						width: 1200,
						height: 900,
					},
				},
			],
		},
	});
	assert.equal(preview.url, 'https://i.redd.it/a.jpg?width=1200&format=pjpg');
	assert.equal(preview.aspectRatio, '1200 / 900');
	assert.equal(getRedditPreviewImage({}).url, '');
	assert.equal(getRedditPreviewImage({}).aspectRatio, '');

	const gallery = getRedditGalleryImage({
		gallery_data: { items: [{ media_id: 'abc123' }] },
		media_metadata: {
			abc123: {
				s: { u: 'https://preview.redd.it/pic.jpg?s=1&amp;width=800', x: 800, y: 600 },
			},
		},
	});
	assert.equal(gallery.url, 'https://preview.redd.it/pic.jpg?s=1&width=800');
	assert.equal(gallery.aspectRatio, '800 / 600');
	assert.equal(getRedditGalleryImage({ gallery_data: { items: [] } }).url, '');

	const videoFromCrosspost = getRedditVideoData({
		crosspost_parent_list: [
			{
				secure_media: {
					reddit_video: { fallback_url: 'https://v.redd.it/abc/DASH_720.mp4', width: 1280 },
				},
			},
		],
	});
	assert.equal(videoFromCrosspost.fallback_url, 'https://v.redd.it/abc/DASH_720.mp4');
	assert.equal(videoFromCrosspost.width, 1280);
	assert.equal(Object.keys(getRedditVideoData({})).length, 0);

	assert.equal(
		getRedditHostedVideoFallbackUrl({
			url_overridden_by_dest: 'https://v.redd.it/xyz123',
		}),
		'https://v.redd.it/xyz123/DASH_720.mp4?source=fallback'
	);
	assert.equal(getRedditHostedVideoFallbackUrl({ url: 'https://i.redd.it/still.jpg' }), '');

	assert.equal(
		getRedditIframeFallbackUrl('/r/cs2/comments/abc/title/'),
		'https://www.redditmedia.com/r/cs2/comments/abc/title/?ref_source=embed&ref=share&embed=true'
	);
	assert.equal(getRedditIframeFallbackUrl(''), '');

	assert.equal(isRedditProgressiveMp4Url('https://v.redd.it/a/DASH_720.mp4?source=fallback'), true);
	assert.equal(isRedditProgressiveMp4Url('https://v.redd.it/a/DASHPlaylist.mpd'), false);
	assert.equal(isRedditNonNativeVideoStreamUrl('https://v.redd.it/a/HLS.m3u8'), true);
	assert.equal(isRedditNonNativeVideoStreamUrl('https://v.redd.it/a/file.mp4'), false);

	assert.equal(
		redditPostUrlToMediaEmbed('https://www.reddit.com/r/cs2/comments/abc123/my_post/'),
		'https://www.redditmedia.com/r/cs2/comments/abc123/my_post?ref_source=embed&ref=share&embed=true'
	);
	assert.equal(redditPostUrlToMediaEmbed('https://example.com/r/cs2/comments/abc/title'), '');
	assert.equal(redditPostUrlToMediaEmbed('javascript:alert(1)'), '');
	assert.equal(redditPostUrlToMediaEmbed('https://www.reddit.com/r/cs2/'), '');
});
