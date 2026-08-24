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

const NAV_SLOTS = [
	'index.html',
	'The Setup',
	'Gaming',
	'Donators',
	'garage-sale',
	'Help Wanted',
	'QA',
	'Dev',
	'Achievements',
	'Socials',
];

function makeLink(dataNav) {
	return {
		dataNav,
		getAttribute(name) {
			return name === 'data-nav' ? dataNav : null;
		},
	};
}

function makeScope(links) {
	const byNav = new Map(links.map((link) => [link.dataNav, link]));
	return {
		querySelectorAll(selector) {
			assert.equal(selector, 'nav a[data-nav]');
			return links;
		},
		querySelector(selector) {
			const match = String(selector).match(/^a\[data-nav="([^"]+)"\]$/);
			if (!match) return null;
			return byNav.get(match[1]) || null;
		},
	};
}

function loadNavHelpers(pathname) {
	const sandbox = {
		String,
		decodeURIComponent,
		window: {
			location: {
				pathname,
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(componentsSource, 'resolveActiveNavLink')}
		this.__helpers = { resolveActiveNavLink };
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'nav helpers should load');
	return sandbox.__helpers;
}

function activeNavFor(pathname) {
	const { resolveActiveNavLink } = loadNavHelpers(pathname);
	const links = NAV_SLOTS.map(makeLink);
	return resolveActiveNavLink(makeScope(links))?.dataNav ?? null;
}

test('resolveActiveNavLink maps Keyboard hub and related setup pages onto Gaming Setups', () => {
	assert.equal(activeNavFor('/Keyboard/60he'), 'The Setup');
	assert.equal(activeNavFor('/Keyboard/60he.html'), 'The Setup');
	assert.equal(activeNavFor('/PC/pc.html'), 'The Setup');
	assert.equal(activeNavFor('/The%20Setup/the-setup'), 'The Setup');
	assert.equal(activeNavFor('/Upgrades/upgrades.html'), 'The Setup');
});

test('resolveActiveNavLink highlights home, Gaming, and other primary slots from the path', () => {
	assert.equal(activeNavFor('/'), 'index.html');
	assert.equal(activeNavFor('/index.html'), 'index.html');
	assert.equal(activeNavFor('/Gaming/gaming'), 'Gaming');
	assert.equal(activeNavFor('/Counter-Strike/nosmoking.html'), 'Gaming');
	assert.equal(activeNavFor('/QA/qa'), 'QA');
	assert.equal(activeNavFor('/Garage%20Sale/garage-sale'), 'garage-sale');
	assert.equal(activeNavFor('/Socials/socials.html'), 'Socials');
	assert.equal(activeNavFor('/search.html'), null);
});
