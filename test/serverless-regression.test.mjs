import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const steamInventory = require('../netlify/functions/steam-cs2-inventory.js');
const twitchRegister = require('../netlify/functions/twitch-register-eventsub.js');

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(payload, ok = true, status = ok ? 200 : 500) {
	return {
		ok,
		status,
		async json() {
			return payload;
		},
		async text() {
			return JSON.stringify(payload);
		},
	};
}

async function withFetch(mockFetch, run) {
	globalThis.fetch = mockFetch;
	try {
		return await run();
	} finally {
		globalThis.fetch = ORIGINAL_FETCH;
	}
}

async function withEnv(values, run) {
	const previous = {};
	for (const key of Object.keys(values)) {
		previous[key] = process.env[key];
		if (values[key] === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = values[key];
		}
	}

	try {
		return await run();
	} finally {
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	}
}

function buildSteamInventoryPayload(itemCount) {
	const assets = [];
	const descriptions = [];

	for (let i = 0; i < itemCount; i += 1) {
		const id = String(1000 + i);
		const marketName = `Covert Test Rifle ${String(i + 1).padStart(3, '0')}`;
		assets.push({
			assetid: id,
			classid: id,
			instanceid: '0',
			amount: '1',
			appid: 730,
			contextid: '2',
		});
		descriptions.push({
			classid: id,
			instanceid: '0',
			name: marketName,
			market_name: marketName,
			market_hash_name: marketName,
			type: 'Rifle',
			tradable: 1,
			marketable: 1,
			tags: [{ category: 'Rarity', localized_tag_name: 'Covert' }],
		});
	}

	return {
		success: 1,
		more: false,
		assets,
		descriptions,
	};
}

test('Twitch EventSub registration rejects unauthorized requests before Twitch calls', async () => {
	await withEnv(
		{
			TWITCH_REGISTER_SECRET: 'expected-secret',
			TWITCH_EVENTSUB_SECRET: undefined,
			TWITCH_CLIENT_ID: undefined,
			TWITCH_CLIENT_SECRET: undefined,
			TWITCH_BROADCASTER_ID: undefined,
			PUBLIC_SITE_URL: undefined,
		},
		async () => {
			await withFetch(
				async () => {
					assert.fail('unauthorized registration should not call Twitch');
				},
				async () => {
					const response = await twitchRegister.handler({
						httpMethod: 'POST',
						headers: { authorization: 'Bearer wrong-secret' },
					});

					assert.equal(response.statusCode, 403);
					assert.deepEqual(JSON.parse(response.body), { error: 'Forbidden.' });
				}
			);
		}
	);
});

test('Twitch EventSub registration accepts bearer auth and skips existing subscriptions', async () => {
	const calls = [];

	await withEnv(
		{
			TWITCH_REGISTER_SECRET: 'expected-secret',
			TWITCH_EVENTSUB_SECRET: 'eventsub-secret',
			TWITCH_CLIENT_ID: 'client-id',
			TWITCH_CLIENT_SECRET: 'client-secret',
			TWITCH_BROADCASTER_ID: '42',
			PUBLIC_SITE_URL: 'https://owen.example/',
		},
		async () => {
			await withFetch(
				async (url, options = {}) => {
					calls.push({ url: String(url), options });

					if (String(url).includes('oauth2/token')) {
						return jsonResponse({ access_token: 'app-token' });
					}

					if (String(url).includes('eventsub/subscriptions?status=enabled')) {
						return jsonResponse({
							data: [
								{
									type: 'channel.follow',
									version: '2',
									condition: { broadcaster_user_id: '42' },
									transport: {
										callback:
											'https://owen.example/.netlify/functions/twitch-eventsub',
									},
								},
							],
						});
					}

					if (String(url).includes('eventsub/subscriptions')) {
						return jsonResponse({ data: [{}] });
					}

					assert.fail(`unexpected fetch URL: ${url}`);
				},
				async () => {
					const response = await twitchRegister.handler({
						httpMethod: 'POST',
						headers: { authorization: 'Bearer expected-secret' },
					});
					const payload = JSON.parse(response.body);
					const createCalls = calls.filter((call) => {
						return (
							call.options.method === 'POST' &&
							call.url.includes('eventsub/subscriptions')
						);
					});

					assert.equal(response.statusCode, 200);
					assert.equal(payload.ok, true);
					assert.equal(
						payload.callback,
						'https://owen.example/.netlify/functions/twitch-eventsub'
					);
					assert.deepEqual(
						payload.results.map((result) => result.status),
						['already_exists', 'created', 'created', 'created']
					);
					assert.equal(createCalls.length, 3);
					assert.deepEqual(
						createCalls.map((call) => JSON.parse(call.options.body).type),
						['channel.subscribe', 'channel.subscription.gift', 'channel.cheer']
					);
				}
			);
		}
	);
});

test('Steam CS2 inventory pricing caps market lookups but returns unpriced items', async () => {
	const inventoryPayload = buildSteamInventoryPayload(90);
	const priceLookupNames = [];

	await withFetch(
		async (url) => {
			const href = String(url);

			if (href.includes('/inventory/')) {
				return jsonResponse(inventoryPayload);
			}

			if (href.includes('/market/priceoverview/')) {
				const marketHashName = new URL(href).searchParams.get('market_hash_name');
				priceLookupNames.push(marketHashName);
				return jsonResponse({
					success: true,
					lowest_price: '$123.45',
					median_price: '$120.00',
					volume: '1',
				});
			}

			assert.fail(`unexpected fetch URL: ${href}`);
		},
		async () => {
			const response = await steamInventory.handler({
				httpMethod: 'GET',
				queryStringParameters: {
					profile: '76561198000000000',
					featured: '0',
					limit: '90',
				},
			});
			const payload = JSON.parse(response.body);

			assert.equal(response.statusCode, 200);
			assert.equal(payload.ok, true);
			assert.equal(payload.totalItems, 90);
			assert.equal(payload.items.length, 90);
			assert.equal(priceLookupNames.length, 80);
			assert.equal(new Set(priceLookupNames).size, 80);
			assert.equal(payload.items[0].pricing.lowestPriceUsd, 123.45);
			assert.equal(payload.items[79].pricing.lowestPriceUsd, 123.45);
			assert.equal(payload.items[80].pricing, null);
			assert.equal(payload.items[89].pricing, null);
		}
	);
});
