import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const searchPageSource = readFileSync(new URL('../scripts/search-page.js', import.meta.url), 'utf8');

class FakeTextNode {
	constructor(text) {
		this.nodeType = 3;
		this.textContent = String(text);
	}
}

class FakeElement {
	constructor(tagName = 'div') {
		this.tagName = tagName.toUpperCase();
		this.children = [];
		this.className = '';
		this._textContent = '';
	}

	get textContent() {
		return `${this._textContent}${this.children.map((child) => child.textContent || '').join('')}`;
	}

	set textContent(value) {
		this._textContent = String(value);
		this.children = [];
	}

	appendChild(child) {
		this.children.push(child);
		return child;
	}
}

function createDocument() {
	const elements = {
		'site-search-page-results': new FakeElement('div'),
		'site-search-page-summary': new FakeElement('p'),
	};

	return {
		readyState: 'complete',
		title: '',
		elements,
		createElement: (tagName) => new FakeElement(tagName),
		createTextNode: (text) => new FakeTextNode(text),
		getElementById: (id) => elements[id] || null,
		addEventListener() {
			throw new Error('Search page tests use a loaded document.');
		},
	};
}

async function runSearchPage({ search = '', api, fetchImpl }) {
	const document = createDocument();
	const window = {
		location: { search },
		owenminercsSiteSearchApi: api,
	};
	const context = vm.createContext({
		document,
		window,
		fetch: fetchImpl,
		URLSearchParams,
		Error,
	});

	vm.runInContext(searchPageSource, context, { filename: 'scripts/search-page.js' });
	await new Promise((resolve) => setImmediate(resolve));

	return {
		document,
		resultsEl: document.elements['site-search-page-results'],
		summaryEl: document.elements['site-search-page-summary'],
	};
}

test('search page leaves network and rendering untouched for empty queries', async () => {
	const api = {
		indexUrl: '/data/site-search-index.json',
		filterEntries() {
			assert.fail('empty search query should not filter entries');
		},
		renderResults() {
			assert.fail('empty search query should not render results');
		},
	};

	const { document, resultsEl, summaryEl } = await runSearchPage({
		search: '?q=%20%20%20',
		api,
		fetchImpl() {
			assert.fail('empty search query should not fetch the search index');
		},
	});

	assert.equal(document.title, 'Search | Owen Miner');
	assert.equal(resultsEl.textContent, '');
	assert.equal(
		summaryEl.textContent,
		'Enter a search using the Search link in the navigation bar or the search section on the home page.'
	);
});

test('search page fetches the static index and delegates full-page rendering', async () => {
	const indexedEntries = [
		{ title: 'Gaming Setups', path: 'The Setup/the-setup', text: 'desk keyboard pc' },
		{ title: 'Keyboard', path: 'Keyboard/60he', text: 'rapid trigger' },
	];
	const renderedEntries = [indexedEntries[0]];
	const calls = [];
	const api = {
		indexUrl: '/data/site-search-index.json',
		filterEntries(entries, query, maxResults) {
			calls.push({ type: 'filter', entries, query, maxResults });
			return renderedEntries;
		},
		renderResults(container, list, query, variant) {
			calls.push({ type: 'render', container, list, query, variant });
			container.textContent = 'rendered results';
		},
	};
	const fetchCalls = [];

	const { document, resultsEl, summaryEl } = await runSearchPage({
		search: '?q=Gaming%20Setups',
		api,
		fetchImpl(url) {
			fetchCalls.push(url);
			return Promise.resolve({
				ok: true,
				json: () => Promise.resolve({ entries: indexedEntries }),
			});
		},
	});

	assert.deepEqual(fetchCalls, ['/data/site-search-index.json']);
	assert.equal(document.title, 'Gaming Setups — Search | Owen Miner');
	assert.equal(summaryEl.textContent, 'Results for Gaming Setups.');
	assert.equal(summaryEl.children[1].className, 'site-search-page-query');
	assert.equal(summaryEl.children[1].textContent, 'Gaming Setups');
	assert.equal(resultsEl.textContent, 'rendered results');
	assert.deepEqual(calls, [
		{ type: 'filter', entries: indexedEntries, query: 'Gaming Setups', maxResults: Infinity },
		{
			type: 'render',
			container: resultsEl,
			list: renderedEntries,
			query: 'Gaming Setups',
			variant: 'fullPage',
		},
	]);
});

test('search page shows a deterministic empty state when the index cannot load', async () => {
	const api = {
		indexUrl: '/data/site-search-index.json',
		filterEntries() {
			assert.fail('failed index fetch should not filter entries');
		},
		renderResults() {
			assert.fail('failed index fetch should not render results');
		},
	};

	const { document, resultsEl, summaryEl } = await runSearchPage({
		search: '?q=pc',
		api,
		fetchImpl() {
			return Promise.resolve({
				ok: false,
				json: () => Promise.resolve({}),
			});
		},
	});

	assert.equal(document.title, 'pc — Search | Owen Miner');
	assert.equal(summaryEl.textContent, 'Results for pc.');
	assert.equal(resultsEl.children.length, 1);
	assert.equal(resultsEl.children[0].tagName, 'P');
	assert.equal(resultsEl.children[0].className, 'site-search-results__empty');
	assert.equal(resultsEl.children[0].textContent, 'Could not load search index.');
});
