import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

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

function loadComparisonHelpers() {
	const source = readWorkspaceFile('scripts/setup-comparisons.js');
	const sandbox = {
		String,
		Number,
		Object,
		Array,
	};

	vm.runInNewContext(
		[
			extractFunction(source, 'parseSpecs'),
			extractFunction(source, 'getNumericValue'),
			extractFunction(source, 'normalizeLabel'),
			extractFunction(source, 'getPrimaryLabel'),
			extractFunction(source, 'escapeHtml'),
			extractFunction(source, 'getSpecComparisons'),
			extractFunction(source, 'getHeadlineFromSpecs'),
			extractFunction(source, 'chooseLead'),
			extractFunction(source, 'getIntentFromSpecLabel'),
			extractFunction(source, 'createSummary'),
			`this.__helpers = {
				parseSpecs,
				getNumericValue,
				normalizeLabel,
				getPrimaryLabel,
				escapeHtml,
				getSpecComparisons,
				getHeadlineFromSpecs,
				chooseLead,
				getIntentFromSpecLabel,
				createSummary,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'setup-comparisons helpers should load');
	return sandbox.__helpers;
}

const helpers = loadComparisonHelpers();

test('setup-comparisons parseSpecs keeps values that contain colons', () => {
	const { parseSpecs } = helpers;

	const specs = parseSpecs('Refresh Rate:360Hz|Resolution:2560:1440|Weight: 65 g');
	assert.equal(specs['Refresh Rate'], '360Hz');
	assert.equal(specs.Resolution, '2560:1440');
	assert.equal(specs.Weight, '65 g');
	assert.equal(Object.keys(parseSpecs('')).length, 0);
	assert.equal(Object.keys(parseSpecs('broken-entry|AlsoBroken')).length, 0);
});

test('setup-comparisons normalizeLabel and getPrimaryLabel stabilize compare keys', () => {
	const { normalizeLabel, getPrimaryLabel } = helpers;

	assert.equal(normalizeLabel('Refresh Rate'), 'refresh rate');
	assert.equal(normalizeLabel('  Response-Time!! '), 'response time');
	assert.equal(getPrimaryLabel('Mouse — G Pro X'), 'G Pro X');
	assert.equal(getPrimaryLabel('Plain Label'), 'Plain Label');
});

test('setup-comparisons chooseLead prefers higher refresh and lower weight', () => {
	const { chooseLead } = helpers;

	assert.equal(chooseLead({ label: 'Refresh Rate', a: '360Hz', b: '240Hz' }), 'a');
	assert.equal(chooseLead({ label: 'Refresh Rate', a: '144Hz', b: '240Hz' }), 'b');
	assert.equal(chooseLead({ label: 'Weight', a: '58g', b: '72g' }), 'a');
	assert.equal(chooseLead({ label: 'Weight', a: '80g', b: '55g' }), 'b');
	assert.equal(chooseLead({ label: 'Color', a: 'Black', b: 'White' }), null);
	assert.equal(chooseLead({ label: 'Refresh Rate', a: '240Hz', b: '240Hz' }), null);
});

test('setup-comparisons getSpecComparisons matches labels case-insensitively and skips ties', () => {
	const { getSpecComparisons } = helpers;

	const comparisons = getSpecComparisons(
		{ specs: { 'Refresh Rate': '360Hz', Weight: '58g', Color: 'Black' } },
		{ specs: { 'refresh rate': '240Hz', weight: '58g', Color: 'White' } }
	);

	assert.equal(comparisons.length, 2);
	assert.equal(comparisons[0].label, 'Refresh Rate');
	assert.equal(comparisons[0].a, '360Hz');
	assert.equal(comparisons[0].b, '240Hz');
	assert.equal(comparisons[1].label, 'Color');
});

test('setup-comparisons createSummary leans on preferred headline specs', () => {
	const { createSummary } = helpers;

	const summary = createSummary(
		{
			name: 'Zowie XL2566K',
			specs: { 'Refresh Rate': '360Hz', Weight: '6.2kg' },
			opinion: 'My competitive pick.',
		},
		{
			name: 'Dell U2720Q',
			specs: { 'Refresh Rate': '60Hz', Weight: '5.5kg' },
			opinion: 'Better for desk work.',
		}
	);

	assert.match(summary.summary, /competitive gaming/i);
	assert.match(summary.summary, /Zowie XL2566K/);
	assert.match(summary.summary, /360Hz/);
	assert.equal(summary.specs.length, 2);
	assert.equal(summary.opinions.length, 2);
	assert.match(summary.opinions[0], /Zowie XL2566K: My competitive pick\./);
});
