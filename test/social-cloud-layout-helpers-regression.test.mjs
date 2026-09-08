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

function loadLayoutHelpers({
	innerWidth = 1200,
	cloudWidth = 1000,
	cardCount = 4,
	config = { cardCountDesktop: 20, cardCountMobile: 12 },
	enabledCatalog = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }],
} = {}) {
	const sandbox = {
		Math,
		Number,
		String,
		window: { innerWidth },
		cloudWidth,
		cardCount,
		config,
		enabledCatalog,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'toSafeNumber')}
		${extractFunction(socialCloudSource, 'clamp')}
		${extractFunction(socialCloudSource, 'normalizeAspectRatio')}
		${extractFunction(socialCloudSource, 'sanitizeRedditText')}
		${extractFunction(socialCloudSource, 'getLaneCount')}
		${extractFunction(socialCloudSource, 'updateCardCountForViewport')}
		${extractFunction(socialCloudSource, 'getInitialX')}
		this.__helpers = {
			toSafeNumber,
			clamp,
			normalizeAspectRatio,
			sanitizeRedditText,
			getLaneCount,
			updateCardCountForViewport,
			getInitialX,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'layout helpers should load');
	return { helpers: sandbox.__helpers, sandbox };
}

test('toSafeNumber parses integers and treats non-numeric input as zero', () => {
	const { helpers } = loadLayoutHelpers();
	assert.equal(helpers.toSafeNumber(12), 12);
	assert.equal(helpers.toSafeNumber('  7'), 7);
	assert.equal(helpers.toSafeNumber('12.9'), 12);
	assert.equal(helpers.toSafeNumber(''), 0);
	assert.equal(helpers.toSafeNumber(null), 0);
	assert.equal(helpers.toSafeNumber(undefined), 0);
	assert.equal(helpers.toSafeNumber('nope'), 0);
	assert.equal(helpers.toSafeNumber(Number.NaN), 0);
});

test('normalizeAspectRatio rejects non-positive sizes and keeps a caller fallback', () => {
	const { helpers } = loadLayoutHelpers();
	assert.equal(helpers.normalizeAspectRatio(1920, 1080), '1920 / 1080');
	assert.equal(helpers.normalizeAspectRatio('9', '16'), '9 / 16');
	assert.equal(helpers.normalizeAspectRatio(0, 16), '16 / 9');
	assert.equal(helpers.normalizeAspectRatio(-4, 3), '16 / 9');
	assert.equal(helpers.normalizeAspectRatio('wide', 9), '16 / 9');
	assert.equal(helpers.normalizeAspectRatio(100, Number.NaN, '4 / 3'), '4 / 3');
});

test('sanitizeRedditText collapses whitespace and treats empty values as a blank string', () => {
	const { helpers } = loadLayoutHelpers();
	assert.equal(helpers.sanitizeRedditText('  Hello\n\tReddit  world  '), 'Hello Reddit world');
	assert.equal(helpers.sanitizeRedditText(''), '');
	assert.equal(helpers.sanitizeRedditText(null), '');
	assert.equal(helpers.sanitizeRedditText(undefined), '');
	assert.equal(helpers.sanitizeRedditText(42), '42');
});

test('getLaneCount and updateCardCountForViewport switch at 780px and cap to catalog size', () => {
	const desktop = loadLayoutHelpers({ innerWidth: 780, enabledCatalog: new Array(40).fill({}) });
	assert.equal(desktop.helpers.getLaneCount(), 4);
	desktop.helpers.updateCardCountForViewport();
	assert.equal(desktop.sandbox.cardCount, 20);

	const mobile = loadLayoutHelpers({ innerWidth: 779, enabledCatalog: new Array(40).fill({}) });
	assert.equal(mobile.helpers.getLaneCount(), 3);
	mobile.helpers.updateCardCountForViewport();
	assert.equal(mobile.sandbox.cardCount, 12);

	const shortCatalog = loadLayoutHelpers({
		innerWidth: 1200,
		enabledCatalog: [{}, {}],
	});
	shortCatalog.helpers.updateCardCountForViewport();
	assert.equal(shortCatalog.sandbox.cardCount, 2);

	const emptyCatalog = loadLayoutHelpers({
		innerWidth: 1200,
		enabledCatalog: [],
	});
	emptyCatalog.helpers.updateCardCountForViewport();
	assert.equal(emptyCatalog.sandbox.cardCount, 20);
});

test('getInitialX spreads the first wave across the cloud without leaving the 8px gutter', () => {
	const { helpers } = loadLayoutHelpers({
		cloudWidth: 1000,
		cardCount: 4,
	});

	const maxX = Math.max(8, 1000 - 100 - 8);
	assert.equal(helpers.getInitialX(0, 100), Math.max(8, Math.min(maxX, ((0 + 0.3) / 4) * maxX)));
	assert.equal(helpers.getInitialX(3, 100), Math.max(8, Math.min(maxX, ((3 + 0.3) / 4) * maxX)));
	assert.equal(helpers.getInitialX(0, 2000), 8);
});
