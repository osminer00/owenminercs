import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const donatorsSource = readFileSync(new URL('../scripts/donators.js', import.meta.url), 'utf8');

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

function loadDonatorLabelHelpers() {
	const sandbox = {
		Number,
		String,
		Math,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(donatorsSource, 'asNumber')}
		${extractFunction(donatorsSource, 'kindLabel')}
		this.__helpers = { asNumber, kindLabel };
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('kindLabel distinguishes donations, bits, subscriptions, and Twitch gifted-sub bundles', () => {
	const { kindLabel } = loadDonatorLabelHelpers();

	assert.equal(kindLabel('donation', {}), 'Donation');
	assert.equal(kindLabel('bits', {}), 'Bits');
	assert.equal(kindLabel('subscription', { platform: 'twitch', subscribers: 1 }), 'Subscription');
	assert.equal(kindLabel('subscription', { platform: 'twitch', subscribers: 2 }), 'Gifted subs');
	assert.equal(kindLabel('subscription', { platform: 'twitch', subscribers: '3' }), 'Gifted subs');
	assert.equal(kindLabel('subscription', { platform: 'youtube', subscribers: 8 }), 'Subscription');
	assert.equal(kindLabel('subscription', { platform: 'twitch', subscribers: 'nope' }), 'Subscription');
	assert.equal(kindLabel('other', {}), 'Support');
	assert.equal(kindLabel('unknown', {}), 'Support');
});
