import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const braceStart = source.indexOf('{', start);
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

function extractNavIdsBetween(startMarker, endMarker) {
	const start = componentsSource.indexOf(startMarker);
	const end = componentsSource.indexOf(endMarker, start);
	assert.ok(start >= 0, `${startMarker} should exist`);
	assert.ok(end > start, `${endMarker} should follow ${startMarker}`);
	const fragment = componentsSource.slice(start, end);
	return [...fragment.matchAll(/data-nav="([^"]+)"/g)].map((match) => match[1]);
}

function extractMainNavTourSlots() {
	const match = componentsSource.match(
		/const MAIN_NAV_TOUR_SLOTS = Object\.freeze\(\[\s*(?<body>[\s\S]*?)\s*\]\);/
	);
	assert.ok(match, 'MAIN_NAV_TOUR_SLOTS should exist');
	return [...match.groups.body.matchAll(/'([^']+)'/g)].map((slot) => slot[1]);
}

function makeScope(navIds) {
	const links = navIds.map((id) => ({
		id,
		getAttribute(name) {
			return name === 'data-nav' ? id : null;
		},
	}));
	return {
		querySelectorAll(selector) {
			assert.equal(selector, 'nav a[data-nav]');
			return links;
		},
		querySelector(selector) {
			const match = selector.match(/^a\[data-nav="([^"]+)"\]$/);
			assert.ok(match, `unexpected selector ${selector}`);
			return links.find((link) => link.id === match[1]) || null;
		},
	};
}

function buildResolveActiveNavLink(pathname) {
	const resolveActiveNavLinkSource = extractFunction(componentsSource, 'resolveActiveNavLink');
	const window = { location: { pathname } };
	return Function(
		'window',
		`${resolveActiveNavLinkSource}; return resolveActiveNavLink;`
	)(window);
}

function buildGetMainNavTourSlot(pathname) {
	const getMainNavTourSlotSource = extractFunction(
		componentsSource,
		'getMainNavTourSlotFromLocation'
	);
	const window = { location: { pathname } };
	return Function(
		'window',
		`${getMainNavTourSlotSource}; return getMainNavTourSlotFromLocation;`
	)(window);
}

test('shared header/footer nav ids stay in sync with main-nav tour slots', () => {
	const headerNavIds = extractNavIdsBetween('class SharedHeader', 'class SharedFooter');
	const footerNavIds = extractNavIdsBetween(
		'class SharedFooter',
		'function registerCustomElements'
	);
	const tourSlots = extractMainNavTourSlots();

	assert.deepEqual(footerNavIds, headerNavIds, 'footer nav should mirror header nav order');
	assert.deepEqual(
		tourSlots,
		headerNavIds,
		'main-nav tour slots should cover every header nav item'
	);
	assert.ok(headerNavIds.includes('Dev'), 'Programs nav should keep its Dev data-nav slot');
});

test('dev stack page resolves to the Programs nav slot', () => {
	const navIds = extractMainNavTourSlots();
	const scope = makeScope(navIds);

	const resolveActiveNavLink = buildResolveActiveNavLink('/dev/dev-stack');
	const activeLink = resolveActiveNavLink(scope);
	assert.equal(activeLink?.id, 'Dev');

	const getMainNavTourSlotFromLocation = buildGetMainNavTourSlot('/dev/dev-stack');
	assert.equal(getMainNavTourSlotFromLocation(), 'Dev');
});
