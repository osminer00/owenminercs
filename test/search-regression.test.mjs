import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { setImmediate as flushMicrotasks } from 'node:timers/promises';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');
const searchPageSource = readFileSync(
	new URL('../scripts/search-page.js', import.meta.url),
	'utf8'
);

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
		this.nodeType = 1;
		this.tagName = tagName.toUpperCase();
		this.childNodes = [];
		this.className = '';
		this.href = '';
		this.parentNode = null;
		this._textContent = '';
	}

	appendChild(child) {
		this.childNodes.push(child);
		child.parentNode = this;
		return child;
	}

	get children() {
		return this.childNodes.filter((child) => child.nodeType === 1);
	}

	get textContent() {
		return `${this._textContent}${this.childNodes.map((child) => child.textContent).join('')}`;
	}

	set textContent(value) {
		this._textContent = String(value);
		this.childNodes = [];
	}
}

function createFakeDocument(elements = {}) {
	const elementMap = new Map(Object.entries(elements));
	return {
		readyState: 'complete',
		title: '',
		createElement(tagName) {
			return new FakeElement(tagName);
		},
		createTextNode(text) {
			return new FakeTextNode(text);
		},
		getElementById(id) {
			return elementMap.get(id) || null;
		},
		addEventListener() {
			assert.fail('search page should run immediately when document is already loaded');
		},
	};
}

function extractFunction(source, functionName) {
	const pattern = new RegExp(`(?:async\\s+)?function\\s+${functionName}\\s*\\(`);
	const match = pattern.exec(source);
	assert.ok(match, `${functionName} should exist`);

	let parenDepth = 0;
	let paramsEnd = -1;
	for (let i = source.indexOf('(', match.index); i < source.length; i += 1) {
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
	assert.notEqual(paramsEnd, -1, `${functionName} parameters should close`);

	const braceStart = source.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${functionName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(match.index, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function buildSearchApi(document) {
	return new Function(
		'document',
		`
		const siteRoot = 'https://www.owenminercs.com/';
		const isLocal = false;
		${extractFunction(componentsSource, 'resolveSiteSearchHref')}
		${extractFunction(componentsSource, 'searchManualKeywordHit')}
		${extractFunction(componentsSource, 'searchRankEntry')}
		${extractFunction(componentsSource, 'searchFilterEntries')}
		${extractFunction(componentsSource, 'searchRenderResults')}
		return { resolveSiteSearchHref, searchFilterEntries, searchRenderResults };
		`
	)(document);
}

function runSearchPage(window, document, fetchImpl) {
	new Function('window', 'document', 'fetch', 'URLSearchParams', searchPageSource)(
		window,
		document,
		fetchImpl,
		URLSearchParams
	);
}

test('shared site search ranks curated multi-token matches and renders result text safely', () => {
	const document = createFakeDocument();
	const { searchFilterEntries, searchRenderResults } = buildSearchApi(document);
	const entries = [
		{
			title: 'Keyboard lighting video',
			path: 'Socials/keyboard-video',
			snippet: 'A video clip.',
			text: 'keyboard setup b roll and captions',
		},
		{
			title: 'Gaming Setups',
			path: 'The%20Setup/the-setup',
			snippet: 'Desk, camping gear, PC, keyboard, and upgrades.',
			text: 'Desk gear, PC gear, and keyboard picks.',
			manualTerms: ['keyboard setup'],
		},
		{
			title: 'Keyboard Hub',
			path: 'Keyboard/keyboard',
			snippet: 'Keyboard builds and switches.',
			text: 'Keyboard builds only.',
		},
	];

	const matches = searchFilterEntries(entries, 'keyboard setup', Infinity);

	assert.deepEqual(
		matches.map((entry) => entry.path),
		['The%20Setup/the-setup', 'Socials/keyboard-video'],
		'curated setup page should outrank incidental video text, and pages missing a token should be excluded'
	);

	const container = document.createElement('div');
	searchRenderResults(
		container,
		[
			{
				title: '<img src=x onerror=alert(1)>',
				path: '/Counter-Strike/nosmoking',
				snippet: '<script>bad()</script>',
			},
		],
		'nosmoking',
		'fullPage'
	);

	const [list] = container.children;
	const [item] = list.children;
	const [link, snippet] = item.children;
	assert.equal(list.tagName, 'UL');
	assert.equal(link.tagName, 'A');
	assert.equal(link.href, 'https://www.owenminercs.com/Counter-Strike/nosmoking');
	assert.equal(link.textContent, '<img src=x onerror=alert(1)>');
	assert.equal(snippet.textContent, '<script>bad()</script>');
	assert.deepEqual(
		item.children.map((child) => child.tagName),
		['A', 'SPAN'],
		'HTML-looking titles and snippets must stay text, not become executable nodes'
	);
});

test('search results page fetches the static index and delegates full-page rendering for q', async () => {
	const resultsEl = new FakeElement('div');
	const summaryEl = new FakeElement('p');
	const document = createFakeDocument({
		'site-search-page-results': resultsEl,
		'site-search-page-summary': summaryEl,
	});
	const entries = [{ title: 'Keyboard Hub', path: 'Keyboard/keyboard' }];
	let fetchedUrl = '';
	let filterArgs = null;
	let renderArgs = null;
	const window = {
		location: { search: '?q=%3Ckeyboard%3E' },
		owenminercsSiteSearchApi: {
			indexUrl: '/data/site-search-index.json',
			filterEntries(receivedEntries, query, maxResults) {
				filterArgs = { receivedEntries, query, maxResults };
				return [{ title: 'Keyboard Hub', path: 'Keyboard/keyboard' }];
			},
			renderResults(container, list, query, variant) {
				renderArgs = { container, list, query, variant };
			},
		},
	};

	runSearchPage(window, document, async (url) => {
		fetchedUrl = url;
		return {
			ok: true,
			async json() {
				return { entries };
			},
		};
	});
	await flushMicrotasks();

	assert.equal(document.title, '<keyboard> — Search | Owen Miner');
	assert.equal(fetchedUrl, '/data/site-search-index.json');
	assert.deepEqual(filterArgs, {
		receivedEntries: entries,
		query: '<keyboard>',
		maxResults: Infinity,
	});
	assert.equal(renderArgs.container, resultsEl);
	assert.deepEqual(renderArgs.list, [{ title: 'Keyboard Hub', path: 'Keyboard/keyboard' }]);
	assert.equal(renderArgs.query, '<keyboard>');
	assert.equal(renderArgs.variant, 'fullPage');
	assert.equal(summaryEl.textContent, 'Results for <keyboard>.');
	assert.equal(summaryEl.childNodes[1].className, 'site-search-page-query');
	assert.equal(summaryEl.childNodes[1].textContent, '<keyboard>');
});

test('search results page does not fetch the index for an empty query', () => {
	const resultsEl = new FakeElement('div');
	const summaryEl = new FakeElement('p');
	const document = createFakeDocument({
		'site-search-page-results': resultsEl,
		'site-search-page-summary': summaryEl,
	});
	const window = {
		location: { search: '?q=%20%20' },
		owenminercsSiteSearchApi: {
			indexUrl: '/data/site-search-index.json',
			filterEntries() {
				assert.fail('empty queries should not be filtered');
			},
			renderResults() {
				assert.fail('empty queries should not render result lists');
			},
		},
	};

	runSearchPage(window, document, async () => {
		assert.fail('empty queries should not fetch the search index');
	});

	assert.equal(document.title, 'Search | Owen Miner');
	assert.equal(resultsEl.textContent, '');
	assert.match(summaryEl.textContent, /Enter a search using the Search link/);
});
