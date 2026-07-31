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
			if (depth === 0) return source.slice(start, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function loadSteamHelpers(relativePath) {
	const source = readWorkspaceFile(relativePath);
	const sandbox = {
		String,
		Boolean,
		Number,
		Array,
		Map,
		Set,
		Math,
		Object,
		Number: Number,
		COOL_RARITY: new Set(['Covert', 'Extraordinary', 'Contraband']),
		CS2_APP_ID: 730,
		CS2_CONTEXT_ID: 2,
	};

	vm.runInNewContext(
		[
			'const COOL_RARITY = new Set(["Covert", "Extraordinary", "Contraband"]);',
			'const CS2_APP_ID = 730;',
			'const CS2_CONTEXT_ID = 2;',
			extractFunction(source, 'asNumber'),
			extractFunction(source, 'looksLikeSteamId64'),
			extractFunction(source, 'firstTagValue'),
			extractFunction(source, 'isContainerItem'),
			extractFunction(source, 'isSkinLikeItem'),
			extractFunction(source, 'isCoolItem'),
			extractFunction(source, 'parseMarketPrice'),
			extractFunction(source, 'normalizeInspectLink'),
			extractFunction(source, 'mapInventoryItems'),
			`this.__helpers = {
				asNumber,
				looksLikeSteamId64,
				firstTagValue,
				isContainerItem,
				isSkinLikeItem,
				isCoolItem,
				parseMarketPrice,
				normalizeInspectLink,
				mapInventoryItems,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, `helpers should load from ${relativePath}`);
	return sandbox.__helpers;
}

const cloudflareHelpers = loadSteamHelpers('functions/api/steam-cs2-inventory.js');
const netlifyHelpers = loadSteamHelpers('netlify/functions/steam-cs2-inventory.js');

test('Steam inventory caps stay aligned across Cloudflare and Netlify handlers', () => {
	const cloudflare = readWorkspaceFile('functions/api/steam-cs2-inventory.js');
	const netlify = readWorkspaceFile('netlify/functions/steam-cs2-inventory.js');

	for (const constant of [
		'MAX_PAGE_COUNT = 8',
		'MAX_FETCH_COUNT = 250',
		'MAX_PRICED_ITEMS = 300',
		'MAX_PRICE_LOOKUPS = 80',
		"COOL_RARITY = new Set(['Covert', 'Extraordinary', 'Contraband'])",
	]) {
		assert.match(cloudflare, new RegExp(constant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
		assert.match(netlify, new RegExp(constant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
	}
});

test('Steam item classifiers identify cool skins, containers, and skin-like weapons', () => {
	for (const helpers of [cloudflareHelpers, netlifyHelpers]) {
		const { isCoolItem, isContainerItem, isSkinLikeItem } = helpers;

		assert.equal(isCoolItem({ rarity: 'Covert', marketName: 'AK-47 | Redline' }), true);
		assert.equal(isCoolItem({ type: 'Knife', marketName: 'Karambit' }), true);
		assert.equal(isCoolItem({ type: 'Gloves', marketName: 'Sport Gloves' }), true);
		assert.equal(isCoolItem({ marketName: 'AWP | Dragon Lore' }), true);
		assert.equal(isCoolItem({ marketName: 'M4A4 | Howl' }), true);
		assert.equal(isCoolItem({ marketName: 'AK-47 | Case Hardened' }), true);
		assert.equal(isCoolItem({ rarity: 'Mil-Spec Grade', marketName: 'P250 | Sand Storm' }), false);

		assert.equal(isContainerItem({ type: 'Base Grade Container', marketName: 'Fracture Case' }), true);
		assert.equal(isContainerItem({ marketName: 'Sticker Capsule' }), true);
		assert.equal(isContainerItem({ marketName: 'Souvenir Package' }), true);
		assert.equal(isContainerItem({ type: 'Rifle', marketName: 'AK-47 | Redline' }), false);

		assert.equal(isSkinLikeItem({ type: 'Covert Knife' }), true);
		assert.equal(isSkinLikeItem({ type: 'Extraordinary Gloves' }), true);
		assert.equal(isSkinLikeItem({ type: 'Classified Rifle' }), true);
		assert.equal(isSkinLikeItem({ type: 'Restricted Pistol' }), true);
		assert.equal(isSkinLikeItem({ type: 'Base Grade Container' }), false);
	}
});

test('Steam market price parser accepts USD formats and rejects empty junk', () => {
	for (const helpers of [cloudflareHelpers, netlifyHelpers]) {
		const { parseMarketPrice, looksLikeSteamId64, asNumber } = helpers;

		assert.equal(parseMarketPrice('$12.34'), 12.34);
		assert.equal(parseMarketPrice('$1,234.56'), 1234.56);
		assert.equal(parseMarketPrice(null), null);
		assert.equal(parseMarketPrice('not-a-price'), null);
		assert.equal(parseMarketPrice('$$$'), null);

		assert.equal(looksLikeSteamId64('76561198000000000'), true);
		assert.equal(looksLikeSteamId64(' 76561198000000000 '), true);
		assert.equal(looksLikeSteamId64('vanity-name'), false);
		assert.equal(looksLikeSteamId64('123'), false);

		assert.equal(asNumber('12', 0), 12);
		assert.equal(asNumber('nope', 7), 7);
		assert.equal(asNumber(undefined, 3), 3);
	}
});

test('Steam inspect-link tokens and inventory mapping stay deterministic', () => {
	for (const helpers of [cloudflareHelpers, netlifyHelpers]) {
		const { normalizeInspectLink, mapInventoryItems, firstTagValue } = helpers;

		const resolved = normalizeInspectLink(
			'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S%owner_steamid%A%assetid%D123',
			{ assetid: '999', contextid: '2', appid: 730 },
			'76561198000000000'
		);
		assert.equal(
			resolved,
			'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198000000000A999D123'
		);
		assert.equal(normalizeInspectLink(null, {}, '1'), null);

		assert.equal(
			firstTagValue(
				[
					{ category: 'Rarity', localized_tag_name: 'Covert' },
					{ category: 'Weapon', localized_tag_name: 'AWP' },
				],
				'rarity'
			),
			'Covert'
		);
		assert.equal(firstTagValue(null, 'Rarity'), null);

		const mapped = mapInventoryItems(
			{
				assets: [{ assetid: '42', classid: '10', instanceid: '0', amount: '2' }],
				descriptions: [
					{
						classid: '10',
						instanceid: '0',
						name: 'AWP | Fade',
						market_name: 'AWP | Fade (Factory New)',
						market_hash_name: 'AWP | Fade (Factory New)',
						type: 'Covert Sniper Rifle',
						icon_url: 'icon-hash',
						tradable: 1,
						marketable: 1,
						tags: [
							{ category: 'Rarity', localized_tag_name: 'Covert' },
							{ category: 'Weapon', localized_tag_name: 'AWP' },
							{ category: 'Exterior', localized_tag_name: 'Factory New' },
						],
						actions: [
							{
								name: 'Inspect in Game...',
								link: 'steam://preview/%owner_steamid%/%assetid%',
							},
						],
					},
				],
			},
			'76561198000000000'
		);

		assert.equal(mapped.length, 1);
		assert.equal(mapped[0].assetId, '42');
		assert.equal(mapped[0].amount, 2);
		assert.equal(mapped[0].marketName, 'AWP | Fade (Factory New)');
		assert.equal(mapped[0].rarity, 'Covert');
		assert.equal(mapped[0].weapon, 'AWP');
		assert.equal(mapped[0].exterior, 'Factory New');
		assert.equal(mapped[0].inspectLink, 'steam://preview/76561198000000000/42');
		assert.equal(
			mapped[0].iconUrl,
			'https://community.cloudflare.steamstatic.com/economy/image/icon-hash/360fx360f'
		);
		assert.equal(mapped[0].tradable, true);
		assert.equal(mapped[0].marketable, true);
	}
});
