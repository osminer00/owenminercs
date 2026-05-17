import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const searchPageSource = readFileSync(new URL('../search.html', import.meta.url), 'utf8');
const searchIndex = JSON.parse(
	readFileSync(new URL('../data/site-search-index.json', import.meta.url), 'utf8')
);

test('shared header search link resolves to an existing search page', () => {
	assert.match(componentsSource, /href="\$\{getSearchPageUrl\(\)\}"/);
	assert.match(componentsSource, /site-nav-search-open site-nav-link/);
	assert.match(componentsSource, /data-nav="search"/);
	assert.match(searchPageSource, /id="site-search-page-input"/);
	assert.match(searchPageSource, /id="site-search-page-results"/);
});

test('static search index is built and contains core public pages', () => {
	assert.equal(packageJson.scripts['build:search'], 'node dev/build-site-search-index.mjs');
	assert.equal(searchIndex.version, 1);
	assert.ok(Array.isArray(searchIndex.entries), 'search entries should be an array');

	const paths = new Set(searchIndex.entries.map((entry) => entry.path));
	assert.ok(paths.has(''), 'home page should be searchable');
	assert.ok(paths.has('search'), 'search page should be searchable');
	assert.ok(paths.has('Keyboard/60he'), 'keyboard hub should be searchable');
	assert.ok(paths.has('dev/dev-stack'), 'Programs page should be searchable');
});
