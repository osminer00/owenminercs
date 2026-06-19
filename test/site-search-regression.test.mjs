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

function buildSearchApi({ siteRoot = 'https://example.test/', isLocal = false } = {}) {
	return Function(
		'siteRoot',
		'isLocal',
		`
${extractFunction(componentsSource, 'resolveSiteSearchHref')}
${extractFunction(componentsSource, 'searchManualKeywordHit')}
${extractFunction(componentsSource, 'searchRankEntry')}
${extractFunction(componentsSource, 'searchFilterEntries')}
return { resolveSiteSearchHref, searchManualKeywordHit, searchRankEntry, searchFilterEntries };
`
	)(siteRoot, isLocal);
}

test('site search ignores empty and one-character queries', () => {
	const { searchFilterEntries, searchRankEntry } = buildSearchApi();
	const entries = [{ title: 'Keyboard', text: 'Wooting keyboard setup', path: 'Keyboard/60he' }];

	assert.equal(searchRankEntry(entries[0], ''), 0);
	assert.equal(searchRankEntry(entries[0], 'k'), 0);
	assert.deepEqual(searchFilterEntries(entries, ' k '), []);
});

test('site search requires every token from a multi-word query to match', () => {
	const { searchFilterEntries } = buildSearchApi();
	const entries = [
		{ title: 'Kilowatt monitor', text: 'Power readings', path: 'PC/power' },
		{ title: 'Tofu keyboard', text: 'Case build notes', path: 'Keyboard/tofu' },
		{
			title: 'Keyboard power notes',
			text: 'Kilowatt readings while testing a tofu keyboard case.',
			path: 'Keyboard/power-notes',
		},
	];

	assert.deepEqual(
		searchFilterEntries(entries, 'kilowatt tofu', Infinity).map((entry) => entry.path),
		['Keyboard/power-notes']
	);
});

test('site search ranks title matches above body-only matches', () => {
	const { searchRankEntry } = buildSearchApi();
	const query = 'kilowatt tofu';
	const titleMatch = {
		title: 'Kilowatt Tofu notes',
		text: 'Keyboard build log.',
		path: 'Keyboard/title-match',
	};
	const bodyOnlyMatch = {
		title: 'Keyboard notes',
		text: 'Kilowatt Tofu build log.',
		path: 'Keyboard/body-match',
	};

	assert.ok(searchRankEntry(titleMatch, query) > searchRankEntry(bodyOnlyMatch, query));
});

test('site search manual keywords boost curated pages above incidental matches', () => {
	const { searchFilterEntries } = buildSearchApi();
	const entries = [
		{
			title: 'Old video notes',
			text: 'Programs mentioned in passing.',
			path: 'Posts/incidental-programs',
		},
		{
			title: 'Dev Stack',
			text: 'Programs and tools used on the site.',
			path: 'Dev/dev-stack',
			manualTerms: ['programs'],
		},
	];

	assert.deepEqual(
		searchFilterEntries(entries, 'programs', Infinity).map((entry) => entry.path),
		['Dev/dev-stack', 'Posts/incidental-programs']
	);
});

test('site search href resolution follows production and local extension rules', () => {
	const remoteApi = buildSearchApi({ siteRoot: 'https://owenminercs.com/', isLocal: false });
	const localApi = buildSearchApi({ siteRoot: 'http://localhost:5500/', isLocal: true });

	assert.equal(remoteApi.resolveSiteSearchHref('/'), 'https://owenminercs.com/');
	assert.equal(
		remoteApi.resolveSiteSearchHref('/Keyboard/60he'),
		'https://owenminercs.com/Keyboard/60he'
	);
	assert.equal(
		localApi.resolveSiteSearchHref('Keyboard/60he'),
		'http://localhost:5500/Keyboard/60he.html'
	);
});
