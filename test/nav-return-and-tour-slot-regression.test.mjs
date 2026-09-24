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
		attrs: {},
		children: [],
		setAttribute(name, value) {
			this.attrs[name] = value;
		},
		appendChild(child) {
			this.children.push(child);
			return child;
		},
		addEventListener() {},
	};
}

function loadNavHelpers() {
	const source = readWorkspaceFile('scripts/components.js');
	const bodyChildren = [];
	const storage = new Map();
	const HTMLAnchorElement = class HTMLAnchorElement {};
	const sandbox = {
		decodeURIComponent,
		URL,
		Date,
		Number,
		String,
		JSON,
		Math,
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
		window: {
			location: {
				pathname: '/',
				href: 'https://owenminercs.com/index.html',
				origin: 'https://owenminercs.com',
			},
			scrollX: 4,
			scrollY: 240,
		},
		document: {
			title: 'Home — OwenMinerCS',
			querySelector(selector) {
				if (selector !== '.site-nav-return-popup') return null;
				return bodyChildren.find((node) => node.className === 'site-nav-return-popup') || null;
			},
			body: {
				appendChild(node) {
					bodyChildren.push(node);
					return node;
				},
			},
			createElement,
		},
		HTMLAnchorElement,
		bodyChildren,
		storage,
	};

	vm.runInNewContext(
		[
			extractConst(source, 'NAV_RETURN_STATE_KEY'),
			extractConst(source, 'NAV_RETURN_SCROLL_KEY'),
			extractConst(source, 'NAV_RETURN_MAX_AGE_MS'),
			extractFunction(source, 'readJsonStorage'),
			extractFunction(source, 'writeJsonStorage'),
			extractFunction(source, 'normalizeUrlForMatch'),
			extractFunction(source, 'captureNavReturnState'),
			extractFunction(source, 'buildNavReturnButton'),
			extractFunction(source, 'maybeShowNavReturnButton'),
			extractFunction(source, 'getMainNavTourSlotFromLocation'),
			`this.api = {
				NAV_RETURN_STATE_KEY,
				NAV_RETURN_SCROLL_KEY,
				NAV_RETURN_MAX_AGE_MS,
				readJsonStorage,
				normalizeUrlForMatch,
				captureNavReturnState,
				maybeShowNavReturnButton,
				getMainNavTourSlotFromLocation,
			};`,
		].join('\n'),
		sandbox
	);

	function makeAnchor({ href, classes = ['site-nav-link'], target = '' }) {
		const anchor = new HTMLAnchorElement();
		anchor.target = target;
		anchor.classList = {
			contains(name) {
				return classes.includes(name);
			},
		};
		anchor.getAttribute = (name) => (name === 'href' ? href : null);
		return anchor;
	}

	return { sandbox, makeAnchor, api: sandbox.api, bodyChildren, storage };
}

test('main-nav tour slots follow published section paths and keep Socials off the home slot', () => {
	const { sandbox, api } = loadNavHelpers();
	const cases = [
		['/', 'index.html'],
		['/index.html', 'index.html'],
		['/Socials/', 'Socials'],
		['/Socials/socials', 'Socials'],
		['/Socials/view-all-content', 'Socials'],
		['/Counter-Strike/nosmoking', 'Gaming'],
		['/Counter-Strike/CS', 'Gaming'],
		['/Gaming/cs2-skins', 'Gaming'],
		['/Keyboard/60he', 'The Setup'],
		['/Keyboard/60he-2025.html', 'The Setup'],
		['/PC/pc', 'The Setup'],
		['/The%20Setup/the-setup', 'The Setup'],
		['/The Setup/the-setup', 'The Setup'],
		['/The%20Setup/monitors', 'The Setup'],
		['/Upgrades/monitors', 'The Setup'],
		['/Donators/donators', 'Donators'],
		['/Garage%20Sale/garage-sale', 'garage-sale'],
		['/Garage Sale/garage-sale', 'garage-sale'],
		['/QA/qa', 'QA'],
		['/qa', 'QA'],
		['/Achievements/achievements', 'Achievements'],
		['/Help%20Wanted/board', 'Help Wanted'],
		['/dev/dev-stack', null],
		['/Photography/gallery', null],
	];

	for (const [pathname, expected] of cases) {
		sandbox.window.location.pathname = pathname;
		assert.equal(api.getMainNavTourSlotFromLocation(), expected, pathname);
	}
});

test('main-nav tour slot survives a broken percent-encoding and still lowercases the raw path', () => {
	const { sandbox, api } = loadNavHelpers();
	sandbox.window.location.pathname = '/Socials/%E0%A4%A';
	assert.equal(api.getMainNavTourSlotFromLocation(), 'Socials');
	sandbox.window.location.pathname = '/%';
	assert.equal(api.getMainNavTourSlotFromLocation(), null);
});

test('nav return ignores hash, rejects off-site targets, and stores same-origin section changes', () => {
	const { sandbox, api, makeAnchor, storage } = loadNavHelpers();
	sandbox.window.location.href = 'https://owenminercs.com/index.html';
	sandbox.window.scrollX = 4;
	sandbox.window.scrollY = 240;
	sandbox.document.title = 'Home — OwenMinerCS';

	assert.equal(
		api.normalizeUrlForMatch('https://owenminercs.com/Gaming/cs2-skins?tab=cases#price'),
		'https://owenminercs.com/Gaming/cs2-skins?tab=cases'
	);
	assert.equal(api.normalizeUrlForMatch('http://['), '');

	api.captureNavReturnState(makeAnchor({ href: 'https://evil.example/phish' }));
	api.captureNavReturnState(makeAnchor({ href: 'javascript:alert(1)' }));
	api.captureNavReturnState(makeAnchor({ href: 'mailto:owen@owenminercs.com' }));
	api.captureNavReturnState(makeAnchor({ href: '#top' }));
	api.captureNavReturnState(makeAnchor({ href: 'https://owenminercs.com/index.html#bio' }));
	api.captureNavReturnState(makeAnchor({ href: 'Gaming/gaming', classes: ['other'] }));
	api.captureNavReturnState(makeAnchor({ href: 'Gaming/gaming', target: '_blank' }));
	api.captureNavReturnState({ classList: { contains: () => true }, getAttribute: () => 'Gaming/gaming' });
	assert.equal(storage.has(api.NAV_RETURN_STATE_KEY), false);

	api.captureNavReturnState(makeAnchor({ href: 'Gaming/cs2-skins?tab=cases#price' }));
	const record = api.readJsonStorage(api.NAV_RETURN_STATE_KEY);
	assert.equal(record.fromUrl, 'https://owenminercs.com/index.html');
	assert.equal(record.fromTitle, 'Home — OwenMinerCS');
	assert.equal(record.fromScrollX, 4);
	assert.equal(record.fromScrollY, 240);
	assert.equal(record.toUrl, 'https://owenminercs.com/Gaming/cs2-skins?tab=cases#price');
	assert.equal(typeof record.createdAt, 'number');
});

test('nav return button appears only on the destination, expires, and does not stack', () => {
	const { sandbox, api, bodyChildren, storage } = loadNavHelpers();
	const fresh = {
		fromUrl: 'https://owenminercs.com/index.html',
		fromTitle: 'Home — OwenMinerCS',
		fromScrollX: 1,
		fromScrollY: 2,
		toUrl: 'https://owenminercs.com/Socials/socials',
		createdAt: Date.now(),
	};
	storage.set(api.NAV_RETURN_STATE_KEY, JSON.stringify(fresh));

	sandbox.window.location.href = 'https://owenminercs.com/index.html';
	api.maybeShowNavReturnButton();
	assert.equal(bodyChildren.length, 0);
	assert.equal(storage.has(api.NAV_RETURN_STATE_KEY), true);

	sandbox.window.location.href = 'https://owenminercs.com/Socials/socials#cloud';
	api.maybeShowNavReturnButton();
	assert.equal(bodyChildren.length, 1);
	assert.equal(bodyChildren[0].className, 'site-nav-return-popup');
	assert.equal(bodyChildren[0].children[0].textContent, 'Back');
	assert.equal(bodyChildren[0].children[0].attrs['aria-label'], 'Back to Home — OwenMinerCS');

	api.maybeShowNavReturnButton();
	assert.equal(bodyChildren.length, 1);

	bodyChildren.length = 0;
	storage.set(
		api.NAV_RETURN_STATE_KEY,
		JSON.stringify({
			...fresh,
			fromTitle: '',
			createdAt: Date.now() - api.NAV_RETURN_MAX_AGE_MS - 1000,
		})
	);
	api.maybeShowNavReturnButton();
	assert.equal(bodyChildren.length, 0);
	assert.equal(storage.has(api.NAV_RETURN_STATE_KEY), false);

	storage.set(
		api.NAV_RETURN_STATE_KEY,
		JSON.stringify({
			...fresh,
			fromTitle: '',
			createdAt: Date.now(),
		})
	);
	api.maybeShowNavReturnButton();
	assert.equal(bodyChildren[0].children[0].attrs['aria-label'], 'Back to your previous page');
});
