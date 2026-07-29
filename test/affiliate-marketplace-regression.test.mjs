import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractClassMethod(source, methodName) {
	const needle = `\n\t${methodName}(`;
	const start = source.indexOf(needle);
	assert.notEqual(start, -1, `${methodName} should exist as a class method`);

	const paramsStart = source.indexOf('(', start);
	assert.notEqual(paramsStart, -1, `${methodName} should have parameters`);

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
	assert.notEqual(paramsEnd, -1, `${methodName} parameter list should close`);

	const braceStart = source.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${methodName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) {
				const signatureAndBody = source.slice(start + 1, i + 1).trimStart();
				return `function ${signatureAndBody}`;
			}
		}
	}

	assert.fail(`${methodName} body should close`);
}

function loadAffiliateHelpers() {
	const source = readWorkspaceFile('scripts/affiliate-links.js');
	const sandbox = {
		URL,
		String,
		encodeURIComponent,
		Boolean,
		Array,
		Number,
		window: { location: { origin: 'https://owenminercs.com' } },
	};

	const methodNames = [
		'getPriceModel',
		'normalizeProductLinks',
		'escapeHtml',
		'getSearchTerms',
		'encodeSearchTerms',
		'isSafeHttpUrl',
		'safeHttpUrl',
		'isAmazonDirectUrl',
		'isAliExpressDirectUrl',
		'buildAmazonDirectUrl',
		'buildAmazonSearchUrl',
		'buildAliExpressSearchUrl',
		'getDirectLink',
		'getPrimaryProductUrl',
		'getButtonDefinitions',
	];

	vm.runInNewContext(
		[
			...methodNames.map((name) => extractClassMethod(source, name)),
			'const api = {};',
			...methodNames.map((name) => `api.${name} = ${name}.bind(api);`),
			'this.__helpers = api;',
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'affiliate helpers should load');
	return sandbox.__helpers;
}

test('affiliate price model prefers current_price and keeps legacy price as paid fallback', () => {
	const { getPriceModel } = loadAffiliateHelpers();

	function assertPriceModel(actual, expected) {
		assert.equal(actual.current, expected.current);
		assert.equal(actual.paid, expected.paid);
	}

	assertPriceModel(getPriceModel(null), { current: '', paid: '' });
	assertPriceModel(getPriceModel({ current_price: '$120', paid_price: '$99' }), {
		current: '$120',
		paid: '$99',
	});
	assertPriceModel(getPriceModel({ current_price: '$120', price: '$80' }), {
		current: '$120',
		paid: '$80',
	});
	assertPriceModel(getPriceModel({ paid_price: '$55' }), { current: '', paid: '$55' });
	assertPriceModel(getPriceModel({ price: '$40' }), { current: '', paid: '$40' });
});

test('affiliate marketplace disable flags suppress Amazon and AliExpress search buttons', () => {
	const { buildAmazonSearchUrl, buildAliExpressSearchUrl, getButtonDefinitions } =
		loadAffiliateHelpers();

	const product = { name: 'Govee Light Bars', links: { disable_marketplaces: true } };

	assert.equal(buildAmazonSearchUrl(product, product.links), '');
	assert.equal(buildAliExpressSearchUrl(product, product.links), '');
	assert.equal(getButtonDefinitions('lighting.govee', product).length, 0);

	assert.equal(
		buildAmazonSearchUrl(product, { disable_amazon: true }),
		''
	);
	assert.equal(
		buildAliExpressSearchUrl(product, { disable_aliexpress: true }),
		''
	);
	assert.equal(buildAmazonSearchUrl(product, { amazon_search: false }), '');
	assert.equal(buildAliExpressSearchUrl(product, { aliexpress: false }), '');
});

test('affiliate search builders keep tag and reject unsafe explicit marketplace URLs', () => {
	const { buildAmazonSearchUrl, buildAliExpressSearchUrl, safeHttpUrl, escapeHtml } =
		loadAffiliateHelpers();

	const product = { name: 'Wooting 60HE' };

	assert.equal(
		buildAmazonSearchUrl(product, {}),
		'https://www.amazon.com/s?k=Wooting+60HE&tag=owenminercs-20'
	);
	assert.equal(
		buildAliExpressSearchUrl(product, {}),
		'https://www.aliexpress.com/wholesale?SearchText=Wooting+60HE'
	);
	assert.equal(
		buildAmazonSearchUrl(product, {
			amazon_search: 'https://www.amazon.com/s?k=custom-query&tag=owenminercs-20',
		}),
		'https://www.amazon.com/s?k=custom-query&tag=owenminercs-20'
	);
	assert.equal(buildAmazonSearchUrl(product, { amazon_search: 'javascript:alert(1)' }), '');
	assert.equal(safeHttpUrl('https://example.com/ok'), 'https://example.com/ok');
	assert.equal(safeHttpUrl('javascript:alert(1)'), '');
	// Relative paths resolve against the page origin for protocol checks, but the
	// stored href keeps the original relative string when it is considered safe.
	assert.equal(safeHttpUrl('/relative/path'), '/relative/path');
	assert.equal(safeHttpUrl('mailto:owen@example.com'), '');
	assert.equal(
		escapeHtml(`<img src="x" onerror="alert('x')">`),
		'&lt;img src=&quot;x&quot; onerror=&quot;alert(&#39;x&#39;)&quot;&gt;'
	);
});

test('affiliate primary URL prefers direct links over marketplace search', () => {
	const { getPrimaryProductUrl, getDirectLink, getButtonDefinitions } = loadAffiliateHelpers();

	const product = {
		name: 'Official Keyboard',
		asin: 'B0TESTASIN',
		links: {
			direct: 'https://wooting.io/wooting-60he',
			disable_marketplaces: true,
		},
	};

	assert.equal(getDirectLink(product, product.links), 'https://wooting.io/wooting-60he');
	assert.equal(getPrimaryProductUrl(product, product.links), 'https://wooting.io/wooting-60he');
	assert.equal(getButtonDefinitions('keyboard.60he', product).length, 0);

	const asinProduct = {
		name: 'Case',
		asin: 'B012345678',
		links: {},
	};
	assert.equal(
		getPrimaryProductUrl(asinProduct, asinProduct.links),
		'https://www.amazon.com/dp/B012345678?tag=owenminercs-20'
	);

	const searchOnly = {
		name: 'Case',
		links: {},
	};
	assert.equal(
		getPrimaryProductUrl(searchOnly, searchOnly.links),
		'https://www.amazon.com/s?k=Case&tag=owenminercs-20'
	);
	assert.equal(
		getDirectLink(asinProduct, {
			amazon_direct: 'https://www.amazon.com/dp/B012345678?tag=owenminercs-20',
		}),
		'https://www.amazon.com/dp/B012345678?tag=owenminercs-20'
	);
});
