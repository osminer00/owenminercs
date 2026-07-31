import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

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

function createAnchor(initialHref = '#') {
	const attrs = { href: initialHref };
	return {
		getAttribute(name) {
			return Object.hasOwn(attrs, name) ? attrs[name] : null;
		},
		setAttribute(name, value) {
			attrs[name] = String(value);
		},
	};
}

function loadSupportLinkHelpers(document) {
	const source = readWorkspaceFile('scripts/support-links.js');
	const sandbox = { document };

	vm.runInNewContext(
		[
			extractFunction(source, 'isHttpUrl'),
			extractFunction(source, 'apply'),
			`this.__helpers = { isHttpUrl, apply };`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'support-link helpers should load');
	return sandbox.__helpers;
}

test('support-link HTTP guard accepts only http(s) absolute URLs', () => {
	const { isHttpUrl } = loadSupportLinkHelpers({
		querySelectorAll() {
			return [];
		},
	});

	assert.equal(isHttpUrl('https://ko-fi.com/owenminer'), true);
	assert.equal(isHttpUrl('http://example.com/tip'), true);
	assert.equal(isHttpUrl('  https://example.com  '), true);
	assert.equal(isHttpUrl('/relative/path'), false);
	assert.equal(isHttpUrl('javascript:alert(1)'), false);
	assert.equal(isHttpUrl('mailto:hi@example.com'), false);
	assert.equal(isHttpUrl(''), false);
	assert.equal(isHttpUrl(null), false);
	assert.equal(isHttpUrl(123), false);
});

test('support-link apply updates only selectors with safe donation URLs', () => {
	const kofi = createAnchor('#kofi');
	const tip = createAnchor('#tip');
	const steam = createAnchor('#steam');
	const untouched = createAnchor('#keep');

	const document = {
		querySelectorAll(selector) {
			if (selector === 'a[data-kofi-link]') return [kofi];
			if (selector === 'a[data-streamelements-tip-link]') return [tip];
			if (selector === 'a[data-steam-trade-link]') return [steam];
			return [untouched];
		},
	};

	const { apply } = loadSupportLinkHelpers(document);

	apply(null);
	assert.equal(kofi.getAttribute('href'), '#kofi');

	apply({
		ko_fi: 'javascript:alert(1)',
		streamelements_tip: '/local-tip',
		steam_trade_offer: 'mailto:trade@example.com',
	});
	assert.equal(kofi.getAttribute('href'), '#kofi');
	assert.equal(tip.getAttribute('href'), '#tip');
	assert.equal(steam.getAttribute('href'), '#steam');

	apply({
		ko_fi: ' https://ko-fi.com/owenminer ',
		streamelements_tip: 'https://streamelements.com/owenminercs/tip',
		steam_trade_offer:
			'https://steamcommunity.com/tradeoffer/new/?partner=169362392&token=P_48mib_',
	});
	assert.equal(kofi.getAttribute('href'), 'https://ko-fi.com/owenminer');
	assert.equal(tip.getAttribute('href'), 'https://streamelements.com/owenminercs/tip');
	assert.equal(
		steam.getAttribute('href'),
		'https://steamcommunity.com/tradeoffer/new/?partner=169362392&token=P_48mib_'
	);
	assert.equal(untouched.getAttribute('href'), '#keep');
});

test('donation-links.json keeps absolute http(s) support destinations', () => {
	const donationLinks = JSON.parse(readWorkspaceFile('donation-links.json'));
	for (const key of ['ko_fi', 'streamelements_tip', 'steam_trade_offer']) {
		assert.match(String(donationLinks[key] || ''), /^https?:\/\//i);
	}
});
