import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const garageSaleSource = readFileSync(new URL('../scripts/garage-sale.js', import.meta.url), 'utf8');

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
	const sandbox = {
		String,
		Boolean,
		Number,
		Array,
		URL,
		parseFloat,
		isNaN,
		productsUrl: 'https://www.owenminercs.com/Garage%20Sale/shop-products.json',
		SHOP_SECTION_ORDER: ['stickers', 'prints', 'custom-work'],
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(garageSaleSource, 'resolveProductUrl')}
		${extractFunction(garageSaleSource, 'resolveCheckoutPair')}
		${extractFunction(garageSaleSource, 'shopIsCheckoutLive')}
		${extractFunction(garageSaleSource, 'shopAvailabilityLine')}
		${extractFunction(garageSaleSource, 'mapShopProductToListing')}
		${extractFunction(garageSaleSource, 'orderedShopProducts')}
		${extractFunction(garageSaleSource, 'inferSection')}
		this.__helpers = {
			resolveProductUrl,
			shopIsCheckoutLive,
			shopAvailabilityLine,
			mapShopProductToListing,
			orderedShopProducts,
			inferSection,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('mapShopProductToListing only exposes live http checkout for available products', () => {
	const { mapShopProductToListing } = loadGarageSaleHelpers();

	const live = mapShopProductToListing({
		title: 'Signed sticker pack',
		status: 'available',
		checkoutUrl: 'pay.html',
		price: '$12.50',
		image: 'sticker.png',
		imageAlt: '  signed pack  ',
		eyebrow: 'Drop 1',
		summary: 'Three stickers',
		details: ['Matte', ' ', null, 'Signed'],
		secondaryUrl: 'https://example.com/more',
		secondaryLabel: 'Details',
	});

	assert.equal(live.title, 'Signed sticker pack');
	assert.equal(
		live.buyOnSiteUrl,
		'https://www.owenminercs.com/Garage%20Sale/pay.html'
	);
	assert.equal(live.checkoutUrl, live.buyOnSiteUrl);
	assert.equal(live.priceNumber, 12.5);
	assert.equal(
		live.image,
		'https://www.owenminercs.com/Garage%20Sale/sticker.png'
	);
	assert.deepEqual(Array.from(live.images), [
		'https://www.owenminercs.com/Garage%20Sale/sticker.png',
	]);
	assert.equal(live.shopAvailabilityText, 'Available');
	assert.equal(live.shopImageAlt, 'signed pack');
	assert.equal(live.shopEyebrow, 'Drop 1');
	assert.equal(live.shopSummary, 'Three stickers');
	assert.deepEqual(Array.from(live.detailNotes), ['Matte', 'Signed']);
	assert.equal(live.secondaryCtaUrl, 'https://example.com/more');
	assert.equal(live.ebayUrl, '');
	assert.equal(live.__shopSource, true);
	assert.equal(live.__saleHold, true);

	const held = mapShopProductToListing({
		title: 'Print',
		status: 'tbd',
		paypalUrl: 'https://paypal.me/owenminer/20',
		priceNumber: 20,
	});
	assert.equal(held.buyOnSiteUrl, '');
	assert.equal(held.checkoutUrl, '');
	assert.equal(held.shopAvailabilityText, 'TBD');
	assert.equal(held.priceNumber, 20);
	assert.equal(held.title, 'Print');

	const hashOnly = mapShopProductToListing({
		status: 'available',
		checkoutUrl: '#',
	});
	assert.equal(hashOnly.buyOnSiteUrl, '');
	assert.equal(hashOnly.title, 'Shop product');
	assert.equal(hashOnly.shopAvailabilityText, 'Available');

	const rootRelative = mapShopProductToListing({
		status: 'available',
		checkoutUrl: '/pay',
	});
	assert.equal(rootRelative.buyOnSiteUrl, '');
});

test('shop availability copy and checkout liveness cover sold-out, TBD, and missing products', () => {
	const { shopAvailabilityLine, shopIsCheckoutLive } = loadGarageSaleHelpers();

	assert.equal(shopAvailabilityLine(null), 'Coming soon');
	assert.equal(shopAvailabilityLine({ availabilityLabel: ' Ships Friday ' }), ' Ships Friday ');
	assert.equal(shopAvailabilityLine({ status: 'sold-out' }), 'Sold out');
	assert.equal(shopAvailabilityLine({ status: 'mystery' }), 'Coming soon');

	assert.equal(
		shopIsCheckoutLive({
			status: 'available',
			paypalUrl: 'https://paypal.me/owenminer/5',
		}),
		true
	);
	assert.equal(
		shopIsCheckoutLive({
			status: 'available',
			checkoutUrl: 'mailto:owen@example.com',
		}),
		false
	);
	assert.equal(
		shopIsCheckoutLive({
			status: 'available',
			stripeUrl: 'https://buy.stripe.com/test',
		}),
		true
	);
});

test('orderedShopProducts keeps stickers/prints/custom-work order and inferSection maps digital aliases', () => {
	const { orderedShopProducts, inferSection } = loadGarageSaleHelpers();

	const ordered = orderedShopProducts([
		{ id: 'print-1', section: 'prints', title: 'Print', status: 'tbd' },
		null,
		{ id: 'sticker-1', section: 'stickers', title: 'Sticker A', status: 'tbd' },
		{ id: 'sticker-1', section: 'stickers', title: 'Sticker duplicate', status: 'tbd' },
		{ id: 'other-1', section: 'garage', title: 'Should drop', status: 'tbd' },
		{ id: 'custom-1', section: 'custom-work', title: 'Sewing', status: 'tbd' },
		{ id: 'sticker-2', section: 'STICKERS', title: 'Sticker B', status: 'tbd' },
	]);

	assert.deepEqual(Array.from(ordered, (item) => String(item.title)), [
		'Sticker A',
		'Sticker B',
		'Print',
		'Sewing',
	]);

	assert.equal(inferSection({ section: 'digital' }), 'digital');
	assert.equal(inferSection({ section: 'digital-assets' }), 'digital');
	assert.equal(inferSection({ section: 'DIGITAL' }), 'digital');
	assert.equal(inferSection({ section: 'garage' }), 'garage');
	assert.equal(inferSection({ section: 'stickers' }), 'garage');
	assert.equal(inferSection(null), 'garage');
	assert.equal(inferSection({}), 'garage');
});
