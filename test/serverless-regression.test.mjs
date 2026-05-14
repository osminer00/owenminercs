import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

function readSource(relativePath) {
	return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function loadServerlessModule(
	relativePath,
	fetchImpl = async () => {
		throw new Error('Unexpected fetch call in serverless regression test.');
	}
) {
	const source = readSource(relativePath)
		.replace(/^import\s+[^;]+;\s*/gm, '')
		.replace(/\bexport\s+(async\s+function\s+)/g, '$1')
		.replace(/\bexport\s+(function\s+)/g, '$1');
	const exportsObject = {};
	const moduleObject = { exports: exportsObject };
	const requireStub = (specifier) => {
		if (specifier === './_twitch-utils') {
			return {
				json: () => ({}),
				requireEnv: () => 'test-env-value',
				safeJsonParse: (input, fallback = null) => {
					try {
						return JSON.parse(input);
					} catch {
						return fallback;
					}
				},
			};
		}
		return require(specifier);
	};

	return Function(
		'fetch',
		'exports',
		'module',
		'require',
		`${source}
return {
	timingSafeEqual: typeof timingSafeEqual === 'function' ? timingSafeEqual : undefined,
	isAuthorizedRequest: typeof isAuthorizedRequest === 'function' ? isAuthorizedRequest : undefined,
	enrichItemsWithPricing: typeof enrichItemsWithPricing === 'function' ? enrichItemsWithPricing : undefined,
};`
	)(fetchImpl, exportsObject, moduleObject, requireStub);
}

const twitchRegistrationTargets = [
	{
		label: 'Cloudflare Pages',
		path: '../functions/api/twitch-register-eventsub.js',
		isAuthorized(moduleApi, headers, expectedSecret) {
			const normalizedHeaders = new Map(
				Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value])
			);
			return moduleApi.isAuthorizedRequest(
				{
					headers: {
						get(name) {
							return normalizedHeaders.get(String(name).toLowerCase()) || '';
						},
					},
				},
				expectedSecret
			);
		},
	},
	{
		label: 'Netlify',
		path: '../netlify/functions/twitch-register-eventsub.js',
		isAuthorized(moduleApi, headers, expectedSecret) {
			return moduleApi.isAuthorizedRequest(headers, expectedSecret);
		},
	},
];

for (const target of twitchRegistrationTargets) {
	test(`${target.label} Twitch registration authorization accepts header and bearer secrets`, () => {
		const moduleApi = loadServerlessModule(target.path);

		assert.equal(
			target.isAuthorized(
				moduleApi,
				{ 'X-Twitch-Register-Secret': 'correct-secret' },
				'correct-secret'
			),
			true
		);
		assert.equal(
			target.isAuthorized(
				moduleApi,
				{ authorization: 'Bearer correct-secret' },
				'correct-secret'
			),
			true
		);
		assert.equal(
			target.isAuthorized(
				moduleApi,
				{ authorization: 'Basic correct-secret' },
				'correct-secret'
			),
			false
		);
	});

	test(`${target.label} Twitch registration authorization rejects mismatched non-string secrets`, () => {
		const moduleApi = loadServerlessModule(target.path);

		assert.equal(moduleApi.timingSafeEqual(123, 456), false);
		assert.equal(moduleApi.timingSafeEqual(123, '123'), true);
		assert.equal(
			target.isAuthorized(moduleApi, { 'x-twitch-register-secret': 123 }, 456),
			false
		);
		assert.equal(
			target.isAuthorized(moduleApi, { 'x-twitch-register-secret': 'wrong' }, 'correct'),
			false
		);
		assert.equal(target.isAuthorized(moduleApi, {}, 'correct'), false);
	});
}

const steamInventoryTargets = [
	{
		label: 'Cloudflare Pages',
		path: '../functions/api/steam-cs2-inventory.js',
	},
	{
		label: 'Netlify',
		path: '../netlify/functions/steam-cs2-inventory.js',
	},
];

function makeSkinItem(marketHashName) {
	return {
		marketHashName,
		marketName: marketHashName,
		type: 'Rifle',
		rarity: 'Classified',
	};
}

function makePricingFetch(calls) {
	return async (url) => {
		calls.push(new URL(url).searchParams.get('market_hash_name'));
		return {
			ok: true,
			async json() {
				return {
					success: true,
					lowest_price: '$1.25',
					median_price: '$1.30',
					volume: '7',
				};
			},
		};
	};
}

for (const target of steamInventoryTargets) {
	test(`${target.label} Steam inventory pricing caps market lookups at 80 unique names`, async () => {
		const calls = [];
		const moduleApi = loadServerlessModule(target.path, makePricingFetch(calls));
		const items = Array.from({ length: 100 }, (_, index) =>
			makeSkinItem(`AK-47 | Test ${index}`)
		);

		const enriched = await moduleApi.enrichItemsWithPricing(items);

		assert.equal(calls.length, 80);
		assert.deepEqual(
			calls,
			items.slice(0, 80).map((item) => item.marketHashName)
		);
		assert.equal(enriched[0].pricing.lowestPriceUsd, 1.25);
		assert.equal(enriched[79].pricing.lowestPriceUsd, 1.25);
		assert.equal(enriched[80].pricing, null);
	});

	test(`${target.label} Steam inventory pricing only considers the first 300 priced items`, async () => {
		const calls = [];
		const moduleApi = loadServerlessModule(target.path, makePricingFetch(calls));
		const firstPricedItems = Array.from({ length: 300 }, (_, index) =>
			makeSkinItem(index % 2 === 0 ? 'Shared Market Name A' : 'Shared Market Name B')
		);
		const latePricedItems = Array.from({ length: 20 }, (_, index) =>
			makeSkinItem(`Late Market Name ${index}`)
		);

		const enriched = await moduleApi.enrichItemsWithPricing([
			...firstPricedItems,
			...latePricedItems,
		]);

		assert.deepEqual(calls, ['Shared Market Name A', 'Shared Market Name B']);
		assert.equal(enriched[0].pricing.lowestPriceUsd, 1.25);
		assert.equal(enriched[299].pricing.lowestPriceUsd, 1.25);
		assert.equal(enriched[300].pricing, null);
	});
}
