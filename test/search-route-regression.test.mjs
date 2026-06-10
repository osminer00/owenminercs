import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const componentsSource = readFileSync(join(root, 'scripts/components.js'), 'utf8');
const searchHtml = readFileSync(join(root, 'search.html'), 'utf8');
const searchPageScript = readFileSync(join(root, 'scripts/search-page.js'), 'utf8');
const searchIndex = JSON.parse(readFileSync(join(root, 'data/site-search-index.json'), 'utf8'));

function htmlPathForSearchEntry(entryPath) {
	if (!entryPath) return join(root, 'index.html');
	const decoded = entryPath
		.split('/')
		.map((segment) => decodeURIComponent(segment))
		.join('/');
	return join(root, `${decoded}.html`);
}

test('shared header search link ships a real search route and assets', () => {
	assert.match(
		componentsSource,
		/function getSearchPageUrl\(\) \{\s*return siteRoot \+ 'search'/
	);
	assert.match(componentsSource, /class="site-header-search-open site-nav-search-open"/);
	assert.match(searchHtml, /<script src="\.\/scripts\/components\.js" defer><\/script>/);
	assert.match(searchHtml, /<script src="\.\/scripts\/search-page\.js" defer><\/script>/);
	assert.match(searchHtml, /id="site-search-page-results"/);
	assert.match(searchHtml, /name="q"/);
	assert.match(searchHtml, /data-owen-site-search/);
	assert.match(searchPageScript, /fetch\(api\.indexUrl\)/);
});

test('search index is present and only points at existing pages', () => {
	assert.equal(searchIndex.version, 2);
	assert.equal(searchIndex.entryCount, searchIndex.entries.length);
	assert.ok(searchIndex.entries.length > 50, 'search index should cover the public site');
	assert.ok(
		searchIndex.entries.some(
			(entry) => /keyboard/i.test(entry.title) || /keyboard/i.test(entry.text)
		),
		'search index should include keyboard content'
	);

	for (const entry of searchIndex.entries) {
		assert.equal(typeof entry.path, 'string');
		assert.equal(typeof entry.title, 'string');
		assert.equal(typeof entry.snippet, 'string');
		assert.equal(typeof entry.text, 'string');
		assert.ok(
			existsSync(htmlPathForSearchEntry(entry.path)),
			`${entry.path || '/'} should exist`
		);
	}
});
