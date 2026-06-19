import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const rootUrl = new URL('../', import.meta.url);
const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');
const keyboardHubSource = readFileSync(new URL('../Keyboard/60he.html', import.meta.url), 'utf8');
const redirectsSource = readFileSync(new URL('../_redirects', import.meta.url), 'utf8');
const sitemapSource = readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8');
const twitchRegisterSource = readFileSync(
	new URL('../functions/api/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);

function hrefsFrom(html) {
	return [...html.matchAll(/<a\s+[^>]*href="([^"]+)"/gi)].map((match) => match[1]);
}

function assertSiteFileExists(relativePath) {
	assert.ok(existsSync(new URL(relativePath, rootUrl)), `${relativePath} should exist`);
}

test('Wooting 60HE hub links to both build guide pages that exist', () => {
	const hrefs = hrefsFrom(keyboardHubSource);

	assert.ok(hrefs.includes('./60he-2025.html'), 'hub should link to the 2025 build guide');
	assert.ok(hrefs.includes('./60he-2023.html'), 'hub should link to the 2023/v1 build guide');
	assertSiteFileExists('Keyboard/60he-2025.html');
	assertSiteFileExists('Keyboard/60he-2023.html');
	assert.match(keyboardHubSource, /role="navigation" aria-label="Wooting build guide pages"/);
});

test('Programs navigation points to the canonical lowercase dev stack route', () => {
	assert.match(
		componentsSource,
		/<a href="\$\{getLink\('dev\/dev-stack'\)\}" class="site-nav-link" data-nav="Dev" title="Programs for coding, creative work, and streaming">Programs<\/a>/
	);
	assert.doesNotMatch(componentsSource, /getLink\('Dev\/dev-stack'\)/);
	assertSiteFileExists('dev/dev-stack.html');
	assert.match(redirectsSource, /^\/Dev\/dev-stack\s+\/dev\/dev-stack\s+301!$/m);
	assert.match(redirectsSource, /^\/Dev\/dev-stack\.html\s+\/dev\/dev-stack\s+301!$/m);
	assert.match(sitemapSource, /https:\/\/www\.owenminercs\.com\/dev\/dev-stack/);
	assert.doesNotMatch(sitemapSource, /https:\/\/www\.owenminercs\.com\/Dev\/dev-stack/);
});

test('Keyboard 60HE routes stay grouped under The Setup navigation state', () => {
	assert.match(
		componentsSource,
		/if \(lc\.includes\('\/keyboard\/'\) && lc\.includes\('60he'\)\) \{\s*return 'The Setup';\s*\}/
	);
	assert.match(
		componentsSource,
		/if \(!activeLink && currentPath\.includes\('\/Keyboard\/'\) && currentPath\.includes\('60he'\)\) \{\s*activeLink = scope\.querySelector\('a\[data-nav="The Setup"\]'\);\s*\}/
	);
});

test('Twitch registration secret comparison coerces both sides before length checks', () => {
	const functionMatch = twitchRegisterSource.match(
		/function timingSafeEqual\(a, b\) \{(?<body>[\s\S]*?)\n\}/
	);
	assert.ok(functionMatch, 'timingSafeEqual should exist');

	const body = functionMatch.groups.body;
	const coerceAIndex = body.indexOf('a = String(a);');
	const coerceBIndex = body.indexOf('b = String(b);');
	const lengthCheckIndex = body.indexOf('if (a.length !== b.length) return false;');

	assert.ok(coerceAIndex >= 0, 'first value should be coerced to a string');
	assert.ok(coerceBIndex > coerceAIndex, 'second value should be coerced to a string');
	assert.ok(lengthCheckIndex > coerceBIndex, 'length check should happen after string coercion');
	assert.ok(
		body.includes('a.charCodeAt(i) ^ b.charCodeAt(i)'),
		'comparison should still use per-character XOR'
	);
});
