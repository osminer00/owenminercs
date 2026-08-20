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

function loadDockHelpers(options = {}) {
	const localStorage = createMemoryStorage();
	for (const [key, value] of Object.entries(options.seed || {})) {
		localStorage.setItem(key, value);
	}

	class FakeElement {}

	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		JSON,
		Element: FakeElement,
		localStorage,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_EDGE_ROTATE_PX')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_SCALE_MIN')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_SCALE_MAX')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_POS_KEY')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_CUSTOMIZED_CLASS')}
		${extractFunction(componentsSource, 'isPointerOnSocialBarEdge')}
		${extractFunction(componentsSource, 'clampSocialDockScale')}
		${extractFunction(componentsSource, 'parseSocialDockTiltDeg')}
		${extractFunction(componentsSource, 'persistSocialDockPosition')}
		this.__helpers = {
			SOCIAL_DOCK_EDGE_ROTATE_PX,
			SOCIAL_DOCK_POS_KEY,
			SOCIAL_DOCK_CUSTOMIZED_CLASS,
			isPointerOnSocialBarEdge,
			clampSocialDockScale,
			persistSocialDockPosition,
			localStorage,
			FakeElement: Element,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

function makeRectEl(helpers, rect) {
	const node = {
		getBoundingClientRect() {
			return rect;
		},
	};
	Object.setPrototypeOf(node, helpers.FakeElement.prototype);
	return node;
}

function makeWrap(helpers, options = {}) {
	const classes = new Set();
	if (options.placed) classes.add('site-support-dock--placed');
	if (options.customized) classes.add(helpers.SOCIAL_DOCK_CUSTOMIZED_CLASS);

	const props = {};
	if (options.scale != null) props['--site-social-scale'] = String(options.scale);
	if (options.tilt != null) props['--site-social-tilt'] = String(options.tilt);

	const spin = {
		style: {
			getPropertyValue(name) {
				return props[name] || '';
			},
		},
	};

	return {
		classList: {
			contains(name) {
				return classes.has(name);
			},
		},
		style: {
			left: options.left == null ? '' : `${options.left}px`,
			top: options.top == null ? '' : `${options.top}px`,
		},
		querySelector(selector) {
			if (selector === '.site-social-nav__spin') return spin;
			return null;
		},
	};
}

test('isPointerOnSocialBarEdge only treats in-pill rim hits as rotate/resize', () => {
	const helpers = loadDockHelpers();
	assert.equal(helpers.SOCIAL_DOCK_EDGE_ROTATE_PX, 14);
	assert.equal(helpers.isPointerOnSocialBarEdge(10, 10, null), false);
	assert.equal(helpers.isPointerOnSocialBarEdge(10, 10, {}), false);

	const tiny = makeRectEl(helpers, { left: 0, top: 0, right: 1, bottom: 1, width: 1, height: 1 });
	assert.equal(helpers.isPointerOnSocialBarEdge(0, 0, tiny), false);

	const pill = makeRectEl(helpers, {
		left: 100,
		top: 50,
		right: 300,
		bottom: 130,
		width: 200,
		height: 80,
	});

	assert.equal(helpers.isPointerOnSocialBarEdge(99, 90, pill), false);
	assert.equal(helpers.isPointerOnSocialBarEdge(200, 90, pill), false);
	assert.equal(helpers.isPointerOnSocialBarEdge(105, 90, pill), true);
	assert.equal(helpers.isPointerOnSocialBarEdge(114, 90, pill), true);
	assert.equal(helpers.isPointerOnSocialBarEdge(115, 90, pill), false);
	assert.equal(helpers.isPointerOnSocialBarEdge(200, 64, pill), true);
	assert.equal(helpers.isPointerOnSocialBarEdge(286, 90, pill), true);
});

test('persistSocialDockPosition writes customized geometry and clears empty payloads', () => {
	const helpers = loadDockHelpers({
		seed: { 'owenminercs-social-dock-pos': '{"left":9}' },
	});

	helpers.persistSocialDockPosition(makeWrap(helpers, {}));
	assert.equal(helpers.localStorage.getItem(helpers.SOCIAL_DOCK_POS_KEY), null);

	const customized = loadDockHelpers();
	customized.persistSocialDockPosition(
		makeWrap(customized, {
			placed: true,
			customized: true,
			left: 40.4,
			top: 12.6,
			scale: 1.5,
			tilt: '12.5deg',
		})
	);
	const saved = JSON.parse(customized.localStorage.getItem(customized.SOCIAL_DOCK_POS_KEY));
	assert.equal(saved.customized, true);
	assert.equal(saved.left, 40.4);
	assert.equal(saved.top, 12.6);
	assert.equal(saved.scale, 1.5);
	assert.equal(saved.tilt, 12.5);

	const defaults = loadDockHelpers();
	defaults.persistSocialDockPosition(
		makeWrap(defaults, {
			placed: true,
			customized: true,
			left: 8,
			top: 8,
			scale: 1,
			tilt: '0deg',
		})
	);
	const defaultSaved = JSON.parse(defaults.localStorage.getItem(defaults.SOCIAL_DOCK_POS_KEY));
	assert.equal(defaultSaved.customized, true);
	assert.equal(defaultSaved.left, 8);
	assert.equal(defaultSaved.top, 8);
	assert.equal(Object.prototype.hasOwnProperty.call(defaultSaved, 'scale'), false);
	assert.equal(Object.prototype.hasOwnProperty.call(defaultSaved, 'tilt'), false);

	const unplaced = loadDockHelpers();
	unplaced.persistSocialDockPosition(
		makeWrap(unplaced, {
			placed: false,
			customized: true,
			left: 99,
			top: 99,
		})
	);
	const unplacedSaved = JSON.parse(unplaced.localStorage.getItem(unplaced.SOCIAL_DOCK_POS_KEY));
	assert.equal(unplacedSaved.customized, true);
	assert.equal(Object.prototype.hasOwnProperty.call(unplacedSaved, 'left'), false);
	assert.equal(Object.prototype.hasOwnProperty.call(unplacedSaved, 'top'), false);
});
