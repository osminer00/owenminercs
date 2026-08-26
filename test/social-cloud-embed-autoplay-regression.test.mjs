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
			if (depth === 0) {
				const prefix = start >= 6 && source.slice(start - 6, start) === 'async ' ? 'async ' : '';
				return prefix + source.slice(start, i + 1);
			}
		}
	}

	assert.fail(`${functionName} body should close`);
}

function loadEmbedHelpers() {
	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		Array,
		URL,
		encodeURIComponent,
		window: {
			location: {
				origin: 'https://www.owenminercs.com',
				href: 'https://www.owenminercs.com/Socials/socials.html',
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'isShortFormVideo')}
		${extractFunction(socialCloudSource, 'getResolvedContentType')}
		${extractFunction(socialCloudSource, 'getYouTubeVideoId')}
		${extractFunction(socialCloudSource, 'getYouTubeEmbedUrl')}
		${extractFunction(socialCloudSource, 'getTikTokEmbedUrl')}
		${extractFunction(socialCloudSource, 'isRedditProgressiveMp4Url')}
		${extractFunction(socialCloudSource, 'isRedditNonNativeVideoStreamUrl')}
		${extractFunction(socialCloudSource, 'getEmbedConfig')}
		${extractFunction(socialCloudSource, 'getAutoplayEmbedUrl')}
		${extractFunction(socialCloudSource, 'getIframeReferenceDimensions')}
		this.__helpers = {
			isShortFormVideo,
			getResolvedContentType,
			getYouTubeVideoId,
			getYouTubeEmbedUrl,
			getTikTokEmbedUrl,
			isRedditProgressiveMp4Url,
			isRedditNonNativeVideoStreamUrl,
			getEmbedConfig,
			getAutoplayEmbedUrl,
			getIframeReferenceDimensions,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'social-cloud embed helpers should load');
	return sandbox.__helpers;
}

test('getAutoplayEmbedUrl mutes looping YouTube/TikTok embeds and keeps invalid srcs off those hosts', () => {
	const { getAutoplayEmbedUrl } = loadEmbedHelpers();

	assert.equal(getAutoplayEmbedUrl(''), '');

	const youtube = new URL(
		getAutoplayEmbedUrl('https://www.youtube.com/embed/EmNTRsInyiA?rel=0')
	);
	assert.equal(youtube.searchParams.get('autoplay'), '1');
	assert.equal(youtube.searchParams.get('playsinline'), '1');
	assert.equal(youtube.searchParams.get('loop'), '1');
	assert.equal(youtube.searchParams.get('mute'), '1');
	assert.equal(youtube.searchParams.get('enablejsapi'), '1');
	assert.equal(youtube.searchParams.get('playlist'), 'EmNTRsInyiA');
	assert.equal(youtube.searchParams.get('origin'), 'https://www.owenminercs.com');

	const tiktok = new URL(getAutoplayEmbedUrl('https://www.tiktok.com/player/v1/7123456789'));
	assert.equal(tiktok.searchParams.get('autoplay'), '1');
	assert.equal(tiktok.searchParams.get('muted'), '1');
	assert.equal(tiktok.searchParams.get('loop'), '1');
	assert.equal(tiktok.searchParams.get('mute'), null);

	const scripted = getAutoplayEmbedUrl('javascript:alert(1)');
	assert.match(scripted, /^javascript:/);
	assert.doesNotMatch(scripted, /youtube|tiktok/i);
	assert.equal(new URL(scripted).searchParams.get('mute'), null);
	assert.equal(new URL(scripted).searchParams.get('playlist'), null);

	const relative = new URL(getAutoplayEmbedUrl('/embed/clip'));
	assert.equal(relative.origin, 'https://www.owenminercs.com');
	assert.equal(relative.pathname, '/embed/clip');
	assert.equal(relative.searchParams.get('autoplay'), '1');
	assert.equal(relative.searchParams.get('mute'), null);

	assert.equal(
		getAutoplayEmbedUrl('http://['),
		'http://[?autoplay=1&playsinline=1&loop=1'
	);
});

test('getEmbedConfig only mounts http video players for YouTube, TikTok, progressive Reddit, and X video', () => {
	const { getEmbedConfig } = loadEmbedHelpers();

	const youtube = getEmbedConfig({
		platform: 'youtube',
		url: 'https://www.youtube.com/watch?v=EmNTRsInyiA',
		contentType: 'short',
	});
	assert.equal(youtube.kind, 'iframe');
	assert.equal(youtube.className, 'youtube');
	assert.match(youtube.src, /^https:\/\/www\.youtube\.com\/embed\/EmNTRsInyiA\?/);
	assert.match(youtube.src, /enablejsapi=1/);
	assert.match(youtube.src, /origin=https%3A%2F%2Fwww\.owenminercs\.com/);

	const youtubePrefersEmbedUrl = getEmbedConfig({
		platform: 'YouTube',
		embedUrl: 'https://www.youtube.com/embed/pref123',
		url: 'https://www.youtube.com/watch?v=ignored',
	});
	assert.equal(youtubePrefersEmbedUrl.src, 'https://www.youtube.com/embed/pref123');

	assert.equal(getEmbedConfig({ platform: 'youtube', url: 'https://example.com/not-yt' }), null);

	const tiktok = getEmbedConfig({
		platform: 'tiktok',
		url: 'https://www.tiktok.com/@owenminercs/video/7123456789',
	});
	assert.equal(tiktok.kind, 'iframe');
	assert.equal(tiktok.className, 'tiktok');
	assert.equal(tiktok.src, 'https://www.tiktok.com/player/v1/7123456789');

	assert.equal(getEmbedConfig({ platform: 'tiktok', url: 'https://www.tiktok.com/@owenminercs' }).src, 'https://www.tiktok.com/embed/@owenminercs');
	assert.equal(getEmbedConfig({ platform: 'tiktok', url: 'https://example.com/no-id' }), null);

	assert.equal(
		getEmbedConfig({
			platform: 'reddit',
			contentType: 'video',
			embedUrl: 'https://v.redd.it/clip/DASHPlaylist.mpd',
		}),
		null
	);
	assert.equal(
		getEmbedConfig({
			platform: 'reddit',
			contentType: 'video',
			embedUrl: 'https://v.redd.it/clip/HLSPlaylist.m3u8',
		}),
		null
	);
	assert.equal(
		getEmbedConfig({
			platform: 'reddit',
			contentType: 'image',
			embedUrl: 'https://v.redd.it/clip.mp4',
		}),
		null
	);

	const redditMp4 = getEmbedConfig({
		platform: 'reddit',
		contentType: 'video',
		embedUrl: 'https://v.redd.it/clip.mp4?source=fallback',
	});
	assert.equal(redditMp4.kind, 'video');
	assert.equal(redditMp4.className, 'reddit');
	assert.equal(redditMp4.src, 'https://v.redd.it/clip.mp4?source=fallback');

	assert.equal(
		getEmbedConfig({
			platform: 'x',
			embedUrl: 'https://video.twimg.com/clip.mp4',
			mediaKind: 'image',
		}),
		null
	);
	assert.equal(getEmbedConfig({ platform: 'x', embedUrl: '', mediaKind: 'video' }), null);

	const xVideo = getEmbedConfig({
		platform: 'x',
		embedUrl: 'https://video.twimg.com/clip.mp4',
		mediaKind: 'video',
	});
	assert.equal(xVideo.kind, 'video');
	assert.equal(xVideo.className, 'x');
	assert.equal(xVideo.src, 'https://video.twimg.com/clip.mp4');

	assert.equal(getEmbedConfig({ platform: 'instagram', url: 'https://www.instagram.com/p/abc' }), null);
});

test('getIframeReferenceDimensions uses TikTok portrait, YouTube short/portrait, then landscape', () => {
	const { getIframeReferenceDimensions } = loadEmbedHelpers();

	const tiktok = getIframeReferenceDimensions({ contentType: 'video' }, { className: 'tiktok' });
	assert.equal(tiktok.w, 405);
	assert.equal(tiktok.h, 720);

	const youtubeShort = getIframeReferenceDimensions(
		{ contentType: 'short', url: 'https://www.youtube.com/shorts/abc' },
		{ className: 'youtube' }
	);
	assert.equal(youtubeShort.w, 720);
	assert.equal(youtubeShort.h, 1280);

	const youtubePortrait = getIframeReferenceDimensions(
		{ contentType: 'video', videoAspectRatio: 0.56 },
		{ className: 'youtube' }
	);
	assert.equal(youtubePortrait.w, 720);
	assert.equal(youtubePortrait.h, 1280);

	const youtubeLandscape = getIframeReferenceDimensions(
		{ contentType: 'video', videoAspectRatio: 1.77 },
		{ className: 'youtube' }
	);
	assert.equal(youtubeLandscape.w, 1280);
	assert.equal(youtubeLandscape.h, 720);

	const otherPortrait = getIframeReferenceDimensions(
		{ contentType: 'video', videoAspectRatio: 0.8 },
		{ className: 'x' }
	);
	assert.equal(otherPortrait.w, 720);
	assert.equal(otherPortrait.h, 1280);

	const otherLandscape = getIframeReferenceDimensions(
		{ contentType: 'video', videoAspectRatio: 1.5 },
		{ className: 'x' }
	);
	assert.equal(otherLandscape.w, 1280);
	assert.equal(otherLandscape.h, 720);
});
