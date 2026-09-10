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
	};
}

class Element {}

class FakeClassList {
	constructor(initial = []) {
		this._set = new Set(initial);
	}

	contains(name) {
		return this._set.has(name);
	}

	add(name) {
		this._set.add(name);
	}

	remove(...names) {
		for (const name of names) this._set.delete(name);
	}

	toggle(name, force) {
		if (force === true) {
			this._set.add(name);
			return true;
		}
		if (force === false) {
			this._set.delete(name);
			return false;
		}
		if (this._set.has(name)) {
			this._set.delete(name);
			return false;
		}
		this._set.add(name);
		return true;
	}
}

class FakeNode extends Element {
	constructor() {
		super();
		this.children = [];
		this.parent = null;
	}

	appendChild(child) {
		if (child.parent) {
			const siblings = child.parent.children;
			const idx = siblings.indexOf(child);
			if (idx >= 0) siblings.splice(idx, 1);
		}
		this.children.push(child);
		child.parent = this;
		return child;
	}

	after(node) {
		if (!this.parent) return;
		if (node.parent) {
			const siblings = node.parent.children;
			const idx = siblings.indexOf(node);
			if (idx >= 0) siblings.splice(idx, 1);
		}
		const i = this.parent.children.indexOf(this);
		this.parent.children.splice(i + 1, 0, node);
		node.parent = this.parent;
	}
}

function loadRemountHelpers({ hasSlot = true, hasReset = true } = {}) {
	const localStorage = createMemoryStorage();
	const slot = hasSlot ? new FakeNode() : null;
	const reset = hasReset ? new FakeNode() : null;
	if (slot && reset) slot.appendChild(reset);
	if (reset) reset.hidden = true;

	const document = {
		querySelector(selector) {
			if (selector === '.site-header-dock-cluster') return slot;
			if (selector === '[data-owen-social-dock-reset]') return reset;
			return null;
		},
	};

	if (slot) {
		slot.querySelector = (selector) => {
			if (selector === '[data-owen-social-dock-reset]') return reset;
			return null;
		};
	}

	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		JSON,
		Element,
		localStorage,
		document,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_POS_KEY')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_CUSTOMIZED_CLASS')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_SCALE_MIN')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_SCALE_MAX')}
		${extractFunction(componentsSource, 'querySocialDockHeaderSlot')}
		${extractFunction(componentsSource, 'appendDockToDefaultSlot')}
		${extractFunction(componentsSource, 'setSocialDockCustomized')}
		${extractFunction(componentsSource, 'clampSocialDockScale')}
		${extractFunction(componentsSource, 'parseSocialDockTiltDeg')}
		${extractFunction(componentsSource, 'persistSocialDockPosition')}
		${extractFunction(componentsSource, 'syncSocialDockIntoHeaderWhenPossible')}
		${extractFunction(componentsSource, 'ensureSocialDockDefaultSlotIfUnplaced')}
		this.__helpers = {
			SOCIAL_DOCK_POS_KEY,
			SOCIAL_DOCK_CUSTOMIZED_CLASS,
			querySocialDockHeaderSlot,
			appendDockToDefaultSlot,
			setSocialDockCustomized,
			syncSocialDockIntoHeaderWhenPossible,
			ensureSocialDockDefaultSlotIfUnplaced,
			localStorage,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'dock remount helpers should load');
	sandbox.__helpers.slot = slot;
	sandbox.__helpers.reset = reset;
	return sandbox.__helpers;
}

function makeWrap(helpers, options = {}) {
	const classes = [];
	if (options.placed) classes.push('site-support-dock--placed');
	if (options.customized) classes.push(helpers.SOCIAL_DOCK_CUSTOMIZED_CLASS);

	const wrap = new FakeNode();
	wrap.classList = new FakeClassList(classes);
	wrap.style = {
		left: options.left == null ? '' : `${options.left}px`,
		top: options.top == null ? '' : `${options.top}px`,
	};
	wrap.querySelector = () => null;
	return wrap;
}

test('appendDockToDefaultSlot inserts after the header reset control', () => {
	const helpers = loadRemountHelpers({ hasSlot: true, hasReset: true });
	const wrap = makeWrap(helpers, { placed: true });

	assert.equal(helpers.appendDockToDefaultSlot(wrap), true);
	assert.equal(helpers.slot.children[0], helpers.reset);
	assert.equal(helpers.slot.children[1], wrap);
	assert.equal(wrap.parent, helpers.slot);
});

test('appendDockToDefaultSlot appends when the header has no reset control', () => {
	const helpers = loadRemountHelpers({ hasSlot: true, hasReset: false });
	const wrap = makeWrap(helpers);

	assert.equal(helpers.appendDockToDefaultSlot(wrap), true);
	assert.equal(helpers.slot.children.length, 1);
	assert.equal(helpers.slot.children[0], wrap);
});

test('appendDockToDefaultSlot returns false when the header cluster is missing', () => {
	const helpers = loadRemountHelpers({ hasSlot: false, hasReset: false });
	const wrap = makeWrap(helpers, { placed: true });

	assert.equal(helpers.querySocialDockHeaderSlot(), null);
	assert.equal(helpers.appendDockToDefaultSlot(wrap), false);
	assert.equal(wrap.parent, null);
});

test('setSocialDockCustomized toggles chrome and the header reset control', () => {
	const helpers = loadRemountHelpers();
	const wrap = makeWrap(helpers);

	assert.equal(helpers.setSocialDockCustomized(null, true), undefined);
	assert.equal(helpers.setSocialDockCustomized({}, true), undefined);

	helpers.setSocialDockCustomized(wrap, true);
	assert.equal(wrap.classList.contains(helpers.SOCIAL_DOCK_CUSTOMIZED_CLASS), true);
	assert.equal(helpers.reset.hidden, false);

	helpers.setSocialDockCustomized(wrap, false);
	assert.equal(wrap.classList.contains(helpers.SOCIAL_DOCK_CUSTOMIZED_CLASS), false);
	assert.equal(helpers.reset.hidden, true);
});

test('syncSocialDockIntoHeaderWhenPossible remounts only uncustomized docks', () => {
	const helpers = loadRemountHelpers();
	const customized = makeWrap(helpers, {
		placed: true,
		customized: true,
		left: 40,
		top: 12,
	});

	helpers.syncSocialDockIntoHeaderWhenPossible(customized);
	assert.equal(customized.parent, null);
	assert.equal(customized.classList.contains('site-support-dock--placed'), true);
	assert.equal(customized.style.left, '40px');
	assert.equal(customized.style.top, '12px');

	const uncustomized = makeWrap(helpers, { placed: true, left: 40, top: 12 });
	helpers.syncSocialDockIntoHeaderWhenPossible(uncustomized);
	assert.equal(uncustomized.parent, helpers.slot);
	assert.equal(uncustomized.classList.contains('site-support-dock--placed'), false);
	assert.equal(uncustomized.style.left, '');
	assert.equal(uncustomized.style.top, '');
	assert.equal(helpers.slot.children[1], uncustomized);
});

test('ensureSocialDockDefaultSlotIfUnplaced skips customized docks and remounts the rest', () => {
	const helpers = loadRemountHelpers();
	const customized = makeWrap(helpers, {
		placed: true,
		customized: true,
		left: 22,
		top: 8,
	});

	helpers.ensureSocialDockDefaultSlotIfUnplaced(customized);
	assert.equal(customized.parent, null);
	assert.equal(customized.classList.contains('site-support-dock--placed'), true);
	assert.equal(customized.style.left, '22px');
	assert.equal(customized.style.top, '8px');

	const uncustomized = makeWrap(helpers, { placed: true, left: 22, top: 8 });
	helpers.ensureSocialDockDefaultSlotIfUnplaced(uncustomized);
	assert.equal(uncustomized.parent, helpers.slot);
	assert.equal(uncustomized.classList.contains('site-support-dock--placed'), false);
	assert.equal(uncustomized.style.left, '');
	assert.equal(uncustomized.style.top, '');
});
