import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');
const searchPageSource = readFileSync(new URL('../scripts/search-page.js', import.meta.url), 'utf8');

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

class FakeTextNode {
	constructor(text) {
		this.nodeType = 3;
		this._textContent = String(text);
	}

	get textContent() {
		return this._textContent;
	}

	set textContent(value) {
		this._textContent = String(value);
	}
}

class FakeElement {
	constructor(tagName) {
		this.tagName = tagName.toUpperCase();
		this.children = [];
		this.className = '';
		this.href = '';
		this._textContent = '';
	}

	appendChild(child) {
		this.children.push(child);
		return child;
	}

	get textContent() {
		return this._textContent + this.children.map((child) => child.textContent).join('');
	}

	set textContent(value) {
		this._textContent = String(value);
		this.children = [];
	}

	get innerHTML() {
		return '';
	}

	set innerHTML(_) {
		assert.fail('search rendering should not write untrusted content with innerHTML');
	}
}

function createFakeDocument(idMap = {}) {
	return {
		readyState: 'complete',
		title: '',
		createdElements: [],
		listeners: new Map(),
		createElement(tagName) {
			const element = new FakeElement(tagName);
			this.createdElements.push(element);
			return element;
		},
		createTextNode(text) {
			return new FakeTextNode(text);
		},
		getElementById(id) {
			return idMap[id] || null;
		},
		addEventListener(type, handler) {
			this.listeners.set(type, handler);
		},
	};
}

function loadSearchHelpers({ siteRoot = 'https://www.owenminercs.com/', isLocal = false } = {}) {
	const sandbox = {
		document: createFakeDocument(),
		siteRoot,
		isLocal,
	};

	vm.runInNewContext(
		[
			extractFunction(componentsSource, 'resolveSiteSearchHref'),
			extractFunction(componentsSource, 'searchManualKeywordHit'),
			extractFunction(componentsSource, 'searchRankEntry'),
			extractFunction(componentsSource, 'searchFilterEntries'),
			extractFunction(componentsSource, 'searchRenderResults'),
			`globalThis.searchHelpers = {
				resolveSiteSearchHref,
				searchFilterEntries,
				searchRenderResults,
			};`,
		].join('\n'),
		sandbox
	);

	return sandbox.searchHelpers;
}

async function flushSearchPagePromises() {
	await Promise.resolve();
	await Promise.resolve();
	await new Promise((resolve) => setImmediate(resolve));
}

function runSearchPage({ search, api, fetchImpl, readyState = 'complete' }) {
	const summaryEl = new FakeElement('p');
	const resultsEl = new FakeElement('div');
	const document = createFakeDocument({
		'site-search-page-summary': summaryEl,
		'site-search-page-results': resultsEl,
	});
	document.readyState = readyState;

	const sandbox = {
		document,
		window: {
			location: { search },
			owenminercsSiteSearchApi: api,
		},
		fetch: fetchImpl,
		URLSearchParams,
		Error,
	};

	vm.runInNewContext(searchPageSource, sandbox);

	return { document, summaryEl, resultsEl };
}

test('site search filters multi-token queries, honors curated ranking, and caps previews', () => {
	const { searchFilterEntries } = loadSearchHelpers();
	const entries = [
		{
			path: 'Garage%20Sale/garage-sale',
			title: 'Garage Sale',
			snippet: 'Used gear and budget pc parts',
			text: 'Find a compact build list.',
			manualTerms: ['budget pc'],
		},
		{
			path: 'PC/pc',
			title: 'Budget PC overview',
			snippet: 'Parts and upgrade notes',
			text: 'A broad hardware page.',
		},
		{
			path: 'Keyboard/60he',
			title: 'Wooting 60HE keyboard',
			snippet: 'Analog switches and rapid trigger',
			text: 'Setup notes for gaming.',
		},
		{
			path: 'The%20Setup/the-setup',
			title: 'Gaming Setups',
			snippet: 'Desk layout and peripherals',
			text: 'Monitor arms, lighting, and chair details.',
		},
	];

	assert.equal(
		searchFilterEntries(entries, 'x', 10).length,
		0,
		'one-character queries stay inert'
	);

	const curated = searchFilterEntries(entries, 'budget pc', 10);
	assert.equal(curated[0].path, 'Garage%20Sale/garage-sale');
	assert.equal(curated[1].path, 'PC/pc');

	const crossField = searchFilterEntries(entries, 'analog keyboard', 10);
	assert.equal(crossField.length, 1);
	assert.equal(crossField[0].path, 'Keyboard/60he');

	const decodedPath = searchFilterEntries(entries, 'the setup', 10);
	assert.equal(decodedPath.length, 1);
	assert.equal(decodedPath[0].path, 'The%20Setup/the-setup');

	const capped = searchFilterEntries(entries, 'gear', 1);
	assert.equal(capped.length, 1);
});

test('site search renderer writes safe text and canonical hrefs for result data', () => {
	const { searchRenderResults } = loadSearchHelpers({ siteRoot: 'https://example.test/' });
	const container = new FakeElement('div');

	searchRenderResults(
		container,
		[
			{
				path: 'Keyboard/60he',
				title: '<img src=x onerror=alert(1)>',
				snippet: '<script>alert(1)</script>',
			},
		],
		'keyboard',
		'fullPage'
	);

	assert.equal(container.children.length, 1);
	const list = container.children[0];
	assert.equal(list.tagName, 'UL');
	assert.equal(list.className, 'site-search-results__list');

	const item = list.children[0];
	const link = item.children[0];
	const snippet = item.children[1];
	assert.equal(link.href, 'https://example.test/Keyboard/60he');
	assert.equal(link.textContent, '<img src=x onerror=alert(1)>');
	assert.equal(snippet.textContent, '<script>alert(1)</script>');
});

test('dedicated search page fetches the index and delegates full-page rendering for query links', async () => {
	const rawQuery = '<img src=x onerror=alert(1)>';
	const indexEntries = [{ path: 'Keyboard/60he', title: 'Wooting 60HE' }];
	let fetchedUrl = '';
	let filterCall;
	let renderCall;

	const api = {
		indexUrl: '/data/site-search-index.json',
		filterEntries(entries, query, maxResults) {
			filterCall = { entries, query, maxResults };
			return [indexEntries[0]];
		},
		renderResults(container, list, query, variant) {
			renderCall = { container, list, query, variant };
		},
	};

	const { document, summaryEl, resultsEl } = runSearchPage({
		search: `?q=${encodeURIComponent(rawQuery)}`,
		api,
		fetchImpl(url) {
			fetchedUrl = url;
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ entries: indexEntries }),
			});
		},
	});

	await flushSearchPagePromises();

	assert.equal(fetchedUrl, '/data/site-search-index.json');
	assert.equal(document.title, `${rawQuery} \u2014 Search | Owen Miner`);
	assert.equal(summaryEl.children[1].className, 'site-search-page-query');
	assert.equal(summaryEl.children[1].textContent, rawQuery);
	assert.deepEqual(filterCall, {
		entries: indexEntries,
		query: rawQuery,
		maxResults: Infinity,
	});
	assert.deepEqual(renderCall, {
		container: resultsEl,
		list: [indexEntries[0]],
		query: rawQuery,
		variant: 'fullPage',
	});
});

test('dedicated search page avoids fetching blank queries and renders fetch failures', async () => {
	const blankApi = {
		indexUrl: '/data/site-search-index.json',
		filterEntries() {
			assert.fail('blank queries should not filter entries');
		},
		renderResults() {
			assert.fail('blank queries should not render result lists');
		},
	};

	const blankPage = runSearchPage({
		search: '?q=%20%20',
		api: blankApi,
		fetchImpl() {
			assert.fail('blank queries should not fetch the search index');
		},
	});

	assert.equal(blankPage.document.title, 'Search | Owen Miner');
	assert.match(blankPage.summaryEl.textContent, /Enter a search/);
	assert.equal(blankPage.resultsEl.textContent, '');

	const failingPage = runSearchPage({
		search: '?q=keyboard',
		api: {
			indexUrl: '/data/site-search-index.json',
			filterEntries() {
				assert.fail('failed index fetches should not filter entries');
			},
			renderResults() {
				assert.fail('failed index fetches should not render result lists');
			},
		},
		fetchImpl() {
			return Promise.resolve({ ok: false });
		},
	});

	await flushSearchPagePromises();

	assert.equal(failingPage.resultsEl.children.length, 1);
	assert.equal(failingPage.resultsEl.children[0].className, 'site-search-results__empty');
	assert.equal(failingPage.resultsEl.children[0].textContent, 'Could not load search index.');
});
