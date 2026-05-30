import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
	handler: twitchRegisterHandler,
} = require('../netlify/functions/twitch-register-eventsub.js');
const { handler: steamInventoryHandler } = require('../netlify/functions/steam-cs2-inventory.js');

function withTemporaryEnv(values, fn) {
	return async (t) => {
		const previous = {};
		for (const key of Object.keys(values)) {
			previous[key] = process.env[key];
			if (values[key] == null) {
				delete process.env[key];
			} else {
				process.env[key] = values[key];
			}
		}

		t.after(() => {
			for (const [key, value] of Object.entries(previous)) {
				if (value == null) {
					delete process.env[key];
				} else {
					process.env[key] = value;
				}
			}
		});

		await fn(t);
	};
}

function stubFetch(t, implementation) {
	const previousFetch = globalThis.fetch;
	globalThis.fetch = implementation;
	t.after(() => {
		globalThis.fetch = previousFetch;
	});
}

const TWITCH_ENV = {
	TWITCH_REGISTER_SECRET: 'register-secret',
	TWITCH_CLIENT_ID: 'client-id',
	TWITCH_CLIENT_SECRET: 'client-secret',
	TWITCH_EVENTSUB_SECRET: 'eventsub-secret',
	TWITCH_BROADCASTER_ID: '123456789',
	PUBLIC_SITE_URL: 'https://owenminercs.com/',
};

test(
	'twitch registration rejects malformed authorization before network calls',
	withTemporaryEnv(TWITCH_ENV, async (t) => {
		let fetchCalls = 0;
		stubFetch(t, async () => {
			fetchCalls += 1;
			throw new Error('unauthorized request should not fetch Twitch');
		});

		const response = await twitchRegisterHandler({
			httpMethod: 'POST',
			headers: {
				authorization: 12345,
			},
		});

		assert.equal(response.statusCode, 403);
		assert.deepEqual(JSON.parse(response.body), { error: 'Forbidden.' });
		assert.equal(fetchCalls, 0);
	})
);

test(
	'twitch registration accepts bearer secret and skips already registered subscriptions',
	withTemporaryEnv(TWITCH_ENV, async (t) => {
		const fetchCalls = [];
		const existingSubscriptions = [
			'channel.follow',
			'channel.subscribe',
			'channel.subscription.gift',
			'channel.cheer',
		].map((type) => ({
			type,
			version: type === 'channel.follow' ? '2' : '1',
			transport: {
				callback: 'https://owenminercs.com/.netlify/functions/twitch-eventsub',
			},
			condition: {
				broadcaster_user_id: '123456789',
			},
		}));

		stubFetch(t, async (url, options = {}) => {
			fetchCalls.push({
				url: String(url),
				method: options.method || 'GET',
				body: options.body,
			});
			if (String(url).includes('/oauth2/token')) {
				return {
					ok: true,
					json: async () => ({ access_token: 'app-token' }),
					text: async () => JSON.stringify({ access_token: 'app-token' }),
				};
			}
			if (String(url).includes('/helix/eventsub/subscriptions?status=enabled')) {
				return {
					ok: true,
					status: 200,
					text: async () => JSON.stringify({ data: existingSubscriptions }),
				};
			}
			throw new Error(`unexpected Twitch fetch: ${url}`);
		});

		const response = await twitchRegisterHandler({
			httpMethod: 'POST',
			headers: {
				authorization: 'Bearer register-secret',
			},
		});
		const body = JSON.parse(response.body);

		assert.equal(response.statusCode, 200);
		assert.equal(body.ok, true);
		assert.deepEqual(
			body.results.map((result) => result.status),
			['already_exists', 'already_exists', 'already_exists', 'already_exists']
		);
		assert.equal(fetchCalls.length, 2);
		assert.equal(
			fetchCalls.filter(
				(call) => call.method === 'POST' && call.url.includes('/eventsub/subscriptions')
			).length,
			0,
			'existing subscriptions should not be recreated'
		);
	})
);

test('steam inventory price enrichment is capped to protect Steam market lookups', async (t) => {
	const ownerSteamId = '76561198000000000';
	const assets = [];
	const descriptions = [];

	for (let i = 0; i < 85; i += 1) {
		const id = String(1000 + i);
		const marketHashName = `AK-47 | Regression Skin ${i} (Field-Tested)`;
		assets.push({
			assetid: id,
			classid: id,
			instanceid: '1',
			amount: '1',
			contextid: '2',
			appid: '730',
		});
		descriptions.push({
			classid: id,
			instanceid: '1',
			name: marketHashName,
			market_name: marketHashName,
			market_hash_name: marketHashName,
			type: 'Rifle',
			tradable: 1,
			marketable: 1,
			tags: [{ category: 'Rarity', localized_tag_name: 'Mil-Spec Grade' }],
		});
	}

	const priceRequests = [];
	stubFetch(t, async (url) => {
		const href = String(url);
		if (href.includes('/inventory/')) {
			return {
				ok: true,
				text: async () =>
					JSON.stringify({
						success: 1,
						more: false,
						assets,
						descriptions,
					}),
			};
		}
		if (href.includes('/market/priceoverview/')) {
			priceRequests.push(new URL(href).searchParams.get('market_hash_name'));
			return {
				ok: true,
				json: async () => ({
					success: true,
					lowest_price: '$12.34',
					median_price: '$12.00',
					volume: '7',
				}),
			};
		}
		throw new Error(`unexpected Steam fetch: ${href}`);
	});

	const response = await steamInventoryHandler({
		httpMethod: 'GET',
		queryStringParameters: {
			profile: ownerSteamId,
			featured: '0',
			limit: '300',
			count: '250',
		},
	});
	const body = JSON.parse(response.body);

	assert.equal(response.statusCode, 200);
	assert.equal(body.ok, true);
	assert.equal(body.totalItems, 85);
	assert.equal(priceRequests.length, 80);
	assert.equal(body.items.filter((item) => item.pricing).length, 80);
	assert.equal(body.items.filter((item) => !item.pricing).length, 5);
});
