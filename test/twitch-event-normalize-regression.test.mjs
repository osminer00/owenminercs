import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const cloudflareSource = readFileSync(
	new URL('../functions/api/_twitch-utils.js', import.meta.url),
	'utf8'
);
const netlifySource = readFileSync(
	new URL('../netlify/functions/_twitch-utils.js', import.meta.url),
	'utf8'
);

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

function loadTwitchHelpers(source, uuid = 'test-event-id') {
	const sandbox = {
		String,
		Number,
		Date,
		JSON,
		crypto: {
			randomUUID() {
				return uuid;
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		this.__helpers = (function () {
			${extractFunction(source, 'eventTypeToLabel')}
			${extractFunction(source, 'normalizeTwitchEvent')}
			${extractFunction(source, 'safeJsonParse')}
			return { eventTypeToLabel, normalizeTwitchEvent, safeJsonParse };
		})();
		`,
		sandbox
	);

	return sandbox.__helpers;
}

function eventFields(event) {
	return {
		id: String(event.id),
		subscriptionType: String(event.subscriptionType),
		type: String(event.type),
		createdAt: String(event.createdAt),
		userName: String(event.userName),
		displayText: String(event.displayText),
		tier: event.tier == null ? null : String(event.tier),
		months: event.months == null ? null : Number(event.months),
		total: event.total == null ? null : Number(event.total),
		bits: event.bits == null ? null : Number(event.bits),
	};
}

function assertHostParity(assertCase) {
	const cloudflare = loadTwitchHelpers(cloudflareSource);
	const netlify = loadTwitchHelpers(netlifySource);
	assertCase(cloudflare, 'cloudflare');
	assertCase(netlify, 'netlify');
}

test('eventTypeToLabel maps known EventSub types and falls back to other', () => {
	assertHostParity((helpers) => {
		assert.equal(helpers.eventTypeToLabel('channel.follow'), 'follow');
		assert.equal(helpers.eventTypeToLabel('channel.subscribe'), 'subscribe');
		assert.equal(helpers.eventTypeToLabel('channel.subscription.gift'), 'gift_sub');
		assert.equal(helpers.eventTypeToLabel('channel.cheer'), 'bits');
		assert.equal(helpers.eventTypeToLabel('channel.raid'), 'other');
		assert.equal(helpers.eventTypeToLabel(''), 'other');
	});
});

test('normalizeTwitchEvent builds follow/sub/gift/bits copy with login vs display-name fallbacks', () => {
	assertHostParity((helpers) => {
		const follow = eventFields(
			helpers.normalizeTwitchEvent('channel.follow', {
				user_name: 'Ada',
				followed_at: '2026-05-01T12:00:00Z',
			})
		);
		assert.equal(follow.id, 'test-event-id');
		assert.equal(follow.type, 'follow');
		assert.equal(follow.createdAt, '2026-05-01T12:00:00Z');
		assert.equal(follow.userName, 'Ada');
		assert.equal(follow.displayText, 'Ada followed');

		const loginOnly = eventFields(
			helpers.normalizeTwitchEvent('channel.follow', {
				user_login: 'ada_login',
				followed_at: '2026-05-01T12:00:00Z',
			})
		);
		assert.equal(loginOnly.userName, 'ada_login');
		assert.equal(loginOnly.displayText, 'Someone followed');

		const subscribe = eventFields(
			helpers.normalizeTwitchEvent('channel.subscribe', {
				user_name: 'Bea',
				started_at: '2026-05-02T12:00:00Z',
				tier: '2000',
				cumulative_months: '7',
			})
		);
		assert.equal(subscribe.type, 'subscribe');
		assert.equal(subscribe.tier, '2000');
		assert.equal(subscribe.months, 7);
		assert.equal(subscribe.displayText, 'Bea subscribed (Tier 2000)');
		assert.equal(subscribe.createdAt, '2026-05-02T12:00:00Z');

		const subscribeDefaults = eventFields(
			helpers.normalizeTwitchEvent('channel.subscribe', {
				user_name: 'Bea',
				started_at: '2026-05-02T12:00:00Z',
			})
		);
		assert.equal(subscribeDefaults.tier, '1000');
		assert.equal(subscribeDefaults.months, 1);

		const giftOne = eventFields(
			helpers.normalizeTwitchEvent('channel.subscription.gift', {
				user_name: 'Cara',
				started_at: '2026-05-03T12:00:00Z',
				total: 1,
			})
		);
		assert.equal(giftOne.type, 'gift_sub');
		assert.equal(giftOne.total, 1);
		assert.equal(giftOne.displayText, 'Cara gifted 1 sub');

		const giftMany = eventFields(
			helpers.normalizeTwitchEvent('channel.subscription.gift', {
				user_name: 'Cara',
				started_at: '2026-05-03T12:00:00Z',
				total: 5,
				tier: '3000',
			})
		);
		assert.equal(giftMany.total, 5);
		assert.equal(giftMany.tier, '3000');
		assert.equal(giftMany.displayText, 'Cara gifted 5 subs');

		const giftMissingTotal = eventFields(
			helpers.normalizeTwitchEvent('channel.subscription.gift', {
				user_name: 'Cara',
				started_at: '2026-05-03T12:00:00Z',
			})
		);
		assert.equal(giftMissingTotal.total, 1);

		const bits = eventFields(
			helpers.normalizeTwitchEvent('channel.cheer', {
				user_name: 'Drew',
				started_at: '2026-05-04T12:00:00Z',
				bits: 250,
			})
		);
		assert.equal(bits.type, 'bits');
		assert.equal(bits.bits, 250);
		assert.equal(bits.displayText, 'Drew cheered 250 bits');

		const bitsMissing = eventFields(
			helpers.normalizeTwitchEvent('channel.cheer', {
				user_name: 'Drew',
				started_at: '2026-05-04T12:00:00Z',
			})
		);
		assert.equal(bitsMissing.bits, 0);
		assert.equal(bitsMissing.displayText, 'Drew cheered 0 bits');

		const unknown = eventFields(
			helpers.normalizeTwitchEvent('channel.raid', {
				user_name: 'Eve',
				started_at: '2026-05-05T12:00:00Z',
			})
		);
		assert.equal(unknown.type, 'other');
		assert.equal(unknown.displayText, 'New Twitch activity');
		assert.match(unknown.createdAt, /^\d{4}-\d{2}-\d{2}T/);
	});
});

test('safeJsonParse returns the fallback for malformed payloads on both hosts', () => {
	assertHostParity((helpers) => {
		assert.equal(helpers.safeJsonParse('{"ok":true}').ok, true);
		assert.equal(helpers.safeJsonParse('not-json', null), null);
		assert.equal(helpers.safeJsonParse('{', 'fallback'), 'fallback');
		assert.equal(helpers.safeJsonParse('[]', null).length, 0);
	});
});
