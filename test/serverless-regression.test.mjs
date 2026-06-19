import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const require = createRequire(import.meta.url);

const { handler: steamInventoryHandler } = require('../netlify/functions/steam-cs2-inventory.js');
const { handler: twitchRegisterHandler } = require('../netlify/functions/twitch-register-eventsub.js');

const pagesSteamSource = readFileSync(
	new URL('../functions/api/steam-cs2-inventory.js', import.meta.url),
	'utf8'
);
const netlifySteamSource = readFileSync(
	new URL('../netlify/functions/steam-cs2-inventory.js', import.meta.url),
	'utf8'
);
const pagesTwitchRegisterSource = readFileSync(
	new URL('../functions/api/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);
const netlifyTwitchRegisterSource = readFileSync(
	new URL('../netlify/functions/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);

const TWITCH_ENV_KEYS = [
	'TWITCH_REGISTER_SECRET',
	'TWITCH_EVENTSUB_SECRET',
	'TWITCH_CLIENT_ID',
	'TWITCH_CLIENT_SECRET',
	'TWITCH_BROADCASTER_ID',
	'PUBLIC_SITE_URL',
];

function responseJson(payload, status = 200) {
	const body = JSON.stringify(payload);
	return {
		ok: status >= 200 && status < 300,
		status,
		async text() {
			return body;
		},
		async json() {
			return payload;
		},
	};
}

function parseFunctionJson(result) {
	return JSON.parse(result.body);
}

async function withProcessEnv(overrides, callback) {
	const saved = new Map(TWITCH_ENV_KEYS.map((key) => [key, process.env[key]]));

	for (const key of TWITCH_ENV_KEYS) {
		if (Object.prototype.hasOwnProperty.call(overrides, key)) {
			process.env[key] = overrides[key];
		} else {
			delete process.env[key];
		}
	}

	try {
		return await callback();
	} finally {
		for (const [key, value] of saved.entries()) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	}
}

function installFetchMock(implementation) {
	const previousFetch = globalThis.fetch;
	const calls = [];

	globalThis.fetch = async (url, options = {}) => {
		const call = { url: String(url), options };
		calls.push(call);
		return implementation(call.url, options);
	};

	return {
		calls,
		restore() {
			globalThis.fetch = previousFetch;
		},
	};
}

function buildExistingTwitchSubscriptions(callback, broadcasterId) {
	return ['channel.follow', 'channel.subscribe', 'channel.subscription.gift', 'channel.cheer'].map(
		(type) => ({
			type,
			version: type === 'channel.follow' ? '2' : '1',
			condition: { broadcaster_user_id: broadcasterId },
			transport: { callback },
		})
	);
}

function buildSteamInventoryPayload() {
	const assets = [];
	const descriptions = [];

	function pushItem(id, type, marketHashName) {
		assets.push({
			assetid: String(id),
			classid: String(id),
			instanceid: '0',
			amount: '1',
			appid: 730,
			contextid: '2',
		});
		descriptions.push({
			classid: String(id),
			instanceid: '0',
			name: marketHashName,
			market_name: marketHashName,
			market_hash_name: marketHashName,
			type,
			tradable: 1,
			marketable: 1,
			tags: [],
		});
	}

	for (let i = 0; i < 10; i += 1) {
		pushItem(1000 + i, 'Graffiti', `Graffiti Regression ${i}`);
	}
	for (let i = 0; i < 100; i += 1) {
		pushItem(2000 + i, 'Rifle', `AK-47 Regression ${i}`);
	}

	return {
		success: 1,
		more: false,
		assets,
		descriptions,
	};
}

test('Twitch registration rejects unauthorized requests before external calls', async () => {
	await withProcessEnv({ TWITCH_REGISTER_SECRET: 'correct-secret' }, async () => {
		const fetchMock = installFetchMock(() => {
			throw new Error('Unauthorized registration should not call Twitch');
		});

		try {
			const result = await twitchRegisterHandler({
				httpMethod: 'POST',
				headers: { 'x-twitch-register-secret': 'wrong-secret' },
			});

			assert.equal(result.statusCode, 403);
			assert.deepEqual(parseFunctionJson(result), { error: 'Forbidden.' });
			assert.equal(fetchMock.calls.length, 0);
		} finally {
			fetchMock.restore();
		}
	});
});

test('Twitch registration accepts bearer auth and skips subscriptions that already exist', async () => {
	const broadcasterId = '123456789';
	const callback = 'https://example.com/.netlify/functions/twitch-eventsub';

	await withProcessEnv(
		{
			TWITCH_REGISTER_SECRET: 'register-secret',
			TWITCH_EVENTSUB_SECRET: 'eventsub-secret',
			TWITCH_CLIENT_ID: 'client-id',
			TWITCH_CLIENT_SECRET: 'client-secret',
			TWITCH_BROADCASTER_ID: broadcasterId,
			PUBLIC_SITE_URL: 'https://example.com/',
		},
		async () => {
			const fetchMock = installFetchMock((url, options) => {
				if (url === 'https://id.twitch.tv/oauth2/token') {
					assert.equal(options.method, 'POST');
					return responseJson({ access_token: 'app-token' });
				}
				if (url === 'https://api.twitch.tv/helix/eventsub/subscriptions?status=enabled') {
					assert.equal(options.method, 'GET');
					return responseJson({
						data: buildExistingTwitchSubscriptions(callback, broadcasterId),
					});
				}
				throw new Error(`Unexpected Twitch fetch: ${url}`);
			});

			try {
				const result = await twitchRegisterHandler({
					httpMethod: 'POST',
					headers: { Authorization: 'Bearer register-secret' },
				});
				const body = parseFunctionJson(result);

				assert.equal(result.statusCode, 200);
				assert.equal(body.ok, true);
				assert.equal(body.callback, callback);
				assert.deepEqual(
					body.results.map((entry) => entry.status),
					['already_exists', 'already_exists', 'already_exists', 'already_exists']
				);
				assert.equal(fetchMock.calls.length, 2);
			} finally {
				fetchMock.restore();
			}
		}
	);
});

test('Steam inventory caps fetch size and market pricing lookups', async () => {
	const pricingLookups = [];
	const inventoryCounts = [];

	const fetchMock = installFetchMock((url) => {
		if (url.includes('/inventory/76561198000000000/730/2')) {
			const params = new URL(url).searchParams;
			inventoryCounts.push(params.get('count'));
			return responseJson(buildSteamInventoryPayload());
		}

		if (url.startsWith('https://steamcommunity.com/market/priceoverview/')) {
			const params = new URL(url).searchParams;
			pricingLookups.push(params.get('market_hash_name'));
			return responseJson({
				success: true,
				lowest_price: '$123.45',
				median_price: '$120.00',
				volume: '7',
			});
		}

		throw new Error(`Unexpected Steam fetch: ${url}`);
	});

	try {
		const result = await steamInventoryHandler({
			httpMethod: 'GET',
			queryStringParameters: {
				profile: '76561198000000000',
				count: '9999',
				featured: '0',
				limit: '5',
			},
		});
		const body = parseFunctionJson(result);

		assert.equal(result.statusCode, 200);
		assert.deepEqual(inventoryCounts, ['250']);
		assert.equal(body.totalItems, 110);
		assert.equal(pricingLookups.length, 80);
		assert.equal(new Set(pricingLookups).size, 80);
		assert.ok(
			pricingLookups.every((name) => name.startsWith('AK-47 Regression ')),
			'pricing should skip graffiti/unfeatured market-hash items'
		);
	} finally {
		fetchMock.restore();
	}
});

test('Steam pricing caps stay aligned across deployment targets', () => {
	for (const [label, source] of [
		['Pages', pagesSteamSource],
		['Netlify', netlifySteamSource],
	]) {
		assert.match(source, /const MAX_FETCH_COUNT = 250;/, `${label} fetch page size should stay capped`);
		assert.match(source, /const MAX_PRICED_ITEMS = 300;/, `${label} priced item window should stay capped`);
		assert.match(source, /const MAX_PRICE_LOOKUPS = 80;/, `${label} price lookups should stay capped`);
		assert.match(
			source,
			/pricedItems\.slice\(0, MAX_PRICED_ITEMS\)\.map\(\(item\) => item\.marketHashName\)/,
			`${label} should apply the priced item cap before de-duping`
		);
		assert.match(
			source,
			/\]\.slice\(0, MAX_PRICE_LOOKUPS\);/,
			`${label} should cap unique marketplace lookups`
		);
	}
});

test('Twitch registration auth hardening stays aligned across deployment targets', () => {
	for (const [label, source] of [
		['Pages', pagesTwitchRegisterSource],
		['Netlify', netlifyTwitchRegisterSource],
	]) {
		assert.match(source, /a = String\(a\);/, `${label} timing compare should coerce left value`);
		assert.match(source, /b = String\(b\);/, `${label} timing compare should coerce right value`);
		assert.match(source, /REGISTER_SECRET_HEADER = 'x-twitch-register-secret'/);
	}

	assert.ok(
		pagesTwitchRegisterSource.indexOf('if (!isAuthorizedRequest(request, registerSecret))') <
			pagesTwitchRegisterSource.indexOf("clientId = requireEnv(env, 'TWITCH_CLIENT_ID');"),
		'Pages registration should authorize before requiring Twitch credentials'
	);
	assert.ok(
		netlifyTwitchRegisterSource.indexOf('if (!isAuthorizedRequest(event.headers || {}, registerSecret))') <
			netlifyTwitchRegisterSource.indexOf("clientId = requireEnv('TWITCH_CLIENT_ID');"),
		'Netlify registration should authorize before requiring Twitch credentials'
	);
});
