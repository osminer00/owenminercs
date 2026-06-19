import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { handler: steamInventoryHandler } = require('../netlify/functions/steam-cs2-inventory.js');
const { handler: twitchRegisterHandler } = require('../netlify/functions/twitch-register-eventsub.js');

function jsonResponse(payload, status = 200) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8' },
	});
}

function parseNetlifyJson(response) {
	return JSON.parse(response.body);
}

async function withFetchStub(fetchStub, callback) {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = fetchStub;
	try {
		return await callback();
	} finally {
		globalThis.fetch = originalFetch;
	}
}

async function withEnv(updates, callback) {
	const previous = new Map();
	for (const key of Object.keys(updates)) {
		previous.set(key, process.env[key]);
		if (updates[key] === undefined) {
			delete process.env[key];
		} else {
			process.env[key] = updates[key];
		}
	}

	try {
		return await callback();
	} finally {
		for (const [key, value] of previous.entries()) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	}
}

function buildSteamInventoryFixture(count) {
	const assets = [];
	const descriptions = [];

	for (let index = 0; index < count; index += 1) {
		const id = String(1000 + index);
		assets.push({
			assetid: id,
			classid: `class-${index}`,
			instanceid: 'instance-1',
			amount: '1',
		});
		descriptions.push({
			classid: `class-${index}`,
			instanceid: 'instance-1',
			name: `Regression Rifle ${index}`,
			market_name: `AK-47 | Regression ${index} (Factory New)`,
			market_hash_name: `AK-47 | Regression ${index} (Factory New)`,
			type: 'Rifle',
			tradable: 1,
			marketable: 1,
			tags: [{ category: 'Rarity', localized_tag_name: 'Covert' }],
		});
	}

	return { assets, descriptions };
}

test('Steam inventory pricing caps external market lookups while preserving returned items', async () => {
	const { assets, descriptions } = buildSteamInventoryFixture(90);
	const inventoryRequests = [];
	const priceRequests = [];

	await withFetchStub(
		async (url) => {
			const parsed = new URL(url);
			if (parsed.pathname.startsWith('/inventory/')) {
				inventoryRequests.push(parsed);
				return jsonResponse({
					success: 1,
					assets,
					descriptions,
					more: false,
				});
			}

			if (parsed.pathname === '/market/priceoverview/') {
				priceRequests.push(parsed);
				return jsonResponse({
					success: true,
					lowest_price: '$123.45',
					median_price: '$120.00',
					volume: '5',
				});
			}

			assert.fail(`Unexpected Steam fetch: ${url}`);
		},
		async () => {
			const response = await steamInventoryHandler({
				httpMethod: 'GET',
				queryStringParameters: {
					profile: '76561198000000000',
					count: '999',
					featured: '0',
					limit: '300',
				},
			});
			const body = parseNetlifyJson(response);

			assert.equal(response.statusCode, 200);
			assert.equal(inventoryRequests.length, 1, 'Steam inventory should be fetched once');
			assert.equal(
				inventoryRequests[0].searchParams.get('count'),
				'250',
				'inventory page size should be capped before calling Steam'
			);
			assert.equal(priceRequests.length, 80, 'market price lookups should be capped at 80');
			assert.equal(
				priceRequests.at(-1).searchParams.get('market_hash_name'),
				'AK-47 | Regression 79 (Factory New)'
			);
			assert.ok(
				priceRequests.every(
					(request) =>
						request.searchParams.get('market_hash_name') !== 'AK-47 | Regression 80 (Factory New)'
				),
				'items after the lookup cap should not call Steam market pricing'
			);

			assert.equal(body.ok, true);
			assert.equal(body.totalItems, 90);
			assert.equal(body.items.length, 90);
			assert.equal(body.items[0].pricing.lowestPriceUsd, 123.45);
			assert.equal(body.items[79].pricing.lowestPriceUsd, 123.45);
			assert.equal(body.items[80].pricing, null);
			assert.equal(body.items[89].pricing, null);
		}
	);
});

test('Twitch EventSub registration rejects bad secrets before contacting Twitch', async () => {
	await withEnv(
		{
			TWITCH_REGISTER_SECRET: 'expected-secret',
			TWITCH_EVENTSUB_SECRET: 'webhook-secret',
			TWITCH_CLIENT_ID: 'client-id',
			TWITCH_CLIENT_SECRET: 'client-secret',
			TWITCH_BROADCASTER_ID: 'broadcaster-id',
			PUBLIC_SITE_URL: 'https://example.com',
		},
		async () => {
			let fetchCount = 0;

			await withFetchStub(
				async (url) => {
					fetchCount += 1;
					assert.fail(`Unauthorized registration should not call Twitch: ${url}`);
				},
				async () => {
					const response = await twitchRegisterHandler({
						httpMethod: 'POST',
						headers: { 'x-twitch-register-secret': 'wrong-secret' },
					});
					const body = parseNetlifyJson(response);

					assert.equal(response.statusCode, 403);
					assert.deepEqual(body, { error: 'Forbidden.' });
					assert.equal(fetchCount, 0);
				}
			);
		}
	);
});

test('Twitch EventSub registration dedupes existing subscriptions and sends follow moderator condition', async () => {
	await withEnv(
		{
			TWITCH_REGISTER_SECRET: 'register-secret',
			TWITCH_EVENTSUB_SECRET: 'webhook-secret',
			TWITCH_CLIENT_ID: 'client-id',
			TWITCH_CLIENT_SECRET: 'client-secret',
			TWITCH_BROADCASTER_ID: 'broadcaster-id',
			PUBLIC_SITE_URL: 'https://example.com/',
		},
		async () => {
			const createBodies = [];
			const callback = 'https://example.com/.netlify/functions/twitch-eventsub';

			await withFetchStub(
				async (url, options = {}) => {
					const parsed = new URL(url);
					if (parsed.hostname === 'id.twitch.tv') {
						assert.equal(options.method, 'POST');
						return jsonResponse({ access_token: 'app-token' });
					}

					if (parsed.pathname === '/helix/eventsub/subscriptions') {
						if (options.method === 'POST') {
							createBodies.push(JSON.parse(options.body));
							return jsonResponse({ data: [{ id: `created-${createBodies.length}` }] });
						}

						assert.equal(parsed.searchParams.get('status'), 'enabled');
						return jsonResponse({
							data: [
								{
									type: 'channel.subscribe',
									version: '1',
									condition: { broadcaster_user_id: 'broadcaster-id' },
									transport: { callback },
								},
							],
						});
					}

					assert.fail(`Unexpected Twitch fetch: ${url}`);
				},
				async () => {
					const response = await twitchRegisterHandler({
						httpMethod: 'POST',
						headers: { authorization: 'Bearer register-secret' },
					});
					const body = parseNetlifyJson(response);

					assert.equal(response.statusCode, 200);
					assert.equal(body.ok, true);
					assert.equal(body.callback, callback);
					assert.deepEqual(
						body.results.find((result) => result.type === 'channel.subscribe'),
						{ type: 'channel.subscribe', status: 'already_exists' }
					);
					assert.deepEqual(
						createBodies.map((body) => body.type),
						['channel.follow', 'channel.subscription.gift', 'channel.cheer']
					);

					const followBody = createBodies[0];
					assert.equal(followBody.version, '2');
					assert.deepEqual(followBody.condition, {
						broadcaster_user_id: 'broadcaster-id',
						moderator_user_id: 'broadcaster-id',
					});
					assert.ok(
						createBodies.every((body) => body.transport.callback === callback),
						'all created subscriptions should use the normalized callback URL'
					);
					assert.ok(
						createBodies.every((body) => body.transport.secret === 'webhook-secret'),
						'all created subscriptions should use the webhook EventSub secret'
					);
				}
			);
		}
	);
});
