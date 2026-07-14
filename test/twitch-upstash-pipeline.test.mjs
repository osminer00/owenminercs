import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const REDIS_URL = 'https://redis.example.test';
const REDIS_TOKEN = 'test-redis-token';

async function importCloudflareUtils() {
	const dir = mkdtempSync(join(tmpdir(), 'owen-twitch-utils-'));
	const source = readFileSync(new URL('../functions/api/_twitch-utils.js', import.meta.url), 'utf8');
	writeFileSync(join(dir, '_twitch-utils.mjs'), source);
	const moduleUrl = pathToFileURL(join(dir, '_twitch-utils.mjs')).href;
	const mod = await import(`${moduleUrl}?cacheBust=${Date.now()}-${Math.random()}`);
	return {
		upstashPipeline: mod.upstashPipeline,
		cleanup: () => rmSync(dir, { recursive: true, force: true }),
	};
}

async function withPipelineErrorResponse(callback) {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (url, options = {}) => {
		assert.equal(String(url), `${REDIS_URL}/pipeline`);
		assert.deepEqual(JSON.parse(options.body), [['LPUSH', 'activity:twitch:events', '{}']]);
		return new Response(JSON.stringify([{ result: 1 }, { error: 'ERR command failed' }]), {
			status: 200,
		});
	};

	try {
		await callback();
	} finally {
		globalThis.fetch = originalFetch;
	}
}

test('Cloudflare Upstash pipeline rejects embedded command errors', async () => {
	const { upstashPipeline, cleanup } = await importCloudflareUtils();
	try {
		await withPipelineErrorResponse(async () => {
			await assert.rejects(
				() =>
					upstashPipeline(
						{
							UPSTASH_REDIS_REST_URL: REDIS_URL,
							UPSTASH_REDIS_REST_TOKEN: REDIS_TOKEN,
						},
						[['LPUSH', 'activity:twitch:events', '{}']]
					),
				/ERR command failed/
			);
		});
	} finally {
		cleanup();
	}
});

test('Netlify Upstash pipeline rejects embedded command errors', async () => {
	const previous = {
		UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
		UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
	};
	process.env.UPSTASH_REDIS_REST_URL = REDIS_URL;
	process.env.UPSTASH_REDIS_REST_TOKEN = REDIS_TOKEN;

	try {
		const { upstashPipeline } = require('../netlify/functions/_twitch-utils.js');
		await withPipelineErrorResponse(async () => {
			await assert.rejects(
				() => upstashPipeline([['LPUSH', 'activity:twitch:events', '{}']]),
				/ERR command failed/
			);
		});
	} finally {
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
});
