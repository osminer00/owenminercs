import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const TWITCH_SECRET = 'test-eventsub-secret';
const REDIS_URL = 'https://redis.example.test';
const REDIS_TOKEN = 'test-redis-token';

function twitchSignature({ messageId, timestamp, rawBody }) {
	return `sha256=${createHmac('sha256', TWITCH_SECRET)
		.update(`${messageId}${timestamp}${rawBody}`)
		.digest('hex')}`;
}

function createNotification(messageId) {
	const timestamp = new Date().toISOString();
	const rawBody = JSON.stringify({
		subscription: { type: 'channel.follow' },
		event: {
			user_id: '123',
			user_login: 'retrytester',
			user_name: 'RetryTester',
			followed_at: timestamp,
		},
	});

	return {
		rawBody,
		headers: {
			'twitch-eventsub-message-type': 'notification',
			'twitch-eventsub-message-id': messageId,
			'twitch-eventsub-message-timestamp': timestamp,
			'twitch-eventsub-message-signature': twitchSignature({ messageId, timestamp, rawBody }),
		},
	};
}

function commandResponse(result) {
	return new Response(JSON.stringify({ result }), { status: 200 });
}

function pipelineResponse() {
	return new Response(JSON.stringify([{ result: 1 }]), { status: 200 });
}

function pipelineFailureResponse() {
	return new Response('temporary redis outage', { status: 503 });
}

async function withFetchSteps(steps, callback) {
	const originalFetch = globalThis.fetch;
	const calls = [];
	globalThis.fetch = async (url, options = {}) => {
		const body = JSON.parse(options.body);
		calls.push({ url: String(url), body });
		assert.ok(steps.length > 0, `unexpected Redis call: ${JSON.stringify(body)}`);
		return steps.shift()({ url: String(url), body });
	};

	try {
		const result = await callback(calls);
		assert.equal(steps.length, 0, 'all expected Redis calls should be consumed');
		return result;
	} finally {
		globalThis.fetch = originalFetch;
	}
}

async function importCloudflareEventSub() {
	const dir = mkdtempSync(join(tmpdir(), 'twitch-eventsub-'));
	const utilsSource = readFileSync(
		new URL('../functions/api/_twitch-utils.js', import.meta.url),
		'utf8'
	);
	const handlerSource = readFileSync(
		new URL('../functions/api/twitch-eventsub.js', import.meta.url),
		'utf8'
	).replace("from './_twitch-utils';", "from './_twitch-utils.mjs';");

	writeFileSync(join(dir, '_twitch-utils.mjs'), utilsSource);
	writeFileSync(join(dir, 'twitch-eventsub.mjs'), handlerSource);

	const moduleUrl = pathToFileURL(join(dir, 'twitch-eventsub.mjs')).href;
	const mod = await import(`${moduleUrl}?cacheBust=${Date.now()}-${Math.random()}`);
	return {
		handler: mod.onRequestPost,
		cleanup: () => rmSync(dir, { recursive: true, force: true }),
	};
}

function cloudflareContext(notification) {
	return {
		env: {
			TWITCH_EVENTSUB_SECRET: TWITCH_SECRET,
			UPSTASH_REDIS_REST_URL: REDIS_URL,
			UPSTASH_REDIS_REST_TOKEN: REDIS_TOKEN,
		},
		request: new Request('https://example.test/api/twitch-eventsub', {
			method: 'POST',
			headers: notification.headers,
			body: notification.rawBody,
		}),
	};
}

function netlifyEvent(notification) {
	return {
		httpMethod: 'POST',
		headers: notification.headers,
		body: notification.rawBody,
	};
}

function setNetlifyEnv() {
	const previous = {
		TWITCH_EVENTSUB_SECRET: process.env.TWITCH_EVENTSUB_SECRET,
		UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
		UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
	};
	process.env.TWITCH_EVENTSUB_SECRET = TWITCH_SECRET;
	process.env.UPSTASH_REDIS_REST_URL = REDIS_URL;
	process.env.UPSTASH_REDIS_REST_TOKEN = REDIS_TOKEN;
	return () => {
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	};
}

function expectProcessingClaim(messageId) {
	return ({ body }) => {
		assert.deepEqual(body, [
			'SET',
			`activity:twitch:seen:${messageId}`,
			'processing',
			'NX',
			'EX',
			'60',
		]);
		return commandResponse('OK');
	};
}

function expectPersistedMark(messageId) {
	return ({ body }) => {
		assert.deepEqual(body, [
			'SET',
			`activity:twitch:seen:${messageId}`,
			'persisted',
			'EX',
			'86400',
		]);
		return commandResponse('OK');
	};
}

function expectEventPipeline({ shouldFail = false } = {}) {
	return ({ url, body }) => {
		assert.equal(url, `${REDIS_URL}/pipeline`);
		assert.equal(body[0][0], 'LPUSH');
		assert.equal(body[0][1], 'activity:twitch:events');
		assert.equal(body[1][0], 'LTRIM');
		assert.equal(body[2][0], 'SET');
		assert.equal(body[2][1], 'activity:twitch:last_updated');
		return shouldFail ? pipelineFailureResponse() : pipelineResponse();
	};
}

test('Cloudflare EventSub retries can persist after a transient Redis pipeline failure', async () => {
	const messageId = 'cloudflare-retryable-message';
	const firstDelivery = createNotification(messageId);
	const retryDelivery = createNotification(messageId);
	const { handler, cleanup } = await importCloudflareEventSub();

	try {
		await withFetchSteps(
			[
				expectProcessingClaim(messageId),
				expectEventPipeline({ shouldFail: true }),
				expectProcessingClaim(messageId),
				expectEventPipeline(),
				expectPersistedMark(messageId),
			],
			async (calls) => {
				const firstResponse = await handler(cloudflareContext(firstDelivery));
				assert.equal(firstResponse.status, 500);

				const retryResponse = await handler(cloudflareContext(retryDelivery));
				assert.equal(retryResponse.status, 204);

				const persistedMarks = calls.filter(
					(call) =>
						Array.isArray(call.body) &&
						call.body[0] === 'SET' &&
						call.body[2] === 'persisted'
				);
				assert.equal(persistedMarks.length, 1, 'only the successful retry marks the message persisted');
			}
		);
	} finally {
		cleanup();
	}
});

test('Cloudflare EventSub keeps in-flight messages retryable instead of acknowledging duplicates', async () => {
	const messageId = 'cloudflare-processing-message';
	const notification = createNotification(messageId);
	const { handler, cleanup } = await importCloudflareEventSub();

	try {
		await withFetchSteps(
			[
				() => commandResponse(null),
				({ body }) => {
					assert.deepEqual(body, ['GET', `activity:twitch:seen:${messageId}`]);
					return commandResponse('processing');
				},
			],
			async () => {
				const response = await handler(cloudflareContext(notification));
				assert.equal(response.status, 500);
			}
		);
	} finally {
		cleanup();
	}
});

test('Netlify EventSub mirrors retryable persistence and legacy duplicate handling', async () => {
	const restoreEnv = setNetlifyEnv();
	const { handler } = require('../netlify/functions/twitch-eventsub.js');
	const retryableMessageId = 'netlify-retryable-message';
	const legacyMessageId = 'netlify-legacy-message';
	const firstDelivery = createNotification(retryableMessageId);
	const retryDelivery = createNotification(retryableMessageId);
	const legacyDelivery = createNotification(legacyMessageId);

	try {
		await withFetchSteps(
			[
				expectProcessingClaim(retryableMessageId),
				expectEventPipeline({ shouldFail: true }),
				expectProcessingClaim(retryableMessageId),
				expectEventPipeline(),
				expectPersistedMark(retryableMessageId),
				() => commandResponse(null),
				({ body }) => {
					assert.deepEqual(body, ['GET', `activity:twitch:seen:${legacyMessageId}`]);
					return commandResponse('1');
				},
			],
			async () => {
				const firstResponse = await handler(netlifyEvent(firstDelivery));
				assert.equal(firstResponse.statusCode, 500);

				const retryResponse = await handler(netlifyEvent(retryDelivery));
				assert.equal(retryResponse.statusCode, 204);

				const legacyResponse = await handler(netlifyEvent(legacyDelivery));
				assert.equal(legacyResponse.statusCode, 200);
				assert.deepEqual(JSON.parse(legacyResponse.body), { ok: true, duplicate: true });
			}
		);
	} finally {
		restoreEnv();
	}
});
