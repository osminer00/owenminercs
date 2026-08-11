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

function extractConstAssignment(source, constName) {
	const start = source.indexOf(`const ${constName} = `);
	assert.notEqual(start, -1, `${constName} should exist`);
	const end = source.indexOf(';', start);
	assert.notEqual(end, -1, `${constName} assignment should end`);
	return source.slice(start, end + 1);
}

function createMemoryStorage() {
	const store = new Map();
	return {
		getItem(key) {
			return store.has(key) ? store.get(key) : null;
		},
		setItem(key, value) {
			store.set(String(key), String(value));
		},
		removeItem(key) {
			store.delete(key);
		},
		_dump() {
			return Object.fromEntries(store.entries());
		},
	};
}

function loadKofiPositionHelpers(options = {}) {
	const localStorage = createMemoryStorage();
	for (const [key, value] of Object.entries(options.seed || {})) {
		localStorage.setItem(key, value);
	}

	class FakeElement {
		constructor() {
			this.style = {};
			this.dataset = {};
		}
		getBoundingClientRect() {
			return this.__rect || { width: 72, height: 72, left: 0, top: 0, right: 72, bottom: 72 };
		}
	}

	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		JSON,
		Element: FakeElement,
		window: {
			innerWidth: Number.isFinite(options.innerWidth) ? options.innerWidth : 1280,
			innerHeight: Number.isFinite(options.innerHeight) ? options.innerHeight : 720,
		},
		localStorage,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(componentsSource, 'KOFI_FLOAT_POS_KEY')}
		${extractFunction(componentsSource, 'clampKofiFloatingHostToViewport')}
		${extractFunction(componentsSource, 'placeKofiFloatingHost')}
		${extractFunction(componentsSource, 'applySavedKofiFloatingPosition')}
		${extractFunction(componentsSource, 'persistKofiFloatingPosition')}
		this.__helpers = {
			KOFI_FLOAT_POS_KEY,
			clampKofiFloatingHostToViewport,
			placeKofiFloatingHost,
			applySavedKofiFloatingPosition,
			persistKofiFloatingPosition,
			FakeElement: Element,
			localStorage,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

function makeHost(FakeElement, rect) {
	const host = new FakeElement();
	host.__rect = rect || { width: 80, height: 64, left: 10, top: 20, right: 90, bottom: 84 };
	return host;
}

test('Ko-fi floating host clamp keeps the widget inside the viewport margins', () => {
	const { clampKofiFloatingHostToViewport, FakeElement } = loadKofiPositionHelpers({
		innerWidth: 400,
		innerHeight: 300,
	});
	const host = makeHost(FakeElement, {
		width: 100,
		height: 50,
		left: 0,
		top: 0,
		right: 100,
		bottom: 50,
	});

	const clampedLow = clampKofiFloatingHostToViewport(host, -40, -10);
	assert.equal(clampedLow.left, 2);
	assert.equal(clampedLow.top, 2);

	const clampedHigh = clampKofiFloatingHostToViewport(host, 999, 999);
	assert.equal(clampedHigh.left, 298);
	assert.equal(clampedHigh.top, 248);
});

test('applySavedKofiFloatingPosition restores valid coords and clears corrupt storage', () => {
	const helpers = loadKofiPositionHelpers({
		innerWidth: 1280,
		innerHeight: 720,
		seed: {
			'owenminercs-kofi-floating-chat-pos': JSON.stringify({ left: 42.2, top: 88.8 }),
		},
	});
	const { applySavedKofiFloatingPosition, FakeElement, localStorage, KOFI_FLOAT_POS_KEY } =
		helpers;

	const host = makeHost(FakeElement);
	applySavedKofiFloatingPosition(host);

	assert.equal(host.dataset.owenKofiPosApplied, '1');
	assert.equal(host.dataset.owenKofiCustomized, '1');
	assert.equal(host.style.position, 'fixed');
	assert.equal(host.style.left, '42px');
	assert.equal(host.style.top, '89px');
	assert.equal(host.style.right, 'auto');
	assert.equal(host.style.bottom, 'auto');

	// Idempotent: second apply must not re-read storage or move again.
	host.style.left = '1px';
	applySavedKofiFloatingPosition(host);
	assert.equal(host.style.left, '1px');

	const corruptHelpers = loadKofiPositionHelpers({
		seed: {
			[KOFI_FLOAT_POS_KEY]: JSON.stringify({ left: 'nope', top: 3 }),
		},
	});
	const badHost = makeHost(corruptHelpers.FakeElement);
	corruptHelpers.applySavedKofiFloatingPosition(badHost);
	assert.equal(corruptHelpers.localStorage.getItem(KOFI_FLOAT_POS_KEY), null);
	assert.notEqual(badHost.dataset.owenKofiCustomized, '1');
});

test('persistKofiFloatingPosition only stores customized finite coordinates', () => {
	const { persistKofiFloatingPosition, FakeElement, localStorage, KOFI_FLOAT_POS_KEY } =
		loadKofiPositionHelpers();

	const host = makeHost(FakeElement);
	host.style.left = '55px';
	host.style.top = '66px';

	persistKofiFloatingPosition(host);
	assert.equal(localStorage.getItem(KOFI_FLOAT_POS_KEY), null);

	host.dataset.owenKofiCustomized = '1';
	persistKofiFloatingPosition(host);
	assert.deepEqual(JSON.parse(localStorage.getItem(KOFI_FLOAT_POS_KEY)), {
		left: 55,
		top: 66,
	});

	host.style.left = 'NaN';
	persistKofiFloatingPosition(host);
	assert.equal(localStorage.getItem(KOFI_FLOAT_POS_KEY), null);
});
