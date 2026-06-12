import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

const apiTwitchRegisterSource = readFileSync(
	new URL('../functions/api/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
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

async function withProcessEnv(overrides, callback) {
	const original = new Map();
	for (const key of Object.keys(overrides)) {
		original.set(key, process.env[key]);
		if (overrides[key] == null) {
			delete process.env[key];
		} else {
			process.env[key] = overrides[key];
		}
	}

	try {
		return await callback();
	} finally {
		for (const [key, value] of original) {
			if (value == null) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	}
}

async function withMockFetch(mockFetch, callback) {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = mockFetch;
	try {
		return await callback();
	} finally {
		globalThis.fetch = originalFetch;
	}
}

function makeSteamInventoryPayload({ nonPricedItems, pricedItems }) {
	const assets = [];
	const descriptions = [];
	let id = 1000;

	for (let i = 0; i < nonPricedItems; i += 1) {
		const classid = String(id);
		id += 1;
		assets.push({
			assetid: String(10_000 + i),
			classid,
			instanceid: '0',
			amount: '1',
		});
		descriptions.push({
			classid,
			instanceid: '0',
			name: `Sticker Test ${i}`,
			market_name: `Sticker Test ${i}`,
			market_hash_name: `Sticker Test ${i}`,
			type: 'Sticker',
			tradable: 1,
			marketable: 1,
		});
	}

	for (let i = 0; i < pricedItems; i += 1) {
		const classid = String(id);
		id += 1;
		assets.push({
			assetid: String(20_000 + i),
			classid,
			instanceid: '0',
			amount: '1',
		});
		descriptions.push({
			classid,
			instanceid: '0',
			name: `AK-47 Test ${i}`,
			market_name: `AK-47 Test ${i}`,
			market_hash_name: `AK-47 Test ${i}`,
			type: 'Rifle',
			tradable: 1,
			marketable: 1,
		});
	}

	return {
		success: 1,
		more: false,
		assets,
		descriptions,
	};
}

test('Cloudflare Twitch register secret comparison accepts non-string equivalent values', () => {
	const timingSafeEqualSource = extractFunction(apiTwitchRegisterSource, 'timingSafeEqual');
	const timingSafeEqual = Function(`"use strict"; return (${timingSafeEqualSource});`)();

	assert.equal(timingSafeEqual(12345, '12345'), true);
	assert.equal(timingSafeEqual(12345, '12346'), false);
});

test('Netlify Twitch registration rejects malformed authorization headers before external calls', async () => {
	const { handler } = require('../netlify/functions/twitch-register-eventsub.js');
	const fetchCalls = [];

	await withProcessEnv(
		{
			TWITCH_REGISTER_SECRET: 'expected-secret',
			TWITCH_EVENTSUB_SECRET: null,
		},
		async () => {
			await withMockFetch(
				async (url, options) => {
					fetchCalls.push({ url: String(url), options });
					throw new Error('Twitch should not be called for unauthorized requests');
				},
				async () => {
					const response = await handler({
						httpMethod: 'POST',
						headers: {
							authorization: {},
						},
					});

					assert.equal(response.statusCode, 403);
					assert.deepEqual(JSON.parse(response.body), { error: 'Forbidden.' });
					assert.equal(fetchCalls.length, 0);
				}
			);
		}
	);
});

test('Netlify Steam inventory caps fetch size and eligible market price lookups', async () => {
	const { handler } = require('../netlify/functions/steam-cs2-inventory.js');
	const inventoryPayload = makeSteamInventoryPayload({ nonPricedItems: 5, pricedItems: 90 });
	const inventoryUrls = [];
	const marketPriceUrls = [];

	await withMockFetch(
		async (url) => {
			const href = String(url);
			if (href.includes('/inventory/')) {
				inventoryUrls.push(href);
				return {
					ok: true,
					text: async () => JSON.stringify(inventoryPayload),
				};
			}

			if (href.includes('/market/priceoverview/')) {
				marketPriceUrls.push(href);
				return {
					ok: true,
					json: async () => ({
						success: true,
						lowest_price: '$1.25',
						median_price: '$1.50',
						volume: '12',
					}),
				};
			}

			throw new Error(`Unexpected Steam request: ${href}`);
		},
		async () => {
			const response = await handler({
				httpMethod: 'GET',
				queryStringParameters: {
					profile: '76561198000000000',
					count: '999',
					featured: '0',
					limit: '1',
				},
			});

			assert.equal(response.statusCode, 200);

			const body = JSON.parse(response.body);
			assert.equal(body.ok, true);
			assert.equal(body.totalItems, 95);
			assert.equal(body.items.length, 1);
			assert.equal(inventoryUrls.length, 1);
			assert.equal(new URL(inventoryUrls[0]).searchParams.get('count'), '250');
			assert.equal(marketPriceUrls.length, 80);

			const pricedNames = marketPriceUrls.map((priceUrl) =>
				new URL(priceUrl).searchParams.get('market_hash_name')
			);
			assert.equal(pricedNames[0], 'AK-47 Test 0');
			assert.equal(pricedNames.at(-1), 'AK-47 Test 79');
			assert.ok(
				pricedNames.every((name) => name?.startsWith('AK-47 Test ')),
				'non-skin sticker items should not consume market price lookups'
			);
		}
	);
});
