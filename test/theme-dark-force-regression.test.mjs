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

function createMemoryStorage(seed = {}, options = {}) {
	const store = new Map();
	for (const [key, value] of Object.entries(seed)) {
		store.set(String(key), String(value));
	}
	return {
		getItem(key) {
			return store.has(key) ? store.get(key) : null;
		},
		setItem(key, value) {
			if (options.throwOnSet) throw new Error('storage blocked');
			store.set(String(key), String(value));
		},
		removeItem(key) {
			store.delete(key);
		},
	};
}

function loadThemeHelpers(options = {}) {
	const localStorage = createMemoryStorage(options.seed || {}, options);
	const logos = [{ src: '/images/owenminercs-logo-light.png' }];
	const meta = {
		attrs: { content: '#ffffff' },
		setAttribute(name, value) {
			this.attrs[name] = String(value);
		},
		getAttribute(name) {
			return this.attrs[name] || null;
		},
	};
	const root = {
		dataset: { theme: 'light' },
	};

	const sandbox = {
		String,
		localStorage,
		root,
		meta,
		logos,
		document: {
			documentElement: root,
			querySelector(selector) {
				if (selector === 'meta[name="theme-color"]') return meta;
				return null;
			},
			querySelectorAll(selector) {
				if (selector === 'img.site-logo') return logos;
				return [];
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		const siteRoot = ${JSON.stringify(options.siteRoot || '/')};
		${extractConstAssignment(componentsSource, 'THEME_STORAGE_KEY')}
		${extractFunction(componentsSource, 'brandLogoFilename')}
		${extractFunction(componentsSource, 'syncBrandLogosForTheme')}
		${extractFunction(componentsSource, 'applyStoredTheme')}
		this.__helpers = {
			THEME_STORAGE_KEY,
			brandLogoFilename,
			applyStoredTheme,
			localStorage,
			root,
			meta,
			logos,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('brandLogoFilename maps light vs dark brand assets', () => {
	const helpers = loadThemeHelpers();
	assert.equal(helpers.THEME_STORAGE_KEY, 'owenminercs-theme');
	assert.equal(helpers.brandLogoFilename('light'), 'owenminercs-logo-light.png');
	assert.equal(helpers.brandLogoFilename('dark'), 'owenminercs-logo.png');
	assert.equal(helpers.brandLogoFilename('auto'), 'owenminercs-logo.png');
});

test('applyStoredTheme always forces dark and ignores a stored light preference', () => {
	const helpers = loadThemeHelpers({
		seed: { 'owenminercs-theme': 'light' },
		siteRoot: 'https://www.owenminercs.com/',
	});

	assert.equal(helpers.root.dataset.theme, 'light');
	helpers.applyStoredTheme();

	assert.equal(helpers.localStorage.getItem(helpers.THEME_STORAGE_KEY), 'dark');
	assert.equal(Object.prototype.hasOwnProperty.call(helpers.root.dataset, 'theme'), false);
	assert.equal(helpers.meta.getAttribute('content'), '#050505');
	assert.equal(helpers.logos[0].src, 'https://www.owenminercs.com/images/owenminercs-logo.png');
});

test('applyStoredTheme still applies chrome when localStorage writes fail', () => {
	const helpers = loadThemeHelpers({
		seed: { 'owenminercs-theme': 'light' },
		throwOnSet: true,
	});

	helpers.applyStoredTheme();

	assert.equal(helpers.localStorage.getItem(helpers.THEME_STORAGE_KEY), 'light');
	assert.equal(Object.prototype.hasOwnProperty.call(helpers.root.dataset, 'theme'), false);
	assert.equal(helpers.meta.getAttribute('content'), '#050505');
	assert.equal(helpers.logos[0].src, '/images/owenminercs-logo.png');
});

test('applyStoredTheme never reads a stored theme before forcing dark', () => {
	const applySource = extractFunction(componentsSource, 'applyStoredTheme');
	assert.match(applySource, /localStorage\.setItem\(THEME_STORAGE_KEY, 'dark'\)/);
	assert.doesNotMatch(applySource, /localStorage\.getItem/);
});
