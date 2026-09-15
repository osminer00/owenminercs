import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const socialCloudSource = readFileSync(
	new URL('../Socials/scripts/social-cloud.js', import.meta.url),
	'utf8'
);

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}(`);
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

function loadCardSizeHelpers({
	innerWidth = 1200,
	randomValue = 0,
	pageHeaderHeight = 80,
	pageFooterHeight = 40,
	cloudHeight = 900,
} = {}) {
	const sandbox = {
		Math: {
			random: () => randomValue,
			max: (...args) => Math.max(...args),
			min: (...args) => Math.min(...args),
			floor: (n) => Math.floor(n),
		},
		Number,
		window: { innerWidth },
		cloudHeight,
		pageHeaderHeight,
		pageFooterHeight,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'clamp')}
		${extractFunction(socialCloudSource, 'getVisibleTop')}
		${extractFunction(socialCloudSource, 'getVisibleBottom')}
		${extractFunction(socialCloudSource, 'getCardWidth')}
		${extractFunction(socialCloudSource, 'getLaneY')}
		${extractFunction(socialCloudSource, 'getStateWidth')}
		${extractFunction(socialCloudSource, 'getStateHeight')}
		this.__helpers = {
			getCardWidth,
			getLaneY,
			getStateWidth,
			getStateHeight,
			getVisibleTop,
			getVisibleBottom,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'card size helpers should load');
	return sandbox.__helpers;
}

test('getCardWidth uses a 176–204 mobile range below 780px', () => {
	assert.equal(loadCardSizeHelpers({ innerWidth: 779, randomValue: 0 }).getCardWidth(), 176);
	assert.equal(loadCardSizeHelpers({ innerWidth: 779, randomValue: 1 }).getCardWidth(), 204);
	assert.equal(loadCardSizeHelpers({ innerWidth: 0, randomValue: 0.5 }).getCardWidth(), 190);
});

test('getCardWidth uses a 198–232 desktop range at 780px and above', () => {
	assert.equal(loadCardSizeHelpers({ innerWidth: 780, randomValue: 0 }).getCardWidth(), 198);
	assert.equal(loadCardSizeHelpers({ innerWidth: 780, randomValue: 1 }).getCardWidth(), 232);
	assert.equal(loadCardSizeHelpers({ innerWidth: 1600, randomValue: 0.5 }).getCardWidth(), 215);
});

test('getLaneY keeps the first lane at the visible top when random is zero', () => {
	const helpers = loadCardSizeHelpers({
		pageHeaderHeight: 80,
		pageFooterHeight: 40,
		cloudHeight: 900,
		randomValue: 0,
	});
	assert.equal(helpers.getVisibleTop(), 88);
	assert.equal(helpers.getLaneY(0, 4), 88);
});

test('getLaneY spreads later lanes then clamps so cards stay above bottom - 140px', () => {
	const zero = loadCardSizeHelpers({
		pageHeaderHeight: 80,
		pageFooterHeight: 40,
		cloudHeight: 900,
		randomValue: 0,
	});
	const one = loadCardSizeHelpers({
		pageHeaderHeight: 80,
		pageFooterHeight: 40,
		cloudHeight: 900,
		randomValue: 1,
	});

	// top=88, bottom=852, laneHeight=191, upper=712
	assert.equal(zero.getLaneY(3, 4), 661);
	assert.equal(one.getLaneY(0, 4), 159);
	assert.equal(one.getLaneY(3, 4), 712);
});

test('getLaneY clamps a short cloud so lower lanes cannot fall below the 140px footer band', () => {
	const helpers = loadCardSizeHelpers({
		pageHeaderHeight: 0,
		pageFooterHeight: 0,
		cloudHeight: 200,
		randomValue: 0,
	});
	assert.equal(helpers.getVisibleTop(), 8);
	assert.equal(helpers.getLaneY(0, 3), 8);
	assert.equal(helpers.getLaneY(2, 3), 52);
});

test('getStateWidth prefers live offsetWidth, then stored width, then getCardWidth', () => {
	const helpers = loadCardSizeHelpers({ innerWidth: 1200, randomValue: 0 });
	assert.equal(helpers.getStateWidth({ el: { offsetWidth: 220 }, width: 180 }), 220);
	assert.equal(helpers.getStateWidth({ el: { offsetWidth: 0 }, width: 180 }), 180);
	assert.equal(helpers.getStateWidth({ width: 164 }), 164);
	assert.equal(helpers.getStateWidth({ el: { offsetWidth: 0 }, width: 0 }), 198);
	assert.equal(helpers.getStateWidth(null), 198);
	assert.equal(helpers.getStateWidth({}), 198);
});

test('getStateHeight prefers live offsetHeight and falls back to 140px', () => {
	const helpers = loadCardSizeHelpers();
	assert.equal(helpers.getStateHeight({ el: { offsetHeight: 210 } }), 210);
	assert.equal(helpers.getStateHeight({ el: { offsetHeight: 0 } }), 140);
	assert.equal(helpers.getStateHeight({}), 140);
	assert.equal(helpers.getStateHeight(null), 140);
	assert.equal(helpers.getStateHeight(undefined), 140);
});
