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

function loadCaseStatsHelpers() {
	const source = readWorkspaceFile('scripts/cs2-skins.js');
	const sandbox = { String, Number, Math, Array, Object };

	vm.runInNewContext(
		[
			extractFunction(source, 'escapeHtml'),
			extractFunction(source, 'renderCaseStats'),
			`this.__helpers = { renderCaseStats };`,
		].join('\n'),
		sandbox
	);

	assert.equal(typeof sandbox.__helpers.renderCaseStats, 'function');
	return sandbox.__helpers;
}

function renderStats(caseStats) {
	const node = { innerHTML: '' };
	loadCaseStatsHelpers().renderCaseStats(node, caseStats);
	return node.innerHTML;
}

function pillNames(html) {
	return [...html.matchAll(/class="cs2-case-pill">([^<]*?) x/g)].map((match) => match[1]);
}

test('case stats escape inventory names before writing innerHTML', () => {
	const html = renderStats({
		totalCases: '15',
		byName: {
			'<img src=x onerror=alert(1)>': 2,
			'Kilowatt Case': 1,
		},
	});

	assert.match(html, /Total cases\/capsules:<\/strong> 15/);
	assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt; x2/);
	assert.doesNotMatch(html, /<img/i);
	assert.deepEqual(pillNames(html), ['&lt;img src=x onerror=alert(1)&gt;', 'Kilowatt Case']);
});

test('case stats keep the six highest counts and a zero total when stats are missing', () => {
	const byName = {};
	for (let count = 1; count <= 7; count += 1) {
		byName[`Case ${count}`] = count;
	}

	const ranked = renderStats({ totalCases: 28, byName });
	assert.deepEqual(pillNames(ranked), [
		'Case 7',
		'Case 6',
		'Case 5',
		'Case 4',
		'Case 3',
		'Case 2',
	]);
	assert.doesNotMatch(ranked, /Case 1 x1/);

	const empty = renderStats(null);
	assert.match(empty, /Total cases\/capsules:<\/strong> 0/);
	assert.match(empty, /No cases found/);
	assert.deepEqual(pillNames(empty), []);

	const namedOnly = renderStats({ totalCases: 0, byName: {} });
	assert.match(namedOnly, /Total cases\/capsules:<\/strong> 0/);
	assert.match(namedOnly, /No cases found/);
});
