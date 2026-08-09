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

function loadNavReturnHelpers(options = {}) {
	const localStorage = createMemoryStorage();
	const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.parse('2026-08-09T12:00:00Z');
	const scrollCalls = [];
	const timeouts = [];
	const rafCalls = [];
	const appended = [];
	let locationHref = options.href || 'https://www.owenminercs.com/Gaming/gaming.html';
	const origin = 'https://www.owenminercs.com';

	const RealDate = Date;
	const windowObj = {
		location: {
			get href() {
				return locationHref;
			},
			set href(value) {
				locationHref = String(value);
			},
			origin,
		},
		scrollX: options.scrollX ?? 12,
		scrollY: options.scrollY ?? 340,
		scrollTo(x, y) {
			scrollCalls.push({ x, y });
		},
		requestAnimationFrame(cb) {
			rafCalls.push(cb);
			return rafCalls.length;
		},
		setTimeout(cb, delay) {
			timeouts.push({ cb, delay });
			return timeouts.length;
		},
	};

	const documentObj = {
		title: options.title || 'Gaming — OwenMinerCS',
		body: {
			appendChild(node) {
				appended.push(node);
				return node;
			},
		},
		querySelector() {
			return options.existingPopup ? { className: 'site-nav-return-popup' } : null;
		},
		createElement(tag) {
			const el = {
				tagName: String(tag).toUpperCase(),
				className: '',
				type: '',
				textContent: '',
				_attrs: {},
				children: [],
				setAttribute(name, value) {
					this._attrs[name] = String(value);
				},
				getAttribute(name) {
					return this._attrs[name] ?? null;
				},
				addEventListener(type, handler) {
					this._listeners = this._listeners || {};
					this._listeners[type] = handler;
				},
				appendChild(child) {
					this.children.push(child);
					return child;
				},
			};
			return el;
		},
	};

	const sandbox = {
		localStorage,
		window: windowObj,
		document: documentObj,
		URL,
		JSON,
		Number,
		Date: {
			now: () => nowMs,
			parse: (...args) => RealDate.parse(...args),
		},
		String,
		Boolean,
		Object,
		console,
		requestAnimationFrame: windowObj.requestAnimationFrame,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		class HTMLAnchorElement {
			constructor({ href, className = 'site-nav-link', target = '' } = {}) {
				this.href = href;
				this.target = target;
				this.classList = {
					contains(name) {
						return String(className || '')
							.split(/\\s+/)
							.includes(name);
					},
				};
				this._attrs = { href };
			}
			getAttribute(name) {
				return this._attrs[name] ?? null;
			}
		}
		${extractConstAssignment(componentsSource, 'NAV_RETURN_STATE_KEY')}
		${extractConstAssignment(componentsSource, 'NAV_RETURN_SCROLL_KEY')}
		${extractConstAssignment(componentsSource, 'NAV_RETURN_MAX_AGE_MS')}
		${extractFunction(componentsSource, 'readJsonStorage')}
		${extractFunction(componentsSource, 'writeJsonStorage')}
		${extractFunction(componentsSource, 'normalizeUrlForMatch')}
		${extractFunction(componentsSource, 'captureNavReturnState')}
		${extractFunction(componentsSource, 'applyPendingNavReturnScrollRestore')}
		${extractFunction(componentsSource, 'buildNavReturnButton')}
		${extractFunction(componentsSource, 'maybeShowNavReturnButton')}
		this.__helpers = {
			NAV_RETURN_STATE_KEY,
			NAV_RETURN_SCROLL_KEY,
			NAV_RETURN_MAX_AGE_MS,
			normalizeUrlForMatch,
			captureNavReturnState,
			applyPendingNavReturnScrollRestore,
			buildNavReturnButton,
			maybeShowNavReturnButton,
			readJsonStorage,
			writeJsonStorage,
			makeAnchor(options) {
				return new HTMLAnchorElement(options);
			},
		};
		`,
		sandbox
	);

	return {
		helpers: sandbox.__helpers,
		localStorage,
		scrollCalls,
		timeouts,
		rafCalls,
		appended,
		windowObj,
		setHref(next) {
			locationHref = next;
		},
	};
}

test('nav return captures same-site main-nav clicks and ignores same-page or off-site targets', () => {
	const { helpers, localStorage } = loadNavReturnHelpers({
		href: 'https://www.owenminercs.com/Gaming/gaming.html',
		scrollX: 8,
		scrollY: 220,
		title: 'Gaming page',
	});

	helpers.captureNavReturnState(
		helpers.makeAnchor({ href: 'https://www.owenminercs.com/Socials/socials.html' })
	);
	const saved = JSON.parse(localStorage.getItem(helpers.NAV_RETURN_STATE_KEY));
	assert.equal(saved.fromUrl, 'https://www.owenminercs.com/Gaming/gaming.html');
	assert.equal(saved.toUrl, 'https://www.owenminercs.com/Socials/socials.html');
	assert.equal(saved.fromTitle, 'Gaming page');
	assert.equal(saved.fromScrollX, 8);
	assert.equal(saved.fromScrollY, 220);
	assert.equal(typeof saved.createdAt, 'number');

	localStorage.removeItem(helpers.NAV_RETURN_STATE_KEY);
	helpers.captureNavReturnState(
		helpers.makeAnchor({ href: 'https://www.owenminercs.com/Gaming/gaming.html' })
	);
	assert.equal(localStorage.getItem(helpers.NAV_RETURN_STATE_KEY), null);

	helpers.captureNavReturnState(
		helpers.makeAnchor({
			href: 'https://example.com/elsewhere',
			className: 'site-nav-link',
		})
	);
	assert.equal(localStorage.getItem(helpers.NAV_RETURN_STATE_KEY), null);

	helpers.captureNavReturnState(
		helpers.makeAnchor({
			href: 'https://www.owenminercs.com/Socials/socials.html',
			className: 'other-link',
		})
	);
	assert.equal(localStorage.getItem(helpers.NAV_RETURN_STATE_KEY), null);
});

test('nav return popup appears only on the destination page and restores scroll before navigating back', () => {
	const nowMs = Date.parse('2026-08-09T12:00:00Z');
	const { helpers, localStorage, appended, scrollCalls, rafCalls, timeouts, windowObj, setHref } =
		loadNavReturnHelpers({
			href: 'https://www.owenminercs.com/Socials/socials.html',
			nowMs,
		});

	helpers.writeJsonStorage(helpers.NAV_RETURN_STATE_KEY, {
		fromUrl: 'https://www.owenminercs.com/Gaming/gaming.html',
		fromTitle: 'Gaming page',
		fromScrollX: 4,
		fromScrollY: 180,
		toUrl: 'https://www.owenminercs.com/Socials/socials.html',
		createdAt: nowMs,
	});

	helpers.maybeShowNavReturnButton();
	assert.equal(appended.length, 1);
	const wrap = appended[0];
	assert.equal(wrap.className, 'site-nav-return-popup');
	assert.equal(wrap.children.length, 1);
	const button = wrap.children[0];
	assert.equal(button.textContent, 'Back');
	assert.equal(button.getAttribute('aria-label'), 'Back to Gaming page');

	button._listeners.click();
	assert.equal(localStorage.getItem(helpers.NAV_RETURN_STATE_KEY), null);
	const scrollPayload = JSON.parse(localStorage.getItem(helpers.NAV_RETURN_SCROLL_KEY));
	assert.equal(scrollPayload.targetUrl, 'https://www.owenminercs.com/Gaming/gaming.html');
	assert.equal(scrollPayload.scrollX, 4);
	assert.equal(scrollPayload.scrollY, 180);
	assert.equal(windowObj.location.href, 'https://www.owenminercs.com/Gaming/gaming.html');

	setHref('https://www.owenminercs.com/Gaming/gaming.html');
	helpers.applyPendingNavReturnScrollRestore();
	assert.equal(localStorage.getItem(helpers.NAV_RETURN_SCROLL_KEY), null);
	assert.equal(rafCalls.length, 1);
	assert.equal(timeouts.length, 2);
	assert.equal(timeouts[0].delay, 160);
	assert.equal(timeouts[1].delay, 420);

	rafCalls[0]();
	timeouts[0].cb();
	timeouts[1].cb();
	assert.equal(scrollCalls.length, 3);
	assert.equal(scrollCalls[0].x, 4);
	assert.equal(scrollCalls[0].y, 180);
});

test('nav return expires stale state and ignores mismatched destination pages', () => {
	const nowMs = Date.parse('2026-08-09T12:00:00Z');
	const { helpers, localStorage, appended } = loadNavReturnHelpers({
		href: 'https://www.owenminercs.com/Socials/socials.html',
		nowMs,
	});

	helpers.writeJsonStorage(helpers.NAV_RETURN_STATE_KEY, {
		fromUrl: 'https://www.owenminercs.com/Gaming/gaming.html',
		fromTitle: 'Gaming page',
		fromScrollX: 0,
		fromScrollY: 0,
		toUrl: 'https://www.owenminercs.com/Donators/donators.html',
		createdAt: nowMs,
	});
	helpers.maybeShowNavReturnButton();
	assert.equal(appended.length, 0);

	helpers.writeJsonStorage(helpers.NAV_RETURN_STATE_KEY, {
		fromUrl: 'https://www.owenminercs.com/Gaming/gaming.html',
		fromTitle: 'Gaming page',
		fromScrollX: 0,
		fromScrollY: 0,
		toUrl: 'https://www.owenminercs.com/Socials/socials.html',
		createdAt: nowMs - helpers.NAV_RETURN_MAX_AGE_MS - 1,
	});
	helpers.maybeShowNavReturnButton();
	assert.equal(appended.length, 0);
	assert.equal(localStorage.getItem(helpers.NAV_RETURN_STATE_KEY), null);
});
