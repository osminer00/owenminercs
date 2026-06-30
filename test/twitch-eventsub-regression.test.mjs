import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { handler } = require('../netlify/functions/twitch-eventsub.js');

const ENV_KEYS = ['TWITCH_EVENTSUB_SECRET', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'];

function jsonFetchResponse(payload, ok = true) {
	return {
		ok,
		text: async () => JSON.stringify(payload),
	};
}

function signedNotification({ messageId = 'message-1', secret = 'test-secret' } = {}) {
	const timestamp = new Date().toISOString();
	const body = JSON.stringify({
		subscription: { type: 'channel.follow' },
		event: {
			user_name: 'Bug Hunter',
			user_login: 'bughunter',
			followed_at: timestamp,
		},
	});
	const signature = `sha256=${crypto
		.createHmac('sha256', secret)
		.update(`${messageId}${timestamp}${body}`)
		.digest('hex')}`;

	return {
		httpMethod: 'POST',
		headers: {
			'twitch-eventsub-message-type': 'notification',
			'twitch-eventsub-message-id': messageId,
			'twitch-eventsub-message-timestamp': timestamp,
			'twitch-eventsub-message-signature': signature,
		},
		body,
	};
}

async function withMockedEventSubRuntime(mockFetch, callback) {
	const originalFetch = global.fetch;
	const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
	global.fetch = mockFetch;
	process.env.TWITCH_EVENTSUB_SECRET = 'test-secret';
	process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example';
	process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

	try {
		await callback();
	} finally {
		global.fetch = originalFetch;
		for (const key of ENV_KEYS) {
			if (originalEnv[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = originalEnv[key];
			}
		}
	}
}

test('Twitch EventSub write failures remain retryable instead of becoming duplicates', async () => {
	const fetchCalls = [];
	const responses = [
		jsonFetchResponse({ result: 'OK' }),
		new Error('temporary Upstash outage'),
		jsonFetchResponse({ result: null }),
		jsonFetchResponse({ result: 'processing' }),
		jsonFetchResponse({ result: 'OK' }),
		jsonFetchResponse([
			{ result: 1 },
			{ result: 'OK' },
			{ result: 'OK' },
			{ result: 1 },
			{ result: 1 },
			{ result: 'OK' },
		]),
	];

	await withMockedEventSubRuntime(
		async (url, options) => {
			fetchCalls.push({ url: String(url), body: JSON.parse(options.body) });
			const next = responses.shift();
			if (next instanceof Error) throw next;
			return next;
		},
		async () => {
			const failedAttempt = await handler(signedNotification());
			assert.equal(failedAttempt.statusCode, 500);

			const retryDuringProcessingLock = await handler(signedNotification());
			assert.equal(retryDuringProcessingLock.statusCode, 503);
			assert.equal(retryDuringProcessingLock.headers['Retry-After'], '5');

			const retryAfterProcessingLock = await handler(signedNotification());
			assert.equal(retryAfterProcessingLock.statusCode, 204);
		}
	);

	const firstClaim = fetchCalls.find((call) => call.body[0] === 'SET');
	assert.deepEqual(firstClaim.body, [
		'SET',
		'activity:twitch:seen:message-1',
		'processing',
		'NX',
		'EX',
		'30',
	]);

	const successfulPipeline = fetchCalls.filter((call) => call.url.endsWith('/pipeline')).at(-1);
	assert.ok(successfulPipeline, 'successful retry should persist the EventSub event');
	assert.deepEqual(successfulPipeline.body.at(-1), [
		'SET',
		'activity:twitch:seen:message-1',
		'processed',
		'EX',
		'86400',
	]);
	assert.equal(responses.length, 0);
});

test('Twitch EventSub processed markers still suppress true duplicates', async () => {
	const fetchCalls = [];
	const responses = [
		jsonFetchResponse({ result: null }),
		jsonFetchResponse({ result: 'processed' }),
	];

	await withMockedEventSubRuntime(
		async (url, options) => {
			fetchCalls.push({ url: String(url), body: JSON.parse(options.body) });
			return responses.shift();
		},
		async () => {
			const duplicateAttempt = await handler(signedNotification({ messageId: 'message-2' }));
			assert.equal(duplicateAttempt.statusCode, 200);
			assert.deepEqual(JSON.parse(duplicateAttempt.body), { ok: true, duplicate: true });
		}
	);

	assert.equal(
		fetchCalls.some((call) => call.url.endsWith('/pipeline')),
		false
	);
	assert.equal(responses.length, 0);
});
