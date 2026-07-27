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

function loadGarageSaleHelpers() {
	const source = readWorkspaceFile('scripts/garage-sale.js');
	const sandbox = {
		URL,
		String,
		Boolean,
		Array,
		Number,
		parseFloat,
		isNaN,
		NaN,
	};

	vm.runInNewContext(
		[
			"const productsUrl = 'https://owenminercs.com/Garage%20Sale/shop-products.json';",
			"const ebayUrl = 'https://owenminercs.com/Garage%20Sale/ebay-listings.json';",
			"const PLACEHOLDER_IMG = 'https://owenminercs.com/images/owenminercs-logo.png';",
			"const SHOP_SECTION_ORDER = ['stickers', 'prints', 'custom-work'];",
			extractFunction(source, 'resolveProductUrl'),
			extractFunction(source, 'resolveCheckoutPair'),
			extractFunction(source, 'shopIsCheckoutLive'),
			extractFunction(source, 'shopAvailabilityLine'),
			extractFunction(source, 'mapShopProductToListing'),
			extractFunction(source, 'orderedShopProducts'),
			extractFunction(source, 'getBuyOnSiteUrl'),
			extractFunction(source, 'getEbayUrl'),
			extractFunction(source, 'stableCartId'),
			`this.__helpers = {
				resolveProductUrl,
				resolveCheckoutPair,
				shopIsCheckoutLive,
				shopAvailabilityLine,
				mapShopProductToListing,
				orderedShopProducts,
				getBuyOnSiteUrl,
				stableCartId,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'garage-sale helpers should load');
	return sandbox.__helpers;
}

test('garage-sale prefers PayPal checkout and keeps Stripe as alternate', () => {
	const { resolveCheckoutPair, shopIsCheckoutLive } = loadGarageSaleHelpers();
	const base = 'https://owenminercs.com/Garage%20Sale/shop-products.json';

	const pair = resolveCheckoutPair(
		{
			status: 'available',
			paypalUrl: 'https://paypal.me/owen/10',
			stripeUrl: 'https://buy.stripe.com/test',
			checkoutUrl: 'https://example.com/should-not-win',
		},
		base
	);

	assert.equal(pair.primary, 'https://paypal.me/owen/10');
	assert.equal(pair.alternate, 'https://buy.stripe.com/test');
	assert.equal(
		shopIsCheckoutLive({
			status: 'available',
			paypalUrl: 'https://paypal.me/owen/10',
		}),
		true
	);
});

test('garage-sale falls back to Stripe-only checkout and resolves relative URLs', () => {
	const { resolveCheckoutPair, resolveProductUrl } = loadGarageSaleHelpers();
	const base = 'https://owenminercs.com/Garage%20Sale/shop-products.json';

	const stripeOnly = resolveCheckoutPair(
		{
			stripeUrl: 'https://buy.stripe.com/only',
			paypalUrl: ' ',
			checkoutUrl: '',
		},
		base
	);
	assert.equal(stripeOnly.primary, 'https://buy.stripe.com/only');
	assert.equal(stripeOnly.alternate, '');

	const relativeHttp = resolveCheckoutPair(
		{
			checkoutUrl: 'checkout/sticker-pack',
		},
		base
	);
	assert.equal(
		relativeHttp.primary,
		'https://owenminercs.com/Garage%20Sale/checkout/sticker-pack'
	);

	const nonHttp = resolveCheckoutPair(
		{
			checkoutUrl: '#local-anchor',
			stripeUrl: 'mailto:owen@example.com',
		},
		base
	);
	assert.equal(nonHttp.primary, '');
	assert.equal(nonHttp.alternate, '');

	assert.equal(
		resolveProductUrl('images/sticker.png', base),
		'https://owenminercs.com/Garage%20Sale/images/sticker.png'
	);
	assert.equal(resolveProductUrl('https://cdn.example/a.png', base), 'https://cdn.example/a.png');
	assert.equal(resolveProductUrl('/absolute.png', base), '/absolute.png');
	assert.equal(resolveProductUrl('   ', base), '');
});

test('garage-sale withholds live checkout for non-available products and maps availability labels', () => {
	const { shopIsCheckoutLive, shopAvailabilityLine, mapShopProductToListing } =
		loadGarageSaleHelpers();

	assert.equal(
		shopIsCheckoutLive({
			status: 'tbd',
			paypalUrl: 'https://paypal.me/owen/10',
		}),
		false
	);
	assert.equal(
		shopIsCheckoutLive({
			status: 'available',
			paypalUrl: '#not-checkout',
			stripeUrl: 'mailto:owen@example.com',
		}),
		false
	);

	assert.equal(shopAvailabilityLine(null), 'Coming soon');
	assert.equal(
		shopAvailabilityLine({ status: 'available', availabilityLabel: '  Ships this week  ' }),
		'  Ships this week  '
	);
	assert.equal(shopAvailabilityLine({ status: 'available' }), 'Available');
	assert.equal(shopAvailabilityLine({ status: 'tbd' }), 'TBD');
	assert.equal(shopAvailabilityLine({ status: 'sold-out' }), 'Sold out');
	assert.equal(shopAvailabilityLine({ status: 'draft' }), 'Coming soon');

	const live = mapShopProductToListing({
		title: 'Signed sticker pack',
		status: 'available',
		paypalUrl: 'https://paypal.me/owen/12',
		price: '$12',
	});
	assert.equal(live.buyOnSiteUrl, 'https://paypal.me/owen/12');
	assert.equal(live.checkoutUrl, 'https://paypal.me/owen/12');
	assert.equal(live.shopAvailabilityText, 'Available');

	const held = mapShopProductToListing({
		title: 'Print',
		status: 'tbd',
		paypalUrl: 'https://paypal.me/owen/20',
		price: '$20',
	});
	assert.equal(held.buyOnSiteUrl, '');
	assert.equal(held.checkoutUrl, '');
	assert.equal(held.shopAvailabilityText, 'TBD');
});

test('garage-sale orders shop sections and builds stable cart ids for direct checkout', () => {
	const { orderedShopProducts, stableCartId, getBuyOnSiteUrl } = loadGarageSaleHelpers();

	const ordered = orderedShopProducts([
		{ id: 'c1', section: 'custom-work', title: 'Custom', status: 'tbd' },
		{ id: 'p1', section: 'prints', title: 'Print', status: 'tbd' },
		{ id: 's1', section: 'stickers', title: 'Sticker', status: 'available', paypalUrl: 'https://paypal.me/owen/5' },
		{ id: 's1', section: 'stickers', title: 'Duplicate ignored', status: 'tbd' },
		{ id: 'other', section: 'mystery', title: 'Skipped section', status: 'tbd' },
	]);

	assert.equal(ordered.length, 3);
	assert.equal(ordered[0].title, 'Sticker');
	assert.equal(ordered[1].title, 'Print');
	assert.equal(ordered[2].title, 'Custom');

	const ebayItem = {
		title: 'Old mouse',
		ebayUrl: 'https://www.ebay.com/itm/123456789012',
		buyOnSiteUrl: 'https://paypal.me/owen/30',
	};
	assert.equal(stableCartId(ebayItem), '123456789012');

	const directItem = {
		title: 'Signed print',
		buyOnSiteUrl: 'https://paypal.me/owen/40',
	};
	assert.equal(getBuyOnSiteUrl(directItem), 'https://paypal.me/owen/40');
	assert.match(stableCartId(directItem), /^d\d+$/);
	assert.equal(stableCartId(directItem), stableCartId(directItem));
	assert.notEqual(
		stableCartId(directItem),
		stableCartId({ title: 'Different print', buyOnSiteUrl: 'https://paypal.me/owen/40' })
	);
});
