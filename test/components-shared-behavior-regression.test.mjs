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

function loadSearchHelpers() {
	const helperSource = [
		extractFunction(componentsSource, 'searchManualKeywordHit'),
		extractFunction(componentsSource, 'searchRankEntry'),
		extractFunction(componentsSource, 'searchFilterEntries'),
		'({ searchManualKeywordHit, searchRankEntry, searchFilterEntries });',
	].join('\n');

	return vm.runInNewContext(helperSource, {}, { timeout: 1000 });
}

test('site search ranks manual keyword matches and multi-token results deterministically', () => {
	const { searchFilterEntries } = loadSearchHelpers();
	const entries = [
		{
			path: 'Gaming/rapid-trigger',
			title: 'Rapid trigger settings',
			snippet: 'A general settings note.',
			text: 'Mentioned as part of a broader gaming page.',
		},
		{
			path: 'The%20Setup/the-setup',
			title: 'Bigfoot Jungle setup',
			snippet: 'Rapid switches and desk notes.',
			text: 'Trigger tuning, keyboard layout, and setup notes.',
			manualTerms: ['rapid trigger'],
		},
		{
			path: 'Socials/socials',
			title: 'Content hub',
			snippet: 'Featured clips and posts.',
			text: 'No matching hardware keywords here.',
		},
	];
	const resultPaths = (query, maxResults) =>
		Array.from(searchFilterEntries(entries, query, maxResults), (entry) => entry.path);

	assert.deepEqual(resultPaths('r', 10), [], 'single-letter queries are ignored');
	assert.deepEqual(
		resultPaths('rapid trigger', 10),
		['The%20Setup/the-setup', 'Gaming/rapid-trigger'],
		'curated manual keyword matches should outrank generic title matches'
	);
	assert.deepEqual(
		resultPaths('desk setup', 10),
		['The%20Setup/the-setup'],
		'multi-token queries can match across title, snippet, text, and decoded path'
	);
	assert.deepEqual(
		resultPaths('rapid trigger', 1),
		['The%20Setup/the-setup'],
		'maxResults caps ranked matches without changing their order'
	);
});

test('site search browser wiring preserves the public search contract', () => {
	assert.match(
		componentsSource,
		/const SITE_SEARCH_INDEX_URL = `\$\{siteRoot\}data\/site-search-index\.json`;/,
		'search should load the generated public index'
	);
	assert.match(componentsSource, /window\.owenminercsSiteSearchApi = \{/);
	assert.match(componentsSource, /indexUrl: SITE_SEARCH_INDEX_URL/);
	assert.match(componentsSource, /resolveHref: resolveSiteSearchHref/);
	assert.match(componentsSource, /getSearchPageUrl/);
	assert.match(componentsSource, /filterEntries: searchFilterEntries/);
	assert.match(componentsSource, /renderResults: searchRenderResults/);

	const initSiteSearch = extractFunction(componentsSource, 'initSiteSearch');
	assert.match(initSiteSearch, /document\.getElementById\('home-site-search-input'\)/);
	assert.match(initSiteSearch, /document\.getElementById\('home-site-search-results'\)/);
	assert.match(initSiteSearch, /homeInput\.closest\('\.site-search-form--home'\)/);
	assert.match(initSiteSearch, /homeResults\.querySelector\('\.site-search-results__link'\)/);
	assert.match(initSiteSearch, /fetch\(SITE_SEARCH_INDEX_URL\)/);
	assert.match(initSiteSearch, /p\.className = 'site-search-results__empty';/);
	assert.match(initSiteSearch, /p\.textContent = 'Could not load search index\.';/);
});

test('main nav return flow captures same-site nav clicks and restores saved scroll', () => {
	assert.match(
		componentsSource,
		/const NAV_RETURN_STATE_KEY = 'owenminercs-nav-return-state-v1';/
	);
	assert.match(
		componentsSource,
		/const NAV_RETURN_SCROLL_KEY = 'owenminercs-nav-return-scroll-v1';/
	);
	assert.match(componentsSource, /const NAV_RETURN_MAX_AGE_MS = 1000 \* 60 \* 60 \* 8;/);

	const captureNavReturnState = extractFunction(componentsSource, 'captureNavReturnState');
	assert.match(captureNavReturnState, /anchor instanceof HTMLAnchorElement/);
	assert.match(captureNavReturnState, /anchor\.classList\.contains\('site-nav-link'\)/);
	assert.match(captureNavReturnState, /destination\.origin !== window\.location\.origin/);
	assert.match(
		captureNavReturnState,
		/normalizeUrlForMatch\(fromUrl\) === normalizeUrlForMatch\(toUrl\)/
	);
	assert.match(captureNavReturnState, /fromScrollX: window\.scrollX \|\| 0/);
	assert.match(captureNavReturnState, /fromScrollY: window\.scrollY \|\| 0/);
	assert.match(captureNavReturnState, /toUrl,/);

	const initMainNavReturnHistory = extractFunction(componentsSource, 'initMainNavReturnHistory');
	assert.match(initMainNavReturnHistory, /dataset\.owenNavReturnBound === '1'/);
	assert.match(initMainNavReturnHistory, /event\.defaultPrevented/);
	assert.match(initMainNavReturnHistory, /event\.button !== 0/);
	assert.match(
		initMainNavReturnHistory,
		/event\.metaKey \|\| event\.ctrlKey \|\| event\.shiftKey \|\| event\.altKey/
	);
	assert.match(initMainNavReturnHistory, /target\.closest\('a\.site-nav-link'\)/);
	assert.match(
		initMainNavReturnHistory,
		/applyPendingNavReturnScrollRestore\(\);[\s\S]*maybeShowNavReturnButton\(\);/
	);
});

test('main nav return button writes a scroll restore payload before navigating back', () => {
	const buildNavReturnButton = extractFunction(componentsSource, 'buildNavReturnButton');
	assert.match(buildNavReturnButton, /wrap\.className = 'site-nav-return-popup';/);
	assert.match(buildNavReturnButton, /wrap\.setAttribute\('role', 'status'\);/);
	assert.match(buildNavReturnButton, /wrap\.setAttribute\('aria-live', 'polite'\);/);
	assert.match(buildNavReturnButton, /button\.textContent = 'Back';/);
	assert.match(
		buildNavReturnButton,
		/button\.setAttribute\('aria-label', `Back to \$\{labelSource\}`\);/
	);
	assert.match(buildNavReturnButton, /writeJsonStorage\(NAV_RETURN_SCROLL_KEY, \{/);
	assert.match(buildNavReturnButton, /targetUrl: record\.fromUrl/);
	assert.match(buildNavReturnButton, /scrollX: Number\(record\.fromScrollX\) \|\| 0/);
	assert.match(buildNavReturnButton, /scrollY: Number\(record\.fromScrollY\) \|\| 0/);
	assert.match(buildNavReturnButton, /localStorage\.removeItem\(NAV_RETURN_STATE_KEY\);/);

	const applyPendingNavReturnScrollRestore = extractFunction(
		componentsSource,
		'applyPendingNavReturnScrollRestore'
	);
	assert.match(
		applyPendingNavReturnScrollRestore,
		/localStorage\.removeItem\(NAV_RETURN_SCROLL_KEY\);/
	);
	assert.match(applyPendingNavReturnScrollRestore, /requestAnimationFrame\(restore\);/);
	assert.match(applyPendingNavReturnScrollRestore, /window\.setTimeout\(restore, 160\);/);
	assert.match(applyPendingNavReturnScrollRestore, /window\.setTimeout\(restore, 420\);/);
});
