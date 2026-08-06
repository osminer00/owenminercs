import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const celebrationSource = readFileSync(
	new URL('../scripts/achievement-celebration.js', import.meta.url),
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

function extractConstObject(source, name) {
	const start = source.indexOf(`const ${name} = {`);
	assert.notEqual(start, -1, `${name} object should exist`);
	const braceStart = source.indexOf('{', start);
	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(start, i + 1);
		}
	}
	assert.fail(`${name} object should close`);
}

function createFakeDocument() {
	const styleNodes = [];
	const bodyChildren = [];

	function makeEl(tag) {
		const attrs = {};
		const children = [];
		const el = {
			tagName: String(tag).toUpperCase(),
			className: '',
			innerHTML: '',
			textContent: '',
			hidden: false,
			style: {},
			children,
			setAttribute(name, value) {
				attrs[name] = String(value);
			},
			getAttribute(name) {
				return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
			},
			querySelector(selector) {
				if (selector === '.owen-achievement-toast__title') {
					return children.find((child) => child.className.includes('owen-achievement-toast__title'));
				}
				return null;
			},
			classList: {
				add(...names) {
					const set = new Set(String(el.className).split(/\s+/).filter(Boolean));
					names.forEach((name) => set.add(name));
					el.className = [...set].join(' ');
				},
				remove(...names) {
					const set = new Set(String(el.className).split(/\s+/).filter(Boolean));
					names.forEach((name) => set.delete(name));
					el.className = [...set].join(' ');
				},
			},
			appendChild(child) {
				children.push(child);
				return child;
			},
			remove() {
				const idx = bodyChildren.indexOf(el);
				if (idx >= 0) bodyChildren.splice(idx, 1);
			},
		};

		Object.defineProperty(el, 'innerHTML', {
			get() {
				return this._innerHTML || '';
			},
			set(value) {
				this._innerHTML = String(value);
				children.length = 0;
				if (String(value).includes('owen-achievement-toast__title')) {
					children.push({
						className: 'owen-achievement-toast__title',
						textContent: '',
					});
				}
			},
		});

		return el;
	}

	return {
		styleNodes,
		bodyChildren,
		document: {
			getElementById(id) {
				if (id === 'owen-achievement-toast-style') {
					return styleNodes.find((node) => node.id === id) || null;
				}
				if (id === 'owen-achievement-fx') {
					return bodyChildren.find((node) => node.id === id) || null;
				}
				return null;
			},
			createElement(tag) {
				const el = makeEl(tag);
				if (tag === 'style') {
					el.id = '';
					Object.defineProperty(el, 'id', {
						get() {
							return this._id || '';
						},
						set(value) {
							this._id = value;
						},
						configurable: true,
					});
					el.textContent = '';
				}
				return el;
			},
			head: {
				appendChild(node) {
					styleNodes.push(node);
					return node;
				},
			},
			body: {
				appendChild(node) {
					bodyChildren.push(node);
					return node;
				},
				contains(node) {
					return bodyChildren.includes(node);
				},
			},
		},
	};
}

function loadCelebrationHelpers({ reducedMotion = false, matchMediaThrows = false } = {}) {
	const fake = createFakeDocument();
	const timers = [];
	const rafQueue = [];

	function setTimeout(fn) {
		timers.push(fn);
		return timers.length;
	}

	function requestAnimationFrame(fn) {
		rafQueue.push(fn);
		return rafQueue.length;
	}

	const windowObj = {
		matchMedia() {
			if (matchMediaThrows) throw new Error('matchMedia unavailable');
			return { matches: reducedMotion };
		},
		setTimeout,
		requestAnimationFrame,
		innerWidth: 1280,
		innerHeight: 720,
	};

	const sandbox = {
		window: windowObj,
		document: fake.document,
		performance: { now: () => 0 },
		setTimeout,
		requestAnimationFrame,
		Math,
		String,
		Array,
		Boolean,
		console,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstObject(celebrationSource, 'TITLES')}
		${extractFunction(celebrationSource, 'labelForId')}
		${extractFunction(celebrationSource, 'prefersReducedMotion')}
		${extractFunction(celebrationSource, 'getToastStyleBlock')}
		${extractFunction(celebrationSource, 'ensureStyles')}
		${extractFunction(celebrationSource, 'mountToast')}
		${extractFunction(celebrationSource, 'handleUnlockedEvent')}
		this.__helpers = {
			labelForId,
			prefersReducedMotion,
			handleUnlockedEvent,
			mountToast,
		};
		`,
		sandbox
	);

	return {
		helpers: sandbox.__helpers,
		fake,
		flushRaf() {
			while (rafQueue.length) {
				const fn = rafQueue.shift();
				fn();
			}
		},
	};
}

test('achievement celebration maps known titles and humanizes unknown ids', () => {
	const { helpers } = loadCelebrationHelpers();
	assert.equal(helpers.labelForId('lexicon-pin'), 'Bookmark');
	assert.equal(helpers.labelForId('social-dock-grand-tour'), 'Grand tour');
	assert.equal(helpers.labelForId('custom-egg'), 'custom egg');
});

test('achievement celebration respects reduced motion and skips festival path', () => {
	const { helpers, fake, flushRaf } = loadCelebrationHelpers({ reducedMotion: true });

	assert.equal(helpers.prefersReducedMotion(), true);
	helpers.handleUnlockedEvent({ detail: { id: 'fidget-spinner' } });
	flushRaf();
	flushRaf();

	assert.equal(fake.styleNodes.length, 1);
	assert.equal(fake.styleNodes[0].id, 'owen-achievement-toast-style');
	assert.equal(fake.bodyChildren.length, 1);
	const toast = fake.bodyChildren[0];
	assert.match(toast.className, /owen-achievement-toast--calm/);
	assert.doesNotMatch(toast.className, /festival/);
	const title = toast.querySelector('.owen-achievement-toast__title');
	assert.equal(title.textContent, 'Fidget spinner');
	assert.ok(!fake.bodyChildren.some((node) => node.id === 'owen-achievement-fx'));
});

test('achievement celebration ignores empty unlock payloads and survives matchMedia failures', () => {
	const calm = loadCelebrationHelpers({ reducedMotion: true });
	calm.helpers.handleUnlockedEvent(null);
	calm.helpers.handleUnlockedEvent({});
	calm.helpers.handleUnlockedEvent({ detail: {} });
	assert.equal(calm.fake.bodyChildren.length, 0);

	const broken = loadCelebrationHelpers({ matchMediaThrows: true });
	assert.equal(broken.helpers.prefersReducedMotion(), false);
});

test('achievement celebration sets toast title via textContent to avoid HTML injection', () => {
	assert.match(celebrationSource, /tNode\.textContent = title/);
	assert.doesNotMatch(
		celebrationSource,
		/owen-achievement-toast__title["'][^>]*>[\s\S]{0,40}\+/
	);

	const { helpers, fake, flushRaf } = loadCelebrationHelpers({ reducedMotion: true });
	helpers.handleUnlockedEvent({ detail: { id: '<img src=x onerror=alert(1)>' } });
	flushRaf();
	flushRaf();
	const title = fake.bodyChildren[0].querySelector('.owen-achievement-toast__title');
	assert.equal(title.textContent, '<img src=x onerror=alert(1)>');
	assert.equal(title.innerHTML, undefined);
});
