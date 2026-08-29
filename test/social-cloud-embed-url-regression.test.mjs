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

function loadEmbedUrlHelpers(options = {}) {
	const origin = Object.prototype.hasOwnProperty.call(options, 'origin')
		? options.origin
		: 'https://owenminercs.com';
	const sandbox = {
		String,
		encodeURIComponent,
		URL,
		window: origin
			? {
					location: { origin },
				}
			: {},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'getYouTubeVideoId')}
		${extractFunction(socialCloudSource, 'getYouTubeEmbedUrl')}
		${extractFunction(socialCloudSource, 'getTikTokEmbedUrl')}
		this.__helpers = { getYouTubeVideoId, getYouTubeEmbedUrl, getTikTokEmbedUrl };
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('getYouTubeVideoId parses watch, shorts, embed, and youtu.be URLs and falls back after malformed hosts', () => {
	const { getYouTubeVideoId } = loadEmbedUrlHelpers();

	assert.equal(getYouTubeVideoId(''), '');
	assert.equal(getYouTubeVideoId(null), '');
	assert.equal(
		getYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12s'),
		'dQw4w9WgXcQ'
	);
	assert.equal(getYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
	assert.equal(getYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ?feature=share'), 'dQw4w9WgXcQ');
	assert.equal(getYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
	assert.equal(getYouTubeVideoId('javascript:alert(1)'), '');
	assert.equal(getYouTubeVideoId('http://['), '');
	assert.equal(getYouTubeVideoId('not a url but v=AbCdEfGhIjK extra'), 'AbCdEfGhIjK');
});

test('getYouTubeEmbedUrl builds jsapi embeds, encodes origin, and falls back to channel handles', () => {
	const withOrigin = loadEmbedUrlHelpers({ origin: 'https://owenminercs.com' });
	assert.equal(
		withOrigin.getYouTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
		'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1&enablejsapi=1&origin=https%3A%2F%2Fowenminercs.com'
	);

	const withoutOrigin = loadEmbedUrlHelpers({ origin: '' });
	assert.equal(
		withoutOrigin.getYouTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ'),
		'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1&enablejsapi=1'
	);
	assert.equal(
		withoutOrigin.getYouTubeEmbedUrl('https://www.youtube.com/@Owen.Miner_CS'),
		'https://www.youtube.com/embed?listType=user_uploads&list=Owen.Miner_CS&rel=0'
	);
	assert.equal(withoutOrigin.getYouTubeEmbedUrl('https://example.com/watch'), '');
	assert.equal(withoutOrigin.getYouTubeEmbedUrl('javascript:alert(1)'), '');
});

test('getTikTokEmbedUrl maps video ids and profile handles and rejects non-TikTok URLs', () => {
	const { getTikTokEmbedUrl } = loadEmbedUrlHelpers();

	assert.equal(getTikTokEmbedUrl(''), '');
	assert.equal(getTikTokEmbedUrl(null), '');
	assert.equal(
		getTikTokEmbedUrl('https://www.tiktok.com/@owenminer/video/7123456789012345678?lang=en'),
		'https://www.tiktok.com/player/v1/7123456789012345678'
	);
	assert.equal(
		getTikTokEmbedUrl('https://www.tiktok.com/@Owen.Miner_CS'),
		'https://www.tiktok.com/embed/@Owen.Miner_CS'
	);
	assert.equal(getTikTokEmbedUrl('https://www.tiktok.com/tag/setup'), '');
	assert.equal(getTikTokEmbedUrl('javascript:alert(1)'), '');
	assert.equal(getTikTokEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), '');
});
