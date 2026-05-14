import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const netlifyAssistant = require('../netlify/functions/site-assistant.js');

function loadCloudflareAssistant() {
	const source = readFileSync(
		new URL('../functions/api/site-assistant.js', import.meta.url),
		'utf8'
	).replaceAll('export async function ', 'async function ');
	const context = {
		Response,
		fetch: (...args) => globalThis.fetch(...args),
	};

	return vm.runInNewContext(
		`${source}; ({ onRequestPost, onRequestOptions, onRequest });`,
		context,
		{ filename: 'functions/api/site-assistant.js' }
	);
}

function cloudflareContext({
	token,
	accessToken,
	body = { messages: [{ role: 'user', content: 'Hello' }] },
} = {}) {
	const headers = new Headers({
		'content-type': 'application/json',
		'content-length': String(JSON.stringify(body).length),
	});
	if (token) headers.set('x-site-assistant-token', token);

	return {
		request: new Request('https://example.test/api/site-assistant', {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		}),
		env: {
			OPENAI_API_KEY: 'openai-test-key',
			...(accessToken ? { SITE_ASSISTANT_ACCESS_TOKEN: accessToken } : {}),
		},
	};
}

function netlifyEvent({ token, body = { messages: [{ role: 'user', content: 'Hello' }] } } = {}) {
	return {
		httpMethod: 'POST',
		headers: {
			'content-type': 'application/json',
			...(token ? { 'x-site-assistant-token': token } : {}),
		},
		body: JSON.stringify(body),
	};
}

function installFetchAssertion(assertRequest) {
	const originalFetch = globalThis.fetch;
	let calls = 0;
	globalThis.fetch = async (...args) => {
		calls += 1;
		assertRequest(...args);
		return new Response(
			JSON.stringify({ choices: [{ message: { content: 'Assistant reply' } }] }),
			{
				status: 200,
				headers: { 'content-type': 'application/json' },
			}
		);
	};

	return {
		get calls() {
			return calls;
		},
		restore() {
			globalThis.fetch = originalFetch;
		},
	};
}

test('Cloudflare assistant rejects requests when access token is not configured', async () => {
	const assistant = loadCloudflareAssistant();
	const fetchMock = installFetchAssertion(() => assert.fail('OpenAI fetch should not run'));
	try {
		const response = await assistant.onRequestPost(cloudflareContext());
		const payload = await response.json();

		assert.equal(response.status, 503);
		assert.match(payload.error, /SITE_ASSISTANT_ACCESS_TOKEN/);
		assert.equal(fetchMock.calls, 0);
	} finally {
		fetchMock.restore();
	}
});

test('Cloudflare assistant rejects requests with a missing or bad access token', async () => {
	const assistant = loadCloudflareAssistant();
	const fetchMock = installFetchAssertion(() => assert.fail('OpenAI fetch should not run'));
	try {
		const response = await assistant.onRequestPost(
			cloudflareContext({ token: 'wrong-token', accessToken: 'correct-token' })
		);
		const payload = await response.json();

		assert.equal(response.status, 401);
		assert.equal(payload.error, 'Unauthorized assistant request.');
		assert.equal(fetchMock.calls, 0);
	} finally {
		fetchMock.restore();
	}
});

test('Cloudflare assistant allows authorized requests through to OpenAI', async () => {
	const assistant = loadCloudflareAssistant();
	const fetchMock = installFetchAssertion((url, options) => {
		assert.equal(url, 'https://api.openai.com/v1/chat/completions');
		assert.equal(options.headers.Authorization, 'Bearer openai-test-key');
	});
	try {
		const response = await assistant.onRequestPost(
			cloudflareContext({ token: 'correct-token', accessToken: 'correct-token' })
		);
		const payload = await response.json();

		assert.equal(response.status, 200);
		assert.equal(payload.reply, 'Assistant reply');
		assert.equal(fetchMock.calls, 1);
	} finally {
		fetchMock.restore();
	}
});

test('Netlify assistant rejects requests before OpenAI when access token is not configured', async () => {
	const originalOpenAiKey = process.env.OPENAI_API_KEY;
	const originalAccessToken = process.env.SITE_ASSISTANT_ACCESS_TOKEN;
	const fetchMock = installFetchAssertion(() => assert.fail('OpenAI fetch should not run'));
	try {
		process.env.OPENAI_API_KEY = 'openai-test-key';
		delete process.env.SITE_ASSISTANT_ACCESS_TOKEN;

		const response = await netlifyAssistant.handler(netlifyEvent());
		const payload = JSON.parse(response.body);

		assert.equal(response.statusCode, 503);
		assert.match(payload.error, /SITE_ASSISTANT_ACCESS_TOKEN/);
		assert.equal(fetchMock.calls, 0);
	} finally {
		if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
		else process.env.OPENAI_API_KEY = originalOpenAiKey;
		if (originalAccessToken === undefined) delete process.env.SITE_ASSISTANT_ACCESS_TOKEN;
		else process.env.SITE_ASSISTANT_ACCESS_TOKEN = originalAccessToken;
		fetchMock.restore();
	}
});

test('Netlify assistant rejects requests with a missing or bad access token', async () => {
	const originalOpenAiKey = process.env.OPENAI_API_KEY;
	const originalAccessToken = process.env.SITE_ASSISTANT_ACCESS_TOKEN;
	const fetchMock = installFetchAssertion(() => assert.fail('OpenAI fetch should not run'));
	try {
		process.env.OPENAI_API_KEY = 'openai-test-key';
		process.env.SITE_ASSISTANT_ACCESS_TOKEN = 'correct-token';

		const response = await netlifyAssistant.handler(netlifyEvent({ token: 'wrong-token' }));
		const payload = JSON.parse(response.body);

		assert.equal(response.statusCode, 401);
		assert.equal(payload.error, 'Unauthorized assistant request.');
		assert.equal(fetchMock.calls, 0);
	} finally {
		if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
		else process.env.OPENAI_API_KEY = originalOpenAiKey;
		if (originalAccessToken === undefined) delete process.env.SITE_ASSISTANT_ACCESS_TOKEN;
		else process.env.SITE_ASSISTANT_ACCESS_TOKEN = originalAccessToken;
		fetchMock.restore();
	}
});

test('Netlify assistant allows authorized requests through to OpenAI', async () => {
	const originalOpenAiKey = process.env.OPENAI_API_KEY;
	const originalAccessToken = process.env.SITE_ASSISTANT_ACCESS_TOKEN;
	const fetchMock = installFetchAssertion((url, options) => {
		assert.equal(url, 'https://api.openai.com/v1/chat/completions');
		assert.equal(options.headers.Authorization, 'Bearer openai-test-key');
	});
	try {
		process.env.OPENAI_API_KEY = 'openai-test-key';
		process.env.SITE_ASSISTANT_ACCESS_TOKEN = 'correct-token';

		const response = await netlifyAssistant.handler(netlifyEvent({ token: 'correct-token' }));
		const payload = JSON.parse(response.body);

		assert.equal(response.statusCode, 200);
		assert.equal(payload.reply, 'Assistant reply');
		assert.equal(fetchMock.calls, 1);
	} finally {
		if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
		else process.env.OPENAI_API_KEY = originalOpenAiKey;
		if (originalAccessToken === undefined) delete process.env.SITE_ASSISTANT_ACCESS_TOKEN;
		else process.env.SITE_ASSISTANT_ACCESS_TOKEN = originalAccessToken;
		fetchMock.restore();
	}
});
