import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const marker = `function ${functionName}(`;
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, `${functionName} should exist`);
	const declaredAt = source.slice(Math.max(0, start - 6), start) === 'async ' ? start - 6 : start;

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
			if (depth === 0) return source.slice(declaredAt, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function loadHelpers() {
	const generateSource = readWorkspaceFile('dev/affiliate-idea-board/generate-items.mjs');
	const boardSource = readWorkspaceFile('dev/affiliate-idea-board/board.js');
	const sandbox = {
		URL,
		encodeURIComponent,
	};

	vm.runInNewContext(
		[
			extractFunction(generateSource, 'cleanUrl'),
			extractFunction(generateSource, 'amazonAffiliate'),
			extractFunction(generateSource, 'slugId'),
			"const SITE_ORIGIN = 'https://www.owenminercs.com';",
			extractFunction(boardSource, 'sitePageHref'),
			extractFunction(boardSource, 'amazonSearchUrl'),
			'this.__helpers = { cleanUrl, amazonAffiliate, slugId, sitePageHref, amazonSearchUrl };',
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'affiliate idea-board helpers should load');
	return sandbox.__helpers;
}

const helpers = loadHelpers();

test('cleanUrl canonicalizes Amazon product ids and drops tracking query params', () => {
	const { cleanUrl } = helpers;

	assert.equal(
		cleanUrl(
			'  https://smile.amazon.com/Wooting-60HE/dp/b0abc12345/ref=sr_1_1?tag=owenminercs-20&psc=1  '
		),
		'https://www.amazon.com/dp/B0ABC12345'
	);
	assert.equal(
		cleanUrl('https://www.amazon.com/dp/B000123456/?th=1'),
		'https://www.amazon.com/dp/B000123456'
	);
	assert.equal(
		cleanUrl('https://www.amazon.com/s?k=wooting&tag=owenminercs-20'),
		'https://www.amazon.com/s'
	);
});

test('cleanUrl keeps marketplace item paths and strips campaign parameters', () => {
	const { cleanUrl } = helpers;

	assert.equal(
		cleanUrl('https://www.aliexpress.com/item/1005006123456789.html?spm=a2g0o.detail'),
		'https://www.aliexpress.com/item/1005006123456789.html'
	);
	assert.equal(
		cleanUrl('https://www.aliexpress.com/store/1103775565?spm=a2g0o.store'),
		'https://www.aliexpress.com/store/1103775565'
	);
	assert.equal(
		cleanUrl('https://us.govee.com/products/strip/?utm_source=affiliate'),
		'https://us.govee.com/products/strip/'
	);
	assert.equal(
		cleanUrl('https://example.com/products/mic-arm?ref=home#details'),
		'https://example.com/products/mic-arm'
	);
});

test('cleanUrl returns trimmed text when the value is not a URL', () => {
	const { cleanUrl } = helpers;

	assert.equal(cleanUrl('  not a url :::  '), 'not a url :::');
	assert.equal(cleanUrl('   '), '');
});

test('amazonAffiliate places the ASIN and tag without keeping other query params', () => {
	const { amazonAffiliate } = helpers;

	assert.equal(
		amazonAffiliate('B0ABC12345', 'owenminercs-20'),
		'https://www.amazon.com/dp/B0ABC12345?tag=owenminercs-20'
	);
});

test('slugId builds stable ids from product titles', () => {
	const { slugId } = helpers;

	assert.equal(slugId("Owen's 60HE+"), 'owen-s-60he');
	assert.equal(slugId('  ---Govee RGBIC---  '), 'govee-rgbic');
	assert.equal(slugId('---'), '');
	assert.equal(slugId(''), '');

	const long = slugId(`${'Ab '.repeat(30)}`);
	assert.equal(long.length, 80);
	assert.equal(long.startsWith('ab-ab-ab-'), true);
	assert.equal(long.endsWith('-'), false);
});

test('amazonSearchUrl encodes the query and falls back to the default associate tag', () => {
	const { amazonSearchUrl } = helpers;

	assert.equal(
		amazonSearchUrl('CS2 & desk', ''),
		'https://www.amazon.com/s?k=CS2%20%26%20desk&tag=owenminercs-20'
	);
	assert.equal(
		amazonSearchUrl('mic arm', 'custom tag'),
		'https://www.amazon.com/s?k=mic%20arm&tag=custom%20tag'
	);
});

test('sitePageHref encodes path segments and skips the affiliate catalog file', () => {
	const { sitePageHref } = helpers;

	assert.equal(sitePageHref(''), null);
	assert.equal(sitePageHref(null), null);
	assert.equal(sitePageHref('affiliate-links.json'), null);
	assert.equal(
		sitePageHref('/The Setup/the-setup.html'),
		'https://www.owenminercs.com/The%20Setup/the-setup.html'
	);
	assert.equal(
		sitePageHref('Keyboard/60he.html'),
		'https://www.owenminercs.com/Keyboard/60he.html'
	);
});
