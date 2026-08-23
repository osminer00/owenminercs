import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const cloudSource = readFileSync(
	new URL('../functions/api/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);
const netlifySource = readFileSync(
	new URL('../netlify/functions/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);

function extractFunction(source, functionName) {
	const syncStart = source.indexOf(`function ${functionName}`);
	const asyncStart = source.indexOf(`async function ${functionName}`);
	const start =
		asyncStart !== -1 && (syncStart === -1 || asyncStart < syncStart) ? asyncStart : syncStart;
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

function loadCloudAuth() {
	const sandbox = { String, Boolean };
	vm.createContext(sandbox);
	vm.runInContext(
		`
		const REGISTER_SECRET_HEADER = 'x-twitch-register-secret';
		${extractFunction(cloudSource, 'timingSafeEqual')}
		${extractFunction(cloudSource, 'isAuthorizedRequest')}
		this.__helpers = { timingSafeEqual, isAuthorizedRequest };
		`,
		sandbox
	);
	return sandbox.__helpers;
}

function loadNetlifyAuth() {
	const sandbox = { String, Boolean };
	vm.createContext(sandbox);
	vm.runInContext(
		`
		const REGISTER_SECRET_HEADER = 'x-twitch-register-secret';
		${extractFunction(netlifySource, 'timingSafeEqual')}
		${extractFunction(netlifySource, 'getHeader')}
		${extractFunction(netlifySource, 'isAuthorizedRequest')}
		this.__helpers = { timingSafeEqual, getHeader, isAuthorizedRequest };
		`,
		sandbox
	);
	return sandbox.__helpers;
}

function cloudRequest(headers) {
	const normalized = Object.fromEntries(
		Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
	);
	return {
		headers: {
			get(name) {
				const value = normalized[String(name).toLowerCase()];
				return value == null ? null : value;
			},
		},
	};
}

test('Twitch register timingSafeEqual coerces non-strings before comparing', () => {
	const cloud = loadCloudAuth();
	const netlify = loadNetlifyAuth();

	for (const helpers of [cloud, netlify]) {
		assert.equal(helpers.timingSafeEqual('secret', 'secret'), true);
		assert.equal(helpers.timingSafeEqual('secret', 'Secret'), false);
		assert.equal(helpers.timingSafeEqual('short', 'longer-secret'), false);
		assert.equal(helpers.timingSafeEqual(12345, '12345'), true);
		assert.equal(helpers.timingSafeEqual(12345, '12346'), false);
		assert.equal(helpers.timingSafeEqual('', ''), true);
	}
});

test('Cloudflare EventSub register accepts header or bearer secret and rejects mismatches', () => {
	const { isAuthorizedRequest } = loadCloudAuth();
	const expected = 'register-secret';

	assert.equal(
		isAuthorizedRequest(
			cloudRequest({ 'x-twitch-register-secret': 'register-secret' }),
			expected
		),
		true
	);
	assert.equal(
		isAuthorizedRequest(cloudRequest({ authorization: 'Bearer register-secret' }), expected),
		true
	);
	assert.equal(
		isAuthorizedRequest(cloudRequest({ authorization: 'BEARER register-secret' }), expected),
		true
	);
	assert.equal(
		isAuthorizedRequest(
			cloudRequest({
				'x-twitch-register-secret': 'register-secret',
				authorization: 'Bearer other-secret',
			}),
			expected
		),
		true
	);
	assert.equal(
		isAuthorizedRequest(cloudRequest({ 'x-twitch-register-secret': 'wrong' }), expected),
		false
	);
	assert.equal(isAuthorizedRequest(cloudRequest({}), expected), false);
	assert.equal(
		isAuthorizedRequest(cloudRequest({ 'x-twitch-register-secret': 'register-secret' }), ''),
		false
	);
	assert.equal(
		isAuthorizedRequest(cloudRequest({ 'x-twitch-register-secret': 12345 }), '12345'),
		true
	);
	assert.equal(isAuthorizedRequest(null, expected), false);
});

test('Netlify EventSub register reads headers case-insensitively and matches Cloudflare gates', () => {
	const { isAuthorizedRequest, getHeader } = loadNetlifyAuth();
	const expected = 'register-secret';

	assert.equal(getHeader({ 'X-Twitch-Register-Secret': 'abc' }, 'x-twitch-register-secret'), 'abc');
	assert.equal(getHeader({ Authorization: 'Bearer z' }, 'authorization'), 'Bearer z');
	assert.equal(getHeader({}, 'authorization'), '');

	assert.equal(
		isAuthorizedRequest({ 'X-Twitch-Register-Secret': 'register-secret' }, expected),
		true
	);
	assert.equal(isAuthorizedRequest({ authorization: 'Bearer register-secret' }, expected), true);
	assert.equal(isAuthorizedRequest({ Authorization: 'bearer register-secret' }, expected), true);
	assert.equal(isAuthorizedRequest({ 'x-twitch-register-secret': 'nope' }, expected), false);
	assert.equal(isAuthorizedRequest({}, expected), false);
	assert.equal(isAuthorizedRequest({ 'x-twitch-register-secret': 'register-secret' }, ''), false);
	assert.equal(isAuthorizedRequest({ 'x-twitch-register-secret': 12345 }, '12345'), true);
	assert.equal(isAuthorizedRequest(undefined, expected), false);
});
