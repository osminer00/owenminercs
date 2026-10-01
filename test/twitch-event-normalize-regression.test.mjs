import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const marker = `function ${functionName}(`;
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, `${functionName} should exist`);
	const declaredAt = source.slice(Math.max(0, start - 6), start) === 'async ' ? start - 6 : start;

	const paramsStart = source.indexOf('(', start);
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
	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(declaredAt, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function loadCloudflareNormalize() {
	const source = readWorkspaceFile('functions/api/_twitch-utils.js');
	const sandbox = { crypto: globalThis.crypto };
	vm.runInNewContext(
		[
			extractFunction(source, 'eventTypeToLabel'),
			extractFunction(source, 'normalizeTwitchEvent'),
			'this.normalizeTwitchEvent = normalizeTwitchEvent;',
		].join('\n'),
		sandbox
	);
	assert.equal(typeof sandbox.normalizeTwitchEvent, 'function');
	return sandbox.normalizeTwitchEvent;
}

function hostify(value) {
	return JSON.parse(JSON.stringify(value));
}

function assertNormalizedEvent(normalizeTwitchEvent) {
	const follow = hostify(
		normalizeTwitchEvent('channel.follow', {
			user_name: 'Owen',
			user_login: 'owen',
			followed_at: '2026-06-01T00:00:00.000Z',
		})
	);
	assert.match(follow.id, /^[0-9a-f-]{36}$/i);
	assert.equal(follow.subscriptionType, 'channel.follow');
	assert.equal(follow.type, 'follow');
	assert.equal(follow.userName, 'Owen');
	assert.equal(follow.createdAt, '2026-06-01T00:00:00.000Z');
	assert.equal(follow.displayText, 'Owen followed');
	assert.equal(follow.raw.user_login, 'owen');

	const anonymous = hostify(
		normalizeTwitchEvent('channel.follow', {
			followed_at: '2026-06-01T01:00:00.000Z',
		})
	);
	assert.equal(anonymous.userName, 'Unknown');
	assert.equal(anonymous.displayText, 'Someone followed');
	assert.notEqual(anonymous.id, follow.id);

	const subscribed = hostify(
		normalizeTwitchEvent('channel.subscribe', {
			user_name: 'Ada',
			started_at: '2026-06-02T00:00:00.000Z',
		})
	);
	assert.equal(subscribed.type, 'subscribe');
	assert.equal(subscribed.tier, '1000');
	assert.equal(subscribed.months, 1);
	assert.equal(subscribed.displayText, 'Ada subscribed (Tier 1000)');

	const tiered = hostify(
		normalizeTwitchEvent('channel.subscribe', {
			user_name: 'Ada',
			tier: '2000',
			cumulative_months: '6',
			started_at: '2026-06-02T00:00:00.000Z',
		})
	);
	assert.equal(tiered.tier, '2000');
	assert.equal(tiered.months, 6);
	assert.equal(tiered.displayText, 'Ada subscribed (Tier 2000)');

	const oneGift = hostify(
		normalizeTwitchEvent('channel.subscription.gift', {
			user_name: 'Bea',
			total: 1,
			started_at: '2026-06-03T00:00:00.000Z',
		})
	);
	assert.equal(oneGift.type, 'gift_sub');
	assert.equal(oneGift.total, 1);
	assert.equal(oneGift.tier, '1000');
	assert.equal(oneGift.displayText, 'Bea gifted 1 sub');

	const manyGifts = hostify(
		normalizeTwitchEvent('channel.subscription.gift', {
			user_name: 'Bea',
			total: '3',
			tier: '3000',
			started_at: '2026-06-03T00:00:00.000Z',
		})
	);
	assert.equal(manyGifts.total, 3);
	assert.equal(manyGifts.tier, '3000');
	assert.equal(manyGifts.displayText, 'Bea gifted 3 subs');

	const cheer = hostify(
		normalizeTwitchEvent('channel.cheer', {
			user_name: 'Cam',
			bits: '250',
			started_at: '2026-06-04T00:00:00.000Z',
		})
	);
	assert.equal(cheer.type, 'bits');
	assert.equal(cheer.bits, 250);
	assert.equal(cheer.displayText, 'Cam cheered 250 bits');
	assert.equal(cheer.createdAt, '2026-06-04T00:00:00.000Z');

	const unknown = hostify(
		normalizeTwitchEvent('channel.raid', {
			user_name: 'Dee',
			started_at: '2026-06-05T00:00:00.000Z',
		})
	);
	assert.equal(unknown.type, 'other');
	assert.equal(unknown.userName, 'Dee');
	assert.equal(unknown.displayText, 'New Twitch activity');
	assert.match(unknown.createdAt, /^\d{4}-\d{2}-\d{2}T/);
}

test('Twitch event normalization labels follows, subs, gifts, bits, and unknown activity', () => {
	const netlify = require('../netlify/functions/_twitch-utils.js');
	assertNormalizedEvent(netlify.normalizeTwitchEvent);
	assertNormalizedEvent(loadCloudflareNormalize());
});
