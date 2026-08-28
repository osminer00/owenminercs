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

function extractConstAssignment(source, constName) {
	const start = source.indexOf(`const ${constName} = `);
	assert.notEqual(start, -1, `${constName} should exist`);
	const end = source.indexOf(';', start);
	assert.notEqual(end, -1, `${constName} assignment should end`);
	return source.slice(start, end + 1);
}

function extractUseLightModeAssignment(source) {
	const start = source.indexOf('let useLightMode =');
	assert.notEqual(start, -1, 'useLightMode assignment should exist');
	const end = source.indexOf(';', start);
	assert.notEqual(end, -1, 'useLightMode assignment should end');
	return source.slice(start, end + 1);
}

function createMemoryStorage(seed = {}) {
	const store = new Map(Object.entries(seed));
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
	};
}

function loadModeHelpers(options = {}) {
	const localStorage = options.localStorage || createMemoryStorage(options.seed || {});
	const sandbox = {
		localStorage,
		String,
		Boolean,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(socialCloudSource, 'MODE_STORAGE_KEY')}
		${extractConstAssignment(socialCloudSource, 'LIGHT_MODE_VALUE')}
		${extractConstAssignment(socialCloudSource, 'FULL_MODE_VALUE')}
		${extractFunction(socialCloudSource, 'getStoredModePreference')}
		${extractFunction(socialCloudSource, 'setStoredModePreference')}
		function resolveInitialLightMode(autoLightMode) {
			${extractUseLightModeAssignment(socialCloudSource)}
			return useLightMode;
		}
		this.__helpers = {
			MODE_STORAGE_KEY,
			LIGHT_MODE_VALUE,
			FULL_MODE_VALUE,
			getStoredModePreference,
			setStoredModePreference,
			resolveInitialLightMode,
		};
		`,
		sandbox
	);

	return {
		helpers: sandbox.__helpers,
		localStorage,
	};
}

test('getStoredModePreference only accepts light or full and swallows storage failures', () => {
	assert.equal(loadModeHelpers().helpers.getStoredModePreference(), '');
	assert.equal(loadModeHelpers({ seed: { 'smc-cloud-mode': 'light' } }).helpers.getStoredModePreference(), 'light');
	assert.equal(loadModeHelpers({ seed: { 'smc-cloud-mode': 'full' } }).helpers.getStoredModePreference(), 'full');
	assert.equal(loadModeHelpers({ seed: { 'smc-cloud-mode': 'dark' } }).helpers.getStoredModePreference(), '');
	assert.equal(loadModeHelpers({ seed: { 'smc-cloud-mode': '1' } }).helpers.getStoredModePreference(), '');
	assert.equal(loadModeHelpers({ seed: { 'smc-cloud-mode': 'LIGHT' } }).helpers.getStoredModePreference(), '');

	const throwingStorage = {
		getItem() {
			throw new Error('blocked');
		},
		setItem() {
			throw new Error('blocked');
		},
	};
	assert.equal(
		loadModeHelpers({ localStorage: throwingStorage }).helpers.getStoredModePreference(),
		''
	);
});

test('setStoredModePreference persists the mode key and ignores write errors', () => {
	const { helpers, localStorage } = loadModeHelpers();
	helpers.setStoredModePreference(helpers.LIGHT_MODE_VALUE);
	assert.equal(localStorage.getItem(helpers.MODE_STORAGE_KEY), 'light');
	helpers.setStoredModePreference(helpers.FULL_MODE_VALUE);
	assert.equal(localStorage.getItem(helpers.MODE_STORAGE_KEY), 'full');

	const throwingStorage = {
		getItem() {
			return null;
		},
		setItem() {
			throw new Error('quota');
		},
	};
	assert.doesNotThrow(() => {
		loadModeHelpers({ localStorage: throwingStorage }).helpers.setStoredModePreference('light');
	});
});

test('initial lightweight mode prefers an explicit stored choice over device auto-detection', () => {
	const storedLight = loadModeHelpers({ seed: { 'smc-cloud-mode': 'light' } }).helpers;
	assert.equal(storedLight.resolveInitialLightMode(false), true);
	assert.equal(storedLight.resolveInitialLightMode(true), true);

	const storedFull = loadModeHelpers({ seed: { 'smc-cloud-mode': 'full' } }).helpers;
	assert.equal(storedFull.resolveInitialLightMode(true), false);
	assert.equal(storedFull.resolveInitialLightMode(false), false);

	const unset = loadModeHelpers().helpers;
	assert.equal(unset.resolveInitialLightMode(true), true);
	assert.equal(unset.resolveInitialLightMode(false), false);

	const garbage = loadModeHelpers({ seed: { 'smc-cloud-mode': 'auto' } }).helpers;
	assert.equal(garbage.resolveInitialLightMode(true), true);
	assert.equal(garbage.resolveInitialLightMode(false), false);
});
