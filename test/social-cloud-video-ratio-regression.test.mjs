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

function loadVideoRatioHelpers() {
	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		RegExp,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'normalizePlatformKey')}
		${extractFunction(socialCloudSource, 'isShortFormVideo')}
		${extractFunction(socialCloudSource, 'getResolvedContentType')}
		${extractFunction(socialCloudSource, 'parseAspectRatioValue')}
		${extractFunction(socialCloudSource, 'isRedditProgressiveMp4Url')}
		${extractFunction(socialCloudSource, 'getLegacyVideoRatioForItem')}
		${extractFunction(socialCloudSource, 'getVideoRatioForItem')}
		${extractFunction(socialCloudSource, 'applyCardMediaAspectVars')}
		this.__helpers = {
			parseAspectRatioValue,
			getLegacyVideoRatioForItem,
			getVideoRatioForItem,
			applyCardMediaAspectVars,
			isRedditProgressiveMp4Url,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('parseAspectRatioValue accepts CSS ratios and rejects empty, zero, and malformed values', () => {
	const { parseAspectRatioValue } = loadVideoRatioHelpers();

	assert.equal(parseAspectRatioValue(''), 0);
	assert.equal(parseAspectRatioValue(null), 0);
	assert.equal(parseAspectRatioValue('16:9'), 0);
	assert.equal(parseAspectRatioValue('16 / 0'), 0);
	assert.equal(parseAspectRatioValue('0 / 9'), 0);
	assert.equal(parseAspectRatioValue('not-a-ratio'), 0);
	assert.equal(parseAspectRatioValue('16 / 9'), 16 / 9);
	assert.equal(parseAspectRatioValue('9/16'), 9 / 16);
	assert.equal(parseAspectRatioValue('1.5 / 1'), 1.5);
});

test('getVideoRatioForItem prefers explicit ratios then short/TikTok portrait defaults', () => {
	const { getVideoRatioForItem } = loadVideoRatioHelpers();

	assert.equal(
		getVideoRatioForItem({ contentType: 'short', aspectRatio: '4 / 5' }),
		'4 / 5',
		'parsed aspectRatio wins even for shorts'
	);
	assert.equal(getVideoRatioForItem({ contentType: 'short' }), '9 / 16');
	assert.equal(
		getVideoRatioForItem({
			platform: 'TikTok',
			contentType: 'video',
			url: 'https://www.tiktok.com/@owen/video/1',
		}),
		'9 / 16'
	);
	assert.equal(
		getVideoRatioForItem({ platform: 'youtube', contentType: 'video' }),
		'16 / 9'
	);
	assert.equal(getVideoRatioForItem({ aspectRatio: 'bad' }), '16 / 9');
	assert.equal(
		getVideoRatioForItem({
			url: 'https://www.youtube.com/shorts/abcdefghijk',
		}),
		'9 / 16'
	);
});

test('getLegacyVideoRatioForItem forces redditmedia iframes to 16/9 and ignores short portrait', () => {
	const { getLegacyVideoRatioForItem, isRedditProgressiveMp4Url } = loadVideoRatioHelpers();

	assert.equal(
		isRedditProgressiveMp4Url('https://v.redd.it/clip.mp4?source=fallback'),
		true
	);
	assert.equal(isRedditProgressiveMp4Url('https://v.redd.it/clip.m3u8'), false);

	assert.equal(
		getLegacyVideoRatioForItem({
			platform: 'reddit',
			contentType: 'post',
			aspectRatio: '9 / 16',
			embedUrl: 'https://www.redditmedia.com/mediaembed/abc',
		}),
		'16 / 9',
		'redditmedia iframe players stay landscape even when preview metadata is portrait'
	);
	assert.equal(
		getLegacyVideoRatioForItem({
			platform: 'reddit',
			contentType: 'post',
			aspectRatio: '4 / 5',
			embedUrl: 'https://www.redditmedia.com/mediaembed/clip.mp4',
		}),
		'4 / 5',
		'progressive mp4 redditmedia URLs keep parsed aspect on non-video types'
	);
	assert.equal(
		getLegacyVideoRatioForItem({
			platform: 'youtube',
			contentType: 'short',
			aspectRatio: '9 / 16',
		}),
		'16 / 9',
		'legacy path treats shorts as landscape 16/9'
	);
	assert.equal(
		getLegacyVideoRatioForItem({
			contentType: 'image',
			aspectRatio: '4 / 5',
		}),
		'4 / 5'
	);
	assert.equal(getLegacyVideoRatioForItem({ contentType: 'gallery' }), '16 / 9');
});

test('applyCardMediaAspectVars writes numeric CSS vars and falls back to 16/9', () => {
	const { applyCardMediaAspectVars } = loadVideoRatioHelpers();
	const props = {};
	const cardEl = {
		style: {
			setProperty(name, value) {
				props[name] = value;
			},
		},
	};

	applyCardMediaAspectVars(cardEl, ' 9 / 16 ');
	assert.equal(props['--smc-ar-w'], '9');
	assert.equal(props['--smc-ar-h'], '16');

	applyCardMediaAspectVars(cardEl, '1.5/1');
	assert.equal(props['--smc-ar-w'], '1.5');
	assert.equal(props['--smc-ar-h'], '1');

	applyCardMediaAspectVars(cardEl, '16:9');
	assert.equal(props['--smc-ar-w'], '16');
	assert.equal(props['--smc-ar-h'], '9');

	applyCardMediaAspectVars(cardEl, '');
	assert.equal(props['--smc-ar-w'], '16');
	assert.equal(props['--smc-ar-h'], '9');
});
