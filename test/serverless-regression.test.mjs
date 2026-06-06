import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

const { handler: twitchRegisterHandler } = require('../netlify/functions/twitch-register-eventsub.js');
const { handler: steamInventoryHandler } = require('../netlify/functions/steam-cs2-inventory.js');

function responseJson(payload, { ok = true, status = 200 } = {}) {
	const body = JSON.stringify(payload);
	return {
		ok,
		status,
		async json() {
			return payload;
		},
		async text() {
			return body;
		},
	};
}

async function withMockedFetch(mockFetch, callback) {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = mockFetch;
	try {
		return await callback();
	} finally {
		globalThis.fetch = originalFetch;
	}
}

async function withEnv(nextEnv, callback) {
	const previous = new Map();
	for (const key of Object.keys(nextEnv)) {
		previous.set(key, process.env[key]);
		process.env[key] = nextEnv[key];
	}

	try {
		return await callback();
	} finally {
		for (const [key, value] of previous) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	}
}

test('Twitch EventSub registration rejects bad register secrets before network calls', async () => {
	await withEnv({ TWITCH_REGISTER_SECRET: 'correct-register-secret' }, async () => {
		await withMockedFetch(async () => {
			assert.fail('unauthorized registration should not call Twitch');
		}, async () => {
			const response = await twitchRegisterHandler({
				httpMethod: 'POST',
				headers: { 'X-Twitch-Register-Secret': 'wrong-register-secret' },
			});

			assert.equal(response.statusCode, 403);
			assert.deepEqual(JSON.parse(response.body), { error: 'Forbidden.' });
		});
	});
});

test('Twitch EventSub registration skips existing subscriptions and creates missing ones', async () => {
	const requests = [];
	const callback = 'https://example.com/.netlify/functions/twitch-eventsub';

	await withEnv(
		{
			TWITCH_REGISTER_SECRET: 'register-secret',
			TWITCH_CLIENT_ID: 'client-id',
			TWITCH_CLIENT_SECRET: 'client-secret',
			TWITCH_EVENTSUB_SECRET: 'eventsub-secret',
			TWITCH_BROADCASTER_ID: 'broadcaster-123',
			PUBLIC_SITE_URL: 'https://example.com/',
		},
		async () => {
			await withMockedFetch(async (url, options = {}) => {
				requests.push({ url: String(url), options });

				if (String(url).includes('/oauth2/token')) {
					return responseJson({ access_token: 'app-token' });
				}

				if (String(url).includes('/helix/eventsub/subscriptions?status=enabled')) {
					return responseJson({
						data: [
							{
								type: 'channel.follow',
								version: '2',
								transport: { callback },
								condition: { broadcaster_user_id: 'broadcaster-123' },
							},
						],
					});
				}

				if (
					String(url) === 'https://api.twitch.tv/helix/eventsub/subscriptions' &&
					options.method === 'POST'
				) {
					return responseJson({ data: [] }, { status: 202 });
				}

				throw new Error(`Unexpected fetch: ${url}`);
			}, async () => {
				const response = await twitchRegisterHandler({
					httpMethod: 'POST',
					headers: { authorization: 'Bearer register-secret' },
				});
				const payload = JSON.parse(response.body);

				assert.equal(response.statusCode, 200);
				assert.equal(payload.callback, callback);
				assert.deepEqual(payload.results, [
					{ type: 'channel.follow', status: 'already_exists' },
					{ type: 'channel.subscribe', status: 'created' },
					{ type: 'channel.subscription.gift', status: 'created' },
					{ type: 'channel.cheer', status: 'created' },
				]);

				const createRequests = requests.filter(
					(request) =>
						request.url === 'https://api.twitch.tv/helix/eventsub/subscriptions' &&
						request.options.method === 'POST'
				);
				assert.equal(createRequests.length, 3);
				assert.deepEqual(
					createRequests.map((request) => JSON.parse(request.options.body).type),
					['channel.subscribe', 'channel.subscription.gift', 'channel.cheer']
				);
			});
		}
	);
});

function steamInventoryPayload(itemCount) {
	const assets = [];
	const descriptions = [];

	for (let i = 0; i < itemCount; i += 1) {
		const classid = String(2000 + i);
		const instanceid = '0';
		const marketHashName = `AK-47 | Regression ${i} (Field-Tested)`;

		assets.push({
			assetid: String(1000 + i),
			appid: 730,
			classid,
			contextid: '2',
			instanceid,
			amount: '1',
		});
		descriptions.push({
			classid,
			instanceid,
			name: marketHashName,
			market_name: marketHashName,
			market_hash_name: marketHashName,
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

test('Steam CS2 inventory pricing caps unique market lookups while returning all requested items', async () => {
	const pricedMarketNames = [];

	await withMockedFetch(async (url) => {
		const requestUrl = new URL(String(url));

		if (requestUrl.pathname.includes('/inventory/')) {
			return responseJson(steamInventoryPayload(85));
		}

		if (requestUrl.pathname === '/market/priceoverview/') {
			const marketHashName = requestUrl.searchParams.get('market_hash_name');
			pricedMarketNames.push(marketHashName);
			return responseJson({
				success: true,
				lowest_price: '$123.45',
				median_price: '$120.00',
				volume: '10',
			});
		}

		throw new Error(`Unexpected fetch: ${url}`);
	}, async () => {
		const response = await steamInventoryHandler({
			httpMethod: 'GET',
			queryStringParameters: {
				profile: '76561198000000000',
				featured: '0',
				limit: '300',
				count: '120',
			},
		});
		const payload = JSON.parse(response.body);

		assert.equal(response.statusCode, 200);
		assert.equal(payload.totalItems, 85);
		assert.equal(payload.items.length, 85);
		assert.equal(pricedMarketNames.length, 80);
		assert.equal(new Set(pricedMarketNames).size, 80);
		assert.deepEqual(payload.items[79].pricing.lowestPriceUsd, 123.45);
		assert.equal(payload.items[80].pricing, null);
	});
});
