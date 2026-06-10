import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

const twitchRegister = require('../netlify/functions/twitch-register-eventsub.js');
const steamInventory = require('../netlify/functions/steam-cs2-inventory.js');

const TWITCH_ENV_KEYS = [
	'TWITCH_REGISTER_SECRET',
	'TWITCH_EVENTSUB_SECRET',
	'TWITCH_CLIENT_ID',
	'TWITCH_CLIENT_SECRET',
	'TWITCH_BROADCASTER_ID',
	'PUBLIC_SITE_URL',
];

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
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

function withFetchMock(mock, run) {
	const previousFetch = globalThis.fetch;
	globalThis.fetch = mock;
	return Promise.resolve()
		.then(run)
		.finally(() => {
			globalThis.fetch = previousFetch;
		});
}

function withTwitchEnv(values, run) {
	const previous = new Map(TWITCH_ENV_KEYS.map((key) => [key, process.env[key]]));
	for (const key of TWITCH_ENV_KEYS) delete process.env[key];
	Object.assign(process.env, values);

	return Promise.resolve()
		.then(run)
		.finally(() => {
			for (const key of TWITCH_ENV_KEYS) {
				const oldValue = previous.get(key);
				if (oldValue === undefined) delete process.env[key];
				else process.env[key] = oldValue;
			}
		});
}

function parseBody(response) {
	return JSON.parse(response.body);
}

test('Twitch EventSub registration rejects unauthorized requests before external calls', async () => {
	await withTwitchEnv(
		{
			TWITCH_REGISTER_SECRET: 'register-secret',
			TWITCH_EVENTSUB_SECRET: 'eventsub-secret',
			TWITCH_CLIENT_ID: 'client-id',
			TWITCH_CLIENT_SECRET: 'client-secret',
			TWITCH_BROADCASTER_ID: '12345',
			PUBLIC_SITE_URL: 'https://owenminercs.com',
		},
		async () => {
			let fetchCalls = 0;
			await withFetchMock(
				async () => {
					fetchCalls += 1;
					return jsonResponse({});
				},
				async () => {
					const response = await twitchRegister.handler({
						httpMethod: 'POST',
						headers: { authorization: 'Bearer wrong-secret' },
					});

					assert.equal(response.statusCode, 403);
					assert.deepEqual(parseBody(response), { error: 'Forbidden.' });
					assert.equal(
						fetchCalls,
						0,
						'unauthorized registration must not call Twitch APIs'
					);
				}
			);
		}
	);
});

test('Twitch EventSub registration accepts custom header secrets case-insensitively', async () => {
	await withTwitchEnv(
		{
			TWITCH_REGISTER_SECRET: 'register-secret',
			TWITCH_EVENTSUB_SECRET: 'eventsub-secret',
			TWITCH_CLIENT_ID: 'client-id',
			TWITCH_CLIENT_SECRET: 'client-secret',
			TWITCH_BROADCASTER_ID: '12345',
			PUBLIC_SITE_URL: 'https://owenminercs.com/',
		},
		async () => {
			const requests = [];
			await withFetchMock(
				async (url, options = {}) => {
					requests.push({ url: String(url), options });
					if (String(url).includes('oauth2/token')) {
						return jsonResponse({ access_token: 'app-token' });
					}
					if (String(url).includes('eventsub/subscriptions?status=enabled')) {
						return jsonResponse({
							data: [
								{
									type: 'channel.follow',
									version: '2',
									condition: { broadcaster_user_id: '12345' },
									transport: {
										callback:
											'https://owenminercs.com/.netlify/functions/twitch-eventsub',
									},
								},
							],
						});
					}
					return jsonResponse(
						{ data: [{ id: 'created-subscription' }] },
						{ status: 202 }
					);
				},
				async () => {
					const response = await twitchRegister.handler({
						httpMethod: 'POST',
						headers: { 'X-Twitch-Register-Secret': 'register-secret' },
					});
					const body = parseBody(response);
					const createRequests = requests.filter(
						(request) =>
							request.url.includes('eventsub/subscriptions') &&
							request.options.method === 'POST' &&
							request.options.body
					);

					assert.equal(response.statusCode, 200);
					assert.equal(body.ok, true);
					assert.equal(
						body.callback,
						'https://owenminercs.com/.netlify/functions/twitch-eventsub'
					);
					assert.deepEqual(
						body.results.map((result) => [result.type, result.status]),
						[
							['channel.follow', 'already_exists'],
							['channel.subscribe', 'created'],
							['channel.subscription.gift', 'created'],
							['channel.cheer', 'created'],
						]
					);
					assert.equal(
						createRequests.length,
						3,
						'only missing subscriptions should be created'
					);
					assert.equal(
						createRequests[0].options.headers.Authorization,
						'Bearer app-token',
						'created subscriptions should use the fetched app token'
					);
				}
			);
		}
	);
});

test('Steam CS2 inventory clamps page size and caps market price fan-out', async () => {
	const itemCount = 95;
	const assets = Array.from({ length: itemCount }, (_, index) => ({
		assetid: String(1000 + index),
		classid: String(2000 + index),
		instanceid: '0',
		amount: '1',
	}));
	const descriptions = assets.map((asset, index) => ({
		classid: asset.classid,
		instanceid: asset.instanceid,
		name: `Regression Skin ${index}`,
		market_name: `Regression Skin ${index}`,
		market_hash_name: `Regression Skin ${index}`,
		type: 'Rifle',
		marketable: 1,
		tradable: 1,
		tags: [{ category: 'Rarity', localized_tag_name: 'Covert' }],
	}));
	const calls = [];

	await withFetchMock(
		async (url) => {
			const href = String(url);
			calls.push(href);
			if (href.includes('/inventory/')) {
				return {
					ok: true,
					status: 200,
					async text() {
						return JSON.stringify({ success: 1, more: false, assets, descriptions });
					},
				};
			}
			if (href.includes('/market/priceoverview/')) {
				return jsonResponse({
					success: true,
					lowest_price: '$123.45',
					median_price: '$125.00',
					volume: '7',
				});
			}
			throw new Error(`Unexpected fetch URL: ${href}`);
		},
		async () => {
			const response = await steamInventory.handler({
				httpMethod: 'GET',
				queryStringParameters: {
					profile: '76561198000000000',
					count: '999',
					featured: '0',
					limit: '5',
				},
			});
			const body = parseBody(response);
			const inventoryCalls = calls.filter((url) => url.includes('/inventory/'));
			const priceCalls = calls.filter((url) => url.includes('/market/priceoverview/'));
			const inventoryUrl = new URL(inventoryCalls[0]);

			assert.equal(response.statusCode, 200);
			assert.equal(body.ok, true);
			assert.equal(body.totalItems, itemCount);
			assert.equal(
				body.items.length,
				5,
				'response limit should still apply after pricing enrichment'
			);
			assert.equal(
				inventoryUrl.searchParams.get('count'),
				'250',
				'page size should be clamped'
			);
			assert.equal(priceCalls.length, 80, 'market price lookups should stay capped');
			assert.match(priceCalls[0], /Regression\+Skin\+0/);
			assert.match(priceCalls.at(-1), /Regression\+Skin\+79/);
		}
	);
});
