import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const apiDir = new URL('../functions/api/', import.meta.url);

async function importCloudflareTwitchRegisterModule() {
	const root = await mkdtemp(path.join(tmpdir(), 'twitch-register-eventsub-'));
	const moduleDir = path.join(root, 'functions', 'api');
	await mkdir(moduleDir, { recursive: true });
	await writeFile(path.join(root, 'package.json'), '{"type":"module"}\n');

	const utilsSource = await readFile(new URL('_twitch-utils.js', apiDir), 'utf8');
	const registerSource = (
		await readFile(new URL('twitch-register-eventsub.js', apiDir), 'utf8')
	).replace("from './_twitch-utils'", "from './_twitch-utils.js'");
	await writeFile(path.join(moduleDir, '_twitch-utils.js'), utilsSource);
	await writeFile(path.join(moduleDir, 'twitch-register-eventsub.js'), registerSource);

	try {
		const mod = await import(
			`${path.join(moduleDir, 'twitch-register-eventsub.js')}?t=${Date.now()}`
		);
		return { mod, cleanup: () => rm(root, { force: true, recursive: true }) };
	} catch (error) {
		await rm(root, { force: true, recursive: true });
		throw error;
	}
}

function makeRegistrationEnv(overrides = {}) {
	return {
		TWITCH_REGISTER_SECRET: 1234,
		TWITCH_CLIENT_ID: 'client-id',
		TWITCH_CLIENT_SECRET: 'client-secret',
		TWITCH_EVENTSUB_SECRET: 'eventsub-secret',
		TWITCH_BROADCASTER_ID: 'broadcaster-id',
		PUBLIC_SITE_URL: 'https://owenminercs.com/',
		...overrides,
	};
}

test('EventSub registration accepts a matching non-string register secret', async (t) => {
	const { mod, cleanup } = await importCloudflareTwitchRegisterModule();
	t.after(cleanup);

	const originalFetch = globalThis.fetch;
	t.after(() => {
		globalThis.fetch = originalFetch;
	});

	const fetchCalls = [];
	globalThis.fetch = async (url, options = {}) => {
		fetchCalls.push({ url: String(url), options });
		if (String(url).includes('/oauth2/token')) {
			return Response.json({ access_token: 'app-token' });
		}
		if (String(url).includes('eventsub/subscriptions?status=enabled')) {
			return Response.json({ data: [] });
		}
		return Response.json({ data: [{ id: `created-${fetchCalls.length}` }] }, { status: 202 });
	};

	const response = await mod.onRequestPost({
		env: makeRegistrationEnv(),
		request: new Request('https://example.test/api/twitch-register-eventsub', {
			method: 'POST',
			headers: { 'x-twitch-register-secret': '1234' },
		}),
	});
	const body = await response.json();

	assert.equal(response.status, 200);
	assert.equal(body.ok, true);
	assert.equal(body.callback, 'https://owenminercs.com/api/twitch-eventsub');
	assert.deepEqual(
		body.results.map((result) => result.status),
		['created', 'created', 'created', 'created']
	);
	assert.equal(fetchCalls.length, 6, 'token, existing subscriptions, and four creates');
	assert.match(String(fetchCalls[0].options.body), /client_id=client-id/);
});

test('EventSub registration rejects non-matching non-string register secret before network calls', async (t) => {
	const { mod, cleanup } = await importCloudflareTwitchRegisterModule();
	t.after(cleanup);

	const originalFetch = globalThis.fetch;
	t.after(() => {
		globalThis.fetch = originalFetch;
	});

	let fetchCallCount = 0;
	globalThis.fetch = async () => {
		fetchCallCount += 1;
		throw new Error('fetch should not be called for unauthorized requests');
	};

	const response = await mod.onRequestPost({
		env: makeRegistrationEnv(),
		request: new Request('https://example.test/api/twitch-register-eventsub', {
			method: 'POST',
			headers: { authorization: 'Bearer 4321' },
		}),
	});
	const body = await response.json();

	assert.equal(response.status, 403);
	assert.deepEqual(body, { error: 'Forbidden.' });
	assert.equal(fetchCallCount, 0);
});
