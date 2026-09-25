import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const STEAM_ID = '76561198000000000';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function textResponse(body, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		async text() {
			return body;
		},
		async json() {
			return JSON.parse(body);
		},
	};
}

function loadCloudflareInventory(fetchImpl) {
	const source = readWorkspaceFile('functions/api/steam-cs2-inventory.js').replaceAll(
		'export async function',
		'async function'
	);
	const sandbox = {
		Response,
		URL,
		URLSearchParams,
		fetch: fetchImpl,
		globalThis: {},
	};
	vm.runInNewContext(`${source}\nglobalThis.__exports = { onRequestGet, onRequest };`, sandbox);
	return sandbox.globalThis.__exports;
}

function loadNetlifyInventory(fetchImpl) {
	const source = readWorkspaceFile('netlify/functions/steam-cs2-inventory.js');
	const exportsObject = {};
	vm.runInNewContext(source, {
		exports: exportsObject,
		URL,
		URLSearchParams,
		fetch: fetchImpl,
	});
	return exportsObject.handler;
}

function catalogItem(partial) {
	return {
		amount: '1',
		copies: 1,
		price: undefined,
		...partial,
	};
}

const FEATURED_CATALOG = [
	catalogItem({
		hash: 'AK-47 | Redline (Field-Tested)',
		type: 'Rifle',
		rarity: 'Classified',
		copies: 2,
		price: { lowest: '$45.00', median: '$50.00' },
	}),
	catalogItem({
		hash: 'Karambit | Doppler (Factory New)',
		type: 'Knife',
		rarity: 'Covert',
		price: { lowest: '$1,200.50', median: '$1,250.00' },
	}),
	catalogItem({
		hash: 'AWP | Dragon Lore (Field-Tested)',
		type: 'Sniper Rifle',
		rarity: 'Covert',
		price: null,
	}),
	catalogItem({
		hash: 'M4A4 | Fade (Factory New)',
		type: 'Rifle',
		rarity: 'Restricted',
		price: { lowest: '$250.00' },
	}),
	catalogItem({
		hash: 'Glock-18 | Water Elemental (Minimal Wear)',
		type: 'Pistol',
		rarity: 'Classified',
		price: { lowest: '$80.00' },
	}),
	catalogItem({
		hash: 'Kilowatt Case',
		type: 'Base Grade Container',
		rarity: 'Base Grade',
		amount: '3',
		price: { lowest: '$0.50' },
	}),
	catalogItem({
		hash: 'Revolution Case',
		type: 'Base Grade Container',
		rarity: 'Base Grade',
		amount: 'nope',
		price: { lowest: '$1.20' },
	}),
	catalogItem({
		hash: 'AK-47 | Slate (Field-Tested)',
		type: 'Rifle',
		rarity: 'Mil-Spec Grade',
		price: { lowest: '', median: '$150.25' },
	}),
	catalogItem({
		hash: 'Sticker | Hello',
		type: 'Sticker',
		rarity: 'High Grade',
		price: { lowest: '$5.00' },
	}),
	catalogItem({
		hash: 'Butterfly Knife | Vanilla',
		type: 'Knife',
		rarity: 'Extraordinary',
		price: { median: '$400.00' },
	}),
];

function inventoryPayloadFrom(items) {
	const assets = [];
	const descriptions = [];
	items.forEach((item, index) => {
		const classid = String(index + 1);
		const copies = item.copies || 1;
		for (let copy = 0; copy < copies; copy += 1) {
			assets.push({
				assetid: `${classid}-${copy}`,
				classid,
				instanceid: '0',
				amount: item.amount,
			});
		}
		descriptions.push({
			classid,
			instanceid: '0',
			name: item.hash,
			market_name: item.hash,
			market_hash_name: item.hash,
			type: item.type,
			tradable: 1,
			marketable: 1,
			tags: [{ category: 'Rarity', localized_tag_name: item.rarity }],
		});
	});
	return { success: 1, more: false, assets, descriptions };
}

function priceTable(items) {
	const table = new Map();
	for (const item of items) {
		if (item.price === undefined) continue;
		table.set(item.hash, item.price);
	}
	return table;
}

function createInventoryFetch(items, calls) {
	const payload = inventoryPayloadFrom(items);
	const prices = priceTable(items);
	return async (url) => {
		const href = String(url);
		calls.push(href);
		if (href.includes('/?xml=1')) {
			return textResponse(`<profile><steamID64>${STEAM_ID}</steamID64></profile>`);
		}
		if (href.includes('/inventory/')) {
			return textResponse(JSON.stringify(payload));
		}
		if (href.includes('/market/priceoverview/')) {
			const name = new URL(href).searchParams.get('market_hash_name');
			const price = prices.get(name);
			if (!price) return textResponse(JSON.stringify({ success: false }));
			return textResponse(
				JSON.stringify({
					success: true,
					lowest_price: price.lowest,
					median_price: price.median,
					volume: '3',
				})
			);
		}
		throw new Error(`Unexpected fetch: ${href}`);
	};
}

function priceNames(calls) {
	return calls
		.filter((href) => href.includes('/market/priceoverview/'))
		.map((href) => new URL(href).searchParams.get('market_hash_name'));
}

async function readHandlerBody(result) {
	if (result && typeof result.json === 'function') {
		return { status: result.status, body: await result.json() };
	}
	return { status: result.statusCode, body: JSON.parse(result.body) };
}

async function invoke(which, fetchImpl, { query = '', method = 'GET', eventQuery = null } = {}) {
	if (which === 'cloudflare') {
		const api = loadCloudflareInventory(fetchImpl);
		if (method !== 'GET') return readHandlerBody(await api.onRequest());
		return readHandlerBody(
			await api.onRequestGet({
				request: { url: `https://owenminercs.com/api/steam-cs2-inventory${query}` },
			})
		);
	}
	const handler = loadNetlifyInventory(fetchImpl);
	const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
	const queryStringParameters = eventQuery || Object.fromEntries(params.entries());
	return readHandlerBody(
		await handler({
			httpMethod: method,
			queryStringParameters,
		})
	);
}

function priced(body, hash) {
	const item = body.items.find((entry) => entry.marketHashName === hash);
	assert.ok(item, `${hash} should be in the response`);
	return item.pricing;
}

test('featured inventory keeps expensive or unpriced cool skins and counts cases', async () => {
	for (const which of ['cloudflare', 'netlify']) {
		const calls = [];
		const { status, body } = await invoke(which, createInventoryFetch(FEATURED_CATALOG, calls), {
			query: `?profile=%20${STEAM_ID}%20&limit=2&expensiveMin=100`,
		});

		assert.equal(status, 200);
		assert.equal(body.ok, true);
		assert.equal(body.profile, ` ${STEAM_ID} `);
		assert.equal(body.steamId64, STEAM_ID);
		assert.equal(body.expensiveMin, 100);
		assert.equal(body.hasMore, false);
		assert.equal(body.totalItems, 11);
		assert.deepEqual(
			body.items.map((item) => item.marketHashName),
			['Karambit | Doppler (Factory New)', 'Butterfly Knife | Vanilla']
		);
		assert.equal(priced(body, 'Karambit | Doppler (Factory New)').lowestPriceUsd, 1200.5);
		assert.equal(priced(body, 'Butterfly Knife | Vanilla').lowestPriceUsd, null);
		assert.equal(priced(body, 'Butterfly Knife | Vanilla').medianPriceUsd, 400);
		assert.deepEqual(body.caseStats, {
			totalCases: 4,
			byName: {
				'Kilowatt Case': 3,
				'Revolution Case': 1,
			},
		});
		assert.deepEqual(priceNames(calls).filter((name) => name === 'AK-47 | Redline (Field-Tested)'), [
			'AK-47 | Redline (Field-Tested)',
		]);
		assert.equal(priceNames(calls).includes('Sticker | Hello'), false);
		assert.equal(
			calls.some((href) => href.includes('/?xml=1')),
			false
		);
	}
});

test('inventory query switches between full list, price floor, and vanity lookup', async () => {
	for (const which of ['cloudflare', 'netlify']) {
		const fullCalls = [];
		const full = await invoke(which, createInventoryFetch(FEATURED_CATALOG, fullCalls), {
			query: '?profile=owen%20miner&featured=0&limit=3&expensiveMin=-20',
		});
		assert.equal(full.status, 200);
		assert.equal(full.body.expensiveMin, 0);
		assert.equal(full.body.totalItems, 11);
		assert.deepEqual(
			full.body.items.map((item) => item.marketHashName),
			[
				'AK-47 | Redline (Field-Tested)',
				'AK-47 | Redline (Field-Tested)',
				'Karambit | Doppler (Factory New)',
			]
		);
		assert.equal(full.body.caseStats.totalCases, 4);
		assert.ok(fullCalls.some((href) => href.includes('/id/owen%20miner/?xml=1')));
		assert.ok(fullCalls.some((href) => href.includes(`/inventory/${STEAM_ID}/730/2`)));

		const strictCalls = [];
		const strict = await invoke(which, createInventoryFetch(FEATURED_CATALOG, strictCalls), {
			query: `?profile=${STEAM_ID}&expensiveMin=300&limit=10`,
		});
		assert.deepEqual(
			strict.body.items.map((item) => item.marketHashName),
			['Karambit | Doppler (Factory New)', 'Butterfly Knife | Vanilla', 'AWP | Dragon Lore (Field-Tested)']
		);
		assert.equal(priced(strict.body, 'AWP | Dragon Lore (Field-Tested)'), null);
	}
});

test('inventory limits clamp and failed Steam lookups do not invent prices', async () => {
	for (const which of ['cloudflare', 'netlify']) {
		const knives = Array.from({ length: 301 }, (_, index) =>
			catalogItem({
				hash: `Knife ${index}`,
				type: 'Knife',
				rarity: 'Covert',
				price: null,
			})
		);
		const cappedCalls = [];
		const capped = await invoke(which, createInventoryFetch(knives, cappedCalls), {
			query: `?profile=${STEAM_ID}&limit=5000`,
		});
		assert.equal(capped.body.totalItems, 301);
		assert.equal(capped.body.items.length, 300);
		assert.equal(priceNames(cappedCalls).length, 80);

		const oneCalls = [];
		const one = await invoke(which, createInventoryFetch(knives.slice(0, 5), oneCalls), {
			query: `?profile=${STEAM_ID}&limit=0`,
		});
		assert.equal(one.body.items.length, 1);

		let pages = 0;
		const pagingCalls = [];
		const pagingFetch = async (url) => {
			const href = String(url);
			pagingCalls.push(href);
			if (!href.includes('/inventory/')) return textResponse(JSON.stringify({ success: false }));
			pages += 1;
			const start = new URL(href).searchParams.get('start_assetid');
			assert.equal(start, pages === 1 ? null : String(pages - 1));
			assert.equal(new URL(href).searchParams.get('count'), '1');
			return textResponse(
				JSON.stringify({
					success: 1,
					more: true,
					last_assetid: String(pages),
					assets: [
						{
							assetid: String(pages),
							classid: '9',
							instanceid: '0',
							amount: '1',
						},
					],
					descriptions: [
						{
							classid: '9',
							instanceid: '0',
							market_hash_name: 'Paged Knife',
							market_name: 'Paged Knife',
							type: 'Knife',
							tags: [{ category: 'Rarity', localized_tag_name: 'Covert' }],
						},
					],
				})
			);
		};
		const paged = await invoke(which, pagingFetch, {
			query: `?profile=${STEAM_ID}&count=0`,
		});
		assert.equal(pages, 8);
		assert.equal(paged.body.totalItems, 8);
		assert.equal(paged.body.hasMore, true);
		assert.equal(priceNames(pagingCalls).length, 1);

		const deniedCalls = [];
		const denied = await invoke(
			which,
			async (url) => {
				deniedCalls.push(String(url));
				return textResponse('private inventory', 403);
			},
			{ query: `?profile=${STEAM_ID}` }
		);
		assert.equal(denied.status, 500);
		assert.equal(denied.body.ok, false);
		assert.equal(denied.body.error, 'Failed to fetch CS2 inventory.');
		assert.match(denied.body.detail, /Steam inventory request failed \(403\)/);
		assert.equal(priceNames(deniedCalls).length, 0);

		const unresolved = await invoke(
			which,
			async () => textResponse('<profile></profile>'),
			{ query: '?profile=missing-vanity' }
		);
		assert.equal(unresolved.status, 500);
		assert.match(unresolved.body.detail, /Could not resolve Steam profile: missing-vanity/);

		const rejected = await invoke(which, async () => textResponse('{}'), { method: 'POST' });
		assert.equal(rejected.status, 405);
		assert.equal(rejected.body.error, 'Method not allowed. Use GET.');
	}
});
