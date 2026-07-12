import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const searchPageSource = readFileSync(
	new URL('../scripts/search-page.js', import.meta.url),
	'utf8'
);
const redirectsSource = readFileSync(new URL('../_redirects', import.meta.url), 'utf8');
const searchHtmlSource = readFileSync(new URL('../search.html', import.meta.url), 'utf8');

function createFakeElement(tagName = 'div') {
	const children = [];
	let ownText = '';

	return {
		tagName: tagName.toUpperCase(),
		className: '',
		children,
		get textContent() {
			return ownText + children.map((child) => child.textContent || '').join('');
		},
		set textContent(value) {
			ownText = String(value);
			children.length = 0;
		},
		appendChild(child) {
			children.push(child);
			return child;
		},
	};
}

function createTextNode(text) {
	return {
		nodeType: 3,
		textContent: String(text),
	};
}

function createSearchPageHarness({ query = '', fetchImpl, apiOverrides = {} } = {}) {
	const resultsEl = createFakeElement('div');
	const summaryEl = createFakeElement('p');
	const elements = {
		'site-search-page-results': resultsEl,
		'site-search-page-summary': summaryEl,
	};

	const document = {
		readyState: 'complete',
		title: '',
		getElementById(id) {
			return elements[id] || null;
		},
		createElement: createFakeElement,
		createTextNode,
		addEventListener() {
			assert.fail('search page should run immediately after the document has loaded');
		},
	};

	const calls = {
		filterEntries: [],
		renderResults: [],
		fetch: [],
	};

	const api = {
		indexUrl: '/data/site-search-index.json',
		filterEntries(entries, q, maxResults) {
			calls.filterEntries.push({ entries, q, maxResults });
			return apiOverrides.filteredResults || [{ title: 'Matched page', path: 'matched' }];
		},
		renderResults(container, list, q, variant) {
			calls.renderResults.push({ container, list, q, variant });
			const rendered = createFakeElement('p');
			rendered.className = 'rendered-results';
			rendered.textContent = `rendered ${list.length} result(s) for ${q}`;
			container.appendChild(rendered);
		},
		...apiOverrides,
	};

	const fetch =
		fetchImpl ||
		((url) => {
			calls.fetch.push(url);
			return Promise.resolve({
				ok: true,
				json: () =>
					Promise.resolve({ entries: [{ title: 'Keyboard', path: 'Keyboard/60he' }] }),
			});
		});

	const context = {
		window: {
			location: {
				search: query,
			},
			owenminercsSiteSearchApi: api,
		},
		document,
		fetch,
		URLSearchParams,
		Error,
	};

	vm.runInNewContext(searchPageSource, context, { filename: 'scripts/search-page.js' });

	return {
		calls,
		document,
		resultsEl,
		summaryEl,
	};
}

async function flushPromises() {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}

test('dedicated search page leaves empty query links in a safe guidance state', async () => {
	const { calls, document, resultsEl, summaryEl } = createSearchPageHarness({
		query: '?q=%20%20',
	});

	await flushPromises();

	assert.equal(document.title, 'Search | Owen Miner');
	assert.equal(resultsEl.textContent, '');
	assert.equal(
		summaryEl.textContent,
		'Enter a search using the Search link in the navigation bar or the search section on the home page.'
	);
	assert.deepEqual(calls.fetch, [], 'empty queries should not request the static index');
	assert.deepEqual(calls.filterEntries, [], 'empty queries should not run ranking');
	assert.deepEqual(calls.renderResults, [], 'empty queries should not render stale results');
});

test('dedicated search page fetches the index and delegates full-page rendering for query links', async () => {
	const { calls, document, resultsEl, summaryEl } = createSearchPageHarness({
		query: '?q=keyboard%20build',
	});

	await flushPromises();

	assert.equal(document.title, 'keyboard build \u2014 Search | Owen Miner');
	assert.equal(summaryEl.textContent, 'Results for keyboard build.');
	assert.equal(summaryEl.children[0].textContent, 'Results for ');
	assert.equal(summaryEl.children[1].className, 'site-search-page-query');
	assert.equal(summaryEl.children[1].textContent, 'keyboard build');
	assert.equal(summaryEl.children[2].textContent, '.');

	assert.deepEqual(calls.fetch, ['/data/site-search-index.json']);
	assert.equal(calls.filterEntries.length, 1);
	assert.equal(calls.filterEntries[0].q, 'keyboard build');
	assert.equal(calls.filterEntries[0].maxResults, Infinity);
	assert.deepEqual(calls.filterEntries[0].entries, [
		{ title: 'Keyboard', path: 'Keyboard/60he' },
	]);

	assert.equal(calls.renderResults.length, 1);
	assert.equal(calls.renderResults[0].container, resultsEl);
	assert.equal(calls.renderResults[0].q, 'keyboard build');
	assert.equal(calls.renderResults[0].variant, 'fullPage');
	assert.equal(resultsEl.textContent, 'rendered 1 result(s) for keyboard build');
});

test('dedicated search page replaces failed index loads with a deterministic error message', async () => {
	const fetchCalls = [];
	const { calls, resultsEl } = createSearchPageHarness({
		query: '?q=counter-strike',
		fetchImpl(url) {
			fetchCalls.push(url);
			return Promise.resolve({
				ok: false,
				json: () => Promise.resolve({ entries: [{ title: 'Should not render' }] }),
			});
		},
	});

	await flushPromises();

	assert.deepEqual(fetchCalls, ['/data/site-search-index.json']);
	assert.deepEqual(calls.filterEntries, [], 'failed index loads should not rank partial data');
	assert.deepEqual(calls.renderResults, [], 'failed index loads should not render stale results');
	assert.equal(resultsEl.children.length, 1);
	assert.equal(resultsEl.children[0].className, 'site-search-results__empty');
	assert.equal(resultsEl.children[0].textContent, 'Could not load search index.');
});

test('dedicated search route is wired as a static pretty URL with required scripts', () => {
	assert.match(redirectsSource, /^\/search\s+\/search\.html\s+200$/m);
	assert.match(redirectsSource, /^\/search\/\s+\/search\.html\s+200$/m);
	assert.match(
		searchHtmlSource,
		/<link rel="canonical" href="https:\/\/www\.owenminercs\.com\/search" \/>/
	);
	assert.match(searchHtmlSource, /<script src="\.\/scripts\/components\.js" defer><\/script>/);
	assert.match(searchHtmlSource, /<script src="\.\/scripts\/search-page\.js" defer><\/script>/);
	assert.match(searchHtmlSource, /id="site-search-page-results"[\s\S]*aria-live="polite"/);
});
