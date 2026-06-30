import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');

function extractSiteSearchSource() {
	const start = componentsSource.indexOf('/** Resolve a canonical site path');
	const end = componentsSource.indexOf(
		"const DISCORD_INVITE_URL = 'https://discord.gg/fA9GbxmAge';"
	);
	assert.notEqual(start, -1, 'site search helper block should start at resolveSiteSearchHref');
	assert.notEqual(end, -1, 'site search helper block should end before unrelated constants');
	return componentsSource.slice(start, end);
}

function loadSiteSearchApi({ siteRoot = 'https://owenminercs.com/', isLocal = false } = {}) {
	const window = {};
	const document = createFakeDocument();
	const evaluate = new Function(
		'siteRoot',
		'isLocal',
		'window',
		'document',
		`${extractSiteSearchSource()}\nreturn window.owenminercsSiteSearchApi;`
	);
	return { api: evaluate(siteRoot, isLocal, window, document), document };
}

function createFakeDocument() {
	return {
		createElement(tagName) {
			return new FakeElement(tagName);
		},
	};
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

	set textContent(value) {
		this._textContent = String(value);
		this.children = [];
	}

	get textContent() {
		return [this._textContent, ...this.children.map((child) => child.textContent)].join('');
	}
}

test('site search requires meaningful query length before returning matches', () => {
	const { api } = loadSiteSearchApi();
	const entries = [{ title: 'Keyboard setup', path: 'Keyboard/keyboard', text: 'Wooting setup' }];

	assert.deepEqual(api.filterEntries(entries, 'k'), []);
	assert.deepEqual(api.filterEntries(entries, ' k '), []);
	assert.equal(api.filterEntries(entries, 'ke').length, 1);
});

test('site search requires every multi-word token somewhere in the indexed entry', () => {
	const { api } = loadSiteSearchApi();
	const entries = [
		{
			title: 'Wooting keyboard setup',
			path: 'Keyboard/keyboard',
			snippet: 'Rapid trigger gear',
			text: 'Analog gaming board and switches',
		},
		{
			title: 'Wooting profile',
			path: 'Gaming/wooting',
			snippet: 'Counter-Strike settings',
			text: 'Mouse sensitivity and crosshair notes',
		},
	];

	const matches = api.filterEntries(entries, 'wooting keyboard');

	assert.deepEqual(
		matches.map((entry) => entry.path),
		['Keyboard/keyboard']
	);
});

test('site search manual keyword hits outrank incidental body matches', () => {
	const { api } = loadSiteSearchApi();
	const entries = [
		{
			title: 'Video archive',
			path: 'Socials/videos',
			snippet: 'Clips and uploads',
			text: 'A long page that mentions programs in a title from an embedded feed.',
		},
		{
			title: 'Programs',
			path: 'Programs/programs',
			snippet: 'Download tools and project utilities',
			text: '',
			manualTerms: ['programs'],
		},
	];

	const matches = api.filterEntries(entries, 'programs');

	assert.deepEqual(
		matches.map((entry) => entry.path),
		['Programs/programs', 'Socials/videos']
	);
});

test('site search sorts tied rankings by path and respects max result limits', () => {
	const { api } = loadSiteSearchApi();
	const entries = [
		{ title: 'Alpha', path: 'z-last', text: 'needle' },
		{ title: 'Alpha', path: 'a-first', text: 'needle' },
		{ title: 'Alpha', path: 'm-middle', text: 'needle' },
	];

	const matches = api.filterEntries(entries, 'needle', 2);

	assert.deepEqual(
		matches.map((entry) => entry.path),
		['a-first', 'm-middle']
	);
});

test('site search falls back to raw paths when malformed URI decoding fails', () => {
	const { api } = loadSiteSearchApi();
	const entries = [{ title: '', path: '%E0%A4%A', snippet: '', text: '' }];

	const matches = api.filterEntries(entries, '%E0');

	assert.deepEqual(
		matches.map((entry) => entry.path),
		['%E0%A4%A']
	);
});

test('site search href resolution mirrors production and local extension rules', () => {
	const production = loadSiteSearchApi({
		siteRoot: 'https://owenminercs.com/',
		isLocal: false,
	}).api;
	const local = loadSiteSearchApi({ siteRoot: 'http://localhost:5500/', isLocal: true }).api;

	assert.equal(production.resolveHref(''), 'https://owenminercs.com/');
	assert.equal(production.resolveHref('/PC/pc'), 'https://owenminercs.com/PC/pc');
	assert.equal(production.getSearchPageUrl(), 'https://owenminercs.com/search');

	assert.equal(local.resolveHref('/PC/pc'), 'http://localhost:5500/PC/pc.html');
	assert.equal(local.getSearchPageUrl(), 'http://localhost:5500/search.html');
});

test('site search renderResults writes result titles and snippets as text', () => {
	const { api, document } = loadSiteSearchApi();
	const container = document.createElement('div');
	const unsafeTitle = '<img src=x onerror=alert(1)>';
	const unsafeSnippet = '<script>alert(1)</script>';

	api.renderResults(
		container,
		[{ title: unsafeTitle, path: 'Search/search', snippet: unsafeSnippet }],
		'search',
		'fullPage'
	);

	const list = container.children[0];
	const item = list.children[0];
	const link = item.children[0];
	const snippet = item.children[1];

	assert.equal(list.tagName, 'UL');
	assert.equal(link.textContent, unsafeTitle);
	assert.equal(snippet.textContent, unsafeSnippet);
	assert.equal(link.href, 'https://owenminercs.com/Search/search');
});

test('site search renderResults distinguishes empty, short, and no-match states', () => {
	const { api, document } = loadSiteSearchApi();
	const container = document.createElement('div');

	api.renderResults(container, [], '', 'preview');
	assert.equal(
		container.textContent,
		'Type at least 2 characters to search page copy, titles, image captions, and paths.'
	);

	api.renderResults(container, [], 'q', 'fullPage');
	assert.equal(container.textContent, 'Use at least 2 characters to search the full site.');

	api.renderResults(container, [], 'missing', 'fullPage');
	assert.equal(container.textContent, 'No matching pages.');
});
