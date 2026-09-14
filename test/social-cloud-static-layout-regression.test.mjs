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

function makeCardEl() {
	return { style: { transform: '' } };
}

function loadStaticLayoutHelpers({
	innerWidth = 1200,
	cloudWidth = 800,
	cloudHeight = 900,
	pageHeaderHeight = 80,
	pageFooterHeight = 40,
	cardCount = 4,
} = {}) {
	const states = Array.from({ length: cardCount }, () => ({ el: makeCardEl() }));
	const sandbox = {
		Math,
		Number,
		window: { innerWidth },
		cloudWidth,
		cloudHeight,
		pageHeaderHeight,
		pageFooterHeight,
		states,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'getVisibleTop')}
		${extractFunction(socialCloudSource, 'getVisibleBottom')}
		${extractFunction(socialCloudSource, 'placeStaticCards')}
		this.__helpers = { getVisibleTop, getVisibleBottom, placeStaticCards };
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'static layout helpers should load');
	return { helpers: sandbox.__helpers, sandbox, states };
}

function parseTranslate(transform) {
	const match = String(transform).match(
		/^translate3d\((-?\d+(?:\.\d+)?)px, (-?\d+(?:\.\d+)?)px, 0\)$/
	);
	assert.ok(match, `transform should be translate3d: ${transform}`);
	return { x: Number(match[1]), y: Number(match[2]) };
}

test('getVisibleTop stays at least 8px and otherwise sits 8px below the header', () => {
	assert.equal(loadStaticLayoutHelpers({ pageHeaderHeight: 0 }).helpers.getVisibleTop(), 8);
	assert.equal(loadStaticLayoutHelpers({ pageHeaderHeight: 4 }).helpers.getVisibleTop(), 12);
	assert.equal(loadStaticLayoutHelpers({ pageHeaderHeight: 80 }).helpers.getVisibleTop(), 88);
});

test('getVisibleBottom prefers the footer budget but never shrinks the visible band below 120px', () => {
	const shortCloud = loadStaticLayoutHelpers({
		pageHeaderHeight: 0,
		pageFooterHeight: 0,
		cloudHeight: 100,
	});
	assert.equal(shortCloud.helpers.getVisibleBottom(), 128);

	const tallCloud = loadStaticLayoutHelpers({
		pageHeaderHeight: 80,
		pageFooterHeight: 50,
		cloudHeight: 1000,
	});
	assert.equal(tallCloud.helpers.getVisibleBottom(), 942);
});

test('placeStaticCards lays a 3-column reduced-motion grid on desktop viewports', () => {
	const { helpers, states } = loadStaticLayoutHelpers({
		innerWidth: 780,
		cloudWidth: 800,
		pageHeaderHeight: 80,
		cardCount: 4,
	});

	helpers.placeStaticCards();

	const first = parseTranslate(states[0].el.style.transform);
	const second = parseTranslate(states[1].el.style.transform);
	const third = parseTranslate(states[2].el.style.transform);
	const fourth = parseTranslate(states[3].el.style.transform);

	assert.deepEqual(first, { x: 14, y: 102 });
	assert.deepEqual(second, { x: 258, y: 102 });
	assert.deepEqual(third, { x: 502, y: 102 });
	assert.deepEqual(fourth, { x: 14, y: 240 });
});

test('placeStaticCards switches to 2 columns below 780px and clamps card width to 156–230', () => {
	const mobile = loadStaticLayoutHelpers({
		innerWidth: 779,
		cloudWidth: 800,
		pageHeaderHeight: 80,
		cardCount: 3,
	});
	mobile.helpers.placeStaticCards();
	assert.deepEqual(parseTranslate(mobile.states[0].el.style.transform), { x: 14, y: 102 });
	assert.deepEqual(parseTranslate(mobile.states[1].el.style.transform), { x: 258, y: 102 });
	assert.deepEqual(parseTranslate(mobile.states[2].el.style.transform), { x: 14, y: 240 });

	const narrow = loadStaticLayoutHelpers({
		innerWidth: 1200,
		cloudWidth: 400,
		pageHeaderHeight: 0,
		cardCount: 2,
	});
	narrow.helpers.placeStaticCards();
	assert.deepEqual(parseTranslate(narrow.states[0].el.style.transform), { x: 14, y: 22 });
	assert.deepEqual(parseTranslate(narrow.states[1].el.style.transform), { x: 184, y: 22 });
});
