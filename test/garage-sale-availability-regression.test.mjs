import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}(`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const braceStart = source.indexOf('{', start);
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

function loadShopAvailability() {
	const source = readWorkspaceFile('scripts/garage-sale.js');
	const sandbox = {};
	vm.runInNewContext(
		`${extractFunction(source, 'shopAvailabilityLine')}\nthis.shopAvailabilityLine = shopAvailabilityLine;`,
		sandbox
	);
	return sandbox.shopAvailabilityLine;
}

test('shopAvailabilityLine prefers a custom label, then maps known statuses, then falls back', () => {
	const shopAvailabilityLine = loadShopAvailability();

	assert.equal(shopAvailabilityLine(null), 'Coming soon');
	assert.equal(shopAvailabilityLine({}), 'Coming soon');
	assert.equal(shopAvailabilityLine({ status: 'draft' }), 'Coming soon');
	assert.equal(shopAvailabilityLine({ status: 'Available' }), 'Available');
	assert.equal(shopAvailabilityLine({ status: 'TBD' }), 'TBD');
	assert.equal(shopAvailabilityLine({ status: 'sold-out' }), 'Sold out');
	assert.equal(
		shopAvailabilityLine({
			status: 'available',
			availabilityLabel: '  Ships next week  ',
		}),
		'  Ships next week  '
	);
	assert.equal(
		shopAvailabilityLine({
			status: 'sold-out',
			availabilityLabel: '',
		}),
		'Sold out'
	);
});
