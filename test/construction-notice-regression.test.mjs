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

function extractNamedIife(source, name) {
	const start = source.indexOf(`(function ${name}`);
	assert.notEqual(start, -1, `${name} IIFE should exist`);

	let depth = 0;
	let started = false;
	for (let i = start; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') {
			depth += 1;
			started = true;
		}
		if (char === '}') {
			depth -= 1;
			if (started && depth === 0) {
				const close = source.indexOf(')', i);
				return source.slice(start, close === -1 ? i + 1 : close + 1);
			}
		}
	}

	assert.fail(`${name} IIFE should close`);
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
	};
}

function makeEl() {
	return {
		className: '',
		innerHTML: '',
		removed: false,
		style: {},
		attributes: {},
		listeners: {},
		setAttribute(name, value) {
			this.attributes[name] = String(value);
		},
		querySelector(selector) {
			if (selector === '.site-construction-dialog__btn') {
				if (!this._btn) {
					this._btn = {
						focused: false,
						listeners: {},
						addEventListener(type, fn) {
							this.listeners[type] = fn;
						},
						focus() {
							this.focused = true;
						},
					};
				}
				return this._btn;
			}
			return null;
		},
		addEventListener(type, fn) {
			this.listeners[type] = fn;
		},
		remove() {
			this.removed = true;
		},
	};
}

function loadConstructionHelpers(options = {}) {
	const localStorage = createMemoryStorage();
	for (const [key, value] of Object.entries(options.seed || {})) {
		localStorage.setItem(key, value);
	}

	const appended = [];
	const keydownListeners = [];
	const created = [];
	const noticeSource = extractNamedIife(componentsSource, 'initConstructionNotice');

	const document = {
		readyState: 'complete',
		documentElement: {
			dataset: { ...(options.dataset || {}) },
		},
		body: {
			style: { overflow: options.bodyOverflow || '' },
			appendChild(node) {
				appended.push(node);
				return node;
			},
		},
		createElement(tag) {
			const el = makeEl();
			el.tagName = String(tag);
			created.push(el);
			return el;
		},
		addEventListener(type, fn, capture) {
			if (type === 'keydown') keydownListeners.push({ fn, capture });
		},
		removeEventListener(type, fn) {
			if (type !== 'keydown') return;
			const idx = keydownListeners.findIndex((row) => row.fn === fn);
			if (idx >= 0) keydownListeners.splice(idx, 1);
		},
	};

	const sandbox = {
		String,
		Boolean,
		document,
		localStorage,
		window: {
			setTimeout(fn) {
				fn();
				return 0;
			},
		},
		appended,
		created,
		keydownListeners,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(componentsSource, 'DISCORD_INVITE_URL')}
		${extractConstAssignment(noticeSource, 'STORAGE_KEY')}
		${extractFunction(noticeSource, 'dismiss')}
		${extractFunction(noticeSource, 'run')}
		this.__helpers = {
			STORAGE_KEY,
			DISCORD_INVITE_URL,
			dismiss,
			run,
			localStorage,
			document,
			appended,
			created,
			keydownListeners,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('construction notice uses a stable dismiss storage key and only treats "1" as dismissed', () => {
	const helpers = loadConstructionHelpers();
	assert.equal(helpers.STORAGE_KEY, 'owenminercs-construction-notice-dismissed-v1');

	const dismissed = loadConstructionHelpers({
		seed: { 'owenminercs-construction-notice-dismissed-v1': '1' },
	});
	dismissed.run();
	assert.equal(dismissed.appended.length, 0);
	assert.equal(dismissed.document.documentElement.dataset.owenConstructionNoticeInit, '1');

	const otherValue = loadConstructionHelpers({
		seed: { 'owenminercs-construction-notice-dismissed-v1': 'true' },
	});
	otherValue.run();
	assert.equal(otherValue.appended.length, 2);
});

test('construction notice skip-if-already-initialized and dismiss persist + teardown', () => {
	const already = loadConstructionHelpers({
		dataset: { owenConstructionNoticeInit: '1' },
	});
	already.run();
	assert.equal(already.appended.length, 0);

	const helpers = loadConstructionHelpers();
	helpers.run();
	assert.equal(helpers.appended.length, 2);
	assert.match(helpers.appended[1].innerHTML, /Got it/);
	assert.equal(helpers.document.body.style.overflow, 'hidden');
	assert.equal(helpers.keydownListeners.length, 1);

	const host = helpers.appended[1];
	const backdrop = helpers.appended[0];
	const onKey = helpers.keydownListeners[0].fn;
	helpers.dismiss(host, backdrop, onKey);

	assert.equal(helpers.localStorage.getItem(helpers.STORAGE_KEY), '1');
	assert.equal(host.removed, true);
	assert.equal(backdrop.removed, true);
	assert.equal(helpers.document.body.style.overflow, '');
	assert.equal(helpers.keydownListeners.length, 0);
});
