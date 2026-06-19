import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const netlifyEventSub = require('../netlify/functions/twitch-eventsub.js');
const netlifySource = readFileSync(
	new URL('../netlify/functions/twitch-eventsub.js', import.meta.url),
	'utf8'
);
const cloudflareSource = readFileSync(
	new URL('../functions/api/twitch-eventsub.js', import.meta.url),
	'utf8'
);

const SECRET = 'test-eventsub-secret';

function signedNotification({ messageId = 'message-1', timestamp = new Date().toISOString() } = {}) {
	const body = JSON.stringify({
		subscription: { type: 'channel.follow' },
		event: {
			user_name: 'TestViewer',
			user_login: 'testviewer',
			followed_at: timestamp,
		},
	});
	const signature = `sha256=${crypto
		.createHmac('sha256', SECRET)
		.update(`${messageId}${timestamp}${body}`)
		.digest('hex')}`;
	return {
		httpMethod: 'POST',
		headers: {
			'twitch-eventsub-message-id': messageId,
			'twitch-eventsub-message-timestamp': timestamp,
			'twitch-eventsub-message-signature': signature,
			'twitch-eventsub-message-type': 'notification',
		},
		body,
	};
}

async function withMockedEventSubEnv(upstashResult, fn) {
	const oldEnv = {
		TWITCH_EVENTSUB_SECRET: process.env.TWITCH_EVENTSUB_SECRET,
		UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
		UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
	};
	const oldFetch = globalThis.fetch;
	const calls = [];
	process.env.TWITCH_EVENTSUB_SECRET = SECRET;
	process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.example.test';
	process.env.UPSTASH_REDIS_REST_TOKEN = 'redis-token';
	globalThis.fetch = async (_url, options = {}) => {
		calls.push(JSON.parse(String(options.body || '[]')));
		return new Response(JSON.stringify({ result: upstashResult }), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		});
	};

	try {
		return await fn(calls);
	} finally {
		globalThis.fetch = oldFetch;
		for (const [key, value] of Object.entries(oldEnv)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
}

test('Twitch EventSub persists idempotency and event writes in one Redis script', async () => {
	await withMockedEventSubEnv(1, async (commands) => {
		const response = await netlifyEventSub.handler(
			signedNotification({ messageId: 'atomic-message-1' })
		);

		assert.equal(response.statusCode, 204);
		assert.equal(commands.length, 1);
		const command = commands[0];
		assert.equal(command[0], 'EVAL');
		assert.match(command[1], /redis\.call\('SET', KEYS\[1], '1', 'NX', 'EX'/);
		assert.equal(command[2], '4');
		assert.equal(command[3], 'activity:twitch:seen:atomic-message-1');
		assert.equal(command[4], 'activity:twitch:events');
		assert.equal(command[5], 'activity:twitch:last_updated');
		assert.equal(command[6], 'activity:twitch:totals');
		assert.equal(command[7], '86400');
		assert.equal(command[9], '99');
		assert.equal(command[11], 'events_total');
		assert.equal(command[12], '1');
		assert.equal(command[13], 'follows_total');
		assert.equal(command[14], '1');
	});
});

test('Twitch EventSub duplicate script result skips without rewriting event data', async () => {
	await withMockedEventSubEnv(0, async (commands) => {
		const response = await netlifyEventSub.handler(
			signedNotification({ messageId: 'duplicate-message-1' })
		);

		assert.equal(response.statusCode, 200);
		assert.deepEqual(JSON.parse(response.body), { ok: true, duplicate: true });
		assert.equal(commands.length, 1);
		assert.equal(commands[0][0], 'EVAL');
	});
});

test('Twitch EventSub handlers do not use separate pre-write idempotency pipelines', () => {
	for (const [label, source] of [
		['Netlify', netlifySource],
		['Cloudflare', cloudflareSource],
	]) {
		assert.match(source, /const PERSIST_EVENT_SCRIPT = `/, `${label} handler uses the Lua script`);
		assert.match(source, /function persistEventCommand\(/, `${label} handler builds one command`);
		assert.doesNotMatch(source, /upstashPipeline/, `${label} handler avoids separate pipelines`);
		assert.doesNotMatch(
			source,
			/upstashCommand\([\s\S]*?['"]SET['"][\s\S]*?SEEN_MESSAGE_PREFIX/,
			`${label} handler should not set the seen key before writing event data`
		);
	}
});
