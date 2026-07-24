import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const netlifyUtils = require('../netlify/functions/_twitch-utils.js');
const twitchEventsub = require('../netlify/functions/twitch-eventsub.js');

const SECRET = 'eventsub-test-secret';
const UPSTASH_URL = 'https://upstash.example/redis';
const UPSTASH_TOKEN = 'upstash-token';

function signTwitchMessage({ secret, messageId, timestamp, rawBody }) {
	const digest = createHmac('sha256', secret)
		.update(`${messageId}${timestamp}${rawBody}`)
		.digest('hex');
	return `sha256=${digest}`;
}

function freshTimestamp(offsetMs = 0) {
	return new Date(Date.now() + offsetMs).toISOString();
}

async function withEnv(overrides, fn) {
	const previous = new Map();
	for (const key of Object.keys(overrides)) {
		previous.set(key, Object.hasOwn(process.env, key) ? process.env[key] : undefined);
		const value = overrides[key];
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}

	try {
		return await fn();
	} finally {
		for (const [key, value] of previous) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
}

async function withFetch(fakeFetch, fn) {
	const previous = globalThis.fetch;
	globalThis.fetch = fakeFetch;
	try {
		return await fn();
	} finally {
		globalThis.fetch = previous;
	}
}

function parseBody(response) {
	return response.body ? JSON.parse(response.body) : null;
}

async function signedPost({
	messageType,
	payload,
	messageId = 'msg-1',
	timestamp = freshTimestamp(),
	secret = SECRET,
	tamperSignature = false,
}) {
	const rawBody = JSON.stringify(payload);
	const signature = signTwitchMessage({ secret, messageId, timestamp, rawBody });
	return twitchEventsub.handler({
		httpMethod: 'POST',
		headers: {
			'twitch-eventsub-message-type': messageType,
			'twitch-eventsub-message-id': messageId,
			'twitch-eventsub-message-timestamp': timestamp,
			'twitch-eventsub-message-signature': tamperSignature ? `${signature}ff` : signature,
		},
		body: rawBody,
	});
}

test('Netlify verifyTwitchSignature accepts valid HMAC and rejects tampered values', () => {
	const messageId = 'abc123';
	const timestamp = freshTimestamp();
	const rawBody = '{"challenge":"ok"}';
	const signature = signTwitchMessage({ secret: SECRET, messageId, timestamp, rawBody });

	assert.equal(
		netlifyUtils.verifyTwitchSignature({
			secret: SECRET,
			messageId,
			timestamp,
			rawBody,
			signature,
		}),
		true
	);
	assert.equal(
		netlifyUtils.verifyTwitchSignature({
			secret: SECRET,
			messageId,
			timestamp,
			rawBody,
			signature: `${signature}00`,
		}),
		false
	);
	assert.equal(
		netlifyUtils.verifyTwitchSignature({
			secret: SECRET,
			messageId: '',
			timestamp,
			rawBody,
			signature,
		}),
		false
	);
});

test('Cloudflare and Netlify normalizeTwitchEvent map follow/sub/gift/bits edge cases', async () => {
	const cloudflareUtils = await import('../functions/api/_twitch-utils.js');

	for (const utils of [netlifyUtils, cloudflareUtils]) {
		const follow = utils.normalizeTwitchEvent('channel.follow', {
			user_name: 'ViewerOne',
			followed_at: '2026-07-01T12:00:00Z',
		});
		assert.equal(follow.type, 'follow');
		assert.equal(follow.displayText, 'ViewerOne followed');
		assert.equal(follow.createdAt, '2026-07-01T12:00:00Z');

		const sub = utils.normalizeTwitchEvent('channel.subscribe', {
			user_name: 'Subscriber',
			tier: '2000',
			cumulative_months: '4',
			started_at: '2026-07-02T12:00:00Z',
		});
		assert.equal(sub.type, 'subscribe');
		assert.equal(sub.tier, '2000');
		assert.equal(sub.months, 4);
		assert.equal(sub.displayText, 'Subscriber subscribed (Tier 2000)');

		const gift = utils.normalizeTwitchEvent('channel.subscription.gift', {
			user_name: 'Gifter',
			total: '3',
			tier: '1000',
			started_at: '2026-07-03T12:00:00Z',
		});
		assert.equal(gift.type, 'gift_sub');
		assert.equal(gift.total, 3);
		assert.equal(gift.displayText, 'Gifter gifted 3 subs');

		const bits = utils.normalizeTwitchEvent('channel.cheer', {
			user_login: 'cheerer',
			bits: '500',
			started_at: '2026-07-04T12:00:00Z',
		});
		assert.equal(bits.type, 'bits');
		assert.equal(bits.bits, 500);
		assert.equal(bits.userName, 'cheerer');
		assert.equal(bits.displayText, 'Someone cheered 500 bits');

		const unknown = utils.normalizeTwitchEvent('channel.raid', {});
		assert.equal(unknown.type, 'other');
		assert.equal(unknown.displayText, 'New Twitch activity');
	}
});

test('EventSub webhook rejects stale and invalid signatures before touching Redis', async () => {
	let fetchCount = 0;

	await withEnv(
		{
			TWITCH_EVENTSUB_SECRET: SECRET,
			UPSTASH_REDIS_REST_URL: UPSTASH_URL,
			UPSTASH_REDIS_REST_TOKEN: UPSTASH_TOKEN,
		},
		async () => {
			await withFetch(async () => {
				fetchCount += 1;
				throw new Error('Redis must not be contacted for rejected webhook requests');
			}, async () => {
				const stale = await signedPost({
					messageType: 'notification',
					payload: { subscription: { type: 'channel.follow' }, event: {} },
					timestamp: freshTimestamp(-11 * 60 * 1000),
				});
				assert.equal(stale.statusCode, 403);
				assert.deepEqual(parseBody(stale), {
					error: 'Stale or invalid message timestamp.',
				});

				const badSig = await signedPost({
					messageType: 'notification',
					payload: { subscription: { type: 'channel.follow' }, event: {} },
					tamperSignature: true,
				});
				assert.equal(badSig.statusCode, 403);
				assert.deepEqual(parseBody(badSig), {
					error: 'Invalid Twitch EventSub signature.',
				});

				assert.equal(fetchCount, 0);
			});
		}
	);
});

test('EventSub webhook verification challenge returns plain challenge without Redis writes', async () => {
	let fetchCount = 0;

	await withEnv(
		{
			TWITCH_EVENTSUB_SECRET: SECRET,
			UPSTASH_REDIS_REST_URL: UPSTASH_URL,
			UPSTASH_REDIS_REST_TOKEN: UPSTASH_TOKEN,
		},
		async () => {
			await withFetch(async () => {
				fetchCount += 1;
				throw new Error('challenge verification should not call Redis');
			}, async () => {
				const response = await signedPost({
					messageType: 'webhook_callback_verification',
					payload: { challenge: 'challenge-token-123' },
				});
				assert.equal(response.statusCode, 200);
				assert.equal(response.body, 'challenge-token-123');
				assert.match(response.headers['Content-Type'], /text\/plain/);
				assert.equal(fetchCount, 0);
			});
		}
	);
});

test('EventSub webhook marks duplicates and persists new follow notifications with stats', async () => {
	const redisCalls = [];

	await withEnv(
		{
			TWITCH_EVENTSUB_SECRET: SECRET,
			UPSTASH_REDIS_REST_URL: UPSTASH_URL,
			UPSTASH_REDIS_REST_TOKEN: UPSTASH_TOKEN,
		},
		async () => {
			await withFetch(async (url, options = {}) => {
				const href = String(url);
				const body = JSON.parse(options.body);
				redisCalls.push({ href, body });

				if (href === UPSTASH_URL) {
					const key = body[1];
					if (key === 'activity:twitch:seen:dup-1') {
						return {
							ok: true,
							async text() {
								return JSON.stringify({ result: null });
							},
						};
					}
					return {
						ok: true,
						async text() {
							return JSON.stringify({ result: 'OK' });
						},
					};
				}

				if (href === `${UPSTASH_URL}/pipeline`) {
					return {
						ok: true,
						async text() {
							return JSON.stringify(body.map(() => ({ result: 'OK' })));
						},
					};
				}

				throw new Error(`Unexpected Redis URL: ${href}`);
			}, async () => {
				const duplicate = await signedPost({
					messageType: 'notification',
					messageId: 'dup-1',
					payload: {
						subscription: { type: 'channel.follow' },
						event: { user_name: 'DupViewer', followed_at: '2026-07-05T01:00:00Z' },
					},
				});
				assert.equal(duplicate.statusCode, 200);
				assert.deepEqual(parseBody(duplicate), { ok: true, duplicate: true });
				assert.equal(redisCalls.length, 1);
				assert.equal(redisCalls[0].href, UPSTASH_URL);

				const created = await signedPost({
					messageType: 'notification',
					messageId: 'new-1',
					payload: {
						subscription: { type: 'channel.follow' },
						event: { user_name: 'FreshViewer', followed_at: '2026-07-05T02:00:00Z' },
					},
				});
				assert.equal(created.statusCode, 204);
				assert.equal(created.body, '');
				assert.equal(redisCalls.length, 3);
				assert.equal(redisCalls[1].href, UPSTASH_URL);
				assert.deepEqual(redisCalls[1].body.slice(0, 3), [
					'SET',
					'activity:twitch:seen:new-1',
					'1',
				]);
				assert.equal(redisCalls[2].href, `${UPSTASH_URL}/pipeline`);
				assert.equal(redisCalls[2].body[0][0], 'LPUSH');
				assert.equal(redisCalls[2].body[0][1], 'activity:twitch:events');
				const stored = JSON.parse(redisCalls[2].body[0][2]);
				assert.equal(stored.type, 'follow');
				assert.equal(stored.displayText, 'FreshViewer followed');
				assert.deepEqual(redisCalls[2].body[3], [
					'HINCRBY',
					'activity:twitch:totals',
					'events_total',
					'1',
				]);
				assert.deepEqual(redisCalls[2].body[4], [
					'HINCRBY',
					'activity:twitch:totals',
					'follows_total',
					'1',
				]);
			});
		}
	);
});

test('Cloudflare verifyTwitchSignature matches the Netlify HMAC contract', async () => {
	const cloudflareUtils = await import('../functions/api/_twitch-utils.js');
	const messageId = 'cf-msg';
	const timestamp = freshTimestamp();
	const rawBody = '{"ok":true}';
	const signature = signTwitchMessage({ secret: SECRET, messageId, timestamp, rawBody });

	assert.equal(
		await cloudflareUtils.verifyTwitchSignature({
			secret: SECRET,
			messageId,
			timestamp,
			rawBody,
			signature,
		}),
		true
	);
	assert.equal(
		await cloudflareUtils.verifyTwitchSignature({
			secret: SECRET,
			messageId,
			timestamp,
			rawBody,
			signature: 'sha256=deadbeef',
		}),
		false
	);
});
