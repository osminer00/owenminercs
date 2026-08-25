import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const paramsStart = source.indexOf('(', start);
	assert.notEqual(paramsStart, -1, `${functionName} should have parameters`);

	let parenDepth = 0;
	let paramsEnd = -1;
	for (let i = paramsStart; i < source.length; i += 1) {
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
	assert.notEqual(paramsEnd, -1, `${functionName} parameter list should close`);

	const braceStart = source.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${functionName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) {
				const prefix = start >= 6 && source.slice(start - 6, start) === 'async ' ? 'async ' : '';
				return prefix + source.slice(start, i + 1);
			}
		}
	}

	assert.fail(`${functionName} body should close`);
}

function readNumericConst(source, name) {
	const match = source.match(new RegExp(`const ${name} = (\\d+);`));
	assert.ok(match, `${name} should be a numeric const`);
	return Number(match[1]);
}

function loadSteamWorkLimiter(relativePath) {
	const source = readWorkspaceFile(relativePath);
	const maxPricedItems = readNumericConst(source, 'MAX_PRICED_ITEMS');
	const maxPriceLookups = readNumericConst(source, 'MAX_PRICE_LOOKUPS');
	const calls = [];

	const sandbox = {
		MAX_PRICED_ITEMS: maxPricedItems,
		MAX_PRICE_LOOKUPS: maxPriceLookups,
		Map,
		Set,
		isSkinLikeItem(item) {
			return Boolean(item?.skin);
		},
		isContainerItem(item) {
			return Boolean(item?.container);
		},
		isCoolItem(item) {
			return Boolean(item?.cool);
		},
		fetchPriceOverview: async (name) => {
			calls.push(name);
			return { lowestPriceUsd: 12, marketHashName: name };
		},
	};

	vm.runInNewContext(
		[
			extractFunction(source, 'extractSteamIdFromXml'),
			extractFunction(source, 'enrichItemsWithPricing'),
			`this.__helpers = { extractSteamIdFromXml, enrichItemsWithPricing };`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, `Steam helpers should load from ${relativePath}`);
	return {
		source,
		maxPricedItems,
		maxPriceLookups,
		calls,
		...sandbox.__helpers,
	};
}

const handlers = [
	'functions/api/steam-cs2-inventory.js',
	'netlify/functions/steam-cs2-inventory.js',
].map((relativePath) => ({ relativePath, ...loadSteamWorkLimiter(relativePath) }));

test('Steam inventory handlers keep the merged pricing work caps', () => {
	for (const handler of handlers) {
		assert.equal(handler.maxPricedItems, 300, `${handler.relativePath} MAX_PRICED_ITEMS`);
		assert.equal(handler.maxPriceLookups, 80, `${handler.relativePath} MAX_PRICE_LOOKUPS`);
		assert.match(
			handler.source,
			/Math\.max\(1, Math\.min\(asNumber\((?:query\.get\('limit'\)|getQueryParam\(event, 'limit'\)), 120\), 300\)\)/
		);
		assert.match(handler.source, /while \(more && pages < MAX_PAGE_COUNT\)/);
	}
});

test('Steam vanity XML parser only accepts a 17-digit steamID64', () => {
	for (const handler of handlers) {
		const { extractSteamIdFromXml } = handler;
		assert.equal(
			extractSteamIdFromXml('<profile><steamID64>76561198000000000</steamID64></profile>'),
			'76561198000000000'
		);
		assert.equal(
			extractSteamIdFromXml('<profile><STEAMID64>76561198000000000</STEAMID64></profile>'),
			'76561198000000000'
		);
		assert.equal(extractSteamIdFromXml('<profile><steamID64>123</steamID64></profile>'), null);
		assert.equal(extractSteamIdFromXml('<profile></profile>'), null);
		assert.equal(extractSteamIdFromXml(''), null);
	}
});

test('enrichItemsWithPricing caps unique market lookups and skips unpriceable rows', async () => {
	for (const handler of handlers) {
		handler.calls.length = 0;

		const extras = [
			{ marketHashName: 'AK-47 | Redline', skin: true },
			{ marketHashName: 'AK-47 | Redline', skin: true },
			{ marketHashName: 'Fracture Case', container: true },
			{ marketHashName: 'P250 | Sand Storm' },
			{ skin: true },
			{ marketHashName: 'Sport Gloves | Vice', cool: true },
		];
		const uniqueSkins = Array.from({ length: handler.maxPriceLookups + 5 }, (_, index) => ({
			marketHashName: `Skin | Unique ${String(index).padStart(3, '0')}`,
			skin: true,
		}));
		const items = [...extras, ...uniqueSkins];

		const enriched = await handler.enrichItemsWithPricing(items);
		const enrichedList = Array.from(enriched);

		assert.equal(handler.calls.length, handler.maxPriceLookups);
		assert.equal(new Set(handler.calls).size, handler.maxPriceLookups);
		assert.ok(handler.calls.includes('AK-47 | Redline'));
		assert.ok(handler.calls.includes('Fracture Case'));
		assert.ok(handler.calls.includes('Sport Gloves | Vice'));
		assert.ok(!handler.calls.includes('P250 | Sand Storm'));
		assert.equal(handler.calls.filter((name) => name === 'AK-47 | Redline').length, 1);

		assert.equal(enrichedList.length, items.length);
		assert.equal(enrichedList[0].pricing.lowestPriceUsd, 12);
		assert.equal(enrichedList[3].pricing, null);

		const unfetched = `Skin | Unique ${String(handler.maxPriceLookups).padStart(3, '0')}`;
		const unfetchedItem = enrichedList.find((item) => item.marketHashName === unfetched);
		assert.ok(unfetchedItem);
		assert.equal(unfetchedItem.pricing, null);
	}
});
