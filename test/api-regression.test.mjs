import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

function fetchResponse(payload, options = {}) {
	const { ok = true, status = ok ? 200 : 500 } = options;
	const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
	return {
		ok,
		status,
		text: async () => body,
		json: async () => JSON.parse(body),
	};
}

function twitchSignature(secret, messageId, timestamp, rawBody) {
	return `sha256=${crypto.createHmac('sha256', secret).update(`${messageId}${timestamp}${rawBody}`).digest('hex')}`;
}

function makeTwitchNotificationEvent({ secret, messageId }) {
	const timestamp = new Date().toISOString();
	const body = JSON.stringify({
		subscription: { type: 'channel.follow' },
		event: {
			user_name: 'Retry Tester',
			user_login: 'retrytester',
			followed_at: timestamp,
		},
	});

	return {
		httpMethod: 'POST',
		headers: {
			'twitch-eventsub-message-type': 'notification',
			'twitch-eventsub-message-id': messageId,
			'twitch-eventsub-message-timestamp': timestamp,
			'twitch-eventsub-message-signature': twitchSignature(
				secret,
				messageId,
				timestamp,
				body
			),
		},
		body,
	};
}

function youtubeFeedXml() {
	return `<?xml version="1.0" encoding="UTF-8"?>
		<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/">
			<entry>
				<yt:videoId>video-three</yt:videoId>
				<title>Video Three</title>
				<published>2026-06-03T12:00:00Z</published>
				<media:description>Third video</media:description>
				<media:thumbnail url="https://img.example.com/three.jpg" />
			</entry>
			<entry>
				<yt:videoId>video-two</yt:videoId>
				<title>Video Two</title>
				<published>2026-06-02T12:00:00Z</published>
				<media:description>Second video</media:description>
				<media:thumbnail url="https://img.example.com/two.jpg" />
			</entry>
			<entry>
				<yt:videoId>video-one</yt:videoId>
				<title>Video One</title>
				<published>2026-06-01T12:00:00Z</published>
				<media:description>First video</media:description>
				<media:thumbnail url="https://img.example.com/one.jpg" />
			</entry>
		</feed>`;
}

test('Twitch EventSub retries are not acknowledged as duplicates after persistence fails', async (t) => {
	const { handler } = require('../netlify/functions/twitch-eventsub.js');
	const originalFetch = globalThis.fetch;
	const originalRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
	const originalRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
	const originalSecret = process.env.TWITCH_EVENTSUB_SECRET;
	const secret = 'unit-test-secret';
	const calls = [];
	let pipelineAttempts = 0;

	process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.test';
	process.env.UPSTASH_REDIS_REST_TOKEN = 'redis-token';
	process.env.TWITCH_EVENTSUB_SECRET = secret;
	globalThis.fetch = async (url, init) => {
		const command = JSON.parse(init.body);
		calls.push({ url: String(url), command });

		if (String(url).endsWith('/pipeline')) {
			pipelineAttempts += 1;
			if (pipelineAttempts === 1) {
				return fetchResponse({ error: 'temporary outage' }, { ok: false, status: 500 });
			}
			return fetchResponse([
				{ result: 1 },
				{ result: 'OK' },
				{ result: 'OK' },
				{ result: 1 },
			]);
		}

		if (command[0] === 'SET') return fetchResponse({ result: 'OK' });
		if (command[0] === 'DEL') return fetchResponse({ result: 1 });
		if (command[0] === 'GET') return fetchResponse({ result: 'processing' });
		throw new Error(`Unexpected Redis command: ${JSON.stringify(command)}`);
	};

	t.after(() => {
		globalThis.fetch = originalFetch;
		if (originalRedisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
		else process.env.UPSTASH_REDIS_REST_URL = originalRedisUrl;
		if (originalRedisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
		else process.env.UPSTASH_REDIS_REST_TOKEN = originalRedisToken;
		if (originalSecret === undefined) delete process.env.TWITCH_EVENTSUB_SECRET;
		else process.env.TWITCH_EVENTSUB_SECRET = originalSecret;
	});

	const event = makeTwitchNotificationEvent({ secret, messageId: 'retry-message-1' });
	const firstAttempt = await handler(event);
	assert.equal(firstAttempt.statusCode, 500);
	assert.ok(
		calls.some(
			(call) =>
				call.command[0] === 'DEL' &&
				call.command[1] === 'activity:twitch:seen:retry-message-1'
		),
		'failed persistence should clear the temporary idempotency marker'
	);

	const retryAttempt = await handler(event);
	assert.equal(retryAttempt.statusCode, 204);
	assert.equal(
		pipelineAttempts,
		2,
		'the retry should attempt persistence instead of returning duplicate'
	);
	assert.ok(
		calls.some(
			(call) =>
				call.command[0] === 'SET' &&
				call.command[1] === 'activity:twitch:seen:retry-message-1' &&
				call.command[2] === 'processed'
		),
		'successful persistence should mark the message processed'
	);
});

test('social feed cache keeps low-limit responses from truncating normal responses', async (t) => {
	const socialFeedUrl = new URL('../functions/api/social-feed.js', import.meta.url);
	socialFeedUrl.search = `?cache-bust=${Date.now()}`;
	const { onRequestGet } = await import(socialFeedUrl.href);
	const originalFetch = globalThis.fetch;
	const fetchUrls = [];

	globalThis.fetch = async (url) => {
		const requestUrl = String(url);
		fetchUrls.push(requestUrl);
		if (requestUrl.startsWith('https://www.youtube.com/@')) {
			return fetchResponse('<html><body>UC12345678901234567890</body></html>');
		}
		if (requestUrl.startsWith('https://www.youtube.com/feeds/videos.xml')) {
			return fetchResponse(youtubeFeedXml());
		}
		throw new Error(`Unexpected fetch URL: ${requestUrl}`);
	};

	t.after(() => {
		globalThis.fetch = originalFetch;
	});

	const env = { YOUTUBE_USERNAME: 'OwenMinerCS' };
	const limitedResponse = await onRequestGet({
		request: new Request('https://example.test/api/social-feed?limit=1'),
		env,
	});
	const limitedPayload = await limitedResponse.json();
	assert.equal(limitedPayload.items.length, 1);

	const defaultResponse = await onRequestGet({
		request: new Request('https://example.test/api/social-feed'),
		env,
	});
	const defaultPayload = await defaultResponse.json();
	assert.equal(defaultPayload.items.length, 3);
	assert.equal(defaultPayload.cache.hit, false);
	assert.equal(
		fetchUrls.filter((url) => url.startsWith('https://www.youtube.com/feeds/videos.xml'))
			.length,
		2,
		'default-limit response should fetch its own payload instead of reusing the limit=1 cache entry'
	);
});
