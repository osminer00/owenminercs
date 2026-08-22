import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const garageSaleSource = readFileSync(
	new URL('../scripts/garage-sale.js', import.meta.url),
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

function loadGarageEbayHelpers() {
	const sandbox = {
		String,
		Number,
		Array,
		Date,
		parseFloat,
		isNaN,
		NaN,
		currentSort: 'order',
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		var currentSort = this.currentSort;
		${extractFunction(garageSaleSource, 'getEbayUrl')}
		${extractFunction(garageSaleSource, 'ebayItemId')}
		${extractFunction(garageSaleSource, 'enrichEbayListingRow')}
		${extractFunction(garageSaleSource, 'getPriceValue')}
		${extractFunction(garageSaleSource, 'getPublishedTime')}
		${extractFunction(garageSaleSource, 'sortEbayList')}
		this.__helpers = {
			getEbayUrl,
			ebayItemId,
			enrichEbayListingRow,
			getPriceValue,
			getPublishedTime,
			sortEbayList,
			setSort(next) {
				currentSort = next;
			},
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('garage-sale eBay URLs only accept http(s) listing links', () => {
	const { getEbayUrl, ebayItemId } = loadGarageEbayHelpers();

	assert.equal(
		getEbayUrl({ ebayUrl: 'https://www.ebay.com/itm/123456789012' }),
		'https://www.ebay.com/itm/123456789012'
	);
	assert.equal(getEbayUrl({ url: 'http://www.ebay.com/itm/999' }), 'http://www.ebay.com/itm/999');
	assert.equal(
		getEbayUrl({ ebayUrl: '  https://www.ebay.com/itm/1  ' }),
		'https://www.ebay.com/itm/1'
	);
	assert.equal(getEbayUrl({ ebayUrl: 'javascript:alert(1)' }), '');
	assert.equal(getEbayUrl({ ebayUrl: 'mailto:owen@example.com' }), '');
	assert.equal(getEbayUrl({ ebayUrl: '/itm/123' }), '');
	assert.equal(getEbayUrl({ ebayUrl: '' }), '');
	assert.equal(getEbayUrl(null), '');
	assert.equal(
		getEbayUrl({ ebayUrl: '   ', url: 'https://www.ebay.com/itm/42' }),
		'https://www.ebay.com/itm/42'
	);

	assert.equal(ebayItemId({ ebayUrl: 'https://www.ebay.com/itm/123456789012' }), '123456789012');
	assert.equal(
		ebayItemId({ ebayUrl: 'https://www.ebay.com/item/no-id' }),
		'https://www.ebay.com/item/no-id'
	);
});

test('garage-sale fills shipping fallbacks and parses listing prices from mixed fields', () => {
	const { enrichEbayListingRow, getPriceValue, getPublishedTime } = loadGarageEbayHelpers();

	assert.equal(enrichEbayListingRow({ shipping: ' $4.00 ' }).shipping, '$4.00');
	assert.equal(enrichEbayListingRow({ shippingCost: 'Free' }).shipping, 'Free');
	assert.equal(
		enrichEbayListingRow({}, { defaultShipping: 'Calculated' }).shipping,
		'Calculated'
	);
	assert.equal(
		enrichEbayListingRow(null).shipping,
		'See live listing on eBay for shipping cost.'
	);

	assert.equal(getPriceValue({ priceNumber: 12.5 }), 12.5);
	assert.equal(getPriceValue({ priceCents: 1999 }), 19.99);
	assert.equal(getPriceValue({ price: '$8.00 USD' }), 8);
	assert.ok(Number.isNaN(getPriceValue({ price: 'Make offer' })));
	assert.ok(Number.isNaN(getPriceValue(null)));

	assert.equal(
		getPublishedTime({ publishedAt: '2026-01-02T00:00:00Z' }),
		Date.parse('2026-01-02T00:00:00Z')
	);
	assert.equal(getPublishedTime({ listingDate: 'not-a-date' }), null);
	assert.equal(getPublishedTime(null), null);
});

test('garage-sale sort keeps file order for missing prices/dates and honors price/date direction', () => {
	const { sortEbayList, setSort } = loadGarageEbayHelpers();
	const listings = [
		{ title: 'A', __fileOrder: 0, priceNumber: 30, publishedAt: '2026-01-01T00:00:00Z' },
		{ title: 'B', __fileOrder: 1, price: 'n/a', publishedAt: '2026-03-01T00:00:00Z' },
		{ title: 'C', __fileOrder: 2, priceCents: 1000, listingDate: '2026-02-01T00:00:00Z' },
	];

	setSort('order');
	assert.deepEqual(
		Array.from(sortEbayList(listings)).map((item) => item.title),
		['A', 'B', 'C']
	);

	setSort('price-asc');
	assert.deepEqual(
		Array.from(sortEbayList(listings)).map((item) => item.title),
		['C', 'A', 'B']
	);

	setSort('price-desc');
	assert.deepEqual(
		Array.from(sortEbayList(listings)).map((item) => item.title),
		['A', 'C', 'B']
	);

	setSort('date-desc');
	assert.deepEqual(
		Array.from(sortEbayList(listings)).map((item) => item.title),
		['B', 'C', 'A']
	);

	setSort('date-asc');
	assert.deepEqual(
		Array.from(sortEbayList(listings)).map((item) => item.title),
		['A', 'C', 'B']
	);
});
