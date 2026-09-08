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

function dims(result) {
	return {
		nextX: result.nextX,
		nextY: result.nextY,
		nextWidth: result.nextWidth,
		nextHeight: result.nextHeight,
	};
}

function loadResizeHelpers(overrides = {}) {
	const sandbox = {
		Math,
		Number,
		String,
		parseAspectRatioValue: undefined,
		toSafeNumber: undefined,
		clamp: undefined,
		card: overrides.card || {
			style: {
				getPropertyValue(name) {
					return name === '--smc-card-ratio' ? overrides.cardRatioCss || '' : '';
				},
			},
		},
		state: overrides.state || { item: overrides.item || {} },
		window: {
			getComputedStyle(el) {
				return el?.__styles || {};
			},
		},
		cloudWidth: overrides.cloudWidth ?? 1000,
		resizeStartClientX: overrides.resizeStartClientX ?? 0,
		resizeStartClientY: overrides.resizeStartClientY ?? 0,
		resizeStartWidth: overrides.resizeStartWidth ?? 200,
		resizeStartHeight: overrides.resizeStartHeight ?? 100,
		resizeStartX: overrides.resizeStartX ?? 50,
		resizeStartY: overrides.resizeStartY ?? 50,
		resizeStartRatio: overrides.resizeStartRatio ?? 2,
		resizeChromeExtra: overrides.resizeChromeExtra ?? 0,
		metaByline: overrides.metaByline || { __styles: {} },
		metaDateWrap: overrides.metaDateWrap || { scrollWidth: 0, offsetWidth: 0 },
		bottomChrome: overrides.bottomChrome || { __styles: {} },
		openPostLink: overrides.openPostLink || { offsetWidth: 0 },
		openChannelLink: overrides.openChannelLink || { offsetWidth: 0 },
		getVisibleTop() {
			return overrides.visibleTop ?? 8;
		},
		getVisibleBottom() {
			return overrides.visibleBottom ?? 800;
		},
	};

	if (overrides.minWidth != null) {
		sandbox.getCardChromeMinWidth = () => overrides.minWidth;
	}

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'toSafeNumber')}
		${extractFunction(socialCloudSource, 'clamp')}
		${extractFunction(socialCloudSource, 'parseAspectRatioValue')}
		${overrides.minWidth == null ? extractFunction(socialCloudSource, 'getCardChromeMinWidth') : ''}
		${extractFunction(socialCloudSource, 'getResizeMediaRatio')}
		${extractFunction(socialCloudSource, 'getResizeDimensions')}
		this.__helpers = {
			toSafeNumber,
			clamp,
			parseAspectRatioValue,
			getCardChromeMinWidth: typeof getCardChromeMinWidth === 'function' ? getCardChromeMinWidth : this.getCardChromeMinWidth,
			getResizeMediaRatio,
			getResizeDimensions,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'resize helpers should load');
	return sandbox.__helpers;
}

test('getCardChromeMinWidth never shrinks below 180 and prefers the larger chrome row', () => {
	const helpers = loadResizeHelpers({
		card: {
			__styles: { paddingLeft: '10px', paddingRight: '10px' },
			style: {
				getPropertyValue() {
					return '';
				},
			},
		},
		metaByline: { __styles: { columnGap: '8px' } },
		metaDateWrap: { scrollWidth: 100.2, offsetWidth: 40 },
		bottomChrome: { __styles: { gap: '10px' } },
		openPostLink: { offsetWidth: 60.4 },
		openChannelLink: { offsetWidth: 70.6 },
	});

	// dateWidth 101 + stats 82 + gap 8 + padding 20 + 12 = 223
	assert.equal(helpers.getCardChromeMinWidth(), 223);

	const tiny = loadResizeHelpers({
		card: {
			__styles: { paddingLeft: '0', paddingRight: 'not-a-number' },
			style: {
				getPropertyValue() {
					return '';
				},
			},
		},
		metaByline: { __styles: {} },
		metaDateWrap: { scrollWidth: 0, offsetWidth: 0 },
		bottomChrome: { __styles: {} },
		openPostLink: { offsetWidth: 10 },
		openChannelLink: { offsetWidth: 10 },
	});
	assert.equal(tiny.getCardChromeMinWidth(), 180);
});

test('getResizeMediaRatio prefers CSS ratio, then numeric aspect, then the start box', () => {
	const fromCss = loadResizeHelpers({
		cardRatioCss: '9 / 16',
		item: { videoAspectRatioCss: '16 / 9', aspectRatio: '4 / 3', videoAspectRatio: 1.5 },
		resizeStartWidth: 400,
		resizeStartHeight: 100,
	});
	assert.equal(fromCss.getResizeMediaRatio(), 9 / 16);

	const fromNumeric = loadResizeHelpers({
		cardRatioCss: '',
		item: { aspectRatio: 'not-a-ratio', videoAspectRatio: 1.25 },
		resizeStartWidth: 400,
		resizeStartHeight: 100,
	});
	assert.equal(fromNumeric.getResizeMediaRatio(), 1.25);

	const fromBox = loadResizeHelpers({
		cardRatioCss: '',
		item: {},
		resizeStartWidth: 300,
		resizeStartHeight: 150,
	});
	assert.equal(fromBox.getResizeMediaRatio(), 2);

	const zeroHeight = loadResizeHelpers({
		cardRatioCss: '',
		item: { videoAspectRatio: 0 },
		resizeStartWidth: 240,
		resizeStartHeight: 0,
	});
	assert.equal(zeroHeight.getResizeMediaRatio(), 240);
});

test('getResizeDimensions grows from the south-east handle and clamps to chrome min width', () => {
	const helpers = loadResizeHelpers({
		minWidth: 180,
		cloudWidth: 1000,
		visibleTop: 8,
		visibleBottom: 800,
		resizeStartWidth: 200,
		resizeStartHeight: 100,
		resizeStartRatio: 2,
		resizeChromeExtra: 0,
		resizeStartX: 50,
		resizeStartY: 50,
		resizeStartClientX: 250,
		resizeStartClientY: 150,
	});

	assert.deepEqual(dims(helpers.getResizeDimensions({ clientX: 300, clientY: 150 }, 'se')), {
		nextX: 50,
		nextY: 50,
		nextWidth: 225,
		nextHeight: 112.5,
	});

	assert.deepEqual(dims(helpers.getResizeDimensions({ clientX: 100, clientY: 150 }, 'se')), {
		nextX: 50,
		nextY: 50,
		nextWidth: 180,
		nextHeight: 90,
	});
});

test('getResizeDimensions keeps west-edge resizes inside the cloud and holds aspect height', () => {
	const helpers = loadResizeHelpers({
		minWidth: 180,
		cloudWidth: 1000,
		visibleTop: 8,
		visibleBottom: 800,
		resizeStartWidth: 200,
		resizeStartHeight: 200,
		resizeStartRatio: 1,
		resizeChromeExtra: 0,
		resizeStartX: 20,
		resizeStartY: 40,
		resizeStartClientX: 20,
		resizeStartClientY: 40,
	});

	assert.deepEqual(dims(helpers.getResizeDimensions({ clientX: -480, clientY: 40 }, 'w')), {
		nextX: 8,
		nextY: 40,
		nextWidth: 220,
		nextHeight: 220,
	});
});

test('getResizeDimensions shortens a south-east drag that would overflow the visible bottom', () => {
	const helpers = loadResizeHelpers({
		minWidth: 180,
		cloudWidth: 1000,
		visibleTop: 8,
		visibleBottom: 800,
		resizeStartWidth: 200,
		resizeStartHeight: 100,
		resizeStartRatio: 1,
		resizeChromeExtra: 0,
		resizeStartX: 50,
		resizeStartY: 600,
		resizeStartClientX: 250,
		resizeStartClientY: 700,
	});

	assert.deepEqual(dims(helpers.getResizeDimensions({ clientX: 250, clientY: 1100 }, 'se')), {
		nextX: 50,
		nextY: 600,
		nextWidth: 200,
		nextHeight: 200,
	});
});
