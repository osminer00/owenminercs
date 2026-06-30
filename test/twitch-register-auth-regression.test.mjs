import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workersSource = readFileSync(
	new URL('../functions/api/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);
const netlifySource = readFileSync(
	new URL('../netlify/functions/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);

function extractAuthHelpers(source) {
	const start = source.indexOf('const REGISTER_SECRET_HEADER');
	const end = source.indexOf('async function getAppAccessToken');
	assert.notEqual(start, -1, 'register secret header constant should exist');
	assert.notEqual(end, -1, 'auth helper block should end before token fetch');
	return source.slice(start, end);
}

function loadWorkersAuthHelpers() {
	return new Function(
		`${extractAuthHelpers(workersSource)}\nreturn { timingSafeEqual, isAuthorizedRequest };`
	)();
}

function loadNetlifyAuthHelpers() {
	return new Function(
		`${extractAuthHelpers(netlifySource)}\nreturn { timingSafeEqual, isAuthorizedRequest };`
	)();
}

function workersRequest(headers = {}) {
	const normalized = new Map(
		Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value])
	);
	return {
		headers: {
			get(name) {
				return normalized.get(String(name).toLowerCase()) ?? '';
			},
		},
	};
}

test('Twitch register timingSafeEqual coerces non-string inputs before comparing', () => {
	for (const { timingSafeEqual } of [loadWorkersAuthHelpers(), loadNetlifyAuthHelpers()]) {
		assert.equal(timingSafeEqual(123456, '123456'), true);
		assert.equal(timingSafeEqual(undefined, 'undefined'), true);
		assert.equal(timingSafeEqual(123456, '123'), false);
		assert.doesNotThrow(() => timingSafeEqual(undefined, undefined));
	}
});

test('Twitch register auth accepts bearer secrets only when header secret is absent', () => {
	const { isAuthorizedRequest } = loadWorkersAuthHelpers();

	assert.equal(
		isAuthorizedRequest(
			workersRequest({ authorization: 'Bearer correct-secret' }),
			'correct-secret'
		),
		true
	);
	assert.equal(
		isAuthorizedRequest(
			workersRequest({
				'x-twitch-register-secret': 'wrong-secret',
				authorization: 'Bearer correct-secret',
			}),
			'correct-secret'
		),
		false
	);
	assert.equal(isAuthorizedRequest(workersRequest({}), 'correct-secret'), false);
	assert.equal(
		isAuthorizedRequest(workersRequest({ 'x-twitch-register-secret': 'correct-secret' }), ''),
		false
	);
});

test('Netlify Twitch register auth reads headers case-insensitively', () => {
	const { isAuthorizedRequest } = loadNetlifyAuthHelpers();

	assert.equal(
		isAuthorizedRequest({ Authorization: 'Bearer correct-secret' }, 'correct-secret'),
		true
	);
	assert.equal(
		isAuthorizedRequest({ 'X-Twitch-Register-Secret': 'correct-secret' }, 'correct-secret'),
		true
	);
	assert.equal(
		isAuthorizedRequest(
			{
				'X-Twitch-Register-Secret': 'wrong-secret',
				Authorization: 'Bearer correct-secret',
			},
			'correct-secret'
		),
		false
	);
});
