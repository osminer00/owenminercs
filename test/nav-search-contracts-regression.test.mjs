import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');
const redirectsSource = readFileSync(new URL('../_redirects', import.meta.url), 'utf8');

test('header and footer main nav keep Gaming Setups label on The Setup hub', () => {
	const setupLinks = [
		...componentsSource.matchAll(
			/<a href="\$\{getLink\('The%20Setup\/the-setup'\)\}"[^>]*>Gaming Setups<\/a>/g
		),
	];
	assert.equal(
		setupLinks.length,
		2,
		'header and footer should both render Gaming Setups → The Setup'
	);
	assert.doesNotMatch(
		componentsSource,
		/<a href="\$\{getLink\('The%20Setup\/the-setup'\)\}"[^>]*>Bigfoot's Jungle<\/a>/
	);
});

test('search pretty URLs rewrite to search.html without dropping the route', () => {
	assert.match(redirectsSource, /^\/search\s+\/search\.html\s+200$/m);
	assert.match(redirectsSource, /^\/search\/\s+\/search\.html\s+200$/m);
});
