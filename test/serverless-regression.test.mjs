import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const cloudflareTwitchRegisterSource = readFileSync(
	new URL('../functions/api/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);
const netlifyTwitchRegisterSource = readFileSync(
	new URL('../netlify/functions/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);

function extractFunction(source, functionName) {
	const pattern = new RegExp(`(?:async\\s+)?function\\s+${functionName}\\s*\\(`);
	const match = pattern.exec(source);
	assert.ok(match, `${functionName} should exist`);

	let parenDepth = 0;
	let paramsEnd = -1;
	for (let i = source.indexOf('(', match.index); i < source.length; i += 1) {
		const char = source[i];
		if (char === '(') parenDepth += 1;
		if (char === ')') {
			parenDepth -= 1;
			if (parenDepth === 0) {
				paramsEnd = i;
				break;
			}
		}
	}
	assert.notEqual(paramsEnd, -1, `${functionName} parameters should close`);

	const braceStart = source.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${functionName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(match.index, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function buildCloudflareRegisterAuth() {
	return new Function(`
		const REGISTER_SECRET_HEADER = 'x-twitch-register-secret';
		${extractFunction(cloudflareTwitchRegisterSource, 'timingSafeEqual')}
		${extractFunction(cloudflareTwitchRegisterSource, 'isAuthorizedRequest')}
		return { timingSafeEqual, isAuthorizedRequest };
	`)();
}

function buildNetlifyRegisterAuth() {
	return new Function(`
		const REGISTER_SECRET_HEADER = 'x-twitch-register-secret';
		${extractFunction(netlifyTwitchRegisterSource, 'timingSafeEqual')}
		${extractFunction(netlifyTwitchRegisterSource, 'getHeader')}
		${extractFunction(netlifyTwitchRegisterSource, 'isAuthorizedRequest')}
		return { timingSafeEqual, isAuthorizedRequest };
	`)();
}

function fakeCloudflareRequest(headers) {
	return {
		headers: {
			get(name) {
				return headers[String(name).toLowerCase()] || '';
			},
		},
	};
}

function makeInventoryPayload(count) {
	return {
		success: 1,
		more: false,
		assets: Array.from({ length: count }, (_, index) => ({
			assetid: String(1000 + index),
			classid: String(2000 + index),
			instanceid: '0',
			amount: '1',
		})),
		descriptions: Array.from({ length: count }, (_, index) => ({
			classid: String(2000 + index),
			instanceid: '0',
			name: `Skin ${index}`,
			market_name: `Skin ${index}`,
			market_hash_name: `Unique Rifle Skin ${index}`,
			type: 'Rifle',
			tradable: 1,
			marketable: 1,
			tags: [],
		})),
	};
}

test('Twitch registration auth compares non-string secrets safely in both runtimes', () => {
	const cloudflareAuth = buildCloudflareRegisterAuth();
	const netlifyAuth = buildNetlifyRegisterAuth();

	assert.equal(cloudflareAuth.timingSafeEqual(1234, '1234'), true);
	assert.equal(netlifyAuth.timingSafeEqual(1234, '1234'), true);
	assert.equal(
		cloudflareAuth.isAuthorizedRequest(
			fakeCloudflareRequest({ authorization: 'Bearer 1234' }),
			1234
		),
		true
	);
	assert.equal(netlifyAuth.isAuthorizedRequest({ authorization: 'Bearer 1234' }, 1234), true);
	assert.equal(
		cloudflareAuth.isAuthorizedRequest(
			fakeCloudflareRequest({ 'x-twitch-register-secret': 'wrong' }),
			1234
		),
		false
	);
	assert.equal(netlifyAuth.isAuthorizedRequest({ 'x-twitch-register-secret': 'wrong' }, 1234), false);
});

test('Netlify Steam inventory handler caps market price lookups at 80 unique names', async () => {
	const { handler } = require('../netlify/functions/steam-cs2-inventory.js');
	const originalFetch = globalThis.fetch;
	const priceUrls = [];
	const inventoryPayload = makeInventoryPayload(90);

	globalThis.fetch = async (url) => {
		const href = String(url);
		if (href.includes('/inventory/')) {
			return {
				ok: true,
				async text() {
					return JSON.stringify(inventoryPayload);
				},
			};
		}
		if (href.includes('/market/priceoverview/')) {
			priceUrls.push(href);
			return {
				ok: true,
				async json() {
					return { success: true, lowest_price: '$1.23', median_price: '$1.50' };
				},
			};
		}
		assert.fail(`unexpected fetch: ${href}`);
	};

	try {
		const response = await handler({
			httpMethod: 'GET',
			queryStringParameters: {
				profile: '76561198000000000',
				featured: '0',
				limit: '300',
			},
		});
		const payload = JSON.parse(response.body);

		assert.equal(response.statusCode, 200);
		assert.equal(priceUrls.length, 80);
		assert.equal(new Set(priceUrls).size, 80, 'price lookups should be deduplicated by market hash');
		assert.equal(payload.totalItems, 90);
		assert.equal(payload.items.length, 90);
		assert.equal(payload.items.filter((item) => item.pricing).length, 80);
		assert.equal(payload.items.filter((item) => item.pricing === null).length, 10);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
