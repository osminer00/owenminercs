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

function loadEmbedConfig() {
	const sandbox = {
		String,
		Boolean,
		URL,
		window: {
			location: { origin: 'https://www.owenminercs.com' },
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'isHttpUrl')}
		${extractFunction(socialCloudSource, 'isShortFormVideo')}
		${extractFunction(socialCloudSource, 'getResolvedContentType')}
		${extractFunction(socialCloudSource, 'getYouTubeVideoId')}
		${extractFunction(socialCloudSource, 'getYouTubeEmbedUrl')}
		${extractFunction(socialCloudSource, 'getTikTokEmbedUrl')}
		${extractFunction(socialCloudSource, 'isRedditProgressiveMp4Url')}
		${extractFunction(socialCloudSource, 'isRedditNonNativeVideoStreamUrl')}
		${extractFunction(socialCloudSource, 'getEmbedConfig')}
		this.__helpers = { getEmbedConfig };
		`,
		sandbox
	);

	return sandbox.__helpers.getEmbedConfig;
}

function embedFields(embed) {
	if (embed == null) return null;
	return {
		kind: String(embed.kind),
		src: String(embed.src),
		className: String(embed.className),
	};
}

test('getEmbedConfig mounts YouTube and TikTok iframes from watch/video URLs', () => {
	const getEmbedConfig = loadEmbedConfig();

	const youtube = embedFields(
		getEmbedConfig({
			platform: 'YouTube',
			url: 'https://www.youtube.com/watch?v=ian1kvdwsEA',
		})
	);
	assert.equal(youtube.kind, 'iframe');
	assert.equal(youtube.className, 'youtube');
	assert.match(youtube.src, /^https:\/\/www\.youtube\.com\/embed\/ian1kvdwsEA\?/);
	assert.match(youtube.src, /enablejsapi=1/);
	assert.match(youtube.src, /origin=https%3A%2F%2Fwww\.owenminercs\.com/);

	const provided = embedFields(
		getEmbedConfig({
			platform: 'youtube',
			embedUrl: 'https://www.youtube.com/embed/custom123',
			url: 'https://www.youtube.com/watch?v=ian1kvdwsEA',
		})
	);
	assert.equal(provided.src, 'https://www.youtube.com/embed/custom123');

	const tiktok = embedFields(
		getEmbedConfig({
			platform: 'tiktok',
			url: 'https://www.tiktok.com/@owen/video/7345123456789012345',
		})
	);
	assert.deepEqual(tiktok, {
		kind: 'iframe',
		src: 'https://www.tiktok.com/player/v1/7345123456789012345',
		className: 'tiktok',
	});
});

test('getEmbedConfig only plays Reddit progressive mp4/webm, never HLS/DASH or non-video posts', () => {
	const getEmbedConfig = loadEmbedConfig();

	assert.equal(
		getEmbedConfig({
			platform: 'reddit',
			contentType: 'image',
			embedUrl: 'https://v.redd.it/clip.mp4',
		}),
		null
	);
	assert.equal(
		getEmbedConfig({
			platform: 'reddit',
			contentType: 'video',
			embedUrl: '',
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
			contentType: 'video',
			embedUrl: 'https://v.redd.it/clip/DASHPlaylist.mpd',
		}),
		null
	);
	assert.equal(
		getEmbedConfig({
			platform: 'reddit',
			contentType: 'video',
			embedUrl: 'https://www.redditmedia.com/r/x/comments/abc?embed=true',
		}),
		null
	);

	assert.deepEqual(
		embedFields(
			getEmbedConfig({
				platform: 'reddit',
				contentType: 'video',
				embedUrl: 'https://v.redd.it/clip.mp4?source=fallback',
			})
		),
		{
			kind: 'video',
			src: 'https://v.redd.it/clip.mp4?source=fallback',
			className: 'reddit',
		}
	);
	assert.deepEqual(
		embedFields(
			getEmbedConfig({
				platform: 'reddit',
				contentType: 'video',
				embedUrl: 'https://v.redd.it/clip.webm',
			})
		),
		{
			kind: 'video',
			src: 'https://v.redd.it/clip.webm',
			className: 'reddit',
		}
	);
});

test('getEmbedConfig mounts X only for video media and rejects unknown platforms', () => {
	const getEmbedConfig = loadEmbedConfig();

	assert.equal(
		getEmbedConfig({
			platform: 'x',
			embedUrl: 'https://video.twimg.com/clip.mp4',
			mediaKind: 'photo',
		}),
		null
	);
	assert.equal(
		getEmbedConfig({
			platform: 'x',
			embedUrl: '',
			mediaKind: 'video',
		}),
		null
	);
	assert.deepEqual(
		embedFields(
			getEmbedConfig({
				platform: 'X',
				embedUrl: '  https://video.twimg.com/clip.mp4  ',
				mediaKind: 'VIDEO',
			})
		),
		{
			kind: 'video',
			src: 'https://video.twimg.com/clip.mp4',
			className: 'x',
		}
	);

	assert.equal(getEmbedConfig({ platform: 'instagram', url: 'https://www.instagram.com/p/abc/' }), null);
	assert.equal(getEmbedConfig({ platform: 'youtube', url: '', embedUrl: '' }), null);
	assert.equal(getEmbedConfig({ platform: 'tiktok', url: '' }), null);
});
