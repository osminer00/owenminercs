import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

const searchHtml = readFileSync(new URL('../search.html', import.meta.url), 'utf8');
const searchPageScript = readFileSync(new URL('../scripts/search-page.js', import.meta.url), 'utf8');
const redirects = readFileSync(new URL('../_redirects', import.meta.url), 'utf8');
const cloudflareTwitchEventSub = readFileSync(
	new URL('../functions/api/twitch-eventsub.js', import.meta.url),
	'utf8'
);

function signTwitchMessage(secret, messageId, timestamp, body) {
	return `sha256=${crypto
		.createHmac('sha256', secret)
		.update(`${messageId}${timestamp}${body}`)
		.digest('hex')}`;
}

function upstashResponse(status, payload) {
	return new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), { status });
}

test('search page works from /search and /search/ rewrite targets', () => {
	assert.match(redirects, /^\/search\s+\/search\.html\s+200$/m);
	assert.match(redirects, /^\/search\/\s+\/search\.html\s+200$/m);

	assert.match(searchHtml, /href="\/css\/owenminercs\.css"/);
	assert.match(searchHtml, /src="\/scripts\/components\.js"/);
	assert.match(searchHtml, /src="\/scripts\/search-page\.js"/);
	assert.match(searchHtml, /src="\/scripts\/support-links\.js"/);
	assert.doesNotMatch(searchHtml, /(?:href|src)="(?:\.\/)?(?:css|scripts)\//);

	assert.match(searchHtml, /<form[\s\S]*role="search"[\s\S]*data-owen-site-search/);
	assert.match(searchHtml, /id="site-search-page-input"[\s\S]*name="q"/);
	assert.match(searchHtml, /action="\/search"/);
	assert.match(searchPageScript, /const inputEl = document\.getElementById\('site-search-page-input'\);/);
	assert.match(searchPageScript, /if \(inputEl\) inputEl\.value = q;/);
});

test('Netlify Twitch EventSub releases idempotency key when event persistence fails', async (t) => {
	const originalFetch = globalThis.fetch;
	const originalEnv = {
		TWITCH_EVENTSUB_SECRET: process.env.TWITCH_EVENTSUB_SECRET,
		UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
		UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
	};
	t.after(() => {
		globalThis.fetch = originalFetch;
		for (const [key, value] of Object.entries(originalEnv)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	});

	process.env.TWITCH_EVENTSUB_SECRET = 'test-secret';
	process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example';
	process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

	const calls = [];
	globalThis.fetch = async (url, options) => {
		const body = JSON.parse(options.body);
		calls.push({ url: String(url), body });
		if (String(url).endsWith('/pipeline')) {
			return upstashResponse(500, 'temporary outage');
		}
		return upstashResponse(200, { result: body[0] === 'DEL' ? 1 : 'OK' });
	};

	const messageId = 'eventsub-message-1';
	const timestamp = new Date().toISOString();
	const body = JSON.stringify({
		subscription: { type: 'channel.follow' },
		event: { user_name: 'RetryUser', followed_at: timestamp },
	});
	const signature = signTwitchMessage(
		process.env.TWITCH_EVENTSUB_SECRET,
		messageId,
		timestamp,
		body
	);

	const { handler } = require('../netlify/functions/twitch-eventsub.js');
	const result = await handler({
		httpMethod: 'POST',
		headers: {
			'twitch-eventsub-message-id': messageId,
			'twitch-eventsub-message-timestamp': timestamp,
			'twitch-eventsub-message-signature': signature,
			'twitch-eventsub-message-type': 'notification',
		},
		body,
	});

	assert.equal(result.statusCode, 500);
	assert.equal(calls.length, 3);
	assert.equal(calls[0].body[0], 'SET');
	assert.equal(calls[1].body[0][0], 'LPUSH');
	assert.deepEqual(calls[2].body, ['DEL', `activity:twitch:seen:${messageId}`]);
});

test('Cloudflare Twitch EventSub has the same retry-safe idempotency cleanup', () => {
	assert.match(cloudflareTwitchEventSub, /async function releaseIdempotencyClaim\(env, key\)/);
	assert.match(cloudflareTwitchEventSub, /await upstashCommand\(env, \['DEL', key\]\);/);
	assert.match(
		cloudflareTwitchEventSub,
		/if \(idempotencyClaimed\) await releaseIdempotencyClaim\(env, idempotencyKey\);/
	);
});
