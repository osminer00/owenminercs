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

function loadPaidPriceHelpers() {
	const source = readWorkspaceFile('scripts/sync-ebay-listings.mjs');
	const sandbox = { String, Map, Array, Object };

	vm.runInNewContext(
		[
			extractFunction(source, 'normalizeTitle'),
			extractFunction(source, 'attachPaidPrice'),
			`this.__helpers = { attachPaidPrice };`,
		].join('\n'),
		sandbox
	);

	assert.equal(typeof sandbox.__helpers.attachPaidPrice, 'function');
	return sandbox.__helpers;
}

const { attachPaidPrice } = loadPaidPriceHelpers();

test('eBay paid price prefers the paid-file value, then the existing listing, and leaves blanks untouched', () => {
	const paidByTitle = new Map([
		['widget', '$12.00'],
		['blank listed', ''],
	]);
	const existingPaidByTitle = new Map([
		['widget', '$4.00'],
		['kept from feed', '$8.50'],
		['blank listed', '$3.00'],
	]);

	const fromPaidFile = { title: '  Widget  ', url: 'https://www.ebay.com/itm/1' };
	const paidResult = attachPaidPrice(fromPaidFile, paidByTitle, existingPaidByTitle);
	assert.equal(paidResult.paidPrice, '$12.00');
	assert.equal(fromPaidFile.paidPrice, undefined);
	assert.equal(paidResult.url, fromPaidFile.url);

	const fromExisting = attachPaidPrice(
		{ title: 'Kept From Feed', price: '$20.00' },
		paidByTitle,
		existingPaidByTitle
	);
	assert.equal(fromExisting.paidPrice, '$8.50');
	assert.equal(fromExisting.price, '$20.00');

	const blankFallsThrough = attachPaidPrice(
		{ title: 'Blank Listed' },
		paidByTitle,
		existingPaidByTitle
	);
	assert.equal(blankFallsThrough.paidPrice, '$3.00');

	const untouched = { title: 'No Record', price: '$1.00' };
	const unchanged = attachPaidPrice(untouched, paidByTitle, existingPaidByTitle);
	assert.equal(unchanged, untouched);
	assert.equal(unchanged.paidPrice, undefined);
});
