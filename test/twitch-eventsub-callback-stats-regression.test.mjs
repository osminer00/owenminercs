import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const cloudUtilsSource = readFileSync(
	new URL('../functions/api/_twitch-utils.js', import.meta.url),
	'utf8'
);
const cloudEventSubSource = readFileSync(
	new URL('../functions/api/twitch-eventsub.js', import.meta.url),
	'utf8'
);
const netlifyEventSubSource = readFileSync(
	new URL('../netlify/functions/twitch-eventsub.js', import.meta.url),
	'utf8'
);
const netlifyRegisterSource = readFileSync(
	new URL('../netlify/functions/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);
const netlifyHealthSource = readFileSync(
	new URL('../netlify/functions/twitch-health.js', import.meta.url),
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

function extractConstAssignment(source, name) {
	const start = source.indexOf(`const ${name} =`);
	assert.notEqual(start, -1, `${name} should exist`);
	const end = source.indexOf(';', start);
	assert.notEqual(end, -1, `${name} assignment should end`);
	return source.slice(start, end + 1);
}

function copyCommands(commands) {
	return Array.from(commands, (command) => Array.from(command, (part) => String(part)));
}

function loadTwitchHelpers(nowMs) {
	const DateStub = {
		parse: Date.parse,
		now() {
			return nowMs;
		},
	};
	const sandbox = {
		String,
		Math,
		Number,
		Date: DateStub,
		TOTALS_HASH_KEY: 'activity:twitch:totals',
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		const cloudCallbackUrl = (() => {
			${extractFunction(cloudUtilsSource, 'callbackUrl')}
			return callbackUrl;
		})();
		const netlifyRegisterCallbackUrl = (() => {
			${extractFunction(netlifyRegisterSource, 'callbackUrl')}
			return callbackUrl;
		})();
		const netlifyHealthCallbackUrl = (() => {
			${extractFunction(netlifyHealthSource, 'callbackUrl')}
			return callbackUrl;
		})();
		${extractConstAssignment(cloudEventSubSource, 'MAX_AGE_MS')}
		const cloudMaxAgeMs = MAX_AGE_MS;
		const cloudMessageIsFresh = (() => {
			${extractFunction(cloudEventSubSource, 'messageIsFresh')}
			return messageIsFresh;
		})();
		const netlifyMessageIsFresh = (() => {
			${extractFunction(netlifyEventSubSource, 'messageIsFresh')}
			return messageIsFresh;
		})();
		const cloudStatCommandsForEvent = (() => {
			${extractFunction(cloudEventSubSource, 'statCommandsForEvent')}
			return statCommandsForEvent;
		})();
		const netlifyStatCommandsForEvent = (() => {
			${extractFunction(netlifyEventSubSource, 'statCommandsForEvent')}
			return statCommandsForEvent;
		})();
		this.__helpers = {
			cloudCallbackUrl,
			netlifyRegisterCallbackUrl,
			netlifyHealthCallbackUrl,
			cloudMessageIsFresh,
			netlifyMessageIsFresh,
			cloudMaxAgeMs,
			cloudStatCommandsForEvent,
			netlifyStatCommandsForEvent,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('Cloudflare and Netlify EventSub callback URLs strip trailing slashes and keep host-specific paths', () => {
	const {
		cloudCallbackUrl,
		netlifyRegisterCallbackUrl,
		netlifyHealthCallbackUrl,
	} = loadTwitchHelpers(0);

	assert.equal(
		cloudCallbackUrl('https://owenminercs.com'),
		'https://owenminercs.com/api/twitch-eventsub'
	);
	assert.equal(
		cloudCallbackUrl('https://owenminercs.com/'),
		'https://owenminercs.com/api/twitch-eventsub'
	);
	assert.equal(
		netlifyRegisterCallbackUrl('https://owenminercs.com/'),
		'https://owenminercs.com/.netlify/functions/twitch-eventsub'
	);
	assert.equal(
		netlifyHealthCallbackUrl('https://owenminercs.com'),
		'https://owenminercs.com/.netlify/functions/twitch-eventsub'
	);
	assert.notEqual(
		cloudCallbackUrl('https://owenminercs.com'),
		netlifyRegisterCallbackUrl('https://owenminercs.com')
	);
});

test('statCommandsForEvent increments follow/sub/gift/bits totals and matches Cloudflare with Netlify', () => {
	const { cloudStatCommandsForEvent, netlifyStatCommandsForEvent } = loadTwitchHelpers(0);

	const follow = copyCommands(cloudStatCommandsForEvent({ type: 'follow' }));
	assert.deepEqual(follow, [
		['HINCRBY', 'activity:twitch:totals', 'events_total', '1'],
		['HINCRBY', 'activity:twitch:totals', 'follows_total', '1'],
	]);
	assert.deepEqual(copyCommands(netlifyStatCommandsForEvent({ type: 'follow' })), follow);

	const sub = copyCommands(cloudStatCommandsForEvent({ type: 'subscribe' }));
	assert.deepEqual(sub, [
		['HINCRBY', 'activity:twitch:totals', 'events_total', '1'],
		['HINCRBY', 'activity:twitch:totals', 'subs_total', '1'],
	]);
	assert.deepEqual(copyCommands(netlifyStatCommandsForEvent({ type: 'subscribe' })), sub);

	const gift = copyCommands(cloudStatCommandsForEvent({ type: 'gift_sub', total: 5 }));
	assert.deepEqual(gift, [
		['HINCRBY', 'activity:twitch:totals', 'events_total', '1'],
		['HINCRBY', 'activity:twitch:totals', 'gift_events_total', '1'],
		['HINCRBY', 'activity:twitch:totals', 'gift_subs_total', '5'],
	]);
	assert.deepEqual(
		copyCommands(netlifyStatCommandsForEvent({ type: 'gift_sub', total: 5 })),
		gift
	);

	const emptyGift = copyCommands(cloudStatCommandsForEvent({ type: 'gift_sub' }));
	assert.equal(emptyGift[2][3], '0');

	const bits = copyCommands(cloudStatCommandsForEvent({ type: 'bits', bits: 42 }));
	assert.deepEqual(bits, [
		['HINCRBY', 'activity:twitch:totals', 'events_total', '1'],
		['HINCRBY', 'activity:twitch:totals', 'bits_total', '42'],
	]);
	assert.deepEqual(copyCommands(netlifyStatCommandsForEvent({ type: 'bits', bits: 42 })), bits);

	const unknown = copyCommands(cloudStatCommandsForEvent({ type: 'other' }));
	assert.deepEqual(unknown, [['HINCRBY', 'activity:twitch:totals', 'events_total', '1']]);
	assert.deepEqual(copyCommands(netlifyStatCommandsForEvent({ type: 'raid' })), unknown);
});

test('messageIsFresh rejects invalid and stale EventSub timestamps on both hosts', () => {
	const now = Date.parse('2026-09-03T10:00:00.000Z');
	const { cloudMessageIsFresh, netlifyMessageIsFresh, cloudMaxAgeMs } = loadTwitchHelpers(now);

	assert.equal(cloudMaxAgeMs, 10 * 60 * 1000);
	assert.equal(cloudMessageIsFresh('not-a-date'), false);
	assert.equal(cloudMessageIsFresh(''), false);
	assert.equal(netlifyMessageIsFresh(undefined), false);

	assert.equal(cloudMessageIsFresh(new Date(now).toISOString()), true);
	assert.equal(netlifyMessageIsFresh(new Date(now).toISOString()), true);
	assert.equal(cloudMessageIsFresh(new Date(now - cloudMaxAgeMs).toISOString()), true);
	assert.equal(cloudMessageIsFresh(new Date(now - cloudMaxAgeMs - 1).toISOString()), false);
	assert.equal(
		netlifyMessageIsFresh(new Date(now + cloudMaxAgeMs + 1).toISOString()),
		false
	);
});
