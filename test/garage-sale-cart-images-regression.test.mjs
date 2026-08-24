import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const garageSaleSource = readFileSync(new URL('../scripts/garage-sale.js', import.meta.url), 'utf8');

const CART_KEY = 'owenminercs-ebay-cart-v1';
const LISTINGS_BASE = 'https://www.owenminercs.com/Garage%20Sale/ebay-listings.json';
const PLACEHOLDER_IMG = 'https://www.owenminercs.com/images/owenminercs-logo.png';

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

function createMemoryStorage() {
	const store = new Map();
	return {
		getItem(key) {
			return store.has(key) ? store.get(key) : null;
		},
		setItem(key, value) {
			store.set(String(key), String(value));
		},
		removeItem(key) {
			store.delete(key);
		},
		clear() {
			store.clear();
		},
	};
}

function loadGarageCartHelpers(options = {}) {
	const localStorage = options.localStorage || createMemoryStorage();
	const cartCountEl = { textContent: '' };
	const sandbox = {
		String,
		Number,
		Array,
		JSON,
		URL,
		parseFloat,
		isNaN,
		NaN,
		localStorage,
		CART_KEY,
		ebayUrl: LISTINGS_BASE,
		PLACEHOLDER_IMG,
		cartCountEl,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		var CART_KEY = this.CART_KEY;
		var ebayUrl = this.ebayUrl;
		var PLACEHOLDER_IMG = this.PLACEHOLDER_IMG;
		var cartCountEl = this.cartCountEl;
		var localStorage = this.localStorage;
		${extractFunction(garageSaleSource, 'resolveProductUrl')}
		${extractFunction(garageSaleSource, 'getEbayUrl')}
		${extractFunction(garageSaleSource, 'ebayItemId')}
		${extractFunction(garageSaleSource, 'getBuyOnSiteUrl')}
		${extractFunction(garageSaleSource, 'stableCartId')}
		${extractFunction(garageSaleSource, 'normalizeEbayImages')}
		${extractFunction(garageSaleSource, 'cartPayloadFromItem')}
		${extractFunction(garageSaleSource, 'readCart')}
		${extractFunction(garageSaleSource, 'writeCart')}
		${extractFunction(garageSaleSource, 'updateCartUi')}
		${extractFunction(garageSaleSource, 'addToCart')}
		this.__helpers = {
			resolveProductUrl,
			getEbayUrl,
			ebayItemId,
			getBuyOnSiteUrl,
			stableCartId,
			normalizeEbayImages,
			cartPayloadFromItem,
			readCart,
			writeCart,
			updateCartUi,
			addToCart,
			localStorage,
			cartCountEl,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'garage-sale cart helpers should load');
	return sandbox.__helpers;
}

test('normalizeEbayImages prepends the primary photo, skips blanks, and falls back to the placeholder', () => {
	const { normalizeEbayImages } = loadGarageCartHelpers();

	const images = Array.from(
		normalizeEbayImages({
			image: 'photos/hero.jpg',
			images: ['  ', 'photos/hero.jpg', 'https://img.example/extra.webp', ''],
		})
	);

	assert.deepEqual(images, [
		'https://www.owenminercs.com/Garage%20Sale/photos/hero.jpg',
		'https://img.example/extra.webp',
	]);

	assert.deepEqual(Array.from(normalizeEbayImages({ title: 'No photos' })), [PLACEHOLDER_IMG]);
	assert.deepEqual(Array.from(normalizeEbayImages({ image: '   ', images: [null] })), [
		PLACEHOLDER_IMG,
	]);
});

test('getBuyOnSiteUrl ignores quoted-empty placeholders and non-http checkout strings', () => {
	const { getBuyOnSiteUrl } = loadGarageCartHelpers();

	assert.equal(
		getBuyOnSiteUrl({
			buyOnSiteUrl: '""',
			checkoutUrl: 'mailto:owen@example.com',
			paypalUrl: 'javascript:alert(1)',
			stripeUrl: '/relative-pay',
		}),
		''
	);
	assert.equal(
		getBuyOnSiteUrl({
			buyOnSiteUrl: '""',
			paypalUrl: 'https://paypal.me/owen/12',
		}),
		'https://paypal.me/owen/12'
	);
	assert.equal(getBuyOnSiteUrl(null), '');
});

test('readCart treats missing, malformed, and non-array storage as an empty cart', () => {
	const storage = createMemoryStorage();
	const helpers = loadGarageCartHelpers({ localStorage: storage });

	assert.deepEqual(Array.from(helpers.readCart()), []);

	storage.setItem(CART_KEY, '{not-json');
	assert.deepEqual(Array.from(helpers.readCart()), []);

	storage.setItem(CART_KEY, '{"id":"oops"}');
	assert.deepEqual(Array.from(helpers.readCart()), []);

	storage.setItem(CART_KEY, JSON.stringify([{ id: 'ok', title: 'Sticker' }]));
	const cart = Array.from(helpers.readCart());
	assert.equal(cart.length, 1);
	assert.equal(cart[0].id, 'ok');
	assert.equal(cart[0].title, 'Sticker');
});

test('addToCart only stores checkout or eBay item listings and dedupes by stable id', () => {
	const helpers = loadGarageCartHelpers();
	const { addToCart, readCart, cartCountEl } = helpers;

	addToCart({ title: 'No links at all' });
	addToCart({
		title: 'Search page, not an item',
		ebayUrl: 'https://www.ebay.com/sch/i.html?_nkw=mouse',
	});
	addToCart({
		title: 'Unsafe checkout',
		buyOnSiteUrl: 'javascript:alert(1)',
	});
	assert.deepEqual(Array.from(readCart()), []);
	assert.equal(cartCountEl.textContent, '');

	const ebayItem = {
		title: 'Used Superlight',
		price: '$90',
		shipping: 'Free',
		ebayUrl: 'https://www.ebay.com/itm/123456789012',
		image: 'photos/mouse.jpg',
	};
	addToCart(ebayItem);
	addToCart(ebayItem);

	const paypalOnly = {
		title: 'Signed print',
		price: '$25',
		buyOnSiteUrl: 'https://paypal.me/owen/25',
		images: ['https://cdn.example/print.jpg'],
	};
	addToCart(paypalOnly);
	addToCart({
		title: 'Signed print',
		buyOnSiteUrl: 'https://paypal.me/owen/25',
	});

	const cart = Array.from(readCart());
	assert.equal(cart.length, 2);
	assert.equal(cart[0].id, '123456789012');
	assert.equal(cart[0].title, 'Used Superlight');
	assert.equal(cart[0].url, 'https://www.ebay.com/itm/123456789012');
	assert.equal(
		cart[0].image,
		'https://www.owenminercs.com/Garage%20Sale/photos/mouse.jpg'
	);
	assert.equal(cart[1].title, 'Signed print');
	assert.equal(cart[1].checkoutUrl, 'https://paypal.me/owen/25');
	assert.equal(cart[1].image, 'https://cdn.example/print.jpg');
	assert.match(cart[1].id, /^d\d+$/);
	assert.equal(cartCountEl.textContent, '2');
});
