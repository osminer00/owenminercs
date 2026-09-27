import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}(`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const paramsStart = source.indexOf('(', start);
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

function extractConst(source, name) {
	const match = source.match(new RegExp(`const ${name} = [^\\n]+`));
	assert.ok(match, `${name} should exist`);
	return match[0].trim().replace(/;$/, '') + ';';
}

function createElement(tag) {
	return {
		tag,
		className: '',
		textContent: '',
		type: '',
		attrs: {},
		children: [],
		listeners: {},
		setAttribute(name, value) {
			this.attrs[name] = value;
		},
		appendChild(child) {
			this.children.push(child);
			return child;
		},
		addEventListener(type, fn) {
			this.listeners[type] = fn;
		},
	};
}

function loadNavReturnScrollHelpers() {
	const source = readWorkspaceFile('scripts/components.js');
	const storage = new Map();
	const scrollCalls = [];
	const frames = [];
	const timeouts = [];
	const sandbox = {
		URL,
		Date,
		Number,
		String,
		JSON,
		localStorage: {
			getItem(key) {
				return storage.has(key) ? storage.get(key) : null;
			},
			setItem(key, value) {
				storage.set(key, String(value));
			},
			removeItem(key) {
				storage.delete(key);
			},
		},
		requestAnimationFrame(fn) {
			frames.push(fn);
			return frames.length;
		},
		window: {
			location: {
				href: 'https://owenminercs.com/Socials/socials',
				origin: 'https://owenminercs.com',
			},
			scrollTo(x, y) {
				scrollCalls.push([x, y]);
			},
			setTimeout(fn, delay) {
				timeouts.push({ fn, delay });
				return timeouts.length;
			},
		},
		document: {
			createElement,
		},
		storage,
		scrollCalls,
		frames,
		timeouts,
	};

	vm.runInNewContext(
		[
			extractConst(source, 'NAV_RETURN_STATE_KEY'),
			extractConst(source, 'NAV_RETURN_SCROLL_KEY'),
			extractConst(source, 'NAV_RETURN_MAX_AGE_MS'),
			extractFunction(source, 'readJsonStorage'),
			extractFunction(source, 'writeJsonStorage'),
			extractFunction(source, 'normalizeUrlForMatch'),
			extractFunction(source, 'applyPendingNavReturnScrollRestore'),
			extractFunction(source, 'buildNavReturnButton'),
			`this.api = {
				NAV_RETURN_STATE_KEY,
				NAV_RETURN_SCROLL_KEY,
				NAV_RETURN_MAX_AGE_MS,
				readJsonStorage,
				applyPendingNavReturnScrollRestore,
				buildNavReturnButton,
			};`,
		].join('\n'),
		sandbox
	);

	return { api: sandbox.api, storage, scrollCalls, frames, timeouts, sandbox };
}

function clickBack(button) {
	const click = button.listeners.click;
	assert.equal(typeof click, 'function');
	click();
}

test('Back stores the previous scroll position and returns to that exact URL', () => {
	const { api, storage, sandbox } = loadNavReturnScrollHelpers();
	const before = Date.now();
	storage.set(api.NAV_RETURN_STATE_KEY, JSON.stringify({ stale: true }));

	const wrap = api.buildNavReturnButton({
		fromUrl: 'https://owenminercs.com/index.html?tab=home#bio',
		fromTitle: 'Home — OwenMinerCS',
		fromScrollX: 0,
		fromScrollY: 840,
	});
	const button = wrap.children[0];

	assert.equal(wrap.attrs.role, 'status');
	assert.equal(button.type, 'button');
	assert.equal(button.textContent, 'Back');
	assert.equal(button.attrs['aria-label'], 'Back to Home — OwenMinerCS');

	clickBack(button);

	const payload = api.readJsonStorage(api.NAV_RETURN_SCROLL_KEY);
	assert.equal(payload.targetUrl, 'https://owenminercs.com/index.html?tab=home#bio');
	assert.equal(payload.scrollX, 0);
	assert.equal(payload.scrollY, 840);
	assert.equal(typeof payload.createdAt, 'number');
	assert.ok(payload.createdAt >= before && payload.createdAt <= Date.now());
	assert.equal(storage.has(api.NAV_RETURN_STATE_KEY), false);
	assert.equal(sandbox.window.location.href, 'https://owenminercs.com/index.html?tab=home#bio');
});

test('Back treats a blank title and non-numeric scroll as a safe fallback', () => {
	const { api, sandbox } = loadNavReturnScrollHelpers();
	const wrap = api.buildNavReturnButton({
		fromUrl: 'https://owenminercs.com/Gaming/cs2-skins',
		fromTitle: '',
		fromScrollX: '12px',
		fromScrollY: null,
	});
	const button = wrap.children[0];

	assert.equal(button.attrs['aria-label'], 'Back to your previous page');
	clickBack(button);

	const payload = api.readJsonStorage(api.NAV_RETURN_SCROLL_KEY);
	assert.equal(payload.targetUrl, 'https://owenminercs.com/Gaming/cs2-skins');
	assert.equal(payload.scrollX, 0);
	assert.equal(payload.scrollY, 0);
	assert.equal(sandbox.window.location.href, 'https://owenminercs.com/Gaming/cs2-skins');
});

test('scroll restore drops stale payloads, keeps the wrong page intact, and retries a hash-matched scroll', () => {
	const { api, storage, scrollCalls, frames, timeouts, sandbox } = loadNavReturnScrollHelpers();

	api.applyPendingNavReturnScrollRestore();
	assert.equal(scrollCalls.length, 0);
	assert.equal(frames.length, 0);

	storage.set(api.NAV_RETURN_SCROLL_KEY, JSON.stringify(['not-a-record']));
	api.applyPendingNavReturnScrollRestore();
	assert.equal(storage.has(api.NAV_RETURN_SCROLL_KEY), false);
	assert.equal(scrollCalls.length, 0);

	const homeScroll = {
		targetUrl: 'https://owenminercs.com/index.html',
		scrollX: 12,
		scrollY: 480,
		createdAt: Date.now() - api.NAV_RETURN_MAX_AGE_MS - 5,
	};
	storage.set(api.NAV_RETURN_SCROLL_KEY, JSON.stringify(homeScroll));
	sandbox.window.location.href = 'https://owenminercs.com/index.html';
	api.applyPendingNavReturnScrollRestore();
	assert.equal(storage.has(api.NAV_RETURN_SCROLL_KEY), false);
	assert.equal(scrollCalls.length, 0);

	storage.set(
		api.NAV_RETURN_SCROLL_KEY,
		JSON.stringify({
			...homeScroll,
			createdAt: Date.now(),
		})
	);
	sandbox.window.location.href = 'https://owenminercs.com/Socials/socials#cloud';
	api.applyPendingNavReturnScrollRestore();
	assert.equal(storage.has(api.NAV_RETURN_SCROLL_KEY), true);
	assert.equal(scrollCalls.length, 0);
	assert.equal(frames.length, 0);

	storage.set(
		api.NAV_RETURN_SCROLL_KEY,
		JSON.stringify({
			targetUrl: 'https://owenminercs.com/index.html#bio',
			scrollX: 'nope',
			scrollY: 20,
			createdAt: Date.now(),
		})
	);
	sandbox.window.location.href = 'https://owenminercs.com/index.html';
	api.applyPendingNavReturnScrollRestore();
	assert.equal(storage.has(api.NAV_RETURN_SCROLL_KEY), false);
	assert.equal(scrollCalls.length, 0);
	assert.equal(frames.length, 0);

	storage.set(
		api.NAV_RETURN_SCROLL_KEY,
		JSON.stringify({
			targetUrl: 'https://owenminercs.com/index.html?tab=home#bio',
			scrollX: 3,
			scrollY: 900,
			createdAt: Date.now(),
		})
	);
	sandbox.window.location.href = 'https://owenminercs.com/index.html?tab=home';
	api.applyPendingNavReturnScrollRestore();
	assert.equal(storage.has(api.NAV_RETURN_SCROLL_KEY), false);
	assert.equal(frames.length, 1);
	assert.deepEqual(
		timeouts.map((entry) => entry.delay),
		[160, 420]
	);

	frames[0]();
	timeouts[0].fn();
	timeouts[1].fn();
	assert.deepEqual(scrollCalls, [
		[3, 900],
		[3, 900],
		[3, 900],
	]);
});
