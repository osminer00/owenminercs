import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const contentCheckScript = fileURLToPath(
	new URL('../dev/public-content-regression-check.mjs', import.meta.url)
);
const cloudflareRegisterSource = readFileSync(
	new URL('../functions/api/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);
const netlifyRegisterSource = readFileSync(
	new URL('../netlify/functions/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const braceStart = source.indexOf('{', start);
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

function runContentCheck(cwd) {
	return spawnSync(process.execPath, [contentCheckScript], {
		cwd,
		encoding: 'utf8',
	});
}

async function createTempSite() {
	return mkdtemp(path.join(tmpdir(), 'owenminercs-content-check-'));
}

function loadCloudflareAuthHelpers() {
	return Function(`
		const REGISTER_SECRET_HEADER = 'x-twitch-register-secret';
		${extractFunction(cloudflareRegisterSource, 'timingSafeEqual')}
		${extractFunction(cloudflareRegisterSource, 'isAuthorizedRequest')}
		return { timingSafeEqual, isAuthorizedRequest };
	`)();
}

function loadNetlifyAuthHelpers() {
	return Function(`
		const REGISTER_SECRET_HEADER = 'x-twitch-register-secret';
		${extractFunction(netlifyRegisterSource, 'timingSafeEqual')}
		${extractFunction(netlifyRegisterSource, 'getHeader')}
		${extractFunction(netlifyRegisterSource, 'isAuthorizedRequest')}
		return { timingSafeEqual, isAuthorizedRequest };
	`)();
}

function cloudflareRequest(headers) {
	const normalized = new Map(
		Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
	);
	return {
		headers: {
			get(name) {
				return normalized.get(String(name).toLowerCase()) ?? '';
			},
		},
	};
}

test('public content check ignores generated search JSON while still scanning public pages', async () => {
	const siteDir = await createTempSite();
	try {
		await mkdir(path.join(siteDir, 'data'));
		await writeFile(
			path.join(siteDir, 'index.html'),
			'<!doctype html><title>Clean public page</title><p>Public profile copy only.</p>'
		);
		await writeFile(
			path.join(siteDir, 'data', 'site-search-index.json'),
			JSON.stringify([
				{ title: 'Generated cache', text: 'Old DMACC snippet from stale search data.' },
			])
		);
		await writeFile(
			path.join(siteDir, 'data', 'search-manual-keywords.json'),
			JSON.stringify({ old: ['schema.org alumniOf field from generated keywords'] })
		);

		const result = runContentCheck(siteDir);

		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.match(result.stdout, /Public content regression check passed\./);
	} finally {
		await rm(siteDir, { force: true, recursive: true });
	}
});

test('public content check fails when forbidden copy appears in public HTML', async () => {
	const siteDir = await createTempSite();
	try {
		await writeFile(
			path.join(siteDir, 'about.html'),
			'<!doctype html><title>About</title><p>While at DMACC I learned how to write software.</p>'
		);

		const result = runContentCheck(siteDir);
		const output = `${result.stdout}\n${result.stderr}`;

		assert.notEqual(result.status, 0, output);
		assert.match(output, /Forbidden public content found:/);
		assert.match(output, /about\.html:1 contains DMACC public mention/);
	} finally {
		await rm(siteDir, { force: true, recursive: true });
	}
});

test('Cloudflare Twitch registration auth supports header and bearer secrets safely', () => {
	const { timingSafeEqual, isAuthorizedRequest } = loadCloudflareAuthHelpers();

	assert.equal(timingSafeEqual(1234, '1234'), true);
	assert.equal(timingSafeEqual(1234, '1235'), false);
	assert.doesNotThrow(() => timingSafeEqual(12, 123));

	assert.equal(
		isAuthorizedRequest(cloudflareRequest({ 'x-twitch-register-secret': 's3cret' }), 's3cret'),
		true
	);
	assert.equal(
		isAuthorizedRequest(cloudflareRequest({ authorization: 'Bearer s3cret' }), 's3cret'),
		true
	);
	assert.equal(
		isAuthorizedRequest(
			cloudflareRequest({
				'x-twitch-register-secret': 'wrong',
				authorization: 'Bearer s3cret',
			}),
			's3cret'
		),
		false
	);
	assert.equal(
		isAuthorizedRequest(cloudflareRequest({ authorization: 'Bearer wrong' }), 's3cret'),
		false
	);
});

test('Netlify Twitch registration auth is case-insensitive and safely coerces secrets', () => {
	const { timingSafeEqual, isAuthorizedRequest } = loadNetlifyAuthHelpers();

	assert.equal(timingSafeEqual(1234, '1234'), true);
	assert.equal(timingSafeEqual(1234, '1235'), false);
	assert.doesNotThrow(() => timingSafeEqual(12, 123));

	assert.equal(
		isAuthorizedRequest({ 'X-Twitch-Register-Secret': 's3cret' }, 's3cret'),
		true
	);
	assert.equal(isAuthorizedRequest({ authorization: 'Bearer s3cret' }, 's3cret'), true);
	assert.equal(
		isAuthorizedRequest(
			{ 'x-twitch-register-secret': 'wrong', authorization: 'Bearer s3cret' },
			's3cret'
		),
		false
	);
	assert.equal(isAuthorizedRequest({ authorization: 'Bearer wrong' }, 's3cret'), false);
});
