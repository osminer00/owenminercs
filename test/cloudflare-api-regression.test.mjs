import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function readProjectFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function jsonResponse(payload, init = {}) {
	return new Response(JSON.stringify(payload), {
		status: init.status || 200,
		headers: { 'content-type': 'application/json', ...(init.headers || {}) },
	});
}

function textResponse(text, init = {}) {
	return new Response(text, {
		status: init.status || 200,
		headers: { 'content-type': 'text/plain', ...(init.headers || {}) },
	});
}

function installFetchMock(t, handler) {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = handler;
	t.after(() => {
		globalThis.fetch = originalFetch;
	});
}

async function loadTwitchRegisterModule() {
	const utilsSource = readProjectFile('functions/api/_twitch-utils.js');
	const utilsUrl = `data:text/javascript;base64,${Buffer.from(utilsSource).toString('base64')}`;
	const helpers = await import(utilsUrl);

	const source = readProjectFile('functions/api/twitch-register-eventsub.js')
		.replace(
			"import { callbackUrl, json, requireEnv, safeJsonParse } from './_twitch-utils';",
			'const { callbackUrl, json, requireEnv, safeJsonParse } = helpers;'
		)
		.replace('export async function onRequestPost', 'async function onRequestPost')
		.replace('export async function onRequest', 'async function onRequest');
	const factory = new Function('helpers', `${source}\nreturn { onRequestPost, onRequest };`);
	return factory(helpers);
}

function loadSteamInventoryModule() {
	const source = readProjectFile('functions/api/steam-cs2-inventory.js')
		.replace('export async function onRequestGet', 'async function onRequestGet')
		.replace('export async function onRequest', 'async function onRequest');
	const factory = new Function(`${source}\nreturn { onRequestGet, onRequest };`);
	return factory();
}

function headerGetter(headers) {
	return {
		get(name) {
			return headers[String(name).toLowerCase()] ?? null;
		},
	};
}

function makeExistingSubscription(type, version, callback) {
	return {
		type,
		version,
		condition: { broadcaster_user_id: 'broadcaster-123' },
		transport: { callback },
	};
}

test('Cloudflare Twitch registration rejects unauthorized requests before Twitch calls', async (t) => {
	const { onRequestPost } = await loadTwitchRegisterModule();
	let fetchCalls = 0;
	installFetchMock(t, async () => {
		fetchCalls += 1;
		throw new Error('Twitch should not be called for unauthorized requests');
	});

	const response = await onRequestPost({
		env: { TWITCH_REGISTER_SECRET: 'expected-secret' },
		request: { headers: headerGetter({ 'x-twitch-register-secret': 'wrong-secret' }) },
	});

	assert.equal(response.status, 403);
	assert.deepEqual(await response.json(), { error: 'Forbidden.' });
	assert.equal(fetchCalls, 0);
});

test('Cloudflare Twitch registration accepts bearer auth and avoids duplicate subscriptions', async (t) => {
	const { onRequestPost } = await loadTwitchRegisterModule();
	const callback = 'https://example.com/api/twitch-eventsub';
	const fetchCalls = [];
	installFetchMock(t, async (url, options = {}) => {
		fetchCalls.push({ url: String(url), options });

		if (String(url) === 'https://id.twitch.tv/oauth2/token') {
			assert.equal(options.method, 'POST');
			return jsonResponse({ access_token: 'app-token' });
		}

		if (String(url).includes('/helix/eventsub/subscriptions?status=enabled')) {
			assert.equal(options.method, 'GET');
			assert.equal(options.headers.Authorization, 'Bearer app-token');
			assert.equal(options.headers['Client-Id'], 'client-123');
			return textResponse(
				JSON.stringify({
					data: [
						makeExistingSubscription('channel.follow', '2', callback),
						makeExistingSubscription('channel.subscribe', '1', callback),
						makeExistingSubscription('channel.subscription.gift', '1', callback),
						makeExistingSubscription('channel.cheer', '1', callback),
					],
				})
			);
		}

		throw new Error(`Unexpected Twitch fetch: ${url}`);
	});

	const response = await onRequestPost({
		env: {
			TWITCH_REGISTER_SECRET: 'register-secret',
			TWITCH_CLIENT_ID: 'client-123',
			TWITCH_CLIENT_SECRET: 'client-secret',
			TWITCH_EVENTSUB_SECRET: 'eventsub-secret',
			TWITCH_BROADCASTER_ID: 'broadcaster-123',
			PUBLIC_SITE_URL: 'https://example.com/',
		},
		request: { headers: headerGetter({ authorization: 'Bearer register-secret' }) },
	});

	assert.equal(response.status, 200);
	const payload = await response.json();
	assert.equal(payload.ok, true);
	assert.equal(payload.callback, callback);
	assert.deepEqual(
		payload.results.map((result) => result.status),
		['already_exists', 'already_exists', 'already_exists', 'already_exists']
	);
	assert.equal(fetchCalls.length, 2, 'duplicate subscriptions should not trigger POST creates');
});

test('Cloudflare CS2 inventory caps unique Steam market price lookups', async (t) => {
	const { onRequestGet } = loadSteamInventoryModule();
	const steamId64 = '76561198000000000';
	const itemCount = 90;
	const inventory = {
		success: 1,
		more: false,
		assets: Array.from({ length: itemCount }, (_, index) => ({
			assetid: `asset-${index}`,
			classid: `class-${index}`,
			instanceid: '0',
			amount: '1',
			appid: 730,
			contextid: 2,
		})),
		descriptions: Array.from({ length: itemCount }, (_, index) => ({
			classid: `class-${index}`,
			instanceid: '0',
			name: `Knife ${index}`,
			market_name: `Knife ${index}`,
			market_hash_name: `Knife ${index}`,
			type: 'Covert Knife',
			tags: [{ category: 'Rarity', localized_tag_name: 'Covert' }],
			tradable: 1,
			marketable: 1,
		})),
	};
	const priceLookups = [];

	installFetchMock(t, async (url) => {
		const href = String(url);
		if (href.startsWith(`https://steamcommunity.com/inventory/${steamId64}/730/2`)) {
			return textResponse(JSON.stringify(inventory));
		}

		if (href.startsWith('https://steamcommunity.com/market/priceoverview/')) {
			const marketHashName = new URL(href).searchParams.get('market_hash_name');
			priceLookups.push(marketHashName);
			return jsonResponse({
				success: true,
				lowest_price: `$${100 + priceLookups.length}.00`,
				median_price: `$${110 + priceLookups.length}.00`,
				volume: '1',
			});
		}

		throw new Error(`Unexpected Steam fetch: ${href}`);
	});

	const response = await onRequestGet({
		request: {
			url: `https://example.com/api/steam-cs2-inventory?profile=${steamId64}&featured=0&limit=300`,
		},
	});

	assert.equal(response.status, 200);
	const payload = await response.json();
	assert.equal(payload.ok, true);
	assert.equal(payload.totalItems, itemCount);
	assert.equal(payload.items.length, itemCount);
	assert.equal(priceLookups.length, 80, 'Steam market lookups should remain capped at 80');
	assert.deepEqual(priceLookups.slice(0, 3), ['Knife 0', 'Knife 1', 'Knife 2']);
	assert.equal(payload.items[79].pricing.lowestPriceUsd, 180);
	assert.equal(payload.items[80].pricing, null);
});
