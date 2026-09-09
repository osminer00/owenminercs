import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');

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

class Element {}

class FakeMark extends Element {
	constructor(rect) {
		super();
		this._rect = rect;
	}

	getBoundingClientRect() {
		return this._rect;
	}
}

class FakeSpin extends Element {
	constructor() {
		super();
		this.classes = new Set(['is-fidget-turbo', 'keep-me']);
		this.attrs = { 'data-fidget-fx': '3', 'data-other': '1' };
		this.classList = {
			remove: (name) => {
				this.classes.delete(name);
			},
		};
	}

	removeAttribute(name) {
		delete this.attrs[name];
	}
}

function loadPivotHelpers() {
	const sandbox = {
		Element,
		Math,
	};
	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(componentsSource, 'getPivotFromMark')}
		${extractFunction(componentsSource, 'clearFidgetTurboVisual')}
		this.__helpers = {
			getPivotFromMark,
			clearFidgetTurboVisual,
		};
		`,
		sandbox
	);
	assert.ok(sandbox.__helpers, 'dock pivot helpers should load');
	return sandbox.__helpers;
}

test('getPivotFromMark returns the rect center and ignores non-elements', () => {
	const helpers = loadPivotHelpers();

	const center = helpers.getPivotFromMark(
		new FakeMark({ left: 10, top: 20, width: 40, height: 30 })
	);
	assert.equal(center.x, 30);
	assert.equal(center.y, 35);

	const zero = helpers.getPivotFromMark(new FakeMark({ left: 0, top: 0, width: 0, height: 0 }));
	assert.equal(zero.x, 0);
	assert.equal(zero.y, 0);

	assert.equal(helpers.getPivotFromMark(null), null);
	assert.equal(helpers.getPivotFromMark(undefined), null);
	assert.equal(helpers.getPivotFromMark({ getBoundingClientRect: () => ({ left: 1, top: 1 }) }), null);
});

test('clearFidgetTurboVisual strips turbo chrome and no-ops for non-elements', () => {
	const helpers = loadPivotHelpers();
	const spin = new FakeSpin();

	helpers.clearFidgetTurboVisual(spin);
	assert.equal(spin.classes.has('is-fidget-turbo'), false);
	assert.equal(spin.classes.has('keep-me'), true);
	assert.equal(Object.prototype.hasOwnProperty.call(spin.attrs, 'data-fidget-fx'), false);
	assert.equal(spin.attrs['data-other'], '1');

	assert.equal(helpers.clearFidgetTurboVisual(null), undefined);
	assert.equal(helpers.clearFidgetTurboVisual({ classList: { remove() {} } }), undefined);
});
