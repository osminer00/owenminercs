import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

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

function loadClosestHeadingHelper() {
	const source = readWorkspaceFile('scripts/accessible-media.js');
	const sandbox = { String };

	vm.runInNewContext(
		[
			extractFunction(source, 'cleanText'),
			extractFunction(source, 'closestHeadingText'),
			'this.closestHeadingText = closestHeadingText;',
		].join('\n'),
		sandbox
	);

	assert.equal(typeof sandbox.closestHeadingText, 'function');
	return sandbox.closestHeadingText;
}

function makeImage({ headingText, closestReturns = true } = {}) {
	const heading =
		headingText == null
			? null
			: {
					textContent: headingText,
				};

	const block = {
		querySelector(selector) {
			assert.match(selector, /keep-card__label/);
			assert.match(selector, /h1, h2, h3, h4/);
			return heading;
		},
	};

	return {
		closest(selector) {
			assert.match(selector, /\.keep-card/);
			assert.match(selector, /section/);
			return closestReturns ? block : null;
		},
	};
}

test('closestHeadingText returns cleaned heading text from the nearest keep-card or section', () => {
	const closestHeadingText = loadClosestHeadingHelper();

	assert.equal(closestHeadingText(makeImage({ headingText: '  Desk   Setup  ' })), 'Desk Setup');
	assert.equal(closestHeadingText(makeImage({ headingText: 'PC build' })), 'PC build');
	assert.equal(closestHeadingText(makeImage({ headingText: null })), '');
});

test('closestHeadingText ignores images without closest() or a matching block', () => {
	const closestHeadingText = loadClosestHeadingHelper();

	assert.equal(closestHeadingText(null), '');
	assert.equal(closestHeadingText({}), '');
	assert.equal(closestHeadingText(makeImage({ closestReturns: false })), '');
});
