import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

const twitchRegister = require('../netlify/functions/twitch-register-eventsub.js');
const steamInventory = require('../netlify/functions/steam-cs2-inventory.js');

async function withEnv(overrides, fn) {
	const previous = new Map();
	for (const key of Object.keys(overrides)) {
		previous.set(key, Object.hasOwn(process.env, key) ? process.env[key] : undefined);
		process.env[key] = overrides[key];
	}

	try {
		return await fn();
	} finally {
		for (const [key, value] of previous) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
}

async function withFetch(fakeFetch, fn) {
	const previous = globalThis.fetch;
	globalThis.fetch = fakeFetch;
	try {
		return await fn();
	} finally {
		globalThis.fetch = previous;
	}
}

function parseNetlifyJson(response) {
	return JSON.parse(response.body);
}

test('Twitch EventSub registration rejects unauthorized calls before external requests', async () => {
	let fetchCount = 0;
	await withEnv({ TWITCH_REGISTER_SECRET: 'register-secret' }, async () => {
		await withFetch(async () => {
			fetchCount += 1;
			throw new Error('unauthorized registration should not call fetch');
		}, async () => {
			const response = await twitchRegister.handler({
				httpMethod: 'POST',
				headers: { 'x-twitch-register-secret': 'wrong-secret' },
			});

			assert.equal(response.statusCode, 403);
			assert.deepEqual(parseNetlifyJson(response), { error: 'Forbidden.' });
			assert.equal(fetchCount, 0);
		});
	});
});

test('Twitch EventSub registration accepts case-insensitive numeric secret headers and skips existing subscriptions', async () => {
	const callback = 'https://example.com/.netlify/functions/twitch-eventsub';
	const fetchCalls = [];
	const createBodies = [];

	await withEnv(
		{
			TWITCH_REGISTER_SECRET: '123456',
			TWITCH_CLIENT_ID: 'client-id',
			TWITCH_CLIENT_SECRET: 'client-secret',
			TWITCH_EVENTSUB_SECRET: 'eventsub-secret',
			TWITCH_BROADCASTER_ID: 'broadcaster-1',
			PUBLIC_SITE_URL: 'https://example.com/',
		},
		async () => {
			await withFetch(async (url, options = {}) => {
				const href = String(url);
				fetchCalls.push({ url: href, options });

				if (href === 'https://id.twitch.tv/oauth2/token') {
					return {
						ok: true,
						json: async () => ({ access_token: 'app-token' }),
					};
				}

				if (href.endsWith('/helix/eventsub/subscriptions?status=enabled')) {
					return {
						ok: true,
						status: 200,
						text: async () =>
							JSON.stringify({
								data: [
									{
										type: 'channel.subscribe',
										version: '1',
										transport: { callback },
										condition: { broadcaster_user_id: 'broadcaster-1' },
									},
								],
							}),
					};
				}

				if (href === 'https://api.twitch.tv/helix/eventsub/subscriptions') {
					createBodies.push(JSON.parse(options.body));
					return {
						ok: true,
						status: 202,
						text: async () => JSON.stringify({ data: [] }),
					};
				}

				throw new Error(`Unexpected Twitch fetch: ${href}`);
			}, async () => {
				const response = await twitchRegister.handler({
					httpMethod: 'POST',
					headers: { 'X-Twitch-Register-Secret': 123456 },
				});

				assert.equal(response.statusCode, 200);
				const body = parseNetlifyJson(response);
				assert.equal(body.ok, true);
				assert.equal(body.callback, callback);
				assert.deepEqual(body.results, [
					{ type: 'channel.follow', status: 'created' },
					{ type: 'channel.subscribe', status: 'already_exists' },
					{ type: 'channel.subscription.gift', status: 'created' },
					{ type: 'channel.cheer', status: 'created' },
				]);

				assert.equal(fetchCalls.length, 5);
				assert.equal(createBodies.length, 3);
				assert.deepEqual(
					createBodies.map((body) => body.type),
					['channel.follow', 'channel.subscription.gift', 'channel.cheer']
				);
				assert.equal(createBodies[0].condition.moderator_user_id, 'broadcaster-1');
				for (const createBody of createBodies) {
					assert.equal(createBody.condition.broadcaster_user_id, 'broadcaster-1');
					assert.equal(createBody.transport.callback, callback);
					assert.equal(createBody.transport.secret, 'eventsub-secret');
				}
			});
		}
	);
});

function makeInventoryPayload(itemCount) {
	const assets = [];
	const descriptions = [];

	for (let i = 0; i < itemCount; i += 1) {
		const classid = `class-${i}`;
		assets.push({
			assetid: String(1000 + i),
			classid,
			instanceid: '0',
			amount: '1',
			appid: '730',
			contextid: '2',
		});
		descriptions.push({
			classid,
			instanceid: '0',
			name: `Skin ${i}`,
			market_name: `AK-47 | Regression ${i}`,
			market_hash_name: `AK-47 | Regression ${i}`,
			type: 'Rifle',
			tradable: 1,
			marketable: 1,
			tags: [
				{ category: 'Rarity', localized_tag_name: i % 2 === 0 ? 'Covert' : 'Mil-Spec Grade' },
				{ category: 'Weapon', localized_tag_name: 'AK-47' },
			],
		});
	}

	return {
		success: 1,
		more: false,
		assets,
		descriptions,
	};
}

test('Steam CS2 inventory caps marketplace price lookups while preserving inventory items', async () => {
	const inventoryPayload = makeInventoryPayload(100);
	const priceLookupNames = [];

	await withFetch(async (url) => {
		const href = String(url);

		if (href.includes('/inventory/76561198000000000/730/2?')) {
			return {
				ok: true,
				status: 200,
				text: async () => JSON.stringify(inventoryPayload),
			};
		}

		if (href.startsWith('https://steamcommunity.com/market/priceoverview/')) {
			priceLookupNames.push(new URL(href).searchParams.get('market_hash_name'));
			return {
				ok: true,
				json: async () => ({
					success: true,
					lowest_price: '$123.45',
					median_price: '$100.00',
					volume: '7',
				}),
			};
		}

		throw new Error(`Unexpected Steam fetch: ${href}`);
	}, async () => {
		const response = await steamInventory.handler({
			httpMethod: 'GET',
			queryStringParameters: {
				profile: '76561198000000000',
				count: '250',
				featured: '0',
				limit: '300',
			},
		});

		assert.equal(response.statusCode, 200);
		const body = parseNetlifyJson(response);
		assert.equal(body.ok, true);
		assert.equal(body.totalItems, 100);
		assert.equal(body.items.length, 100);
		assert.equal(priceLookupNames.length, 80);
		assert.equal(new Set(priceLookupNames).size, 80);
		assert.deepEqual(priceLookupNames.slice(0, 3), [
			'AK-47 | Regression 0',
			'AK-47 | Regression 1',
			'AK-47 | Regression 2',
		]);
		assert.equal(body.items[0].pricing.lowestPriceUsd, 123.45);
		assert.equal(body.items[79].pricing.lowestPriceUsd, 123.45);
		assert.equal(body.items[80].pricing, null);
	});
});
