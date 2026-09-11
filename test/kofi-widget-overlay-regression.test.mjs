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
}

function loadOverlayHelper(options = {}) {
	const host = options.host === false ? null : { id: options.hostId || 'kofi-widget-overlay-abc' };
	const nodes = new Map();
	if (options.iframes) {
		for (const iframe of options.iframes) {
			nodes.set(iframe.id, iframe);
		}
	}

	const document = {
		querySelector(selector) {
			if (selector === 'div[id^="kofi-widget-overlay-"]') return host;
			return null;
		},
		getElementById(id) {
			return nodes.get(id) || null;
		},
	};

	const sandbox = {
		document,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(componentsSource, 'tryOpenKofiWidgetOverlayFromLink')}
		this.__helpers = { tryOpenKofiWidgetOverlayFromLink };
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'Ko-fi overlay helper should load');
	sandbox.__helpers.host = host;
	return sandbox.__helpers;
}

function makeDonateButton({ open = false } = {}) {
	const button = {
		id: '',
		classList: new FakeClassList(open ? ['open'] : []),
		clickCount: 0,
		click() {
			this.clickCount += 1;
		},
	};
	return button;
}

function makeIframe({ id, width, height, button, locked = false }) {
	return {
		id,
		getBoundingClientRect() {
			return { width, height, left: 0, top: 0, right: width, bottom: height };
		},
		contentDocument: locked
			? null
			: {
					getElementById(buttonId) {
						if (!button) return null;
						return buttonId === button.id ? button : null;
					},
				},
	};
}

test('tryOpenKofiWidgetOverlayFromLink returns false without an overlay host', () => {
	const helpers = loadOverlayHelper({ host: false });
	assert.equal(helpers.tryOpenKofiWidgetOverlayFromLink(), false);
});

test('tryOpenKofiWidgetOverlayFromLink clicks the desktop overlay donate button', () => {
	const hostId = 'kofi-widget-overlay-abc';
	const button = makeDonateButton();
	button.id = `${hostId}-donate-button`;
	const iframe = makeIframe({
		id: `kofi-wo-container${hostId}`,
		width: 72,
		height: 72,
		button,
	});
	const helpers = loadOverlayHelper({ hostId, iframes: [iframe] });

	assert.equal(helpers.tryOpenKofiWidgetOverlayFromLink(), true);
	assert.equal(button.clickCount, 1);
});

test('tryOpenKofiWidgetOverlayFromLink treats an already-open donate button as success', () => {
	const hostId = 'kofi-widget-overlay-abc';
	const button = makeDonateButton({ open: true });
	button.id = `${hostId}-donate-button`;
	const iframe = makeIframe({
		id: `kofi-wo-container${hostId}`,
		width: 72,
		height: 72,
		button,
	});
	const helpers = loadOverlayHelper({ hostId, iframes: [iframe] });

	assert.equal(helpers.tryOpenKofiWidgetOverlayFromLink(), true);
	assert.equal(button.clickCount, 0);
});

test('tryOpenKofiWidgetOverlayFromLink skips tiny iframes then still opens via the unlocked fallback', () => {
	const hostId = 'kofi-widget-overlay-xyz';
	const button = makeDonateButton();
	button.id = `${hostId}-donate-button`;
	const iframe = makeIframe({
		id: `kofi-wo-container${hostId}`,
		width: 1,
		height: 1,
		button,
	});
	const helpers = loadOverlayHelper({ hostId, iframes: [iframe] });

	assert.equal(helpers.tryOpenKofiWidgetOverlayFromLink(), true);
	assert.equal(button.clickCount, 1);
});

test('tryOpenKofiWidgetOverlayFromLink uses the mobile iframe id when desktop is missing', () => {
	const hostId = 'kofi-widget-overlay-mobi';
	const button = makeDonateButton();
	button.id = `${hostId}-donate-button`;
	const iframe = makeIframe({
		id: `kofi-wo-container-mobi${hostId}`,
		width: 80,
		height: 48,
		button,
	});
	const helpers = loadOverlayHelper({ hostId, iframes: [iframe] });

	assert.equal(helpers.tryOpenKofiWidgetOverlayFromLink(), true);
	assert.equal(button.clickCount, 1);
});

test('tryOpenKofiWidgetOverlayFromLink returns false when the iframe document is locked', () => {
	const hostId = 'kofi-widget-overlay-abc';
	const button = makeDonateButton();
	button.id = `${hostId}-donate-button`;
	const iframe = makeIframe({
		id: `kofi-wo-container${hostId}`,
		width: 72,
		height: 72,
		button,
		locked: true,
	});
	const helpers = loadOverlayHelper({ hostId, iframes: [iframe] });

	assert.equal(helpers.tryOpenKofiWidgetOverlayFromLink(), false);
	assert.equal(button.clickCount, 0);
});
