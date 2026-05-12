import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');
const keyboardHubSource = readFileSync(new URL('../Keyboard/60he.html', import.meta.url), 'utf8');
const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '..');

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

function loadSearchApi({ siteRoot, isLocal }) {
	const script = `
		const siteRoot = ${JSON.stringify(siteRoot)};
		const isLocal = ${JSON.stringify(isLocal)};
		${extractFunction(componentsSource, 'resolveSiteSearchHref')}
		${extractFunction(componentsSource, 'getSearchPageUrl')}
		${extractFunction(componentsSource, 'searchManualKeywordHit')}
		${extractFunction(componentsSource, 'searchRankEntry')}
		${extractFunction(componentsSource, 'searchFilterEntries')}
		({
			resolveSiteSearchHref,
			getSearchPageUrl,
			searchRankEntry,
			searchFilterEntries,
		});
	`;
	return vm.runInNewContext(script);
}

test('site search ranks curated manual keyword hits above incidental body matches', () => {
	const { searchFilterEntries, searchRankEntry } = loadSearchApi({
		siteRoot: 'https://www.owenminercs.com/',
		isLocal: false,
	});
	const entries = [
		{
			path: 'Gaming/cs2-videos',
			title: 'CS2 videos',
			snippet: 'One clip mentions Wooting once.',
			text: 'Wooting appears incidentally in this long video transcript.',
		},
		{
			path: 'Keyboard/60he',
			title: 'Wooting 60HE build guide',
			snippet: 'Parts, switches, and build notes.',
			text: 'Hall effect keyboard setup.',
			manualTerms: ['wooting', 'wooting 60he'],
		},
	];

	const ranked = searchFilterEntries(entries, ' wooting ');

	assert.deepEqual(Array.from(ranked, (entry) => entry.path), [
		'Keyboard/60he',
		'Gaming/cs2-videos',
	]);
	assert.ok(
		searchRankEntry(entries[1], 'wooting') > searchRankEntry(entries[0], 'wooting'),
		'manual keyword match should materially boost the curated page'
	);
});

test('site search supports multi-word token matches and deterministic result caps', () => {
	const { searchFilterEntries } = loadSearchApi({
		siteRoot: 'https://www.owenminercs.com/',
		isLocal: false,
	});
	const entries = [
		{
			path: 'b-page',
			title: 'Jade switch notes',
			snippet: 'Magnetic switches',
			text: 'Keyboard tuning.',
		},
		{
			path: 'a-page',
			title: 'Jade switch notes',
			snippet: 'Magnetic switches',
			text: 'Keyboard tuning.',
		},
		{
			path: 'unmatched-page',
			title: 'Keyboard notes',
			snippet: 'No requested switch family here.',
			text: 'Rapid trigger setup.',
		},
	];

	assert.deepEqual(Array.from(searchFilterEntries(entries, 'x')), [], 'one-character queries should not search');
	assert.deepEqual(
		Array.from(searchFilterEntries(entries, 'jade magnetic', Infinity), (entry) => entry.path),
		['a-page', 'b-page'],
		'ties should sort by path for stable output'
	);
	assert.deepEqual(
		Array.from(searchFilterEntries(entries, 'jade magnetic', 1), (entry) => entry.path),
		['a-page'],
		'maxResults should cap the stable result list'
	);
});

test('site search href generation preserves production and local routing rules', () => {
	const productionApi = loadSearchApi({
		siteRoot: 'https://www.owenminercs.com/',
		isLocal: false,
	});
	const localApi = loadSearchApi({
		siteRoot: 'http://localhost:5500/',
		isLocal: true,
	});

	assert.equal(productionApi.resolveSiteSearchHref(''), 'https://www.owenminercs.com/');
	assert.equal(productionApi.resolveSiteSearchHref('/Keyboard/60he'), 'https://www.owenminercs.com/Keyboard/60he');
	assert.equal(productionApi.getSearchPageUrl(), 'https://www.owenminercs.com/search');

	assert.equal(localApi.resolveSiteSearchHref('/Keyboard/60he'), 'http://localhost:5500/Keyboard/60he.html');
	assert.equal(localApi.getSearchPageUrl(), 'http://localhost:5500/search.html');
});

test('keyboard 60HE hub keeps both build guide links pointed at existing pages', () => {
	const expectedBuildLinks = ['./60he-2025.html', './60he-2023.html'];

	for (const href of expectedBuildLinks) {
		assert.match(keyboardHubSource, new RegExp(`<a href="${href.replace('.', '\\.')}">`));
		const target = resolve(repoRoot, 'Keyboard', href.replace(/^\.\//, ''));
		assert.ok(existsSync(target), `${href} should resolve to an existing Keyboard page`);
	}

	assert.match(
		keyboardHubSource,
		/<div class="keyboard-parts-row"[^>]*role="navigation"[^>]*aria-label="Wooting build guide pages"/,
		'hub cards should remain exposed as build-guide navigation'
	);
});
