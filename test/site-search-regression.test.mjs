import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');
const redirectsSource = readFileSync(new URL('../_redirects', import.meta.url), 'utf8');
const searchPageSource = readFileSync(
	new URL('../scripts/search-page.js', import.meta.url),
	'utf8'
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

function loadSearchFunctions() {
	return Function(`
		${extractFunction(componentsSource, 'searchManualKeywordHit')}
		${extractFunction(componentsSource, 'searchRankEntry')}
		${extractFunction(componentsSource, 'searchFilterEntries')}

		return { searchRankEntry, searchFilterEntries };
	`)();
}

function loadHrefFunctions({ siteRoot, isLocal }) {
	return Function(
		'siteRoot',
		'isLocal',
		`
			${extractFunction(componentsSource, 'resolveSiteSearchHref')}
			${extractFunction(componentsSource, 'getSearchPageUrl')}

			return { resolveSiteSearchHref, getSearchPageUrl };
		`
	)(siteRoot, isLocal);
}

test('site search requires meaningful query text and every multi-word token', () => {
	const { searchFilterEntries } = loadSearchFunctions();
	const entries = [
		{
			title: 'Wooting keyboard setup',
			text: 'Analog switches and rapid trigger notes for the 60HE.',
			path: 'Keyboard/60he',
		},
		{
			title: 'Wooting overview',
			text: 'Keyboard notes without the specific model token.',
			path: 'Keyboard/overview',
		},
		{
			title: '60HE profile',
			text: 'Actuation and switch settings without the brand token.',
			path: 'Keyboard/60he-profile',
		},
	];

	assert.deepEqual(searchFilterEntries(entries, 'w', Infinity), []);
	assert.deepEqual(
		searchFilterEntries(entries, 'wooting 60he', Infinity).map((entry) => entry.path),
		['Keyboard/60he']
	);
});

test('site search ranks title matches and curated manual terms above incidental mentions', () => {
	const { searchFilterEntries, searchRankEntry } = loadSearchFunctions();
	const titleMatch = {
		title: 'Wooting 60HE keyboard',
		text: 'Compact setup notes.',
		path: 'Keyboard/60he',
	};
	const bodyMatch = {
		title: 'Keyboard notes',
		text: 'The Wooting 60HE appears in the hardware notes.',
		path: 'Keyboard/notes',
	};

	assert.ok(
		searchRankEntry(titleMatch, 'wooting 60he') > searchRankEntry(bodyMatch, 'wooting 60he'),
		'exact title hits should rank above body-only hits'
	);

	const results = searchFilterEntries(
		[
			{
				title: 'Popular video links',
				text: 'A stream title mentions repair mat as incidental copy.',
				path: 'Gaming/videos',
			},
			{
				title: 'Desk setup accessories',
				text: 'Repair work mat picks for the setup.',
				path: 'The%20Setup/the-setup',
				manualTerms: ['repair mat'],
			},
		],
		'repair mat',
		Infinity
	);

	assert.equal(results[0].path, 'The%20Setup/the-setup');
});

test('site search caps preview results but lets the dedicated search page request all matches', () => {
	const { searchFilterEntries } = loadSearchFunctions();
	const entries = Array.from({ length: 45 }, (_, index) => ({
		title: `Alpha result ${String(index).padStart(2, '0')}`,
		text: 'Shared alpha query copy.',
		path: `Pages/alpha-${String(index).padStart(2, '0')}`,
	}));

	assert.equal(searchFilterEntries(entries, 'alpha').length, 40);
	assert.equal(searchFilterEntries(entries, 'alpha', Infinity).length, 45);
});

test('site search hrefs follow local extension and production pretty-url rules', () => {
	const local = loadHrefFunctions({ siteRoot: 'http://127.0.0.1:5500/', isLocal: true });
	const production = loadHrefFunctions({
		siteRoot: 'https://www.owenminercs.com/',
		isLocal: false,
	});

	assert.equal(
		local.resolveSiteSearchHref('/Keyboard/60he'),
		'http://127.0.0.1:5500/Keyboard/60he.html'
	);
	assert.equal(local.resolveSiteSearchHref(''), 'http://127.0.0.1:5500/');
	assert.equal(local.getSearchPageUrl(), 'http://127.0.0.1:5500/search.html');

	assert.equal(
		production.resolveSiteSearchHref('/Keyboard/60he'),
		'https://www.owenminercs.com/Keyboard/60he'
	);
	assert.equal(production.resolveSiteSearchHref('/'), 'https://www.owenminercs.com/');
	assert.equal(production.getSearchPageUrl(), 'https://www.owenminercs.com/search');
});

test('site search route and shared API wiring stay connected', () => {
	assert.match(redirectsSource, /^\/search\s+\/search\.html\s+200$/m);
	assert.match(redirectsSource, /^\/search\/\s+\/search\.html\s+200$/m);

	assert.match(
		componentsSource,
		/const SITE_SEARCH_INDEX_URL = `\$\{siteRoot\}data\/site-search-index\.json`;/
	);
	assert.match(componentsSource, /window\.owenminercsSiteSearchApi = \{/);
	assert.match(componentsSource, /resolveHref:\s*resolveSiteSearchHref,/);
	assert.match(componentsSource, /getSearchPageUrl,/);
	assert.match(componentsSource, /filterEntries:\s*searchFilterEntries,/);
	assert.match(componentsSource, /renderResults:\s*searchRenderResults,/);
	assert.match(
		componentsSource,
		/<a href="\$\{getSearchPageUrl\(\)\}" class="site-header-search-open/
	);

	assert.match(searchPageSource, /api\.filterEntries\(entries, q, Infinity\)/);
	assert.match(searchPageSource, /api\.renderResults\(resultsEl, list, q, 'fullPage'\)/);
});
