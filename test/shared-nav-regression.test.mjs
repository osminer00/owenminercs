import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

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

function extractMainNavTourSlots() {
	const match = componentsSource.match(
		/const MAIN_NAV_TOUR_SLOTS = Object\.freeze\(\[(?<body>[\s\S]*?)\]\);/
	);
	assert.ok(match, 'MAIN_NAV_TOUR_SLOTS should exist');
	return [...match.groups.body.matchAll(/'([^']+)'/g)].map((slot) => slot[1]);
}

function mainNavTourSlotFor(pathname) {
	const functionSource = extractFunction(componentsSource, 'getMainNavTourSlotFromLocation');
	const context = {
		window: { location: { pathname } },
		result: undefined,
	};
	vm.runInNewContext(`${functionSource}; result = getMainNavTourSlotFromLocation();`, context);
	return context.result;
}

test('Programs nav uses the dev route token in shared header and footer', () => {
	const programsLinkPattern =
		/<li><a href="\$\{getLink\('dev\/dev-stack'\)\}" class="site-nav-link" data-nav="dev" title="Programs for coding, creative work, and streaming">Programs<\/a><\/li>/g;

	assert.equal(
		[...componentsSource.matchAll(programsLinkPattern)].length,
		2,
		'Programs link should be present in both shared header and footer'
	);
	assert.doesNotMatch(
		componentsSource,
		/data-nav="Dev"/,
		'Programs data-nav must match the lower-case /dev/ route for active-link highlighting'
	);
	assert.ok(
		extractMainNavTourSlots().includes('dev'),
		'Programs should be counted by the main-nav tour slots'
	);
});

test('Programs page counts as the dev main-nav tour slot', () => {
	assert.equal(mainNavTourSlotFor('/dev/dev-stack'), 'dev');
	assert.equal(mainNavTourSlotFor('/dev/dev-stack.html'), 'dev');
});

test('Gaming Setups label keeps the stable The Setup route and nav slot', () => {
	const setupLinkPattern =
		/<li><a href="\$\{getLink\('The%20Setup\/the-setup'\)\}" class="site-nav-link" data-nav="The Setup" title="Desk, camping gear, PC, keyboard, and upgrades">Gaming Setups<\/a><\/li>/g;

	assert.equal(
		[...componentsSource.matchAll(setupLinkPattern)].length,
		2,
		'Gaming Setups should appear in both shared header and footer'
	);
	assert.ok(
		extractMainNavTourSlots().includes('The Setup'),
		'Renaming the label should not change the stable The Setup nav slot'
	);
});
