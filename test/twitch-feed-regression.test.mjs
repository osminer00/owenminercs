import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const paramsStart = source.indexOf('(', start);
	assert.notEqual(paramsStart, -1, `${functionName} should have parameters`);

	let parenDepth = 0;
	let paramsEnd = -1;
	for (let i = paramsStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '(') parenDepth += 1;
		if (char === ')') {
			parenDepth -= 1;
			if (parenDepth === 0) {
				paramsEnd = i;
				break;
			}
		}
	}
	assert.notEqual(paramsEnd, -1, `${functionName} parameter list should close`);

	const braceStart = source.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${functionName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(start, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function cloudflareJson(payload, status = 200) {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8' },
	});
}

function safeJsonParse(input, fallback = null) {
	try {
		return JSON.parse(input);
	} catch {
		return fallback;
	}
}

function loadParsePositiveInt(relativePath) {
	const source = readWorkspaceFile(relativePath);
	const sandbox = { Number };
	vm.runInNewContext(
		[
			extractFunction(source, 'parsePositiveInt'),
			'this.parsePositiveInt = parsePositiveInt;',
		].join('\n'),
		sandbox
	);
	return sandbox.parsePositiveInt;
}

function loadCloudflareTwitchFeed({ upstashPipeline, upstashCommand }) {
	const source = readWorkspaceFile('functions/api/twitch-feed.js')
		.replace(/import\s*\{[\s\S]*?\}\s*from\s*'\.\/_twitch-utils';/, '')
		.replace(/export async function/g, 'async function');

	const context = {
		Response,
		URL,
		Date,
		Math,
		Number,
		String,
		Array,
		Object,
		Boolean,
		json: cloudflareJson,
		safeJsonParse,
		upstashPipeline,
		upstashCommand,
		EVENT_LIST_KEY: 'activity:twitch:events',
		TOTALS_HASH_KEY: 'activity:twitch:totals',
		LAST_UPDATED_KEY: 'activity:twitch:last_updated',
		globalThis: {},
	};

	vm.runInNewContext(
		`${source}\nglobalThis.__exports = { onRequestGet, onRequestOptions };`,
		context
	);
	return context.globalThis.__exports;
}

function loadNetlifyTwitchFeed({ upstashPipeline, upstashCommand }) {
	const source = readWorkspaceFile('netlify/functions/twitch-feed.js').replace(
		/const \{[\s\S]*?\} = require\('\.\/_twitch-utils'\);/,
		''
	);

	const exports = {};
	const context = {
		exports,
		Date,
		Math,
		Number,
		String,
		Array,
		Object,
		Boolean,
		json(statusCode, payload) {
			return {
				statusCode,
				headers: { 'Content-Type': 'application/json; charset=utf-8' },
				body: JSON.stringify(payload),
			};
		},
		safeJsonParse,
		upstashPipeline,
		upstashCommand,
	};

	vm.runInNewContext(source, context);
	return { handler: exports.handler };
}

for (const runtime of [
	{ label: 'Cloudflare', path: 'functions/api/twitch-feed.js' },
	{ label: 'Netlify', path: 'netlify/functions/twitch-feed.js' },
]) {
	test(`${runtime.label} twitch-feed parsePositiveInt falls back and accepts positives`, () => {
		const parsePositiveInt = loadParsePositiveInt(runtime.path);
		assert.equal(parsePositiveInt(undefined, 30), 30);
		assert.equal(parsePositiveInt('', 30), 30);
		assert.equal(parsePositiveInt('0', 30), 30);
		assert.equal(parsePositiveInt('-3', 30), 30);
		assert.equal(parsePositiveInt('nope', 30), 30);
		assert.equal(parsePositiveInt('12', 30), 12);
		assert.equal(parsePositiveInt('12.9', 30), 12);
	});
}

test('Cloudflare twitch-feed clamps limit, drops corrupt events, and ignores unknown totals', async () => {
	const pipelineCalls = [];
	const { onRequestGet } = loadCloudflareTwitchFeed({
		upstashPipeline: async (_env, commands) => {
			pipelineCalls.push(commands);
			return [
				{
					result: [
						JSON.stringify({ id: 'older', createdAt: '2026-01-01T00:00:00.000Z' }),
						'{not-json',
						JSON.stringify({ id: 'newer', createdAt: '2026-02-01T00:00:00.000Z' }),
						'null',
					],
				},
				{
					result: [
						'events_total',
						'4',
						'bits_total',
						'12',
						'unknown_field',
						'999',
						'follows_total',
						'not-a-number',
					],
				},
			];
		},
		upstashCommand: async () => '2026-02-01T12:00:00.000Z',
	});

	const response = await onRequestGet({
		request: new Request('https://owenminercs.com/api/twitch-feed?limit=999'),
		env: {},
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.ok, true);
	assert.equal(pipelineCalls.length, 1);
	const lrange = Array.from(pipelineCalls[0][0]);
	assert.equal(lrange[0], 'LRANGE');
	assert.equal(lrange[1], 'activity:twitch:events');
	assert.equal(lrange[2], '0');
	assert.equal(lrange[3], '79');
	assert.equal(body.events.length, 2);
	assert.equal(body.events[0].id, 'newer');
	assert.equal(body.events[1].id, 'older');
	assert.equal(body.totals.events_total, 4);
	assert.equal(body.totals.bits_total, 12);
	assert.equal(body.totals.follows_total, 0);
	assert.equal(Object.hasOwn(body.totals, 'unknown_field'), false);
	assert.equal(body.lastUpdated, '2026-02-01T12:00:00.000Z');
});

test('Cloudflare twitch-feed uses default limit and returns 500 when Upstash fails', async () => {
	const pipelineCalls = [];
	const { onRequestGet } = loadCloudflareTwitchFeed({
		upstashPipeline: async (_env, commands) => {
			pipelineCalls.push(commands);
			throw new Error('redis down');
		},
		upstashCommand: async () => null,
	});

	const response = await onRequestGet({
		request: new Request('https://owenminercs.com/api/twitch-feed'),
		env: {},
	});
	const body = await response.json();

	assert.equal(response.status, 500);
	assert.equal(body.error, 'Failed to load Twitch feed.');
	assert.match(body.detail, /redis down/);
	const lrange = Array.from(pipelineCalls[0][0]);
	assert.equal(lrange[0], 'LRANGE');
	assert.equal(lrange[1], 'activity:twitch:events');
	assert.equal(lrange[2], '0');
	assert.equal(lrange[3], '29');
});

test('Netlify twitch-feed mirrors limit clamping, filtering, and method guard', async () => {
	const pipelineCalls = [];
	const { handler } = loadNetlifyTwitchFeed({
		upstashPipeline: async (commands) => {
			pipelineCalls.push(commands);
			return [
				{
					result: [
						JSON.stringify({ id: 'b', createdAt: '2026-03-01T00:00:00.000Z' }),
						'nope',
						JSON.stringify({ id: 'a', createdAt: '2026-04-01T00:00:00.000Z' }),
					],
				},
				{ result: ['subs_total', '7', 'gift_subs_total', '2'] },
			];
		},
		upstashCommand: async () => null,
	});

	const methodResponse = await handler({ httpMethod: 'POST', queryStringParameters: {} });
	assert.equal(methodResponse.statusCode, 405);

	const response = await handler({
		httpMethod: 'GET',
		queryStringParameters: { limit: '1000' },
	});
	const body = JSON.parse(response.body);

	assert.equal(response.statusCode, 200);
	assert.equal(body.ok, true);
	const lrange = Array.from(pipelineCalls[0][0]);
	assert.equal(lrange[0], 'LRANGE');
	assert.equal(lrange[1], 'activity:twitch:events');
	assert.equal(lrange[2], '0');
	assert.equal(lrange[3], '79');
	assert.equal(body.events.length, 2);
	assert.equal(body.events[0].id, 'a');
	assert.equal(body.events[1].id, 'b');
	assert.equal(body.totals.subs_total, 7);
	assert.equal(body.totals.gift_subs_total, 2);
	assert.equal(body.totals.events_total, 0);
	assert.equal(body.lastUpdated, null);
});
