import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const serverSource = readFileSync(
	new URL('../scripts/local-twitch-eventsub-server.mjs', import.meta.url),
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

function taggedResponse(name, status) {
	return new Response(status === 204 ? null : name, {
		status,
		headers: { 'x-stub': name },
	});
}

function loadHandlerFor() {
	const calls = [];
	const sandbox = {
		JSON,
		Response,
		process: { env: { TWITCH_LOCAL_PORT: '8789' } },
		onTwitchFeedGet: async (ctx) => {
			calls.push(['onTwitchFeedGet', ctx.request]);
			return taggedResponse('feed-get', 200);
		},
		onTwitchFeedOptions: async (ctx) => {
			calls.push(['onTwitchFeedOptions', ctx.request]);
			return taggedResponse('feed-options', 204);
		},
		onTwitchHealthGet: async (ctx) => {
			calls.push(['onTwitchHealthGet', ctx.request]);
			return taggedResponse('health-get', 200);
		},
		onTwitchRegisterPost: async (ctx) => {
			calls.push(['onTwitchRegisterPost', ctx.request]);
			return taggedResponse('register-post', 200);
		},
		onTwitchRegisterFallback: async (ctx) => {
			calls.push(['onTwitchRegisterFallback', ctx.request]);
			return taggedResponse('register-fallback', 405);
		},
		onTwitchEventsubPost: async (ctx) => {
			calls.push(['onTwitchEventsubPost', ctx.request]);
			return taggedResponse('eventsub-post', 204);
		},
		onTwitchEventsubOptions: async (ctx) => {
			calls.push(['onTwitchEventsubOptions', ctx.request]);
			return taggedResponse('eventsub-options', 204);
		},
		onTwitchEventsubFallback: async (ctx) => {
			calls.push(['onTwitchEventsubFallback', ctx.request]);
			return taggedResponse('eventsub-fallback', 405);
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(serverSource, 'handlerFor')}
		this.__helpers = { handlerFor };
		`,
		sandbox
	);

	return { handlerFor: sandbox.__helpers.handlerFor, calls };
}

async function readJson(response) {
	return JSON.parse(await response.text());
}

test('local EventSub server stays on loopback and only advertises the four Twitch routes', () => {
	assert.match(serverSource, /const host = "127\.0\.0\.1"/);
	assert.doesNotMatch(
		serverSource,
		/listen\([^)]*0\.0\.0\.0/,
		'local EventSub server must stay bound to loopback'
	);
	assert.match(serverSource, /TWITCH_LOCAL_PORT \|\| "8789"/);
	assert.match(
		serverSource,
		/endpoints: \/api\/twitch-health \/api\/twitch-feed \/api\/twitch-register-eventsub \/api\/twitch-eventsub/
	);
	assert.match(serverSource, /Access-Control-Allow-Methods", "GET, POST, OPTIONS"/);
	assert.match(
		serverSource,
		/res\.writeHead\(400, \{ "content-type": "application\/json; charset=utf-8" \}\);/
	);
	assert.match(serverSource, /error: "Missing request URL\."/);
	assert.match(
		serverSource,
		/res\.writeHead\(500, \{ "content-type": "application\/json; charset=utf-8" \}\);/
	);
});

test('handlerFor routes twitch-feed GET/OPTIONS and rejects other methods', async () => {
	const { handlerFor, calls } = loadHandlerFor();
	const request = new Request('http://127.0.0.1:8789/api/twitch-feed');

	const getResponse = await handlerFor('/api/twitch-feed', 'GET', request);
	assert.equal(getResponse.status, 200);
	assert.equal(getResponse.headers.get('x-stub'), 'feed-get');
	assert.equal(calls[0][0], 'onTwitchFeedGet');
	assert.equal(calls[0][1], request);

	const optionsResponse = await handlerFor('/api/twitch-feed', 'OPTIONS', request);
	assert.equal(optionsResponse.status, 204);
	assert.equal(optionsResponse.headers.get('x-stub'), 'feed-options');
	assert.equal(calls[1][0], 'onTwitchFeedOptions');

	const postResponse = await handlerFor('/api/twitch-feed', 'POST', request);
	assert.equal(postResponse.status, 405);
	const postBody = await readJson(postResponse);
	assert.equal(postBody.error, 'Method not allowed. Use GET.');
	assert.equal(
		calls.length,
		2,
		'disallowed feed methods must not call the Worker handlers'
	);
});

test('handlerFor routes twitch-health GET and rejects other methods', async () => {
	const { handlerFor, calls } = loadHandlerFor();
	const request = new Request('http://127.0.0.1:8789/api/twitch-health');

	const getResponse = await handlerFor('/api/twitch-health', 'GET', request);
	assert.equal(getResponse.status, 200);
	assert.equal(getResponse.headers.get('x-stub'), 'health-get');
	assert.equal(calls[0][0], 'onTwitchHealthGet');

	const postResponse = await handlerFor('/api/twitch-health', 'POST', request);
	assert.equal(postResponse.status, 405);
	const postBody = await readJson(postResponse);
	assert.equal(postBody.error, 'Method not allowed. Use GET.');
	assert.equal(calls.length, 1);
});

test('handlerFor posts EventSub register/webhook and falls back for other methods', async () => {
	const { handlerFor, calls } = loadHandlerFor();
	const registerRequest = new Request('http://127.0.0.1:8789/api/twitch-register-eventsub', {
		method: 'POST',
	});
	const eventsubRequest = new Request('http://127.0.0.1:8789/api/twitch-eventsub', {
		method: 'POST',
	});

	const registerPost = await handlerFor(
		'/api/twitch-register-eventsub',
		'POST',
		registerRequest
	);
	assert.equal(registerPost.headers.get('x-stub'), 'register-post');
	assert.equal(calls[0][0], 'onTwitchRegisterPost');

	const registerGet = await handlerFor(
		'/api/twitch-register-eventsub',
		'GET',
		registerRequest
	);
	assert.equal(registerGet.headers.get('x-stub'), 'register-fallback');
	assert.equal(calls[1][0], 'onTwitchRegisterFallback');

	const eventsubPost = await handlerFor('/api/twitch-eventsub', 'POST', eventsubRequest);
	assert.equal(eventsubPost.status, 204);
	assert.equal(eventsubPost.headers.get('x-stub'), 'eventsub-post');
	assert.equal(calls[2][0], 'onTwitchEventsubPost');

	const eventsubOptions = await handlerFor('/api/twitch-eventsub', 'OPTIONS', eventsubRequest);
	assert.equal(eventsubOptions.status, 204);
	assert.equal(eventsubOptions.headers.get('x-stub'), 'eventsub-options');
	assert.equal(calls[3][0], 'onTwitchEventsubOptions');

	const eventsubGet = await handlerFor('/api/twitch-eventsub', 'GET', eventsubRequest);
	assert.equal(eventsubGet.headers.get('x-stub'), 'eventsub-fallback');
	assert.equal(calls[4][0], 'onTwitchEventsubFallback');
});

test('handlerFor returns 404 JSON for unknown EventSub local paths', async () => {
	const { handlerFor, calls } = loadHandlerFor();
	const response = await handlerFor(
		'/api/social-feed',
		'GET',
		new Request('http://127.0.0.1:8789/api/social-feed')
	);
	assert.equal(response.status, 404);
	const body = await readJson(response);
	assert.equal(body.ok, false);
	assert.equal(body.error, 'Not found.');
	assert.equal(calls.length, 0);
});
