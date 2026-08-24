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

function loadAffiliateHelpers(products = {}) {
	const source = readWorkspaceFile('scripts/affiliate-links.js');
	const sandbox = {
		URL,
		String,
		encodeURIComponent,
		Boolean,
		Array,
		Number,
		products,
		window: { location: { origin: 'https://owenminercs.com' } },
	};

	const methodNames = [
		'getProduct',
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
		'retailerBadgeHtml',
		'generateLinkButtons',
	];

	vm.runInNewContext(
		[
			...methodNames.map((name) => extractClassMethod(source, name)),
			'const api = {};',
			...methodNames.map((name) => `api.${name} = ${name}.bind(api);`),
			'api.products = this.products;',
			'this.__helpers = api;',
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'affiliate helpers should load');
	return sandbox.__helpers;
}

test('getProduct walks nested catalog keys and returns null for missing paths', () => {
	const api = loadAffiliateHelpers({
		pc_components: {
			rog_swift_monitor: { name: 'ROG Swift', links: { amazon: 'https://www.amazon.com/dp/B0TEST' } },
		},
	});

	const product = api.getProduct('pc_components.rog_swift_monitor');
	assert.equal(product.name, 'ROG Swift');
	assert.equal(api.getProduct('pc_components.missing'), null);
	assert.equal(api.getProduct('nope'), null);
	assert.equal(api.getProduct(''), null);
	assert.equal(api.getProduct('pc_components.rog_swift_monitor.extra.depth'), null);
});

test('generateLinkButtons HTML-escapes untrusted product names, keys, and prices', () => {
	const api = loadAffiliateHelpers({
		desk_setup: {
			hostile_light: {
				name: 'Govee</strong><img src=x onerror=alert(1)>',
				current_price: '$12"</p><script>alert(1)</script>',
				links: {
					disable_aliexpress: true,
					amazon_search: 'https://www.amazon.com/s?k=govee&tag=owenminercs-20&q="onclick',
				},
			},
			no_links: {
				name: 'Orphan product',
			},
		},
	});

	const html = api.generateLinkButtons('desk_setup.hostile_light');
	assert.match(
		html,
		/<p class="product-name"><strong>Govee&lt;\/strong&gt;&lt;img src=x onerror=alert\(1\)&gt;<\/strong><\/p>/
	);
	assert.match(
		html,
		/Now: <span class="price-highlight">\$12&quot;&lt;\/p&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/span>/
	);
	assert.match(html, /href="https:\/\/www\.amazon\.com\/s\?k=govee&amp;tag=owenminercs-20&amp;q=&quot;onclick"/);
	assert.match(
		html,
		/title="Search Amazon for Govee&lt;\/strong&gt;&lt;img src=x onerror=alert\(1\)&gt;"/
	);
	assert.match(html, /data-product="desk_setup.hostile_light"/);
	assert.doesNotMatch(html, /<img /);
	assert.doesNotMatch(html, /<script>/);
	assert.doesNotMatch(html, /href="javascript:/);

	assert.equal(api.generateLinkButtons('desk_setup.missing'), '');
	assert.equal(api.generateLinkButtons('desk_setup.no_links'), '');
});
