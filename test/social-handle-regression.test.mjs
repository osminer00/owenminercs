import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const NEW_X_PROFILE_URL = 'https://x.com/OwenMiner';
const STALE_X_PROFILE_URL_PATTERN = /https:\/\/(?:www\.)?(?:x|twitter)\.com\/OwenMinerCS\b/i;
const STALE_TWITTER_META_HANDLE_PATTERN =
	/<meta\b(?=[^>]*\bname=["']twitter:(?:site|creator)["'])(?=[^>]*\bcontent=["']@OwenMinerCS["'])[^>]*>/i;

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function assertNoStaleXHandle(relativePath, source) {
	assert.doesNotMatch(
		source,
		STALE_X_PROFILE_URL_PATTERN,
		`${relativePath} should not link to the retired X/Twitter profile`
	);
	assert.doesNotMatch(
		source,
		STALE_TWITTER_META_HANDLE_PATTERN,
		`${relativePath} should not publish retired twitter:site/twitter:creator metadata`
	);
}

function loadCloudflareLiveStatus() {
	const source = readWorkspaceFile('functions/api/live-status.js')
		.replace('export async function onRequestGet', 'async function onRequestGet')
		.replace('export async function onRequest', 'async function onRequest');
	const context = {
		Response,
		URLSearchParams,
		globalThis: {},
	};
	vm.runInNewContext(`${source}\nglobalThis.__exports = { onRequestGet, onRequest };`, context);
	return context.globalThis.__exports;
}

function loadNetlifyLiveStatus() {
	const source = readWorkspaceFile('netlify/functions/live-status.js');
	const exports = {};
	const context = {
		exports,
		fetch: async () => {
			throw new Error('network should not be reached for fallback live-status tests');
		},
		process: { env: {} },
		URLSearchParams,
	};
	vm.runInNewContext(source, context);
	return { handler: exports.handler, env: context.process.env };
}

async function readJsonResponse(response) {
	return response.json();
}

test('Cloudflare live-status uses the current X profile for manual and fallback links', async () => {
	const { onRequestGet } = loadCloudflareLiveStatus();

	const fallback = await readJsonResponse(await onRequestGet({ env: {} }));
	assert.equal(fallback.live, false);
	assert.equal(fallback.source, 'fallback');
	assert.equal(fallback.url, NEW_X_PROFILE_URL);

	const manual = await readJsonResponse(
		await onRequestGet({
			env: {
				LIVE_OVERRIDE_IS_LIVE: 'true',
				LIVE_OVERRIDE_PLATFORM: 'X',
			},
		})
	);
	assert.equal(manual.live, true);
	assert.equal(manual.source, 'manual');
	assert.equal(manual.url, NEW_X_PROFILE_URL);
});

test('Netlify live-status uses the current X profile for manual and fallback links', async () => {
	const { handler, env } = loadNetlifyLiveStatus();

	const fallback = await handler({ httpMethod: 'GET' });
	assert.equal(fallback.statusCode, 200);
	assert.deepEqual(JSON.parse(fallback.body), {
		live: false,
		platform: '',
		url: NEW_X_PROFILE_URL,
		source: 'fallback',
		errors: [],
	});

	env.LIVE_OVERRIDE_IS_LIVE = 'yes';
	env.LIVE_OVERRIDE_PLATFORM = 'X';
	const manual = await handler({ httpMethod: 'GET' });
	assert.equal(manual.statusCode, 200);
	assert.equal(JSON.parse(manual.body).url, NEW_X_PROFILE_URL);
});

test('core social surfaces point X traffic at the current profile', () => {
	const surfaces = [
		{
			path: 'index.html',
			requiredPatterns: [
				/<meta name="twitter:site" content="@OwenMiner" \/>/,
				/"https:\/\/x\.com\/OwenMiner"/,
			],
		},
		{
			path: 'Socials/socials.html',
			requiredPatterns: [
				/<meta name="twitter:site" content="@OwenMiner" \/>/,
				/"https:\/\/x\.com\/OwenMiner"/,
				/href="https:\/\/x\.com\/OwenMiner"/,
			],
		},
		{
			path: 'shared/sharedHeadSection.html',
			requiredPatterns: [/"https:\/\/x\.com\/OwenMiner"/],
		},
		{
			path: 'scripts/components.js',
			requiredPatterns: [/href="https:\/\/x\.com\/OwenMiner"/, /@OwenMiner/],
		},
		{
			path: 'Socials/scripts/social-cloud.js',
			requiredPatterns: [/x:\s*'https:\/\/x\.com\/OwenMiner'/],
		},
		{
			path: 'scripts/sync-x-top-posts.py',
			requiredPatterns: [/DEFAULT_USERNAME = "OwenMiner"/],
		},
		{
			path: 'functions/api/live-status.js',
			requiredPatterns: [/FOLLOW_UPDATES_URL = 'https:\/\/x\.com\/OwenMiner'/],
		},
		{
			path: 'netlify/functions/live-status.js',
			requiredPatterns: [/FOLLOW_UPDATES_URL = 'https:\/\/x\.com\/OwenMiner'/],
		},
	];

	for (const surface of surfaces) {
		const source = readWorkspaceFile(surface.path);
		assertNoStaleXHandle(surface.path, source);
		for (const pattern of surface.requiredPatterns) {
			assert.match(source, pattern, `${surface.path} should keep the current X profile`);
		}
	}
});
