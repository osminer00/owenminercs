import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const socialCloudSource = readFileSync(
	new URL('../Socials/scripts/social-cloud.js', import.meta.url),
	'utf8'
);

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

function loadIconHelpers() {
	const sandbox = {
		String,
		socialIconPaths: {
			x: 'X-PATH',
			youtube: 'YT-PATH',
			twitch: 'TWITCH-PATH',
			reddit: 'REDDIT-PATH',
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'normalizePlatformKey')}
		${extractFunction(socialCloudSource, 'getSocialIconMarkup')}
		${extractFunction(socialCloudSource, 'getExternalLinkIconMarkup')}
		${extractFunction(socialCloudSource, 'decodeHtmlEntities')}
		this.__helpers = {
			normalizePlatformKey,
			getSocialIconMarkup,
			getExternalLinkIconMarkup,
			decodeHtmlEntities,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'social-cloud icon helpers should load');
	return sandbox.__helpers;
}

function svgPath(markup) {
	const match = String(markup).match(/d="([^"]*)"/);
	return match ? match[1] : '';
}

test('normalizePlatformKey maps twitter to x and lowercases other keys', () => {
	const helpers = loadIconHelpers();

	assert.equal(helpers.normalizePlatformKey('twitter'), 'x');
	assert.equal(helpers.normalizePlatformKey(' Twitter '), 'x');
	assert.equal(helpers.normalizePlatformKey('X'), 'x');
	assert.equal(helpers.normalizePlatformKey('YouTube'), 'youtube');
	assert.equal(helpers.normalizePlatformKey(''), '');
	assert.equal(helpers.normalizePlatformKey(null), '');
});

test('getSocialIconMarkup interpolates known SVG paths and blanks unknown platforms', () => {
	const helpers = loadIconHelpers();

	const xMarkup = helpers.getSocialIconMarkup('twitter');
	assert.match(xMarkup, /<svg class="site-social-nav__icon"/);
	assert.match(xMarkup, /aria-hidden="true"/);
	assert.match(xMarkup, /focusable="false"/);
	assert.equal(svgPath(xMarkup), 'X-PATH');
	assert.equal(svgPath(helpers.getSocialIconMarkup('X')), 'X-PATH');
	assert.equal(svgPath(helpers.getSocialIconMarkup(' youtube ')), 'YT-PATH');
	assert.equal(svgPath(helpers.getSocialIconMarkup('twitch')), 'TWITCH-PATH');

	assert.equal(helpers.getSocialIconMarkup('bluesky'), '');
	assert.equal(helpers.getSocialIconMarkup(''), '');
	assert.equal(helpers.getSocialIconMarkup(null), '');
});

test('social-cloud icon map keeps x and not twitter as the lookup key', () => {
	assert.match(socialCloudSource, /const socialIconPaths = \{/);
	assert.match(socialCloudSource, /\n\t\tx: 'M18\.901/);
	assert.equal(/\n\t\ttwitter:/.test(socialCloudSource), false);
});

test('getExternalLinkIconMarkup returns a two-path external-link SVG', () => {
	const helpers = loadIconHelpers();
	const markup = helpers.getExternalLinkIconMarkup();
	const paths = Array.from(String(markup).matchAll(/d="([^"]*)"/g), (match) => match[1]);

	assert.match(markup, /<svg class="site-social-nav__icon"/);
	assert.match(markup, /aria-hidden="true"/);
	assert.equal(paths.length, 2);
	assert.equal(paths[0], 'M14 3h7v7h-2V6.414l-8.293 8.293-1.414-1.414L17.586 5H14V3z');
	assert.equal(
		paths[1],
		'M19 21H3V5h8V3H3C1.897 3 1 3.897 1 5v16c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2v-8h-2v8z'
	);
});

test('decodeHtmlEntities expands the five XML entities used in Reddit copy', () => {
	const helpers = loadIconHelpers();

	assert.equal(helpers.decodeHtmlEntities(''), '');
	assert.equal(helpers.decodeHtmlEntities(null), '');
	assert.equal(helpers.decodeHtmlEntities('plain'), 'plain');
	assert.equal(helpers.decodeHtmlEntities('A &amp; B'), 'A & B');
	assert.equal(helpers.decodeHtmlEntities('&lt;script&gt;'), '<script>');
	assert.equal(helpers.decodeHtmlEntities('&quot;hi&#39;'), `"hi'`);
	assert.equal(helpers.decodeHtmlEntities('&amp;lt;'), '<');
	assert.equal(helpers.decodeHtmlEntities('&amp;amp;'), '&amp;');
});
