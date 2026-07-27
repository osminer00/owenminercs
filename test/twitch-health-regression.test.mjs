import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function cloudflareJson(payload, status = 200) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8' },
	});
}

function loadCloudflareTwitchHealth({ upstashCommand, fetchImpl }) {
	const source = readWorkspaceFile('functions/api/twitch-health.js')
		.replace(/import\s*\{[\s\S]*?\}\s*from\s*'\.\/_twitch-utils';/, '')
		.replace(/export async function/g, 'async function');

	const context = {
		Response,
		URLSearchParams,
		Date,
		String,
		Boolean,
		fetch: fetchImpl,
		json: cloudflareJson,
		safeJsonParse(input, fallback = null) {
			try {
				return JSON.parse(input);
			} catch {
				return fallback;
			}
		},
		requireEnv(env, name) {
			const value = env?.[name];
			if (!value) throw new Error(`Missing required environment variable: ${name}`);
			return value;
		},
		upstashCommand,
		callbackUrl(siteUrl) {
			const trimmed = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
			return `${trimmed}/api/twitch-eventsub`;
		},
		globalThis: {},
	};

	vm.runInNewContext(
		`${source}\nglobalThis.__exports = { onRequestGet, onRequest };`,
		context
	);
	return context.globalThis.__exports;
}

function loadNetlifyTwitchHealth({ upstashCommand, fetchImpl, env = {} }) {
	const source = readWorkspaceFile('netlify/functions/twitch-health.js').replace(
		/const \{[\s\S]*?\} = require\('\.\/_twitch-utils'\);/,
		''
	);

	const exports = {};
	const context = {
		exports,
		fetch: fetchImpl,
		process: { env },
		URLSearchParams,
		Date,
		String,
		Boolean,
		json(statusCode, payload) {
			return {
				statusCode,
				headers: { 'Content-Type': 'application/json; charset=utf-8' },
				body: JSON.stringify(payload),
			};
		},
		safeJsonParse(input, fallback = null) {
			try {
				return JSON.parse(input);
			} catch {
				return fallback;
			}
		},
		upstashCommand,
	};

	vm.runInNewContext(source, context);
	return { handler: exports.handler };
}

const FULL_ENV = {
	TWITCH_CLIENT_ID: 'client-id',
	TWITCH_CLIENT_SECRET: 'client-secret',
	TWITCH_EVENTSUB_SECRET: 'eventsub-secret',
	TWITCH_BROADCASTER_ID: 'broadcaster-1',
	PUBLIC_SITE_URL: 'https://owenminercs.com/',
	UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
	UPSTASH_REDIS_REST_TOKEN: 'token',
};

test('Cloudflare twitch-health reports missing env without calling Upstash or Twitch', async () => {
	let upstashCalls = 0;
	let fetchCalls = 0;
	const { onRequestGet } = loadCloudflareTwitchHealth({
		upstashCommand: async () => {
			upstashCalls += 1;
			return 'PONG';
		},
		fetchImpl: async () => {
			fetchCalls += 1;
			throw new Error('should not fetch');
		},
	});

	const response = await onRequestGet({ env: { PUBLIC_SITE_URL: 'https://owenminercs.com' } });
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.ok, false);
	assert.ok(body.missing.includes('TWITCH_CLIENT_ID'));
	assert.ok(body.missing.includes('UPSTASH_REDIS_REST_TOKEN'));
	assert.equal(body.checks.upstash.skipped, true);
	assert.equal(body.checks.twitchAuth.skipped, true);
	assert.equal(body.callback, 'https://owenminercs.com/api/twitch-eventsub');
	assert.equal(upstashCalls, 0);
	assert.equal(fetchCalls, 0);
});

test('Cloudflare twitch-health requires both Upstash PONG and Twitch token for ok', async () => {
	const pingCommands = [];
	const { onRequestGet } = loadCloudflareTwitchHealth({
		upstashCommand: async (_env, command) => {
			pingCommands.push(Array.from(command));
			return 'pong';
		},
		fetchImpl: async () => ({
			ok: true,
			status: 200,
			async text() {
				return JSON.stringify({ access_token: 'token' });
			},
		}),
	});

	const okResponse = await onRequestGet({ env: FULL_ENV });
	const okBody = await okResponse.json();
	assert.equal(okResponse.status, 200);
	assert.equal(okBody.ok, true);
	assert.equal(okBody.missing.length, 0);
	assert.equal(okBody.checks.upstash.ok, true);
	assert.equal(okBody.checks.twitchAuth.ok, true);
	assert.equal(okBody.callback, 'https://owenminercs.com/api/twitch-eventsub');
	assert.equal(pingCommands.length, 1);
	assert.equal(pingCommands[0][0], 'PING');
	assert.equal(pingCommands[0].length, 1);

	const { onRequestGet: onRequestGetFailAuth } = loadCloudflareTwitchHealth({
		upstashCommand: async () => 'PONG',
		fetchImpl: async () => ({
			ok: false,
			status: 401,
			async text() {
				return JSON.stringify({ message: 'invalid client' });
			},
		}),
	});
	const failBody = await (await onRequestGetFailAuth({ env: FULL_ENV })).json();
	assert.equal(failBody.ok, false);
	assert.equal(failBody.checks.upstash.ok, true);
	assert.equal(failBody.checks.twitchAuth.ok, false);
	assert.equal(failBody.checks.twitchAuth.detail, 'invalid client');
});

test('Cloudflare twitch-health rejects non-GET methods', async () => {
	const { onRequest } = loadCloudflareTwitchHealth({
		upstashCommand: async () => 'PONG',
		fetchImpl: async () => {
			throw new Error('unused');
		},
	});
	const response = await onRequest();
	assert.equal(response.status, 405);
	assert.deepEqual(await response.json(), { error: 'Method not allowed. Use GET.' });
});

test('Netlify twitch-health mirrors missing-env skip and healthy aggregation', async () => {
	let upstashCalls = 0;
	let fetchCalls = 0;

	const missing = loadNetlifyTwitchHealth({
		env: { PUBLIC_SITE_URL: 'https://owenminercs.com/' },
		upstashCommand: async () => {
			upstashCalls += 1;
			return 'PONG';
		},
		fetchImpl: async () => {
			fetchCalls += 1;
			throw new Error('should not fetch');
		},
	});
	const missingResponse = await missing.handler({ httpMethod: 'GET' });
	const missingBody = JSON.parse(missingResponse.body);
	assert.equal(missingResponse.statusCode, 200);
	assert.equal(missingBody.ok, false);
	assert.ok(missingBody.missing.includes('TWITCH_CLIENT_SECRET'));
	assert.equal(missingBody.checks.upstash.skipped, true);
	assert.equal(missingBody.callback, 'https://owenminercs.com/.netlify/functions/twitch-eventsub');
	assert.equal(upstashCalls, 0);
	assert.equal(fetchCalls, 0);

	const pingCommands = [];
	const healthy = loadNetlifyTwitchHealth({
		env: FULL_ENV,
		upstashCommand: async (command) => {
			pingCommands.push(Array.from(command));
			return 'PONG';
		},
		fetchImpl: async () => ({
			ok: true,
			status: 200,
			async text() {
				return JSON.stringify({ access_token: 'token' });
			},
		}),
	});
	const healthyResponse = await healthy.handler({ httpMethod: 'POST' });
	assert.equal(healthyResponse.statusCode, 405);

	const getResponse = await healthy.handler({ httpMethod: 'GET' });
	const getBody = JSON.parse(getResponse.body);
	assert.equal(getResponse.statusCode, 200);
	assert.equal(getBody.ok, true);
	assert.equal(getBody.checks.upstash.ok, true);
	assert.equal(getBody.checks.twitchAuth.ok, true);
	assert.equal(pingCommands.length, 1);
	assert.equal(pingCommands[0][0], 'PING');
	assert.equal(pingCommands[0].length, 1);
});
