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

function loadCatalogMixHelpers() {
	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		Array,
		URL,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'normalizePlatformKey')}
		${extractFunction(socialCloudSource, 'isShortFormVideo')}
		${extractFunction(socialCloudSource, 'getResolvedContentType')}
		${extractFunction(socialCloudSource, 'parseAspectRatioValue')}
		${extractFunction(socialCloudSource, 'getVideoRatioForItem')}
		${extractFunction(socialCloudSource, 'isLivestreamLikeContent')}
		${extractFunction(socialCloudSource, 'interleaveCardGroups')}
		this.__helpers = {
			normalizePlatformKey,
			isShortFormVideo,
			getResolvedContentType,
			parseAspectRatioValue,
			getVideoRatioForItem,
			isLivestreamLikeContent,
			interleaveCardGroups,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'social-cloud catalog mix helpers should load');
	return sandbox.__helpers;
}

test('interleaveCardGroups round-robins platforms and skips empty or non-array groups', () => {
	const { interleaveCardGroups } = loadCatalogMixHelpers();

	const mixed = Array.from(
		interleaveCardGroups([
			['yt-1', 'yt-2', 'yt-3'],
			[],
			null,
			['x-1'],
			['ig-1', 'ig-2'],
		])
	);

	assert.deepEqual(mixed, ['yt-1', 'x-1', 'ig-1', 'yt-2', 'ig-2', 'yt-3']);
	assert.deepEqual(Array.from(interleaveCardGroups([])), []);
	assert.deepEqual(Array.from(interleaveCardGroups([[], undefined, 'nope'])), []);
});

test('isLivestreamLikeContent filters live URLs and titles so VODs stay in the cloud', () => {
	const { isLivestreamLikeContent } = loadCatalogMixHelpers();

	assert.equal(
		isLivestreamLikeContent({
			title: 'Welcome to my Counter Strike 2 live stream',
			url: 'https://www.youtube.com/watch?v=abc',
		}),
		true
	);
	assert.equal(
		isLivestreamLikeContent({
			caption: 'Full screen livestream tonight',
			url: 'https://www.youtube.com/watch?v=abc',
		}),
		true
	);
	assert.equal(
		isLivestreamLikeContent({
			url: 'https://www.youtube.com/live/ian1kvdwsEA',
			title: 'CS2 Premier',
		}),
		true
	);
	assert.equal(
		isLivestreamLikeContent({
			embedUrl: 'https://youtube.com/live/ian1kvdwsEA?feature=share',
			title: 'Road to 30K',
		}),
		true
	);
	assert.equal(
		isLivestreamLikeContent({
			caption: 'This is a Youtube shorts live stream. Full screen 16:9 stream available here',
			url: 'https://www.youtube.com/watch?v=k-5x7qVcMPM',
		}),
		true
	);

	assert.equal(
		isLivestreamLikeContent({
			title: 'Bye Bye',
			url: 'https://www.youtube.com/shorts/EmNTRsInyiA',
			caption: '#cs2 clip from last night',
		}),
		false
	);
	assert.equal(
		isLivestreamLikeContent({
			title: 'Oliveira vs Chandler live reaction later',
			url: 'https://www.youtube.com/watch?v=clip',
		}),
		false
	);
	assert.equal(isLivestreamLikeContent({}), false);
});

test('parseAspectRatioValue and getVideoRatioForItem keep short/TikTok portrait and reject junk ratios', () => {
	const { parseAspectRatioValue, getVideoRatioForItem } = loadCatalogMixHelpers();

	assert.equal(parseAspectRatioValue(''), 0);
	assert.equal(parseAspectRatioValue('not-a-ratio'), 0);
	assert.equal(parseAspectRatioValue('0 / 9'), 0);
	assert.equal(parseAspectRatioValue('-16 / 9'), 0);
	assert.equal(parseAspectRatioValue('16 / 9'), 16 / 9);
	assert.equal(parseAspectRatioValue('9/16'), 9 / 16);
	assert.equal(parseAspectRatioValue('  4  /  3  '), 4 / 3);

	assert.equal(
		getVideoRatioForItem({ platform: 'youtube', aspectRatio: '4 / 3', contentType: 'short' }),
		'4 / 3'
	);
	assert.equal(
		getVideoRatioForItem({
			platform: 'youtube',
			contentType: 'short',
			url: 'https://www.youtube.com/shorts/EmNTRsInyiA',
		}),
		'9 / 16'
	);
	assert.equal(
		getVideoRatioForItem({
			platform: 'tiktok',
			contentType: 'video',
			url: 'https://www.tiktok.com/@owenminercs/video/1',
		}),
		'9 / 16'
	);
	assert.equal(
		getVideoRatioForItem({
			platform: 'youtube',
			contentType: 'video',
			url: 'https://www.youtube.com/watch?v=abc12345',
		}),
		'16 / 9'
	);
});
