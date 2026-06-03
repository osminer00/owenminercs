import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const functionsApiSource = readFileSync(
	new URL('../functions/api/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);
const netlifySource = readFileSync(
	new URL('../netlify/functions/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const paramsEnd = source.indexOf(')', start);
	assert.notEqual(paramsEnd, -1, `${functionName} should have parameters`);

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

function buildFunctionsApiAuth() {
	return Function(`
const REGISTER_SECRET_HEADER = 'x-twitch-register-secret';
${extractFunction(functionsApiSource, 'timingSafeEqual')}
${extractFunction(functionsApiSource, 'isAuthorizedRequest')}
return { timingSafeEqual, isAuthorizedRequest };
`)();
}

function buildNetlifyAuth() {
	return Function(`
const REGISTER_SECRET_HEADER = 'x-twitch-register-secret';
${extractFunction(netlifySource, 'timingSafeEqual')}
${extractFunction(netlifySource, 'getHeader')}
${extractFunction(netlifySource, 'isAuthorizedRequest')}
return { timingSafeEqual, getHeader, isAuthorizedRequest };
`)();
}

function requestWithHeaders(headers) {
	const lowerCaseHeaders = Object.fromEntries(
		Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
	);

	return {
		headers: {
			get(name) {
				return lowerCaseHeaders[String(name).toLowerCase()] || '';
			},
		},
	};
}

test('Twitch registration constant-time comparison accepts non-string inputs safely', () => {
	for (const source of [buildFunctionsApiAuth(), buildNetlifyAuth()]) {
		assert.doesNotThrow(() => source.timingSafeEqual(123, '123'));
		assert.equal(source.timingSafeEqual(123, '123'), true);
		assert.equal(source.timingSafeEqual(123, '456'), false);
	}
});

test('Cloudflare Twitch registration auth accepts header or bearer secret', () => {
	const { isAuthorizedRequest } = buildFunctionsApiAuth();

	assert.equal(
		isAuthorizedRequest(requestWithHeaders({ 'x-twitch-register-secret': 'expected-secret' }), 'expected-secret'),
		true
	);
	assert.equal(
		isAuthorizedRequest(requestWithHeaders({ authorization: 'Bearer expected-secret' }), 'expected-secret'),
		true
	);
});

test('Cloudflare Twitch registration auth rejects missing or mismatched secrets', () => {
	const { isAuthorizedRequest } = buildFunctionsApiAuth();

	assert.equal(isAuthorizedRequest(requestWithHeaders({}), 'expected-secret'), false);
	assert.equal(
		isAuthorizedRequest(requestWithHeaders({ 'x-twitch-register-secret': 'wrong-secret' }), 'expected-secret'),
		false
	);
	assert.equal(
		isAuthorizedRequest(requestWithHeaders({ 'x-twitch-register-secret': 'expected-secret' }), ''),
		false
	);
});

test('Netlify Twitch registration auth handles case-insensitive headers and bearer fallback', () => {
	const { getHeader, isAuthorizedRequest } = buildNetlifyAuth();

	assert.equal(
		getHeader({ 'X-Twitch-Register-Secret': 'expected-secret' }, 'x-twitch-register-secret'),
		'expected-secret'
	);
	assert.equal(
		isAuthorizedRequest({ 'X-Twitch-Register-Secret': 'expected-secret' }, 'expected-secret'),
		true
	);
	assert.equal(isAuthorizedRequest({ Authorization: 'Bearer expected-secret' }, 'expected-secret'), true);
});

test('Netlify Twitch registration auth rejects missing or mismatched secrets', () => {
	const { isAuthorizedRequest } = buildNetlifyAuth();

	assert.equal(isAuthorizedRequest({}, 'expected-secret'), false);
	assert.equal(isAuthorizedRequest({ 'x-twitch-register-secret': 'wrong-secret' }, 'expected-secret'), false);
	assert.equal(isAuthorizedRequest({ 'x-twitch-register-secret': 'expected-secret' }, ''), false);
});
