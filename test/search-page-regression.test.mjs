import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const searchPageSource = readFileSync(new URL('../scripts/search-page.js', import.meta.url), 'utf8');

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const paramsStart = source.indexOf('(', start);
	assert.notEqual(paramsStart, -1, `${functionName} should have parameters`);

	let parenDepth = 0;
	let paramsEnd = -1;
	for (let i = paramsStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '(') parenDepth += 1;
		if (char === ')') {
			parenDepth -= 1;
			if (parenDepth === 0) {
				paramsEnd = i;
				break;
			}
		}
	}
	assert.notEqual(paramsEnd, -1, `${functionName} parameter list should close`);

	const braceStart = source.indexOf('{', paramsEnd);
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

function createFakeNode(tag = 'div') {
	return {
		tagName: String(tag).toUpperCase(),
		className: '',
		childNodes: [],
		_text: '',
		get textContent() {
			if (this.childNodes.length) {
				return this.childNodes.map((child) => child.textContent || '').join('');
			}
			return this._text;
		},
		set textContent(value) {
			this._text = String(value);
			this.childNodes = [];
		},
		appendChild(child) {
			this.childNodes.push(child);
			return child;
		},
	};
}

function loadSearchPage(options = {}) {
	const results = createFakeNode('div');
	const summary = options.summary === null ? null : createFakeNode('p');
	const fetches = [];
	const renderCalls = [];
	const filterCalls = [];
	const pending = [];
	const search = options.search == null ? '?q=keyboard' : options.search;
	const indexPayload = options.indexPayload;
	const fetchOk = options.fetchOk !== false;
	const includeApi = options.includeApi !== false;
	const includeResults = options.includeResults !== false;

	const document = {
		title: 'Search | Owen Miner',
		readyState: 'complete',
		getElementById(id) {
			if (id === 'site-search-page-results') return includeResults ? results : null;
			if (id === 'site-search-page-summary') return summary;
			return null;
		},
		createElement: createFakeNode,
		createTextNode(text) {
			return { nodeType: 3, textContent: String(text) };
		},
	};

	const sandbox = {
		String,
		Array,
		Boolean,
		Error,
		URLSearchParams,
		Promise,
		document,
		fetches,
		filterCalls,
		renderCalls,
		results,
		summary,
		window: {
			location: { search },
			owenminercsSiteSearchApi: includeApi
				? {
						indexUrl: '/data/site-search-index.json',
						filterEntries(entries, query, maxResults) {
							filterCalls.push({ entries, query, maxResults });
							return Array.isArray(entries) ? entries : [];
						},
						renderResults(container, list, query, variant) {
							renderCalls.push({ list, query, variant });
							container.textContent = `rendered:${list.length}:${query}:${variant}`;
						},
					}
				: undefined,
		},
		fetch(url) {
			fetches.push(String(url));
			const request = fetchOk
				? Promise.resolve({
						ok: true,
						json: async () => indexPayload,
					})
				: Promise.resolve({ ok: false });
			pending.push(request);
			return request;
		},
	};

	const iife = extractFunction(searchPageSource, 'initSearchResultsPage');
	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(iife, 'setSummary')}
		${extractFunction(iife, 'run')}
		this.__helpers = { setSummary, run, document, fetches, filterCalls, renderCalls, results, summary };
		`,
		sandbox
	);

	return {
		...sandbox.__helpers,
		async flush() {
			if (!pending.length) return;
			await Promise.all(Array.from(pending));
			await Promise.resolve();
			await Promise.resolve();
		},
	};
}

test('search page summary uses text nodes so query markup stays inert', () => {
	const helpers = loadSearchPage({ includeApi: false });
	const summary = createFakeNode('p');

	helpers.setSummary(null, 'ignored');
	helpers.setSummary(summary, '   ');
	assert.match(summary.textContent, /Enter a search using the Search link/);
	assert.equal(summary.childNodes.length, 0);

	helpers.setSummary(summary, '  <img src=x onerror="alert(1)">  ');
	assert.equal(summary.textContent, 'Results for <img src=x onerror="alert(1)">.');
	const queryEl = summary.childNodes.find((node) => node.className === 'site-search-page-query');
	assert.ok(queryEl, 'query should render in a dedicated span');
	assert.equal(queryEl.textContent, '<img src=x onerror="alert(1)">');
});

test('search page run no-ops without the shared API and clears empty queries', () => {
	const missingApi = loadSearchPage({ includeApi: false, search: '?q=keyboard' });
	missingApi.document.title = 'Keep';
	missingApi.run();
	assert.equal(missingApi.document.title, 'Keep');
	assert.equal(missingApi.fetches.length, 0);

	const missingResults = loadSearchPage({ includeResults: false, search: '?q=keyboard' });
	missingResults.run();
	assert.equal(missingResults.fetches.length, 0);

	const empty = loadSearchPage({ search: '?q=%20%20' });
	empty.results.textContent = 'stale';
	empty.run();
	assert.equal(empty.results.textContent, '');
	assert.equal(empty.document.title, 'Search | Owen Miner');
	assert.equal(empty.fetches.length, 0);
	assert.match(empty.summary.textContent, /Enter a search using the Search link/);
});

test('search page fetches the index, treats bad payloads as empty, and surfaces load failures', async () => {
	const ok = loadSearchPage({
		search: '?q=Wooting%2060HE',
		indexPayload: {
			entries: [{ title: 'Wooting 60HE', path: 'Keyboard/60he' }],
		},
	});
	ok.run();
	await ok.flush();
	assert.deepEqual(Array.from(ok.fetches), ['/data/site-search-index.json']);
	assert.equal(ok.filterCalls.length, 1);
	assert.equal(ok.filterCalls[0].maxResults, Infinity);
	assert.equal(ok.filterCalls[0].query, 'Wooting 60HE');
	assert.equal(ok.renderCalls[0].variant, 'fullPage');
	assert.equal(ok.document.title, 'Wooting 60HE — Search | Owen Miner');
	assert.equal(ok.results.textContent, 'rendered:1:Wooting 60HE:fullPage');
	assert.equal(ok.summary.textContent, 'Results for Wooting 60HE.');

	const badShape = loadSearchPage({
		search: '?q=desk',
		indexPayload: { entries: { not: 'an-array' } },
	});
	badShape.run();
	await badShape.flush();
	assert.deepEqual(Array.from(badShape.filterCalls[0].entries), []);
	assert.equal(badShape.renderCalls[0].list.length, 0);

	const failed = loadSearchPage({ search: '?q=desk', fetchOk: false });
	failed.results.textContent = 'stale';
	failed.run();
	await failed.flush();
	assert.equal(failed.renderCalls.length, 0);
	assert.equal(failed.results.childNodes[0].className, 'site-search-results__empty');
	assert.equal(failed.results.childNodes[0].textContent, 'Could not load search index.');
});
