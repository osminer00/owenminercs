import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../css/owenminercs.css', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const searchSource = readFileSync(new URL('../search.html', import.meta.url), 'utf8');
const searchIndex = JSON.parse(
	readFileSync(new URL('../data/site-search-index.json', import.meta.url), 'utf8')
);

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

function extractCssRule(selector) {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const rulePattern = new RegExp(`${escaped}\\s*\\{(?<body>[\\s\\S]*?)\\}`, 'm');
	const match = cssSource.match(rulePattern);
	assert.ok(match, `${selector} rule should exist`);
	return match.groups.body;
}

function extractCssRuleByPattern(selectorPattern, label) {
	const rulePattern = new RegExp(`${selectorPattern}\\s*\\{(?<body>[\\s\\S]*?)\\}`, 'm');
	const match = cssSource.match(rulePattern);
	assert.ok(match, `${label} rule should exist`);
	return match.groups.body;
}

function extractCssRuleContaining(selector, bodyPattern) {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const rulePattern = new RegExp(`${escaped}\\s*\\{(?<body>[\\s\\S]*?)\\}`, 'gm');
	for (const match of cssSource.matchAll(rulePattern)) {
		if (bodyPattern.test(match.groups.body)) return match.groups.body;
	}
	assert.fail(`${selector} rule containing ${bodyPattern} should exist`);
}

test('social dock first drag keeps header geometry until the pointer is released', () => {
	assert.match(
		componentsSource,
		/const SOCIAL_DOCK_DRAG_LOCK_CLASS = 'site-support-dock--drag-lock-horizontal';/
	);

	const dragFunction = extractFunction(componentsSource, 'initSiteSupportDockDrag');
	const setHeaderDragLock = extractFunction(dragFunction, 'setHeaderDragLock');

	assert.match(setHeaderDragLock, /wrap\.classList\.add\(SOCIAL_DOCK_DRAG_LOCK_CLASS\);/);
	assert.match(setHeaderDragLock, /spin\?\.style\.setProperty\('--site-social-tilt', '0deg'\);/);
	assert.match(setHeaderDragLock, /wrap\.classList\.remove\(SOCIAL_DOCK_DRAG_LOCK_CLASS\);/);
	assert.match(setHeaderDragLock, /spin\?\.style\.removeProperty\('--site-social-tilt'\);/);

	const promotedIndex = dragFunction.indexOf(
		"const promotedFromHeader = !wrap.classList.contains('site-support-dock--placed');"
	);
	const lockIndex = dragFunction.indexOf('setHeaderDragLock(promotedFromHeader);');
	const bodyPromotionIndex = dragFunction.indexOf('document.body.appendChild(wrap);', lockIndex);
	const placedClassIndex = dragFunction.indexOf(
		"wrap.classList.add('site-support-dock--placed');"
	);

	assert.ok(promotedIndex >= 0, 'drag start should capture whether the dock began in the header');
	assert.ok(lockIndex > promotedIndex, 'drag lock should use the pre-promotion placement state');
	assert.ok(
		bodyPromotionIndex > lockIndex,
		'dock should be locked horizontal before it is moved into fixed body placement'
	);
	assert.ok(
		placedClassIndex > lockIndex,
		'placed class should not be added before the drag lock'
	);

	const unlockCalls = dragFunction.match(/setHeaderDragLock\(false\);/g) || [];
	assert.equal(
		unlockCalls.length,
		2,
		'pointer release and lost capture should both clear the lock'
	);
});

test('social dock drag-lock CSS mirrors header horizontal layout while fixed', () => {
	const spinRule = extractCssRule(
		'#site-support-dock.site-support-dock--drag-lock-horizontal .site-social-nav__spin'
	);
	assert.match(spinRule, /--site-social-tilt:\s*0deg;/);

	const rowRule = extractCssRuleByPattern(
		'#site-support-dock\\.site-support-dock--drag-lock-horizontal \\.site-social-nav__chrome,[\\s\\S]*?#site-support-dock\\.site-support-dock--drag-lock-horizontal \\.site-social-nav__main,[\\s\\S]*?#site-support-dock\\.site-support-dock--drag-lock-horizontal \\.site-social-nav__links-level',
		'combined drag-lock horizontal row'
	);
	assert.match(rowRule, /flex-direction:\s*row;/);
	assert.match(rowRule, /align-items:\s*center;/);

	const mainRule = extractCssRule(
		'#site-support-dock.site-support-dock--drag-lock-horizontal .site-social-nav__main'
	);
	assert.match(mainRule, /padding:\s*0\.18rem 0\.38rem;/);

	const linksRule = extractCssRuleContaining(
		'#site-support-dock.site-support-dock--drag-lock-horizontal .site-social-nav__links-level',
		/gap:\s*0\.26rem;/
	);
	assert.match(linksRule, /gap:\s*0\.26rem;/);
	assert.match(linksRule, /min-height:\s*0;/);

	const iconRule = extractCssRule(
		'#site-support-dock.site-support-dock--drag-lock-horizontal .site-social-nav__link .site-social-nav__icon'
	);
	assert.match(iconRule, /width:\s*19px;/);
	assert.match(iconRule, /height:\s*19px;/);
});

test('homepage keeps Impact affiliate verification meta tag in the head', () => {
	assert.match(indexSource, /<meta name="impact-site-verification" content="[0-9a-f-]{36}" \/>/);
});

test('shared header search link resolves to committed search assets', () => {
	assert.match(
		componentsSource,
		/href="\$\{getSearchPageUrl\(\)\}" class="site-nav-link site-header-search-open site-nav-search-open"/
	);
	assert.match(searchSource, /<script src="scripts\/components\.js" defer><\/script>/);
	assert.match(searchSource, /data-owen-site-search/);
	assert.ok(Array.isArray(searchIndex.entries), 'search index should expose entries');
	assert.ok(searchIndex.entries.length > 0, 'search index should not be empty');
	assert.ok(
		searchIndex.entries.some((entry) => entry.path === 'Keyboard/60he'),
		'search index should include the canonical keyboard page'
	);
});
