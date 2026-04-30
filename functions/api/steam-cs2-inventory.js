const DEFAULT_PROFILE = 'putaWinfrontofsteamlilbro';
const STEAM_COMMUNITY_BASE = 'https://steamcommunity.com';
const CS2_APP_ID = 730;
const CS2_CONTEXT_ID = 2;
const MAX_PAGE_COUNT = 8;
const MAX_FETCH_COUNT = 250;
const MAX_PRICED_ITEMS = 300;
const MAX_PRICE_LOOKUPS = 80;
const DEFAULT_EXPENSIVE_MIN = 100;
const PRICE_CURRENCY_USD = 1;
const MARKET_PRICE_ENDPOINT = `${STEAM_COMMUNITY_BASE}/market/priceoverview/`;
const COOL_RARITY = new Set(['Covert', 'Extraordinary', 'Contraband']);

function json(payload, status = 200, extraHeaders = {}) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: {
			'content-type': 'application/json; charset=utf-8',
			'cache-control': 'public, max-age=300, s-maxage=300',
			...extraHeaders,
		},
	});
}

function asNumber(value, fallback) {
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function looksLikeSteamId64(value) {
	return /^\d{17}$/.test(String(value || '').trim());
}

function firstTagValue(tags, category) {
	const entry = Array.isArray(tags)
		? tags.find((tag) => String(tag?.category || '').toLowerCase() === category.toLowerCase())
		: null;
	return entry?.localized_tag_name || null;
}

function isContainerItem(item) {
	const type = String(item?.type || '').toLowerCase();
	const marketName = String(item?.marketName || '').toLowerCase();
	return (
		type.includes('container') ||
		type.includes('case') ||
		marketName.includes('case') ||
		marketName.includes('capsule') ||
		marketName.includes('souvenir package')
	);
}

function isSkinLikeItem(item) {
	const type = String(item?.type || '').toLowerCase();
	return (
		type.includes('knife') ||
		type.includes('gloves') ||
		type.includes('rifle') ||
		type.includes('sniper') ||
		type.includes('pistol') ||
		type.includes('submachine gun') ||
		type.includes('shotgun') ||
		type.includes('machinegun')
	);
}

function isCoolItem(item) {
	const name = String(item?.marketName || '').toLowerCase();
	const rarity = String(item?.rarity || '');
	const type = String(item?.type || '').toLowerCase();
	return (
		COOL_RARITY.has(rarity) ||
		type.includes('knife') ||
		type.includes('gloves') ||
		name.includes('doppler') ||
		name.includes('fade') ||
		name.includes('slaughter') ||
		name.includes('case hardened') ||
		name.includes('crimson web') ||
		name.includes('dragon lore') ||
		name.includes('howl')
	);
}

function parseMarketPrice(priceText) {
	if (!priceText) return null;
	const cleaned = String(priceText).replace(/[^0-9.,]/g, '');
	if (!cleaned) return null;
	if (cleaned.includes(',') && cleaned.includes('.')) {
		const normalized = cleaned.replace(/,/g, '');
		const amount = Number.parseFloat(normalized);
		return Number.isFinite(amount) ? amount : null;
	}
	const normalized = cleaned.replace(/,/g, '');
	const amount = Number.parseFloat(normalized);
	return Number.isFinite(amount) ? amount : null;
}

async function fetchText(url) {
	const response = await fetch(url);
	const text = await response.text();
	if (!response.ok) {
		throw new Error(`Steam request failed (${response.status}) for ${url}`);
	}
	return text;
}

function extractSteamIdFromXml(xmlText) {
	const match = xmlText.match(/<steamID64>(\d{17})<\/steamID64>/i);
	return match?.[1] || null;
}

async function resolveSteamId64(profile) {
	if (looksLikeSteamId64(profile)) return String(profile).trim();
	const vanity = encodeURIComponent(String(profile || DEFAULT_PROFILE).trim());
	const xml = await fetchText(`${STEAM_COMMUNITY_BASE}/id/${vanity}/?xml=1`);
	const steamId64 = extractSteamIdFromXml(xml);
	if (!steamId64) throw new Error(`Could not resolve Steam profile: ${profile}`);
	return steamId64;
}

function normalizeInspectLink(link, asset, ownerSteamId) {
	if (!link) return null;
	let resolved = String(link);
	const replacements = {
		'%assetid%': String(asset?.assetid || ''),
		'%owner_steamid%': String(ownerSteamId || ''),
		'%contextid%': String(asset?.contextid || CS2_CONTEXT_ID),
		'%appid%': String(asset?.appid || CS2_APP_ID),
		'%propid:6%': String(asset?.assetid || ''),
		'%propid:7%': String(asset?.assetid || ''),
		'%propid:1%': String(ownerSteamId || ''),
	};
	for (const [token, replacement] of Object.entries(replacements)) {
		resolved = resolved.replaceAll(token, replacement);
	}
	return resolved;
}

function mapInventoryItems(payload, ownerSteamId) {
	const assets = Array.isArray(payload?.assets) ? payload.assets : [];
	const descriptions = Array.isArray(payload?.descriptions) ? payload.descriptions : [];
	const descriptionByClass = new Map();
	for (const desc of descriptions) {
		descriptionByClass.set(`${desc.classid}:${desc.instanceid}`, desc);
	}
	return assets.map((asset) => {
		const key = `${asset.classid}:${asset.instanceid}`;
		const desc = descriptionByClass.get(key) || {};
		const actions = Array.isArray(desc.actions) ? desc.actions : [];
		const inspectAction = actions.find((action) => /inspect/i.test(String(action?.name || '')));
		const inspectLink = normalizeInspectLink(inspectAction?.link || null, asset, ownerSteamId);
		const icon = desc.icon_url
			? `https://community.cloudflare.steamstatic.com/economy/image/${desc.icon_url}/360fx360f`
			: null;
		return {
			assetId: asset.assetid || null,
			classId: asset.classid || null,
			instanceId: asset.instanceid || null,
			amount: asNumber(asset.amount, 1),
			name: desc.name || null,
			marketName: desc.market_name || desc.market_hash_name || desc.name || null,
			marketHashName: desc.market_hash_name || null,
			type: desc.type || null,
			rarity: firstTagValue(desc.tags, 'Rarity'),
			weapon: firstTagValue(desc.tags, 'Weapon'),
			exterior: firstTagValue(desc.tags, 'Exterior'),
			collection: firstTagValue(desc.tags, 'ItemSet'),
			iconUrl: icon,
			inspectLink,
			tradable: Boolean(desc.tradable),
			marketable: Boolean(desc.marketable),
		};
	});
}

async function fetchInventoryPage(steamId64, count, lastAssetId) {
	const params = new URLSearchParams({ l: 'english', count: String(count) });
	if (lastAssetId) params.set('start_assetid', String(lastAssetId));
	const url = `${STEAM_COMMUNITY_BASE}/inventory/${steamId64}/${CS2_APP_ID}/${CS2_CONTEXT_ID}?${params.toString()}`;
	const response = await fetch(url);
	const text = await response.text();
	if (!response.ok) {
		throw new Error(`Steam inventory request failed (${response.status}): ${text.slice(0, 200)}`);
	}
	const payload = JSON.parse(text || '{}');
	if (!payload || payload.success !== 1) {
		throw new Error(`Steam inventory response was not successful for ${steamId64}.`);
	}
	return payload;
}

async function fetchPriceOverview(marketHashName) {
	if (!marketHashName) return null;
	const params = new URLSearchParams({
		appid: String(CS2_APP_ID),
		currency: String(PRICE_CURRENCY_USD),
		market_hash_name: marketHashName,
	});
	const response = await fetch(`${MARKET_PRICE_ENDPOINT}?${params.toString()}`);
	if (!response.ok) return null;
	const payload = await response.json().catch(() => null);
	if (!payload || payload.success !== true) return null;
	return {
		lowestPrice: payload.lowest_price || null,
		medianPrice: payload.median_price || null,
		volume: payload.volume || null,
		lowestPriceUsd: parseMarketPrice(payload.lowest_price),
		medianPriceUsd: parseMarketPrice(payload.median_price),
	};
}

async function enrichItemsWithPricing(items) {
	const pricedItems = items.filter((item) => {
		return (
			item?.marketHashName &&
			(isSkinLikeItem(item) || isContainerItem(item) || isCoolItem(item))
		);
	});
	const uniqueNames = [
		...new Set(pricedItems.slice(0, MAX_PRICED_ITEMS).map((item) => item.marketHashName)),
	].slice(0, MAX_PRICE_LOOKUPS);
	const pricingMap = new Map();
	for (const marketHashName of uniqueNames) {
		const pricing = await fetchPriceOverview(marketHashName);
		if (pricing) pricingMap.set(marketHashName, pricing);
	}
	return items.map((item) => ({ ...item, pricing: pricingMap.get(item.marketHashName) || null }));
}

export async function onRequestGet(context) {
	try {
		const query = context?.request ? new URL(context.request.url).searchParams : new URLSearchParams();
		const profile = query.get('profile') || DEFAULT_PROFILE;
		const limit = Math.max(1, Math.min(asNumber(query.get('limit'), 120), 300));
		const perPage = Math.max(1, Math.min(asNumber(query.get('count'), 120), MAX_FETCH_COUNT));
		const expensiveMin = Math.max(0, asNumber(query.get('expensiveMin'), DEFAULT_EXPENSIVE_MIN));
		const featuredOnly = query.get('featured') !== '0';

		const steamId64 = await resolveSteamId64(profile);
		let pages = 0;
		let more = true;
		let lastAssetId = null;
		const allItems = [];

		while (more && pages < MAX_PAGE_COUNT) {
			const payload = await fetchInventoryPage(steamId64, perPage, lastAssetId);
			const pageItems = mapInventoryItems(payload, steamId64);
			allItems.push(...pageItems);
			pages += 1;
			more = Boolean(payload.more);
			lastAssetId = payload.last_assetid || null;
		}

		const enrichedItems = await enrichItemsWithPricing(allItems);
		const caseStats = enrichedItems
			.filter((item) => isContainerItem(item))
			.reduce(
				(acc, item) => {
					const amount = Number.isFinite(item.amount) ? item.amount : 1;
					acc.totalCases += amount;
					if (item.marketName) {
						acc.byName[item.marketName] = (acc.byName[item.marketName] || 0) + amount;
					}
					return acc;
				},
				{ totalCases: 0, byName: {} }
			);

		const skinItems = enrichedItems.filter((item) => isSkinLikeItem(item) && !isContainerItem(item));
		const expensiveCoolItems = skinItems
			.filter((item) => {
				const estimated = item?.pricing?.lowestPriceUsd ?? item?.pricing?.medianPriceUsd ?? null;
				if (estimated !== null) {
					return estimated >= expensiveMin && (!featuredOnly || isCoolItem(item));
				}
				return featuredOnly ? isCoolItem(item) : false;
			})
			.sort((a, b) => {
				const aPrice = a?.pricing?.lowestPriceUsd ?? a?.pricing?.medianPriceUsd ?? -1;
				const bPrice = b?.pricing?.lowestPriceUsd ?? b?.pricing?.medianPriceUsd ?? -1;
				return bPrice - aPrice;
			});

		return json({
			ok: true,
			profile,
			steamId64,
			generatedAt: new Date().toISOString(),
			totalItems: enrichedItems.length,
			hasMore: more,
			expensiveMin,
			caseStats,
			items: featuredOnly ? expensiveCoolItems.slice(0, limit) : enrichedItems.slice(0, limit),
		});
	} catch (error) {
		return json(
			{
				ok: false,
				error: 'Failed to fetch CS2 inventory.',
				detail: String(error?.message || error),
			},
			500
		);
	}
}

export async function onRequest() {
	return json({ error: 'Method not allowed. Use GET.' }, 405);
}
