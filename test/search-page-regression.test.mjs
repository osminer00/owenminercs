import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const searchHtml = readFileSync(new URL('../search.html', import.meta.url), 'utf8');
const searchPageJs = readFileSync(new URL('../scripts/search-page.js', import.meta.url), 'utf8');
const workspaceRoot = new URL('../', import.meta.url);
const searchTrailingSlashUrl = 'https://www.owenminercs.com/search/';

function localAssetUrls() {
	const urls = [];
	const attrPattern = /<(?:link|script)\b[^>]*(?:href|src)="([^"]+)"/gi;
	for (const match of searchHtml.matchAll(attrPattern)) {
		const raw = match[1];
		if (/^(?:https?:)?\/\//i.test(raw)) continue;
		if (/^(?:data|mailto|tel):/i.test(raw)) continue;
		urls.push(raw);
	}
	return urls;
}

test('search trailing-slash route loads root site assets', () => {
	const urls = localAssetUrls();
	assert.ok(urls.includes('/css/owenminercs.css'), 'search page should load shared CSS');
	assert.ok(urls.includes('/scripts/components.js'), 'search page should load shared components');
	assert.ok(urls.includes('/scripts/search-page.js'), 'search page should load search page script');
	assert.ok(urls.includes('/scripts/support-links.js'), 'search page should load support link script');

	for (const raw of urls) {
		const resolved = new URL(raw, searchTrailingSlashUrl);
		assert.notEqual(
			resolved.pathname.startsWith('/search/'),
			true,
			`${raw} should not resolve under /search/`
		);

		const fileUrl = new URL(`.${resolved.pathname}`, workspaceRoot);
		assert.ok(existsSync(fileUrl), `${raw} should resolve to an existing static file`);
	}
});

test('search page has an enabled GET query form and preserves linked queries', () => {
	assert.match(searchHtml, /<form[^>]+action="\/search"[^>]+method="get"[^>]+data-owen-site-search/i);
	assert.match(searchHtml, /<input[^>]+id="site-search-page-input"[^>]+type="search"[^>]+name="q"/i);
	assert.match(searchPageJs, /document\.getElementById\('site-search-page-input'\)/);
	assert.match(searchPageJs, /input\.value = q;/);
});
