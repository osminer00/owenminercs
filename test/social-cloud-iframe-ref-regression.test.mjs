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

function loadIframeRefHelpers() {
	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'isShortFormVideo')}
		${extractFunction(socialCloudSource, 'getResolvedContentType')}
		${extractFunction(socialCloudSource, 'getIframeReferenceDimensions')}
		${extractFunction(socialCloudSource, 'fitIframeToBox')}
		this.__helpers = {
			getIframeReferenceDimensions,
			fitIframeToBox,
			getResolvedContentType,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

function dims(value) {
	return { w: value.w, h: value.h };
}

test('getIframeReferenceDimensions uses TikTok, YouTube short/portrait, and landscape pixel refs', () => {
	const { getIframeReferenceDimensions } = loadIframeRefHelpers();

	assert.deepEqual(
		dims(getIframeReferenceDimensions({ contentType: 'video' }, { className: 'tiktok' })),
		{ w: 405, h: 720 }
	);
	assert.deepEqual(
		dims(getIframeReferenceDimensions({ contentType: 'short' }, { className: 'TIKTOK' })),
		{ w: 405, h: 720 },
		'TikTok class wins over short-form content type'
	);

	assert.deepEqual(
		dims(getIframeReferenceDimensions({ contentType: 'short' }, { className: 'youtube' })),
		{ w: 720, h: 1280 }
	);
	assert.deepEqual(
		dims(
			getIframeReferenceDimensions(
				{ contentType: 'video', videoAspectRatio: 0.91 },
				{ className: 'youtube' }
			)
		),
		{ w: 720, h: 1280 }
	);
	assert.deepEqual(
		dims(
			getIframeReferenceDimensions(
				{ contentType: 'video', videoAspectRatio: 0.92 },
				{ className: 'youtube' }
			)
		),
		{ w: 1280, h: 720 },
		'YouTube portrait cutoff is exclusive of 0.92'
	);
	assert.deepEqual(
		dims(
			getIframeReferenceDimensions(
				{ url: 'https://www.youtube.com/shorts/abc123xyz' },
				{ className: 'youtube' }
			)
		),
		{ w: 720, h: 1280 },
		'shorts URLs resolve as short without an explicit contentType'
	);

	assert.deepEqual(
		dims(getIframeReferenceDimensions({ videoAspectRatio: 0.5 }, { className: 'reddit' })),
		{ w: 720, h: 1280 }
	);
	assert.deepEqual(
		dims(getIframeReferenceDimensions({ contentType: 'video' }, { className: '' })),
		{ w: 1280, h: 720 }
	);
	assert.deepEqual(
		dims(getIframeReferenceDimensions({ videoAspectRatio: '9 / 16' }, null)),
		{ w: 1280, h: 720 },
		'CSS ratio strings are not numeric portrait values'
	);
	assert.deepEqual(dims(getIframeReferenceDimensions(null, undefined)), { w: 1280, h: 720 });
});

test('iframe refs compose with fitIframeToBox without overflowing the slot', () => {
	const { getIframeReferenceDimensions, fitIframeToBox } = loadIframeRefHelpers();

	const tiktok = getIframeReferenceDimensions({ contentType: 'short' }, { className: 'tiktok' });
	const tiktokFit = fitIframeToBox(200, 400, tiktok.w, tiktok.h);
	assert.equal(tiktokFit.w, 200);
	assert.equal(tiktokFit.h, 355);

	const youtubeShort = getIframeReferenceDimensions(
		{ contentType: 'short' },
		{ className: 'youtube' }
	);
	const shortFit = fitIframeToBox(180, 320, youtubeShort.w, youtubeShort.h);
	assert.equal(shortFit.w, 180);
	assert.equal(shortFit.h, 320);

	const landscape = getIframeReferenceDimensions(
		{ contentType: 'video' },
		{ className: 'youtube' }
	);
	const boxed = fitIframeToBox(300, 300, landscape.w, landscape.h);
	assert.equal(boxed.w, 300);
	assert.equal(boxed.h, 168);

	const letterboxed = fitIframeToBox(100, 50, landscape.w, landscape.h);
	assert.equal(letterboxed.h, 50);
	assert.equal(letterboxed.w, 88);

	const floored = fitIframeToBox(0, 0, landscape.w, landscape.h);
	assert.equal(floored.w, 1);
	assert.equal(floored.h, 1);
});
