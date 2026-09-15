import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');

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

function loadBackdropHelpers() {
	class Element {}
	class FakeNode extends Element {
		constructor(closestMap = {}) {
			super();
			this.closestMap = closestMap;
		}
		closest(selector) {
			return Object.prototype.hasOwnProperty.call(this.closestMap, selector)
				? this.closestMap[selector]
				: null;
		}
	}

	const sandbox = { Element, Boolean };
	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(componentsSource, 'isBackdropPointerTarget')}
		this.__helpers = { isBackdropPointerTarget };
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'backdrop pointer helper should load');
	return {
		isBackdropPointerTarget: sandbox.__helpers.isBackdropPointerTarget,
		FakeNode,
		Element: sandbox.Element,
	};
}

test('isBackdropPointerTarget rejects non-elements so text nodes cannot start a dock drag', () => {
	const { isBackdropPointerTarget } = loadBackdropHelpers();
	assert.equal(isBackdropPointerTarget(null), false);
	assert.equal(isBackdropPointerTarget(undefined), false);
	assert.equal(isBackdropPointerTarget({ closest: () => true }), false);
	assert.equal(isBackdropPointerTarget('site-social-nav--dock'), false);
});

test('isBackdropPointerTarget ignores social profile links so icon clicks do not steal the drag', () => {
	const { isBackdropPointerTarget, FakeNode } = loadBackdropHelpers();
	const link = new FakeNode({
		'a.site-social-nav__link': {},
		'.site-social-nav--dock': {},
	});
	assert.equal(isBackdropPointerTarget(link), false);
});

test('isBackdropPointerTarget treats empty dock chrome as a drag surface', () => {
	const { isBackdropPointerTarget, FakeNode } = loadBackdropHelpers();
	const chrome = new FakeNode({
		'a.site-social-nav__link': null,
		'.site-social-nav--dock': {},
	});
	assert.equal(isBackdropPointerTarget(chrome), true);
});

test('isBackdropPointerTarget ignores pointers outside the dock pill', () => {
	const { isBackdropPointerTarget, FakeNode } = loadBackdropHelpers();
	const outside = new FakeNode({
		'a.site-social-nav__link': null,
		'.site-social-nav--dock': null,
	});
	assert.equal(isBackdropPointerTarget(outside), false);
});
