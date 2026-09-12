import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractClassMethod(source, methodName) {
	const needle = `\n\t${methodName}(`;
	const start = source.indexOf(needle);
	assert.notEqual(start, -1, `${methodName} should exist as a class method`);

	const paramsStart = source.indexOf('(', start);
	assert.notEqual(paramsStart, -1, `${methodName} should have parameters`);

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
	assert.notEqual(paramsEnd, -1, `${methodName} parameter list should close`);

	const braceStart = source.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${methodName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) {
				const signatureAndBody = source.slice(start + 1, i + 1).trimStart();
				return `function ${signatureAndBody}`;
			}
		}
	}

	assert.fail(`${methodName} body should close`);
}

function loadAffiliateHelpers() {
	const source = readWorkspaceFile('scripts/affiliate-links.js');
	const sandbox = {
		URL,
		String,
		Boolean,
		window: { location: { origin: 'https://owenminercs.com' } },
	};

	const methodNames = [
		'getPriceModel',
		'buildInlinePriceText',
		'isAliExpressDirectUrl',
		'retailerBadgeHtml',
		'formatRetailerName',
	];

	vm.createContext(sandbox);
	vm.runInContext(
		[
			...methodNames.map((name) => extractClassMethod(source, name)),
			'const api = {};',
			...methodNames.map((name) => `api.${name} = ${name}.bind(api);`),
			'this.__helpers = api;',
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'affiliate helpers should load');
	return sandbox.__helpers;
}

test('buildInlinePriceText prefers a live current price and otherwise shows the paid amount', () => {
	const { buildInlinePriceText } = loadAffiliateHelpers();

	assert.equal(buildInlinePriceText({ current_price: '$129.99', paid_price: '$99' }), '| Now $129.99');
	assert.equal(buildInlinePriceText({ paid_price: '$55' }), '| $55');
	assert.equal(buildInlinePriceText({ price: '$40' }), '| $40');
	assert.equal(buildInlinePriceText({ current_price: '  ', paid_price: '  ', price: '' }), '');
	assert.equal(buildInlinePriceText(null), '');
});

test('retailerBadgeHtml marks compensated Amazon/AliExpress links and keeps official non-affiliate shops unlabeled', () => {
	const { retailerBadgeHtml } = loadAffiliateHelpers();

	assert.equal(
		retailerBadgeHtml('official', 'https://www.amazon.com/dp/B0TEST'),
		'<span class="affiliate">Affiliate</span>'
	);
	assert.equal(
		retailerBadgeHtml('direct', 'https://s.click.aliexpress.com/e/_test'),
		'<span class="affiliate">Affiliate</span>'
	);
	assert.match(
		retailerBadgeHtml('official', 'https://www.aliexpress.com/item/100500123.html'),
		/affiliate-note/
	);
	assert.equal(retailerBadgeHtml('official', 'https://wooting.io/wooting-60he'), '');
	assert.equal(retailerBadgeHtml('amazon_search', 'https://www.amazon.com/s?k=govee'), '<span class="affiliate">Affiliate</span>');
	assert.equal(
		retailerBadgeHtml('aliexpress_search', 'https://www.aliexpress.com/wholesale?SearchText=govee'),
		'<span class="affiliate">Affiliate</span>'
	);
});

test('formatRetailerName maps known keys and title-cases unknown retailers', () => {
	const { formatRetailerName } = loadAffiliateHelpers();

	assert.equal(formatRetailerName('amazon_search'), 'Amazon');
	assert.equal(formatRetailerName('bestbuy'), 'Best Buy');
	assert.equal(formatRetailerName('official'), 'Official Website');
	assert.equal(formatRetailerName('direct'), 'Direct Link');
	assert.equal(formatRetailerName('newegg'), 'Newegg');
	assert.equal(formatRetailerName('wooting'), 'Wooting');
});
