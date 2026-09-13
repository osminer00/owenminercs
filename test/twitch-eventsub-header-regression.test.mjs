import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const eventsubSource = readFileSync(
	new URL('../netlify/functions/twitch-eventsub.js', import.meta.url),
	'utf8'
);
const registerSource = readFileSync(
	new URL('../netlify/functions/twitch-register-eventsub.js', import.meta.url),
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

function loadHeaderHelpers() {
	const sandbox = {
		String,
		Object,
		Boolean,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		const eventsubGetHeader = (() => {
			${extractFunction(eventsubSource, 'getHeader')}
			return getHeader;
		})();
		const registerGetHeader = (() => {
			${extractFunction(registerSource, 'getHeader')}
			return getHeader;
		})();
		this.__helpers = { eventsubGetHeader, registerGetHeader };
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'header helpers should load');
	return sandbox.__helpers;
}

test('Netlify EventSub getHeader only reads the exact name or its lowercase form', () => {
	const { eventsubGetHeader } = loadHeaderHelpers();

	assert.equal(eventsubGetHeader(null, 'twitch-eventsub-message-id'), '');
	assert.equal(eventsubGetHeader(undefined, 'twitch-eventsub-message-id'), '');

	assert.equal(
		eventsubGetHeader(
			{ 'twitch-eventsub-message-id': 'msg-exact' },
			'twitch-eventsub-message-id'
		),
		'msg-exact'
	);
	assert.equal(
		eventsubGetHeader(
			{ 'Twitch-Eventsub-Message-Id': 'msg-title' },
			'Twitch-Eventsub-Message-Id'
		),
		'msg-title'
	);
	assert.equal(
		eventsubGetHeader(
			{ 'twitch-eventsub-message-timestamp': '2026-09-13T10:00:00Z' },
			'Twitch-Eventsub-Message-Timestamp'
		),
		'2026-09-13T10:00:00Z'
	);
	assert.equal(
		eventsubGetHeader(
			{ 'Twitch-Eventsub-Message-Id': 'title-only' },
			'twitch-eventsub-message-id'
		),
		''
	);
	assert.equal(eventsubGetHeader({ 'x-other': '1' }, 'twitch-eventsub-message-type'), '');
});

test('Netlify register getHeader matches header names case-insensitively', () => {
	const { registerGetHeader } = loadHeaderHelpers();

	assert.equal(registerGetHeader(null, 'x-twitch-register-secret'), '');
	assert.equal(registerGetHeader({}, 'x-twitch-register-secret'), '');

	assert.equal(
		registerGetHeader(
			{ 'X-Twitch-Register-Secret': 'from-title' },
			'x-twitch-register-secret'
		),
		'from-title'
	);
	assert.equal(
		registerGetHeader({ AUTHORIZATION: 'Bearer abc' }, 'authorization'),
		'Bearer abc'
	);
	assert.equal(
		registerGetHeader({ 'x-twitch-register-secret': 'from-lower' }, 'X-TWITCH-REGISTER-SECRET'),
		'from-lower'
	);
	assert.equal(registerGetHeader({ authorization: 'Bearer abc' }, 'x-twitch-register-secret'), '');
});
