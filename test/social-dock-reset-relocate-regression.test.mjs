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

class FakeStyle {
	constructor(initial = {}) {
		this.left = initial.left ?? '';
		this.top = initial.top ?? '';
		this._props = { ...(initial.props || {}) };
	}

	getPropertyValue(name) {
		return this._props[name] || '';
	}

	setProperty(name, value) {
		this._props[name] = String(value);
	}

	removeProperty(name) {
		delete this._props[name];
	}
}

class FakeNode extends Element {
	constructor() {
		super();
		this.children = [];
		this.parent = null;
		this.offsetWidth = 40;
		this.offsetHeight = 32;
		this.style = new FakeStyle();
		this.lastEvent = null;
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

	contains(node) {
		if (node === this) return true;
		return this.children.some((child) => child.contains?.(node) || child === node);
	}

	getBoundingClientRect() {
		const ownLeft = Number.parseFloat(this.style.left);
		const ownTop = Number.parseFloat(this.style.top);
		let left = Number.isFinite(ownLeft) ? ownLeft : 0;
		let top = Number.isFinite(ownTop) ? ownTop : 0;
		if (!Number.isFinite(ownLeft) || !Number.isFinite(ownTop)) {
			const parentRect = this.parent?.getBoundingClientRect?.();
			if (parentRect) {
				if (!Number.isFinite(ownLeft)) left = parentRect.left;
				if (!Number.isFinite(ownTop)) top = parentRect.top;
			}
		}
		const width = this.offsetWidth;
		const height = this.offsetHeight;
		return {
			left,
			top,
			right: left + width,
			bottom: top + height,
			width,
			height,
		};
	}

	dispatchEvent(event) {
		this.lastEvent = event;
		return true;
	}
}

function loadResetHelpers({ hasSlot = true, hasReset = true } = {}) {
	const localStorage = createMemoryStorage();
	const body = new FakeNode();
	const slot = hasSlot ? new FakeNode() : null;
	const reset = hasReset ? new FakeNode() : null;
	if (slot && reset) slot.appendChild(reset);
	if (reset) reset.hidden = true;

	const rafQueue = [];
	const requestAnimationFrame = (cb) => {
		rafQueue.push(cb);
		return rafQueue.length;
	};

	const document = {
		body,
		querySelector(selector) {
			if (selector === '.site-header-dock-cluster') return slot;
			if (selector === '[data-owen-social-dock-reset]') return reset;
			if (selector === '.site-header-brand-row') return null;
			if (selector === '.site-shared-header') return null;
			return null;
		},
	};

	if (slot) {
		slot.querySelector = (selector) => {
			if (selector === '[data-owen-social-dock-reset]') return reset;
			return null;
		};
	}

	const window = {
		innerWidth: 800,
		innerHeight: 600,
	};

	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		JSON,
		parseFloat,
		Element,
		CustomEvent,
		localStorage,
		document,
		window,
		requestAnimationFrame,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_POS_KEY')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_CUSTOMIZED_CLASS')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_SCALE_MIN')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_SCALE_MAX')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_VIEWPORT_FALLBACK_GAP_PX')}
		${extractFunction(componentsSource, 'querySocialDockHeaderSlot')}
		${extractFunction(componentsSource, 'appendDockToDefaultSlot')}
		${extractFunction(componentsSource, 'setSocialDockCustomized')}
		${extractFunction(componentsSource, 'clampSocialDockScale')}
		${extractFunction(componentsSource, 'parseSocialDockTiltDeg')}
		${extractFunction(componentsSource, 'socialDockCoordsRounded')}
		${extractFunction(componentsSource, 'clampSocialDockToViewport')}
		${extractFunction(componentsSource, 'getSocialDockDefaultViewportPosition')}
		${extractFunction(componentsSource, 'persistSocialDockPosition')}
		${extractFunction(componentsSource, 'relocateSocialDockToDefaultMount')}
		${extractFunction(componentsSource, 'applyDefaultSocialDockAnchor')}
		${extractFunction(componentsSource, 'ensureSocialDockDefaultSlotIfUnplaced')}
		${extractFunction(componentsSource, 'clearSocialDockPosition')}
		${extractFunction(componentsSource, 'resetSocialDockToDefault')}
		this.__helpers = {
			SOCIAL_DOCK_POS_KEY,
			SOCIAL_DOCK_CUSTOMIZED_CLASS,
			querySocialDockHeaderSlot,
			appendDockToDefaultSlot,
			setSocialDockCustomized,
			relocateSocialDockToDefaultMount,
			applyDefaultSocialDockAnchor,
			ensureSocialDockDefaultSlotIfUnplaced,
			clearSocialDockPosition,
			resetSocialDockToDefault,
			localStorage,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'dock reset helpers should load');
	sandbox.__helpers.slot = slot;
	sandbox.__helpers.reset = reset;
	sandbox.__helpers.body = body;
	sandbox.__helpers.flushRaf = () => {
		const queued = rafQueue.splice(0);
		for (const cb of queued) cb(0);
		return queued.length;
	};
	sandbox.__helpers.pendingRafCount = () => rafQueue.length;
	return sandbox.__helpers;
}

function makeWrap(helpers, options = {}) {
	const classes = [];
	if (options.placed) classes.push('site-support-dock--placed');
	if (options.customized) classes.push(helpers.SOCIAL_DOCK_CUSTOMIZED_CLASS);
	if (options.dragging) classes.push('site-support-dock--dragging');

	const wrap = new FakeNode();
	wrap.classList = new FakeClassList(classes);
	wrap.style.left = options.left == null ? '' : `${options.left}px`;
	wrap.style.top = options.top == null ? '' : `${options.top}px`;

	const spin = new FakeNode();
	spin.style = new FakeStyle({
		props: {
			'--site-social-scale': options.scale == null ? '' : String(options.scale),
			'--site-social-tilt': options.tilt == null ? '' : `${options.tilt}deg`,
		},
	});
	wrap.appendChild(spin);
	wrap.querySelector = (selector) => {
		if (selector === '.site-social-nav__spin') return spin;
		if (selector === '.site-social-nav--dock') return wrap;
		return null;
	};
	wrap.spin = spin;
	return wrap;
}

test('relocateSocialDockToDefaultMount remounts into the header cluster when it exists', () => {
	const helpers = loadResetHelpers({ hasSlot: true, hasReset: true });
	const wrap = makeWrap(helpers, { placed: true, left: 40, top: 12 });

	helpers.relocateSocialDockToDefaultMount(wrap);

	assert.equal(wrap.parent, helpers.slot);
	assert.equal(helpers.slot.children[1], wrap);
	assert.equal(helpers.body.children.includes(wrap), false);
	assert.equal(helpers.pendingRafCount(), 0);
	assert.equal(wrap.classList.contains('site-support-dock--placed'), true);
	assert.equal(wrap.style.left, '40px');
});

test('relocateSocialDockToDefaultMount falls back to a clamped body placement after rAF', () => {
	const helpers = loadResetHelpers({ hasSlot: false, hasReset: false });
	const wrap = makeWrap(helpers, { left: 999, top: 4 });

	helpers.relocateSocialDockToDefaultMount(wrap);

	assert.equal(wrap.parent, helpers.body);
	assert.equal(wrap.classList.contains('site-support-dock--placed'), true);
	assert.equal(helpers.pendingRafCount(), 1);
	assert.equal(wrap.style.left, '999px');

	assert.equal(helpers.flushRaf(), 1);
	assert.equal(wrap.style.left, '2px');
	assert.equal(wrap.style.top, '2px');
});

test('applyDefaultSocialDockAnchor only repositions placed, uncustomized docks', () => {
	const helpers = loadResetHelpers({ hasSlot: false, hasReset: false });

	assert.equal(helpers.applyDefaultSocialDockAnchor(null), undefined);
	assert.equal(helpers.applyDefaultSocialDockAnchor({}), undefined);

	const customized = makeWrap(helpers, {
		placed: true,
		customized: true,
		left: 88,
		top: 44,
	});
	helpers.applyDefaultSocialDockAnchor(customized);
	assert.equal(customized.style.left, '88px');
	assert.equal(customized.style.top, '44px');

	const unplaced = makeWrap(helpers, { left: 18, top: 9 });
	helpers.applyDefaultSocialDockAnchor(unplaced);
	assert.equal(unplaced.style.left, '18px');
	assert.equal(unplaced.style.top, '9px');

	const placed = makeWrap(helpers, { placed: true, left: 120, top: 80 });
	helpers.applyDefaultSocialDockAnchor(placed);
	assert.equal(placed.style.left, '2px');
	assert.equal(placed.style.top, '2px');
});

test('clearSocialDockPosition strips placement chrome, remounts, and drops stored coords', () => {
	const helpers = loadResetHelpers({ hasSlot: true, hasReset: true });
	const wrap = makeWrap(helpers, {
		placed: true,
		customized: true,
		dragging: true,
		left: 64,
		top: 28,
		scale: 1.4,
		tilt: 12,
	});
	helpers.localStorage.setItem(helpers.SOCIAL_DOCK_POS_KEY, '{"left":64,"top":28}');

	helpers.clearSocialDockPosition(wrap);

	assert.equal(wrap.classList.contains('site-support-dock--placed'), false);
	assert.equal(wrap.classList.contains('site-support-dock--dragging'), false);
	assert.equal(wrap.classList.contains(helpers.SOCIAL_DOCK_CUSTOMIZED_CLASS), false);
	assert.equal(wrap.style.left, '');
	assert.equal(wrap.style.top, '');
	assert.equal(wrap.spin.style.getPropertyValue('--site-social-scale'), '');
	assert.equal(wrap.spin.style.getPropertyValue('--site-social-tilt'), '');
	assert.equal(wrap.parent, helpers.slot);
	assert.equal(helpers.localStorage.getItem(helpers.SOCIAL_DOCK_POS_KEY), null);
	assert.equal(helpers.reset.hidden, true);
});

test('resetSocialDockToDefault dispatches reset, remounts into the header, and persists a clear', () => {
	const helpers = loadResetHelpers({ hasSlot: true, hasReset: true });
	const wrap = makeWrap(helpers, {
		placed: true,
		customized: true,
		left: 50,
		top: 20,
		scale: 1.2,
	});
	helpers.localStorage.setItem(
		helpers.SOCIAL_DOCK_POS_KEY,
		JSON.stringify({ left: 50, top: 20, scale: 1.2, customized: true })
	);

	helpers.resetSocialDockToDefault(wrap);

	assert.equal(wrap.lastEvent?.type, 'owen-social-dock-reset');
	assert.equal(wrap.parent, helpers.slot);
	assert.equal(wrap.classList.contains('site-support-dock--placed'), false);
	assert.equal(wrap.classList.contains(helpers.SOCIAL_DOCK_CUSTOMIZED_CLASS), false);
	assert.equal(wrap.style.left, '');
	assert.equal(wrap.style.top, '');
	assert.equal(helpers.localStorage.getItem(helpers.SOCIAL_DOCK_POS_KEY), null);
	assert.equal(helpers.reset.hidden, true);
});
