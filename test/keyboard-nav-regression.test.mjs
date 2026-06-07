import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = new URL('../', import.meta.url);
const keyboardHubUrl = new URL('../Keyboard/60he.html', import.meta.url);
const keyboardHubSource = readFileSync(keyboardHubUrl, 'utf8');
const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');

function extractLocalHrefs(source) {
	const hrefPattern = /<a\b[^>]*\bhref=(["'])(?<href>[^"']+)\1/gi;
	return [...source.matchAll(hrefPattern)].map((match) => match.groups.href);
}

function resolveLocalHref(fromUrl, href) {
	const withoutHash = href.split('#')[0];
	const withoutQuery = withoutHash.split('?')[0];
	return new URL(withoutQuery, fromUrl);
}

test('keyboard hub keeps both Wooting 60HE build routes reachable', () => {
	const hrefs = extractLocalHrefs(keyboardHubSource);
	const expectedRoutes = ['./60he-2025.html', './60he-2023.html'];

	for (const route of expectedRoutes) {
		assert.ok(hrefs.includes(route), `hub should link to ${route}`);

		const targetUrl = resolveLocalHref(keyboardHubUrl, route);
		const targetPath = path.relative(repoRoot.pathname, targetUrl.pathname);
		assert.ok(existsSync(targetUrl), `${targetPath} should exist`);

		const targetSource = readFileSync(targetUrl, 'utf8');
		assert.match(targetSource, /<shared-header><\/shared-header>/);
		assert.match(targetSource, /<shared-footer\b/);
	}

	assert.match(keyboardHubSource, /Open 2025 build page/);
	assert.match(keyboardHubSource, /Open Crosshair &amp; v1 page/);
});

test('shared main navigation exposes Programs consistently in header and footer', () => {
	const programsNavPattern =
		/<a href="\$\{getLink\('dev\/dev-stack'\)\}" class="site-nav-link" data-nav="Dev" title="Programs for coding, creative work, and streaming">Programs<\/a>/g;
	const matches = componentsSource.match(programsNavPattern) || [];

	assert.equal(
		matches.length,
		2,
		'Programs nav item should be present once in the header nav and once in the footer nav'
	);
	assert.doesNotMatch(componentsSource, /data-nav="Dev"[^>]*>Dev<\/a>/);
});
