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

function createMemoryStorage(seed = {}) {
	const store = new Map();
	for (const [key, value] of Object.entries(seed)) {
		store.set(String(key), String(value));
	}
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

function loadRestoreHelpers(options = {}) {
	const localStorage = createMemoryStorage(options.seed || {});
	class FakeElement {}

	const classes = new Set();
	const style = { left: '', top: '' };
	const spinProps = {};
	const bodyChildren = [];
	const reset = { hidden: true };

	const wrap = {
		classList: {
			contains(name) {
				return classes.has(name);
			},
			add(name) {
				classes.add(name);
			},
			remove(name) {
				classes.delete(name);
			},
			toggle(name, force) {
				if (force) classes.add(name);
				else classes.delete(name);
			},
		},
		style,
		querySelector(selector) {
			if (selector === '.site-social-nav__spin') {
				return {
					style: {
						setProperty(name, value) {
							spinProps[name] = String(value);
						},
						getPropertyValue(name) {
							return spinProps[name] || '';
						},
					},
				};
			}
			return null;
		},
	};
	Object.setPrototypeOf(wrap, FakeElement.prototype);

	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		JSON,
		Element: FakeElement,
		localStorage,
		wrap,
		classes,
		style,
		spinProps,
		bodyChildren,
		reset,
		document: {
			body: {
				appendChild(node) {
					bodyChildren.push(node);
					return node;
				},
			},
			querySelector(selector) {
				if (selector === '[data-owen-social-dock-reset]') return reset;
				return null;
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_POS_KEY')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_CUSTOMIZED_CLASS')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_DRAG_THRESHOLD_PX')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_SCALE_MIN')}
		${extractConstAssignment(componentsSource, 'SOCIAL_DOCK_SCALE_MAX')}
		${extractFunction(componentsSource, 'clampSocialDockScale')}
		${extractFunction(componentsSource, 'socialDockCoordsRounded')}
		${extractFunction(componentsSource, 'setSocialDockCustomized')}
		${extractFunction(componentsSource, 'clampPlacedSocialDockInViewport')}
		var remountCount = 0;
		function getSocialDockDefaultViewportPosition() {
			return { left: 2, top: 2 };
		}
		function ensureSocialDockDefaultSlotIfUnplaced() {
			remountCount += 1;
		}
		${extractFunction(componentsSource, 'applySavedSocialDockPosition')}
		this.__helpers = {
			SOCIAL_DOCK_POS_KEY,
			SOCIAL_DOCK_CUSTOMIZED_CLASS,
			applySavedSocialDockPosition,
			localStorage,
			wrap,
			classes,
			style,
			spinProps,
			bodyChildren,
			reset,
			getRemountCount() {
				return remountCount;
			},
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('applySavedSocialDockPosition no-ops when nothing is stored', () => {
	const helpers = loadRestoreHelpers();
	helpers.applySavedSocialDockPosition(helpers.wrap);
	assert.equal(helpers.localStorage.getItem(helpers.SOCIAL_DOCK_POS_KEY), null);
	assert.equal(helpers.getRemountCount(), 0);
	assert.equal(helpers.classes.has('site-support-dock--placed'), false);
	assert.equal(helpers.bodyChildren.length, 0);
});

test('applySavedSocialDockPosition clears near-default geometry and remounts the header slot', () => {
	const helpers = loadRestoreHelpers({
		seed: {
			'owenminercs-social-dock-pos': JSON.stringify({ left: 4, top: 5, scale: 1, tilt: 0 }),
		},
	});

	helpers.applySavedSocialDockPosition(helpers.wrap);

	assert.equal(helpers.localStorage.getItem(helpers.SOCIAL_DOCK_POS_KEY), null);
	assert.equal(helpers.getRemountCount(), 1);
	assert.equal(helpers.classes.has('site-support-dock--placed'), false);
	assert.equal(helpers.classes.has(helpers.SOCIAL_DOCK_CUSTOMIZED_CLASS), false);
	assert.equal(helpers.bodyChildren.length, 0);
	assert.equal(helpers.reset.hidden, true);
});

test('applySavedSocialDockPosition restores a customized off-default placement without remounting', () => {
	const helpers = loadRestoreHelpers({
		seed: {
			'owenminercs-social-dock-pos': JSON.stringify({
				left: 80.6,
				top: 90.2,
				scale: 9,
				tilt: 12.5,
			}),
		},
	});

	helpers.applySavedSocialDockPosition(helpers.wrap);

	assert.equal(helpers.getRemountCount(), 0);
	assert.equal(helpers.bodyChildren[0], helpers.wrap);
	assert.equal(helpers.classes.has('site-support-dock--placed'), true);
	assert.equal(helpers.classes.has(helpers.SOCIAL_DOCK_CUSTOMIZED_CLASS), true);
	assert.equal(helpers.style.left, '81px');
	assert.equal(helpers.style.top, '90px');
	assert.equal(helpers.spinProps['--site-social-scale'], '2');
	assert.equal(helpers.spinProps['--site-social-tilt'], '12.5deg');
	assert.equal(helpers.reset.hidden, false);
	assert.equal(helpers.localStorage.getItem(helpers.SOCIAL_DOCK_POS_KEY) != null, true);
});

test('scale or tilt alone still counts as a customized restore at the default slot', () => {
	const scaled = loadRestoreHelpers({
		seed: {
			'owenminercs-social-dock-pos': JSON.stringify({ left: 2, top: 2, scale: 1.4 }),
		},
	});
	scaled.applySavedSocialDockPosition(scaled.wrap);
	assert.equal(scaled.getRemountCount(), 0);
	assert.equal(scaled.classes.has(scaled.SOCIAL_DOCK_CUSTOMIZED_CLASS), true);
	assert.equal(scaled.spinProps['--site-social-scale'], '1.4');
	assert.equal(scaled.bodyChildren.length, 1);

	const tilted = loadRestoreHelpers({
		seed: {
			'owenminercs-social-dock-pos': JSON.stringify({ left: 2, top: 2, tilt: -8 }),
		},
	});
	tilted.applySavedSocialDockPosition(tilted.wrap);
	assert.equal(tilted.getRemountCount(), 0);
	assert.equal(tilted.spinProps['--site-social-tilt'], '-8deg');
	assert.equal(tilted.classes.has(tilted.SOCIAL_DOCK_CUSTOMIZED_CLASS), true);
});

test('applySavedSocialDockPosition swallows malformed saved JSON', () => {
	const helpers = loadRestoreHelpers({
		seed: { 'owenminercs-social-dock-pos': '{not-json' },
	});
	assert.doesNotThrow(() => helpers.applySavedSocialDockPosition(helpers.wrap));
	assert.equal(helpers.getRemountCount(), 0);
	assert.equal(helpers.bodyChildren.length, 0);
	assert.equal(helpers.localStorage.getItem(helpers.SOCIAL_DOCK_POS_KEY), '{not-json');
});
