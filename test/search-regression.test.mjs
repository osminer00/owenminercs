import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');
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

function createSearchApiHarness({
	siteRoot = 'https://www.owenminercs.com/',
	isLocal = false,
} = {}) {
	const source = [
		`const siteRoot = ${JSON.stringify(siteRoot)};`,
		`const isLocal = ${JSON.stringify(isLocal)};`,
		extractFunction(componentsSource, 'resolveSiteSearchHref'),
		extractFunction(componentsSource, 'getSearchPageUrl'),
		extractFunction(componentsSource, 'searchManualKeywordHit'),
		extractFunction(componentsSource, 'searchRankEntry'),
		extractFunction(componentsSource, 'searchFilterEntries'),
		'return { resolveSiteSearchHref, getSearchPageUrl, searchFilterEntries, searchRankEntry };',
	].join('\n');

	return Function(source)();
}

class FakeElement {
	constructor(tagName = 'div') {
		this.tagName = tagName.toUpperCase();
		this.children = [];
		this.className = '';
		this.href = '';
		this._textContent = '';
	}

	get textContent() {
		return `${this._textContent}${this.children.map((child) => child.textContent).join('')}`;
	}

	set textContent(value) {
		this._textContent = String(value);
		this.children = [];
	}

	appendChild(child) {
		this.children.push(child);
		return child;
	}

	querySelector(selector) {
		const match = selector.startsWith('.') ? selector.slice(1) : selector;
		const stack = [...this.children];
		while (stack.length) {
			const child = stack.shift();
			if (child.className?.split(/\s+/).includes(match)) return child;
			if (Array.isArray(child.children)) stack.push(...child.children);
		}
		return null;
	}
}

function createFakeDocument() {
	const elements = new Map([
		['site-search-page-results', new FakeElement('div')],
		['site-search-page-summary', new FakeElement('p')],
	]);

	return {
		readyState: 'complete',
		title: '',
		elements,
		addEventListener() {
			assert.fail('search page should run immediately when document is already loaded');
		},
		createElement(tagName) {
			return new FakeElement(tagName);
		},
		createTextNode(text) {
			return { textContent: String(text) };
		},
		getElementById(id) {
			return elements.get(id) || null;
		},
	};
}

async function runSearchPage({ query = '', fetchImpl, api }) {
	const document = createFakeDocument();
	const context = {
		document,
		fetch: fetchImpl,
		URLSearchParams,
		window: {
			location: { search: query ? `?q=${encodeURIComponent(query)}` : '' },
			owenminercsSiteSearchApi: api,
		},
	};

	vm.runInNewContext(searchPageSource, context, { filename: 'scripts/search-page.js' });
	await Promise.resolve();
	await Promise.resolve();

	return {
		document,
		resultsEl: document.getElementById('site-search-page-results'),
		summaryEl: document.getElementById('site-search-page-summary'),
	};
}

test('site search ranks meaningful matches and caps preview results only when requested', () => {
	const { searchFilterEntries } = createSearchApiHarness();
	const entries = [
		{
			path: 'Socials/socials',
			title: 'Content Cloud',
			snippet: 'Follow gaming clips and setup posts.',
			text: 'General social content with a one-off setup mention.',
		},
		{
			path: 'The%20Setup/the-setup',
			title: 'Gaming Setups',
			snippet: 'Bigfoot Jungle desk, PC, keyboard, and lighting setup guide.',
			text: 'A detailed setup page for Owen Miner gear and streaming equipment.',
			manualTerms: ['setup'],
		},
		{
			path: 'Keyboard/keyboard',
			title: 'Keyboard',
			snippet: 'Keyboard builds and typing gear.',
			text: 'Switches, keycaps, and keyboard layout notes.',
		},
		{
			path: 'Gaming/cs2-price-calc',
			title: 'CS2 Price Calculator',
			snippet: 'Steam inventory valuation for Counter-Strike items.',
			text: 'Looks up CS2 inventory prices from the Steam market.',
		},
	];

	const setupMatches = searchFilterEntries(entries, 'setup', 1);
	assert.deepEqual(
		setupMatches.map((entry) => entry.path),
		['The%20Setup/the-setup'],
		'manual-keyword setup page should outrank incidental setup mentions and respect preview cap'
	);

	const fullMatches = searchFilterEntries(entries, 'setup', Infinity);
	assert.deepEqual(
		fullMatches.map((entry) => entry.path),
		['The%20Setup/the-setup', 'Socials/socials'],
		'full-page searches should include every ranked setup match'
	);

	const splitPhraseMatches = searchFilterEntries(entries, 'steam inventory', Infinity);
	assert.deepEqual(
		splitPhraseMatches.map((entry) => entry.path),
		['Gaming/cs2-price-calc'],
		'multi-word queries should match when every token appears in the combined indexed text'
	);
});

test('site search href helpers preserve production and local URL rules', () => {
	const productionApi = createSearchApiHarness({
		siteRoot: 'https://www.owenminercs.com/',
		isLocal: false,
	});
	assert.equal(productionApi.resolveSiteSearchHref(''), 'https://www.owenminercs.com/');
	assert.equal(
		productionApi.resolveSiteSearchHref('/The%20Setup/the-setup'),
		'https://www.owenminercs.com/The%20Setup/the-setup'
	);
	assert.equal(productionApi.getSearchPageUrl(), 'https://www.owenminercs.com/search');

	const localApi = createSearchApiHarness({
		siteRoot: 'http://localhost:5500/',
		isLocal: true,
	});
	assert.equal(
		localApi.resolveSiteSearchHref('Gaming/gaming'),
		'http://localhost:5500/Gaming/gaming.html'
	);
	assert.equal(localApi.getSearchPageUrl(), 'http://localhost:5500/search.html');
});

test('dedicated search page leaves empty links idle without loading the index', async () => {
	let fetchCalled = false;
	const api = {
		indexUrl: '/data/site-search-index.json',
		filterEntries() {
			assert.fail('empty query should not filter entries');
		},
		renderResults() {
			assert.fail('empty query should not render results');
		},
	};

	const { document, resultsEl, summaryEl } = await runSearchPage({
		fetchImpl() {
			fetchCalled = true;
			return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries: [] }) });
		},
		api,
	});

	assert.equal(fetchCalled, false, 'empty search page should not fetch the index');
	assert.equal(document.title, 'Search | Owen Miner');
	assert.equal(resultsEl.textContent, '');
	assert.match(summaryEl.textContent, /Enter a search/);
});

test('dedicated search page loads the static index and delegates full-page rendering', async () => {
	const calls = [];
	const entries = [
		{ path: 'The%20Setup/the-setup', title: 'Gaming Setups' },
		{ path: 'PC/pc', title: 'PC' },
	];
	const rendered = new FakeElement('p');
	rendered.className = 'rendered-result';
	rendered.textContent = 'rendered setup results';

	const api = {
		indexUrl: '/data/site-search-index.json',
		filterEntries(receivedEntries, query, maxResults) {
			calls.push({ type: 'filter', receivedEntries, query, maxResults });
			return [entries[0]];
		},
		renderResults(resultsEl, list, query, variant) {
			calls.push({ type: 'render', list, query, variant });
			resultsEl.appendChild(rendered);
		},
	};

	const { document, resultsEl, summaryEl } = await runSearchPage({
		query: 'setup',
		fetchImpl(url) {
			assert.equal(url, api.indexUrl);
			return Promise.resolve({ ok: true, json: () => Promise.resolve({ entries }) });
		},
		api,
	});

	assert.equal(document.title, 'setup — Search | Owen Miner');
	assert.equal(summaryEl.querySelector('.site-search-page-query').textContent, 'setup');
	assert.equal(resultsEl.textContent, 'rendered setup results');
	assert.deepEqual(calls, [
		{ type: 'filter', receivedEntries: entries, query: 'setup', maxResults: Infinity },
		{ type: 'render', list: [entries[0]], query: 'setup', variant: 'fullPage' },
	]);
});

test('dedicated search page renders a stable load failure message', async () => {
	const api = {
		indexUrl: '/data/site-search-index.json',
		filterEntries() {
			assert.fail('failed index load should not filter entries');
		},
		renderResults() {
			assert.fail('failed index load should not render results');
		},
	};

	const { resultsEl } = await runSearchPage({
		query: 'setup',
		fetchImpl() {
			return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
		},
		api,
	});

	const errorEl = resultsEl.querySelector('.site-search-results__empty');
	assert.ok(errorEl, 'failure state should append an empty-results message');
	assert.equal(errorEl.textContent, 'Could not load search index.');
});
