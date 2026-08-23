import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');

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
		href: '',
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

function loadSearchHelpers({ siteRoot = 'https://www.owenminercs.com/', isLocal = false } = {}) {
	const sandbox = {
		String,
		Array,
		Math,
		Infinity,
		decodeURIComponent,
		siteRoot,
		isLocal,
		document: {
			createElement: createFakeNode,
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(componentsSource, 'resolveSiteSearchHref')}
		${extractFunction(componentsSource, 'getSearchPageUrl')}
		${extractFunction(componentsSource, 'searchNormalizeBlob')}
		${extractFunction(componentsSource, 'searchManualKeywordHit')}
		${extractFunction(componentsSource, 'searchRankEntry')}
		${extractFunction(componentsSource, 'searchFilterEntries')}
		${extractFunction(componentsSource, 'searchRenderResults')}
		this.__helpers = {
			resolveSiteSearchHref,
			getSearchPageUrl,
			searchNormalizeBlob,
			searchManualKeywordHit,
			searchRankEntry,
			searchFilterEntries,
			searchRenderResults,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('site search ranks title and curated keyword hits above incidental body mentions', () => {
	const { searchRankEntry, searchManualKeywordHit, searchFilterEntries } = loadSearchHelpers();

	assert.equal(searchRankEntry({ title: 'Keyboard', text: 'wooting' }, 'k'), 0);
	assert.equal(searchRankEntry({ title: 'Keyboard', text: 'wooting' }, ''), 0);

	const titleHit = searchRankEntry(
		{ title: 'Wooting 60HE', text: 'magnetic keyboard', path: 'Keyboard/60he' },
		'wooting 60he'
	);
	const bodyOnly = searchRankEntry(
		{ title: 'Gaming', text: 'Someone mentioned a Wooting 60HE in a video title', path: 'Gaming/gaming' },
		'wooting 60he'
	);
	assert.ok(titleHit > bodyOnly, 'title phrase matches should outrank body-only mentions');
	assert.ok(titleHit > 0);
	assert.ok(bodyOnly > 0);

	assert.equal(
		searchManualKeywordHit({ manualTerms: ['wooting 60he', '60he'] }, 'wooting 60he', [
			'wooting',
			'60he',
		]),
		true
	);
	assert.equal(searchManualKeywordHit({ manualTerms: ['60he'] }, 'keyboard', ['keyboard']), false);
	assert.equal(searchManualKeywordHit({ title: 'Keyboard' }, 'keyboard', ['keyboard']), false);

	const curated = {
		title: 'Desk setup',
		text: 'A long page that only mentions wooting once in a caption.',
		path: 'The Setup/the-setup',
		manualTerms: ['wooting'],
	};
	const incidental = {
		title: 'Random clip',
		text: 'wooting shows up in a comment dump',
		path: 'Socials/socials',
	};
	assert.ok(
		searchRankEntry(curated, 'wooting') > searchRankEntry(incidental, 'wooting'),
		'manual keyword pages should outrank incidental mentions'
	);

	const ranked = searchFilterEntries(
		[
			{ title: 'Body mention', text: 'search page copy', path: 'z-body' },
			{ title: 'Search results', text: 'search page copy', path: 'search' },
			{ title: 'Unrelated', text: 'keyboard only', path: 'a-other' },
		],
		'search'
	);
	assert.deepEqual(
		Array.from(ranked).map((entry) => entry.path),
		['search', 'z-body']
	);
});

test('site search requires every query token, caps preview results, and keeps malformed paths searchable', () => {
	const { searchRankEntry, searchFilterEntries, searchNormalizeBlob } = loadSearchHelpers();

	assert.ok(
		searchRankEntry({ title: 'CS2 skins', text: 'inventory prices', path: 'Gaming/cs2-skins' }, 'cs2 skins') >
			0
	);
	assert.equal(
		searchRankEntry(
			{ title: 'CS2', text: 'inventory prices', path: 'Gaming/cs2-price-calc' },
			'cs2 skins'
		),
		0
	);

	const many = Array.from({ length: 45 }, (_, index) => ({
		title: `Match ${String(index).padStart(2, '0')}`,
		text: 'shared token',
		path: `page-${String(index).padStart(2, '0')}`,
	}));
	assert.equal(searchFilterEntries(many, 'shared').length, 40);
	assert.equal(searchFilterEntries(many, 'shared', Infinity).length, 45);
	assert.equal(searchFilterEntries(many, 'x').length, 0);

	assert.match(searchNormalizeBlob({ title: 'PC', path: 'The%20Setup/pc', text: 'Build' }), /the setup\/pc/);
	assert.match(searchNormalizeBlob({ title: 'Bad', path: '%E0%A4%A', text: 'Keep' }), /%e0%a4%a/);
	assert.ok(searchRankEntry({ title: 'Bad', path: '%E0%A4%A', text: 'Keep searchable' }, 'searchable') > 0);
});

test('site search hrefs follow local vs hosted rules and render query/title as text', () => {
	const hosted = loadSearchHelpers({
		siteRoot: 'https://www.owenminercs.com/',
		isLocal: false,
	});
	const local = loadSearchHelpers({ siteRoot: '/', isLocal: true });

	assert.equal(hosted.getSearchPageUrl(), 'https://www.owenminercs.com/search');
	assert.equal(local.getSearchPageUrl(), '/search.html');
	assert.equal(hosted.resolveSiteSearchHref(''), 'https://www.owenminercs.com/');
	assert.equal(hosted.resolveSiteSearchHref('/'), 'https://www.owenminercs.com/');
	assert.equal(
		hosted.resolveSiteSearchHref('/The%20Setup/the-setup'),
		'https://www.owenminercs.com/The%20Setup/the-setup'
	);
	assert.equal(local.resolveSiteSearchHref('QA/qa'), '/QA/qa.html');

	const container = createFakeNode('div');
	hosted.searchRenderResults(container, [], '', 'fullPage');
	assert.equal(container.childNodes[0].className, 'site-search-results__hint');
	assert.match(container.textContent, /No search terms were in the link/);

	hosted.searchRenderResults(container, [], 'q', 'preview');
	assert.match(container.textContent, /at least 2 characters/);

	hosted.searchRenderResults(container, [], 'qq', 'preview');
	assert.equal(container.childNodes[0].className, 'site-search-results__empty');
	assert.equal(container.textContent, 'No matching pages.');

	const xss = '<img src=x onerror="alert(1)">';
	hosted.searchRenderResults(
		container,
		[{ title: xss, snippet: xss, path: 'QA/qa' }],
		'qa',
		'fullPage'
	);
	const list = container.childNodes[0];
	assert.equal(list.className, 'site-search-results__list');
	const link = list.childNodes[0].childNodes[0];
	assert.equal(link.tagName, 'A');
	assert.equal(link.textContent, xss);
	assert.equal(link.href, 'https://www.owenminercs.com/QA/qa');
	assert.equal(list.childNodes[0].childNodes[1].textContent, xss);
});
