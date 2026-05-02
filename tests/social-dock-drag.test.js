const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const COMPONENTS_PATH = path.join(ROOT, 'scripts', 'components.js');
const CSS_PATH = path.join(ROOT, 'css', 'owenminercs.css');

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const bodyStart = source.indexOf('{', start);
	let depth = 0;
	for (let i = bodyStart; i < source.length; i++) {
		const char = source[i];
		if (char === '{') depth++;
		if (char === '}') depth--;
		if (depth === 0) return source.slice(start, i + 1);
	}
	throw new Error(`Could not extract ${functionName}`);
}

class FakeClassList {
	constructor() {
		this.classes = new Set();
	}

	add(...names) {
		names.forEach((name) => this.classes.add(name));
	}

	remove(...names) {
		names.forEach((name) => this.classes.delete(name));
	}

	contains(name) {
		return this.classes.has(name);
	}
}

class FakeStyle {
	constructor() {
		this.left = '';
		this.top = '';
		this.props = new Map();
	}

	setProperty(name, value) {
		this.props.set(name, value);
	}

	removeProperty(name) {
		this.props.delete(name);
	}

	getPropertyValue(name) {
		return this.props.get(name) || '';
	}
}

class FakeElement {
	constructor({ className = '', rect = {} } = {}) {
		this.classList = new FakeClassList();
		className
			.split(/\s+/)
			.filter(Boolean)
			.forEach((name) => this.classList.add(name));
		this.children = [];
		this.listeners = new Map();
		this.parentNode = null;
		this.style = new FakeStyle();
		this.rect = { left: 20, top: 30, width: 180, height: 40, ...rect };
		this.namedChildren = new Map();
	}

	appendChild(child) {
		child.parentNode = this;
		this.children.push(child);
		return child;
	}

	addEventListener(type, handler) {
		const handlers = this.listeners.get(type) || [];
		handlers.push(handler);
		this.listeners.set(type, handlers);
	}

	dispatch(type, event = {}) {
		const e = {
			button: 0,
			pointerId: 1,
			pointerType: 'mouse',
			timeStamp: 0,
			target: this,
			preventDefault() {
				this.defaultPrevented = true;
			},
			...event,
		};
		for (const handler of this.listeners.get(type) || []) {
			handler(e);
		}
		return e;
	}

	querySelector(selector) {
		return this.namedChildren.get(selector) || null;
	}

	closest(selector) {
		if (selector === 'a.site-social-nav__link') return null;
		if (
			selector === '.site-social-nav--dock' &&
			this.classList.contains('site-social-nav--dock')
		) {
			return this;
		}
		return this.parentNode?.closest(selector) || null;
	}

	getBoundingClientRect() {
		return { ...this.rect };
	}

	setPointerCapture() {}

	releasePointerCapture() {}
}

function createDragHarness() {
	const source = fs.readFileSync(COMPONENTS_PATH, 'utf8');
	const functionSource = extractFunction(source, 'initSiteSupportDockDrag');
	const calls = {
		customized: 0,
		persisted: 0,
		achievements: 0,
		relocated: 0,
	};
	const document = {
		body: new FakeElement({ className: 'body' }),
		visibilityState: 'visible',
		listeners: new Map(),
		addEventListener(type, handler) {
			const handlers = this.listeners.get(type) || [];
			handlers.push(handler);
			this.listeners.set(type, handlers);
		},
	};
	const window = {
		addEventListener() {},
		matchMedia() {
			return { matches: true };
		},
	};
	const globals = {
		SOCIAL_DOCK_DRAG_LOCK_CLASS: 'site-support-dock--drag-lock-horizontal',
		SOCIAL_DOCK_CUSTOMIZED_CLASS: 'site-support-dock--customized',
		SOCIAL_DOCK_DRAG_THRESHOLD_PX: 6,
		SOCIAL_DOCK_ICE_VELOCITY_SCALE: 0.3,
		SOCIAL_DOCK_ICE_MIN_SPEED_PX_S: 12,
		SOCIAL_DOCK_ICE_FRICTION_PER_S: 2.4,
		SOCIAL_DOCK_ICE_MAX_COAST_PX: 90,
		SOCIAL_DOCK_ICE_VEL_SMOOTH: 0.45,
		SOCIAL_DOCK_ICE_MIN_FLING_PX_S: 1500,
		window,
		document,
		Element: FakeElement,
		performance: { now: () => 0 },
		requestAnimationFrame: () => 0,
		cancelAnimationFrame: () => {},
		clampPlacedSocialDockInViewport: () => {},
		debounce: (fn) => fn,
		persistSocialDockPosition: () => {
			calls.persisted++;
		},
		unlockSocialDockMoveAchievement: () => {
			calls.achievements++;
		},
		socialDockCoordsRounded: (x, y) => ({ left: Math.round(x), top: Math.round(y) }),
		setSocialDockCustomized: (wrap, enabled) => {
			calls.customized++;
			if (enabled) wrap.classList.add('site-support-dock--customized');
			else wrap.classList.remove('site-support-dock--customized');
		},
		relocateSocialDockToDefaultMount: () => {
			calls.relocated++;
		},
	};
	const initSiteSupportDockDrag = Function(
		...Object.keys(globals),
		`${functionSource}; return initSiteSupportDockDrag;`
	)(...Object.values(globals));

	const wrap = new FakeElement({ className: 'site-support-dock' });
	const nav = new FakeElement({ className: 'site-social-nav site-social-nav--dock' });
	const spin = new FakeElement({ className: 'site-social-nav__spin' });
	wrap.namedChildren.set('.site-social-nav--dock', nav);
	nav.namedChildren.set('.site-social-nav__spin', spin);
	wrap.appendChild(nav);
	nav.appendChild(spin);

	initSiteSupportDockDrag(wrap);

	return { calls, document, nav, spin, wrap };
}

test('header-origin social dock drag stays horizontally locked until release', () => {
	const { calls, document, nav, spin, wrap } = createDragHarness();

	nav.dispatch('pointerdown', { clientX: 25, clientY: 35, timeStamp: 0 });

	assert.equal(wrap.classList.contains('site-support-dock--drag-lock-horizontal'), true);
	assert.equal(spin.style.getPropertyValue('--site-social-tilt'), '0deg');
	assert.equal(wrap.classList.contains('site-support-dock--placed'), true);
	assert.equal(wrap.style.left, '20px');
	assert.equal(wrap.style.top, '30px');
	assert.equal(document.body.children.includes(wrap), true);

	const move = nav.dispatch('pointermove', { clientX: 45, clientY: 48, timeStamp: 32 });
	assert.equal(move.defaultPrevented, true);
	assert.equal(wrap.classList.contains('site-support-dock--drag-lock-horizontal'), true);
	assert.equal(wrap.style.left, '40px');
	assert.equal(wrap.style.top, '43px');

	nav.dispatch('pointerup', { clientX: 45, clientY: 48, timeStamp: 48 });

	assert.equal(wrap.classList.contains('site-support-dock--drag-lock-horizontal'), false);
	assert.equal(spin.style.getPropertyValue('--site-social-tilt'), '');
	assert.equal(wrap.classList.contains('site-support-dock--customized'), true);
	assert.equal(calls.customized, 1);
	assert.equal(calls.persisted, 1);
	assert.equal(calls.achievements, 1);
});

test('existing floating dock drags do not enable the header-only horizontal lock', () => {
	const { nav, spin, wrap } = createDragHarness();
	wrap.classList.add('site-support-dock--placed', 'site-support-dock--customized');
	wrap.style.left = '100px';
	wrap.style.top = '50px';
	spin.style.setProperty('--site-social-tilt', '37deg');

	nav.dispatch('pointerdown', { clientX: 110, clientY: 60, timeStamp: 0 });
	nav.dispatch('pointermove', { clientX: 130, clientY: 76, timeStamp: 24 });

	assert.equal(wrap.classList.contains('site-support-dock--drag-lock-horizontal'), false);
	assert.equal(spin.style.getPropertyValue('--site-social-tilt'), '37deg');
	assert.equal(wrap.style.left, '120px');
	assert.equal(wrap.style.top, '66px');
});

test('social dock drag-lock CSS preserves header-like horizontal geometry', () => {
	const css = fs.readFileSync(CSS_PATH, 'utf8');

	assert.match(
		css,
		/#site-support-dock\.site-support-dock--drag-lock-horizontal\s+\.site-social-nav__spin\s*{[^}]*--site-social-tilt:\s*0deg;/s
	);
	assert.match(
		css,
		/#site-support-dock\.site-support-dock--drag-lock-horizontal\s+\.site-social-nav__chrome,[^{]+\.site-social-nav__main,[^{]+\.site-social-nav__links-level\s*{[^}]*flex-direction:\s*row;[^}]*align-items:\s*center;/s
	);
	assert.match(
		css,
		/#site-support-dock\.site-support-dock--drag-lock-horizontal\s+\.site-social-nav__link\s+\.site-social-nav__icon\s*{[^}]*width:\s*19px;[^}]*height:\s*19px;/s
	);
});
