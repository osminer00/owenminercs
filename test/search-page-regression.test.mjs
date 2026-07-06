import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const searchHtml = readFileSync(new URL('../search.html', import.meta.url), 'utf8');
const searchPageScript = readFileSync(new URL('../scripts/search-page.js', import.meta.url), 'utf8');

test('search page uses root-relative local assets for the trailing-slash route', () => {
	assert.match(searchHtml, /href="\/css\/owenminercs\.css"/);
	assert.match(searchHtml, /src="\/scripts\/components\.js"/);
	assert.match(searchHtml, /src="\/scripts\/search-page\.js"/);
	assert.match(searchHtml, /src="\/scripts\/support-links\.js"/);
	assert.doesNotMatch(searchHtml, /\b(?:href|src)="(?:\.\/)?(?:css|scripts)\//);
});

test('search page exposes an enabled GET search form', () => {
	assert.match(
		searchHtml,
		/<form class="site-search-page-form" action="\/search" method="get" role="search" data-owen-site-search>/
	);
	assert.match(searchHtml, /<input\s+[^>]*id="site-search-page-input"[^>]*\sname="q"[^>]*\stype="search"/);
});

test('search page script keeps direct links and form submissions in sync', () => {
	assert.match(searchPageScript, /if \(inputEl\) inputEl\.value = q;/);
	assert.match(searchPageScript, /formEl\.addEventListener\('submit',/);
	assert.match(searchPageScript, /api\.getSearchPageUrl\(\)\}\?q=\$\{encodeURIComponent\(nextQuery\)\}/);
	assert.doesNotMatch(searchPageScript, /search section on the home page/);
});
