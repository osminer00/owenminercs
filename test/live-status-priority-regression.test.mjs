import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function loadCloudflareLiveStatus(fetchImpl) {
	const source = readWorkspaceFile('functions/api/live-status.js')
		.replace('export async function onRequestGet', 'async function onRequestGet')
		.replace('export async function onRequest', 'async function onRequest');
	const context = {
		Response,
		URL,
		URLSearchParams,
		fetch: fetchImpl,
		globalThis: {},
	};
	vm.runInNewContext(`${source}\nglobalThis.__exports = { onRequestGet, onRequest };`, context);
	return context.globalThis.__exports;
}

function loadNetlifyLiveStatus(fetchImpl, env = {}) {
	const source = readWorkspaceFile('netlify/functions/live-status.js');
	const exports = {};
	const context = {
		exports,
		fetch: fetchImpl,
		process: { env },
		URL,
		URLSearchParams,
	};
	vm.runInNewContext(source, context);
	return { handler: exports.handler, env };
}

function jsonResponse(payload, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		async json() {
			return payload;
		},
		async text() {
			return JSON.stringify(payload);
		},
	};
}

test('Cloudflare live-status prefers manual override over Twitch/YouTube', async () => {
	let fetchCalls = 0;
	const { onRequestGet } = loadCloudflareLiveStatus(async () => {
		fetchCalls += 1;
		throw new Error('network should not be used when manual override is live');
	});

	const response = await onRequestGet({
		env: {
			LIVE_OVERRIDE_IS_LIVE: '1',
			LIVE_OVERRIDE_PLATFORM: 'IRL',
			LIVE_OVERRIDE_URL: 'https://example.com/live',
			TWITCH_CLIENT_ID: 'id',
			TWITCH_CLIENT_SECRET: 'secret',
			TWITCH_BROADCASTER_ID: '123',
			YOUTUBE_API_KEY: 'key',
			YOUTUBE_CHANNEL_ID: 'channel',
		},
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.deepEqual(body, {
		live: true,
		platform: 'IRL',
		url: 'https://example.com/live',
		title: '',
		source: 'manual',
	});
	assert.equal(fetchCalls, 0);
});

test('Cloudflare live-status continues to YouTube after Twitch errors', async () => {
	const { onRequestGet } = loadCloudflareLiveStatus(async (input) => {
		const url = String(input);
		if (url.includes('id.twitch.tv')) {
			throw new Error('twitch token unavailable');
		}
		if (url.includes('googleapis.com/youtube')) {
			return jsonResponse({
				items: [
					{
						id: { videoId: 'yt-live-1' },
						snippet: { title: 'YouTube Live' },
					},
				],
			});
		}
		throw new Error(`Unexpected fetch: ${url}`);
	});

	const response = await onRequestGet({
		env: {
			TWITCH_CLIENT_ID: 'id',
			TWITCH_CLIENT_SECRET: 'secret',
			TWITCH_BROADCASTER_ID: '123',
			YOUTUBE_API_KEY: 'key',
			YOUTUBE_CHANNEL_ID: 'channel',
		},
	});
	const body = await response.json();

	assert.equal(body.live, true);
	assert.equal(body.source, 'youtube');
	assert.equal(body.platform, 'YouTube');
	assert.equal(body.url, 'https://www.youtube.com/watch?v=yt-live-1');
	assert.equal(body.title, 'YouTube Live');
});

test('Netlify live-status collects source errors and falls back when nothing is live', async () => {
	const { handler, env } = loadNetlifyLiveStatus(async (input) => {
		const url = String(input);
		if (url.includes('id.twitch.tv')) {
			return jsonResponse({ access_token: 'token' });
		}
		if (url.includes('api.twitch.tv/helix/streams')) {
			throw new Error('twitch streams down');
		}
		if (url.includes('googleapis.com/youtube')) {
			return jsonResponse({ items: [] });
		}
		throw new Error(`Unexpected fetch: ${url}`);
	}, {
		TWITCH_CLIENT_ID: 'id',
		TWITCH_CLIENT_SECRET: 'secret',
		TWITCH_BROADCASTER_ID: '123',
		YOUTUBE_API_KEY: 'key',
		YOUTUBE_CHANNEL_ID: 'channel',
	});

	const response = await handler({ httpMethod: 'GET' });
	const body = JSON.parse(response.body);

	assert.equal(response.statusCode, 200);
	assert.equal(body.live, false);
	assert.equal(body.source, 'fallback');
	assert.equal(body.url, 'https://x.com/OwenMiner');
	assert.equal(body.errors.length, 1);
	assert.equal(body.errors[0].source, 'twitch');
	assert.match(body.errors[0].message, /twitch streams down/);
	assert.equal(env.TWITCH_CLIENT_ID, 'id');
});
