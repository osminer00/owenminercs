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
		'generateProductCard',
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

test('generateProductCard returns empty HTML for missing catalog keys', () => {
	const api = loadAffiliateHelpers({
		desk_setup: {
			lamp: { name: 'Lamp', links: { official: 'https://example.com/lamp' } },
		},
	});

	assert.equal(api.generateProductCard('desk_setup.missing'), '');
	assert.equal(api.generateProductCard(''), '');
	assert.equal(api.generateProductCard('nope'), '');
});

test('generateProductCard HTML-escapes untrusted name, specs, description, and product keys', () => {
	const api = loadAffiliateHelpers({
		desk_setup: {
			'hostile"card': {
				name: 'Govee</h3><img src=x onerror=alert(1)>',
				specs: '1200lm</p><script>alert(1)</script>',
				description: 'Bright "light" & <b>bold</b>',
				links: { official: 'https://us.govee.com/products/light' },
			},
		},
	});

	const html = api.generateProductCard('desk_setup.hostile"card', { showDescription: true });

	assert.match(html, /class="product-card"/);
	assert.match(html, /data-product="desk_setup.hostile&quot;card"/);
	assert.match(html, /Govee&lt;\/h3&gt;&lt;img src=x onerror=alert\(1\)&gt;/);
	assert.match(html, /1200lm&lt;\/p&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
	assert.match(html, /Bright &quot;light&quot; &amp; &lt;b&gt;bold&lt;\/b&gt;/);
	assert.equal(html.includes('<script>'), false);
	assert.equal(html.includes('<img'), false);
	assert.match(
		html,
		/href="https:\/\/us\.govee\.com\/products\/light"/
	);
	assert.match(html, /rel="noopener noreferrer"/);
	assert.match(html, /target="_blank"/);
});

test('generateProductCard omits specs by default-off and withholds javascript: primary hrefs', () => {
	const api = loadAffiliateHelpers({
		lighting: {
			bar: {
				name: 'Light Bar',
				specs: '24in RGB',
				description: 'Desk wash',
				links: {
					official: 'javascript:alert(1)',
					disable_marketplaces: true,
				},
			},
		},
	});

	const withoutExtras = api.generateProductCard('lighting.bar', {
		showSpecs: false,
		showDescription: false,
	});
	assert.match(withoutExtras, /<h3>Light Bar<\/h3>/);
	assert.equal(withoutExtras.includes('javascript:'), false);
	assert.equal(withoutExtras.includes('24in RGB'), false);
	assert.equal(withoutExtras.includes('Desk wash'), false);

	const withSpecs = api.generateProductCard('lighting.bar');
	assert.match(withSpecs, /<strong>Specs:<\/strong> 24in RGB/);
	assert.equal(withSpecs.includes('Desk wash'), false);
});

test('generateProductCard falls back to an Amazon search heading when only a product name exists', () => {
	const api = loadAffiliateHelpers({
		pc_components: {
			unnamed_links: {
				name: 'ROG Swift',
			},
		},
	});

	const html = api.generateProductCard('pc_components.unnamed_links');
	assert.match(
		html,
		/<h3><a href="https:\/\/www\.amazon\.com\/s\?k=ROG\+Swift&amp;tag=owenminercs-20"/
	);
	assert.equal(html.includes('class="affiliate-button"'), false);
});
