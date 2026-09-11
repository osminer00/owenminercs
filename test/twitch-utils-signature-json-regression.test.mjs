import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import crypto from 'node:crypto';

const cloudflareSource = readFileSync(
	new URL('../functions/api/_twitch-utils.js', import.meta.url),
	'utf8'
);
const netlifySource = readFileSync(
	new URL('../netlify/functions/_twitch-utils.js', import.meta.url),
	'utf8'
);

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

function loadHelpers() {
	const sandbox = {
		String,
		JSON,
		Response,
		crypto,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		this.__helpers = {
			cloudflare: (function () {
				${extractFunction(cloudflareSource, 'json')}
				${extractFunction(cloudflareSource, 'text')}
				${extractFunction(cloudflareSource, 'timingSafeEqual')}
				return { json, text, timingSafeEqual };
			})(),
			netlify: (function () {
				${extractFunction(netlifySource, 'json')}
				${extractFunction(netlifySource, 'twitchSignature')}
				return { json, twitchSignature };
			})(),
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers?.cloudflare, 'Cloudflare twitch utils should load');
	assert.ok(sandbox.__helpers?.netlify, 'Netlify twitch utils should load');
	return sandbox.__helpers;
}

test('Cloudflare timingSafeEqual accepts equal strings and rejects length or byte mismatches', () => {
	const helpers = loadHelpers().cloudflare;

	assert.equal(helpers.timingSafeEqual('', ''), true);
	assert.equal(helpers.timingSafeEqual('sha256=abc', 'sha256=abc'), true);
	assert.equal(helpers.timingSafeEqual('sha256=abc', 'sha256=abd'), false);
	assert.equal(helpers.timingSafeEqual('short', 'longer'), false);
	assert.equal(helpers.timingSafeEqual('abcd', 'ab'), false);
});

test('Netlify twitchSignature prefixes HMAC-SHA256 hex with sha256=', () => {
	const helpers = loadHelpers().netlify;
	const secret = 'eventsub-secret';
	const message = 'id-1' + '2026-09-11T10:00:00Z' + '{"ok":true}';
	const expected = `sha256=${createHmac('sha256', secret).update(message).digest('hex')}`;

	assert.equal(helpers.twitchSignature(secret, message), expected);
	assert.match(helpers.twitchSignature(secret, message), /^sha256=[0-9a-f]{64}$/);
	assert.notEqual(helpers.twitchSignature(secret, message), helpers.twitchSignature(secret, message + 'x'));
});

test('Cloudflare json and text responses set status, content-type, and extra headers', async () => {
	const helpers = loadHelpers().cloudflare;
	const jsonResponse = helpers.json({ ok: true, n: 2 }, 201, { 'x-test': '1' });

	assert.equal(jsonResponse.status, 201);
	assert.equal(jsonResponse.headers.get('content-type'), 'application/json; charset=utf-8');
	assert.equal(jsonResponse.headers.get('x-test'), '1');
	assert.deepEqual(JSON.parse(await jsonResponse.text()), { ok: true, n: 2 });

	const defaultJson = helpers.json({ ok: false });
	assert.equal(defaultJson.status, 200);
	assert.equal(defaultJson.headers.get('content-type'), 'application/json; charset=utf-8');
	assert.equal(JSON.parse(await defaultJson.text()).ok, false);

	const textResponse = helpers.text('webhook-challenge', 200, { 'cache-control': 'no-store' });
	assert.equal(textResponse.status, 200);
	assert.equal(textResponse.headers.get('content-type'), 'text/plain; charset=utf-8');
	assert.equal(textResponse.headers.get('cache-control'), 'no-store');
	assert.equal(await textResponse.text(), 'webhook-challenge');
});

test('Netlify json returns statusCode, JSON body, and merged headers', () => {
	const helpers = loadHelpers().netlify;
	const result = helpers.json(403, { error: 'Forbidden.' }, { 'x-reason': 'auth' });

	assert.equal(result.statusCode, 403);
	assert.equal(result.headers['Content-Type'], 'application/json; charset=utf-8');
	assert.equal(result.headers['x-reason'], 'auth');
	assert.equal(JSON.parse(result.body).error, 'Forbidden.');

	const ok = helpers.json(200, { ok: true });
	assert.equal(ok.statusCode, 200);
	assert.equal(JSON.parse(ok.body).ok, true);
	assert.equal(Object.keys(ok.headers).length, 1);
});
