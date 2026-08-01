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

function loadShopProductHelpers() {
	const source = readWorkspaceFile('scripts/shop-products.js');
	const sandbox = {
		URL,
		String,
		Boolean,
	};

	vm.runInNewContext(
		[
			"const productsUrl = 'https://owenminercs.com/Garage%20Sale/shop-products.json';",
			extractFunction(source, 'resolveUrl'),
			extractFunction(source, 'providerLabel'),
			extractFunction(source, 'statusText'),
			extractFunction(source, 'isAvailable'),
			`this.__helpers = {
				resolveUrl,
				providerLabel,
				statusText,
				isAvailable,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'shop-products helpers should load');
	return sandbox.__helpers;
}

test('shop-products resolveUrl keeps absolute, root, and hash URLs; resolves relatives', () => {
	const { resolveUrl } = loadShopProductHelpers();

	assert.equal(resolveUrl('https://paypal.me/owen/10'), 'https://paypal.me/owen/10');
	assert.equal(resolveUrl('/images/logo.png'), '/images/logo.png');
	assert.equal(resolveUrl('#for-sale'), '#for-sale');
	assert.equal(
		resolveUrl('checkout/sticker-pack'),
		'https://owenminercs.com/Garage%20Sale/checkout/sticker-pack'
	);
	assert.equal(resolveUrl('  '), '');
	assert.equal(resolveUrl(null), '');
	assert.equal(resolveUrl(undefined), '');
});

test('shop-products status and provider labels cover known and fallback values', () => {
	const { statusText, providerLabel } = loadShopProductHelpers();

	assert.equal(statusText({ availabilityLabel: 'Ships this week' }), 'Ships this week');
	assert.equal(statusText({ status: 'available' }), 'Available');
	assert.equal(statusText({ status: 'tbd' }), 'TBD');
	assert.equal(statusText({ status: 'sold-out' }), 'Sold out');
	assert.equal(statusText({ status: 'coming-soon' }), 'Coming soon');
	assert.equal(statusText({ status: 'draft' }), 'Coming soon');
	assert.equal(statusText(null), 'Coming soon');

	assert.equal(providerLabel({ paymentProvider: 'paypal' }), 'PayPal');
	assert.equal(providerLabel({ paymentProvider: 'stripe' }), 'Stripe');
	assert.equal(providerLabel({ paymentProvider: 'other' }), 'Secure');
	assert.equal(providerLabel({}), 'Secure');
});

test('shop-products isAvailable requires available status and a resolvable checkout URL', () => {
	const { isAvailable } = loadShopProductHelpers();

	assert.equal(
		isAvailable({
			status: 'available',
			checkoutUrl: 'https://paypal.me/owen/10',
		}),
		'https://paypal.me/owen/10'
	);
	assert.equal(
		isAvailable({
			status: 'available',
			paypalUrl: 'checkout/local',
		}),
		'https://owenminercs.com/Garage%20Sale/checkout/local'
	);
	assert.equal(
		isAvailable({
			status: 'available',
			buyOnSiteUrl: '/buy/now',
		}),
		'/buy/now'
	);

	assert.equal(
		isAvailable({
			status: 'tbd',
			checkoutUrl: 'https://paypal.me/owen/10',
		}),
		false
	);
	assert.equal(
		isAvailable({
			status: 'available',
			checkoutUrl: '',
			paypalUrl: '',
			stripeUrl: '',
		}),
		''
	);
	assert.equal(isAvailable(null), false);
});
