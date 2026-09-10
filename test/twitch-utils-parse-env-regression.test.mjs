import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

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

function loadCloudflareHelpers() {
	const sandbox = {
		JSON,
		Error,
		String,
		Uint8Array,
	};
	vm.createContext(sandbox);
	vm.runInContext(
		`
		this.__helpers = (function () {
			${extractFunction(cloudflareSource, 'requireEnv')}
			${extractFunction(cloudflareSource, 'safeJsonParse')}
			${extractFunction(cloudflareSource, 'toHex')}
			return { requireEnv, safeJsonParse, toHex };
		})();
		`,
		sandbox
	);
	return sandbox.__helpers;
}

function loadNetlifyHelpers(env = {}) {
	const sandbox = {
		JSON,
		Error,
		String,
		process: { env },
	};
	vm.createContext(sandbox);
	vm.runInContext(
		`
		this.__helpers = (function () {
			${extractFunction(netlifySource, 'requireEnv')}
			${extractFunction(netlifySource, 'safeJsonParse')}
			return { requireEnv, safeJsonParse };
		})();
		`,
		sandbox
	);
	return sandbox.__helpers;
}

test('Cloudflare and Netlify safeJsonParse return parsed values or the fallback', () => {
	const cloudflare = loadCloudflareHelpers();
	const netlify = loadNetlifyHelpers();

	for (const helpers of [cloudflare, netlify]) {
		const objectValue = helpers.safeJsonParse('{"ok":true,"n":2}', null);
		assert.equal(objectValue.ok, true);
		assert.equal(objectValue.n, 2);

		const list = Array.from(helpers.safeJsonParse('[1,2]', []));
		assert.deepEqual(list, [1, 2]);

		assert.equal(helpers.safeJsonParse('not-json', 7), 7);
		assert.equal(helpers.safeJsonParse('{', 'fallback'), 'fallback');
		assert.equal(helpers.safeJsonParse('not-json'), null);
		assert.equal(helpers.safeJsonParse(''), null);
	}
});

test('Cloudflare requireEnv reads env bindings and rejects empty values', () => {
	const helpers = loadCloudflareHelpers();

	assert.equal(helpers.requireEnv({ TWITCH_EVENTSUB_SECRET: 's3cret' }, 'TWITCH_EVENTSUB_SECRET'), 's3cret');

	assert.throws(
		() => helpers.requireEnv({}, 'TWITCH_EVENTSUB_SECRET'),
		/Missing required environment variable: TWITCH_EVENTSUB_SECRET/
	);
	assert.throws(
		() => helpers.requireEnv({ TWITCH_EVENTSUB_SECRET: '' }, 'TWITCH_EVENTSUB_SECRET'),
		/Missing required environment variable: TWITCH_EVENTSUB_SECRET/
	);
	assert.throws(
		() => helpers.requireEnv(null, 'TWITCH_EVENTSUB_SECRET'),
		/Missing required environment variable: TWITCH_EVENTSUB_SECRET/
	);
});

test('Netlify requireEnv reads process.env and rejects empty values', () => {
	const present = loadNetlifyHelpers({ TWITCH_EVENTSUB_SECRET: 's3cret' });
	assert.equal(present.requireEnv('TWITCH_EVENTSUB_SECRET'), 's3cret');

	const missing = loadNetlifyHelpers({});
	assert.throws(
		() => missing.requireEnv('TWITCH_EVENTSUB_SECRET'),
		/Missing required environment variable: TWITCH_EVENTSUB_SECRET/
	);

	const empty = loadNetlifyHelpers({ TWITCH_EVENTSUB_SECRET: '' });
	assert.throws(
		() => empty.requireEnv('TWITCH_EVENTSUB_SECRET'),
		/Missing required environment variable: TWITCH_EVENTSUB_SECRET/
	);
});

test('Cloudflare toHex zero-pads each byte for HMAC hex encoding', () => {
	const helpers = loadCloudflareHelpers();

	assert.equal(helpers.toHex(new Uint8Array([])), '');
	assert.equal(helpers.toHex(new Uint8Array([0, 15, 16, 255])), '000f10ff');
	assert.equal(helpers.toHex(new Uint8Array([10]).buffer), '0a');
});
