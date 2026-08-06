import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const amazonSource = readFileSync(new URL('../functions/amazon-price.js', import.meta.url), 'utf8');

function extractPaApiPriceMapper(source) {
	const marker = 'const prices = {};';
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, 'price map initializer should exist');

	const errorsMarker = 'if (result.Errors && result.Errors.length)';
	const end = source.indexOf(errorsMarker, start);
	assert.notEqual(end, -1, 'PA API errors branch should follow price mapping');

	const body = source.slice(start, end).trim();
	assert.match(body, /ItemsResult/);
	assert.match(body, /DisplayAmount/);

	return `
		function mapPaApiPrices(result) {
			${body}
			return prices;
		}
	`;
}

function loadPriceMapper() {
	const sandbox = {};
	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractPaApiPriceMapper(amazonSource)}
		this.mapPaApiPrices = mapPaApiPrices;
		`,
		sandbox
	);
	return sandbox.mapPaApiPrices;
}

test('Amazon PA-API response mapper keeps only ASIN display prices', () => {
	const mapPaApiPrices = loadPriceMapper();

	const prices = mapPaApiPrices({
		ItemsResult: {
			Items: [
				{
					ASIN: 'B07XYZ1234',
					Offers: {
						Listings: [{ Price: { DisplayAmount: '$19.99' } }],
					},
				},
				{
					ASIN: 'B000MISSING',
					Offers: { Listings: [{ Price: {} }] },
				},
				{
					ASIN: 'B000NOOFFER',
				},
				{
					ASIN: 'B08SECOND00',
					Offers: {
						Listings: [
							{ Price: { DisplayAmount: '$1.00' } },
							{ Price: { DisplayAmount: '$999.00' } },
						],
					},
				},
			],
		},
	});

	assert.deepEqual(prices, {
		B07XYZ1234: '$19.99',
		B08SECOND00: '$1.00',
	});
});

test('Amazon PA-API response mapper tolerates empty and malformed payloads', () => {
	const mapPaApiPrices = loadPriceMapper();

	assert.deepEqual(mapPaApiPrices({}), {});
	assert.deepEqual(mapPaApiPrices({ ItemsResult: {} }), {});
	assert.deepEqual(mapPaApiPrices({ ItemsResult: { Items: null } }), {});
	assert.deepEqual(mapPaApiPrices({ ItemsResult: { Items: [] } }), {});
});
