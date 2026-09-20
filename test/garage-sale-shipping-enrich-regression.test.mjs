import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}(`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const braceStart = source.indexOf('{', start);
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

function loadGarageSaleListingHelpers() {
	const source = readWorkspaceFile('scripts/garage-sale.js');
	const sandbox = { String, Object, Boolean, Array };
	vm.runInNewContext(
		[
			extractFunction(source, 'enrichEbayListingRow'),
			extractFunction(source, 'getEbayUrl'),
			extractFunction(source, 'ebayItemId'),
			'this.enrichEbayListingRow = enrichEbayListingRow;',
			'this.getEbayUrl = getEbayUrl;',
			'this.ebayItemId = ebayItemId;',
		].join('\n'),
		sandbox
	);
	return sandbox;
}

const DEFAULT_SHIPPING = 'See live listing on eBay for shipping cost.';

test('enrichEbayListingRow copies the row and fills shipping from listing, cost, source, then the public fallback', () => {
	const { enrichEbayListingRow } = loadGarageSaleListingHelpers();

	assert.equal(
		enrichEbayListingRow(null, { defaultShipping: 'Source default still applies' }).shipping,
		'Source default still applies'
	);
	assert.equal(enrichEbayListingRow(null, null).shipping, DEFAULT_SHIPPING);

	const original = {
		title: 'Signed print',
		price: '$12',
		shipping: '  Free USPS  ',
		shippingCost: '$8.00',
	};
	const withShipping = enrichEbayListingRow(original, { defaultShipping: 'Included' });
	assert.equal(withShipping.shipping, 'Free USPS');
	assert.equal(withShipping.title, 'Signed print');
	assert.equal(original.shipping, '  Free USPS  ', 'source listing must not be mutated');
	assert.notEqual(withShipping, original);

	assert.equal(
		enrichEbayListingRow({ title: 'Sticker', shipping: '   ' }, { defaultShipping: ' $3 ' })
			.shipping,
		'$3'
	);
	assert.equal(enrichEbayListingRow({ shippingCost: '  $4.50  ' }, null).shipping, '$4.50');
	assert.equal(
		enrichEbayListingRow({ shippingCost: 6 }, { defaultShipping: 'unused' }).shipping,
		'6'
	);
	assert.equal(enrichEbayListingRow({ title: 'Hat' }, {}).shipping, DEFAULT_SHIPPING);
	assert.equal(
		enrichEbayListingRow({ title: 'Hat' }, { defaultShipping: '   ' }).shipping,
		DEFAULT_SHIPPING
	);
});

test('ebayItemId prefers /itm/ digits, otherwise the http(s) url, otherwise the title', () => {
	const { ebayItemId } = loadGarageSaleListingHelpers();

	assert.equal(
		ebayItemId({
			ebayUrl: 'https://www.ebay.com/itm/123456789012',
			url: 'https://www.ebay.com/itm/999',
			title: 'ignored',
		}),
		'123456789012'
	);
	assert.equal(ebayItemId({ url: 'HTTPS://www.ebay.com/ITM/555000111' }), '555000111');
	assert.equal(
		ebayItemId({ url: 'https://www.ebay.com/sch/i.html?_nkw=print', title: 'Print' }),
		'https://www.ebay.com/sch/i.html?_nkw=print'
	);
	assert.equal(ebayItemId({ url: '/itm/123', title: 'Relative listing' }), 'Relative listing');
	assert.equal(ebayItemId({ ebayUrl: 'javascript:alert(1)', title: 'Unsafe' }), 'Unsafe');
	assert.equal(ebayItemId({}), 'unknown');
});
