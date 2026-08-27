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

function loadGeometryHelpers(options = {}) {
	const innerWidth = Number.isFinite(options.innerWidth) ? options.innerWidth : 1200;
	const sandbox = {
		String,
		Number,
		Math,
		window: {
			innerWidth,
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		let cloudWidth = 0;
		let cloudHeight = 0;
		let pageHeaderHeight = 0;
		let pageFooterHeight = 0;
		let cardCount = 1;
		let states = [];
		${extractFunction(socialCloudSource, 'clamp')}
		${extractFunction(socialCloudSource, 'getVisibleTop')}
		${extractFunction(socialCloudSource, 'getVisibleBottom')}
		${extractFunction(socialCloudSource, 'getCardWidth')}
		${extractFunction(socialCloudSource, 'getStateWidth')}
		${extractFunction(socialCloudSource, 'getStateHeight')}
		${extractFunction(socialCloudSource, 'clampStateToVisibleArea')}
		${extractFunction(socialCloudSource, 'getInitialX')}
		${extractFunction(socialCloudSource, 'getWaveRespawnX')}
		${extractFunction(socialCloudSource, 'getRespawnX')}
		this.__helpers = {
			getVisibleTop,
			getVisibleBottom,
			clampStateToVisibleArea,
			getInitialX,
			getWaveRespawnX,
			getRespawnX,
			setBounds(width, height, headerHeight, footerHeight) {
				cloudWidth = width;
				cloudHeight = height;
				pageHeaderHeight = headerHeight;
				pageFooterHeight = footerHeight;
			},
			setCardCount(value) {
				cardCount = value;
			},
			setStates(next) {
				states = next;
			},
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

function cardEl(width, height) {
	return { offsetWidth: width, offsetHeight: height };
}

test('clampStateToVisibleArea keeps unpinned cards inside the header/footer budget and skips pinned cards', () => {
	const helpers = loadGeometryHelpers();
	helpers.setBounds(400, 500, 40, 50);

	assert.equal(helpers.getVisibleTop(), 48);
	assert.equal(helpers.getVisibleBottom(), 442);

	const pinned = { el: cardEl(100, 80), isPinned: true, x: -40, y: 900, width: 100 };
	helpers.clampStateToVisibleArea(pinned);
	assert.equal(pinned.x, -40);
	assert.equal(pinned.y, 900);

	helpers.clampStateToVisibleArea({ x: 10, y: 10 });

	const overflow = { el: cardEl(100, 80), isPinned: false, x: 999, y: -20, width: 12 };
	helpers.clampStateToVisibleArea(overflow);
	assert.equal(overflow.width, 100);
	assert.equal(overflow.x, 292);
	assert.equal(overflow.y, 48);

	const tooLow = { el: cardEl(100, 80), x: 0, y: 800 };
	helpers.clampStateToVisibleArea(tooLow);
	assert.equal(tooLow.x, 8);
	assert.equal(tooLow.y, 362);
});

test('getInitialX spreads cards across the cloud and getRespawnX stays on the left edge', () => {
	const helpers = loadGeometryHelpers();
	helpers.setBounds(400, 500, 0, 0);
	helpers.setCardCount(4);

	assert.equal(helpers.getInitialX(0, 100), (0.3 / 4) * 292);
	assert.equal(helpers.getInitialX(3, 100), (3.3 / 4) * 292);
	helpers.setCardCount(1);
	assert.equal(helpers.getInitialX(40, 100), 292);
	assert.equal(helpers.getRespawnX(100), 8);
	assert.equal(helpers.getRespawnX(0), 8);
});

test('getWaveRespawnX stays offscreen left, ignores pinned cards, and uses the mobile lane gap under 780px', () => {
	const desktop = loadGeometryHelpers({ innerWidth: 1200 });
	desktop.setStates([]);
	assert.equal(desktop.getWaveRespawnX(100), -118);

	const moving = { x: 50, isPinned: false };
	const pinned = { x: -400, isPinned: true };
	desktop.setStates([moving, pinned]);
	assert.equal(desktop.getWaveRespawnX(100), -118);
	assert.equal(desktop.getWaveRespawnX(100, moving), -118);

	desktop.setStates([{ x: -20, isPinned: false }]);
	assert.equal(desktop.getWaveRespawnX(100), -138);

	const mobile = loadGeometryHelpers({ innerWidth: 390 });
	mobile.setStates([]);
	assert.equal(mobile.getWaveRespawnX(100), -112);
});
