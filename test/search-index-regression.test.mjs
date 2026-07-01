import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const repoRoot = new URL('../', import.meta.url);
const searchIndex = JSON.parse(
	readFileSync(new URL('../data/site-search-index.json', import.meta.url), 'utf8')
);

const forbiddenSearchPaths = new Set([
	'dev/ebay-seller-temp',
	'Garage%20Sale/ebay-seller-scratch',
	'Garage Sale/ebay-seller-scratch',
	'temp-ebay-profile',
]);

function decodePath(path) {
	try {
		return decodeURIComponent(path);
	} catch {
		return path;
	}
}

function htmlFileForSearchPath(path) {
	const decoded = decodePath(path);
	return decoded.endsWith('.html') ? decoded : `${decoded}.html`;
}

test('site search index only publishes existing production pages', () => {
	assert.ok(Array.isArray(searchIndex.entries), 'search index should expose entries');
	assert.equal(
		searchIndex.entryCount,
		searchIndex.entries.length,
		'entryCount should match entries length'
	);

	for (const entry of searchIndex.entries) {
		const rawPath = String(entry.path || '');
		const decodedPath = decodePath(rawPath);
		assert.ok(rawPath, 'search entry should include a path');
		assert.ok(
			!forbiddenSearchPaths.has(rawPath),
			`${rawPath} should not be published in search`
		);
		assert.ok(
			!forbiddenSearchPaths.has(decodedPath),
			`${decodedPath} should not be published in search`
		);

		const htmlFile = htmlFileForSearchPath(rawPath);
		assert.ok(
			existsSync(join(repoRoot.pathname, htmlFile)),
			`${rawPath} should resolve to ${htmlFile}`
		);
	}
});
