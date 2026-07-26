import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_TTL_MS = 24 * 60 * 60 * 1000;

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function buildRssXml(videoId = 'abc111', title = 'Fresh Clip') {
	return `<?xml version="1.0" encoding="UTF-8"?>
<feed>
	<entry>
		<yt:videoId>${videoId}</yt:videoId>
		<title>${title}</title>
		<published>2026-07-01T12:00:00Z</published>
		<media:description>Cache regression fixture</media:description>
		<media:thumbnail url="https://example.com/${videoId}.jpg" />
	</entry>
</feed>`;
}

function loadSocialFeedModule({ nowMsRef, fetchImpl }) {
	const source = readWorkspaceFile('functions/api/social-feed.js').replaceAll(
		'export async function ',
		'async function '
	);

	const sandbox = {
		Response,
		URL,
		URLSearchParams,
		Math,
		Number,
		String,
		Boolean,
		Array,
		Set,
		encodeURIComponent,
		console,
		Date: class extends Date {
			static now() {
				return nowMsRef.value;
			}
		},
		fetch: (...args) => fetchImpl(...args),
	};

	vm.runInNewContext(`${source};\nthis.__api = { onRequestGet };`, sandbox);
	assert.equal(typeof sandbox.__api?.onRequestGet, 'function');
	return sandbox.__api;
}

function requestContext(path = 'https://example.com/api/social-feed', env = {}) {
	return {
		request: new Request(path),
		env: {
			YOUTUBE_CHANNEL_ID: 'UCffffffffffffffffffffff',
			YOUTUBE_USERNAME: 'OwenMinerCS',
			...env,
		},
	};
}

test('social-feed serves fresh cache hits without refetching', async () => {
	const nowMsRef = { value: Date.parse('2026-07-26T10:00:00Z') };
	let fetchCalls = 0;
	const api = loadSocialFeedModule({
		nowMsRef,
		fetchImpl: async (url) => {
			fetchCalls += 1;
			assert.match(String(url), /feeds\/videos\.xml/);
			return new Response(buildRssXml('cache1', 'Cached One'), { status: 200 });
		},
	});

	const first = await api.onRequestGet(requestContext());
	const firstPayload = await first.json();
	assert.equal(first.status, 200);
	assert.equal(firstPayload.cache.hit, false);
	assert.equal(firstPayload.cache.stale, false);
	assert.equal(firstPayload.items[0].id, 'youtube_cache1');
	assert.equal(fetchCalls, 1);

	nowMsRef.value += 60_000;
	const second = await api.onRequestGet(requestContext());
	const secondPayload = await second.json();
	assert.equal(second.status, 200);
	assert.equal(secondPayload.cache.hit, true);
	assert.equal(secondPayload.cache.stale, false);
	assert.equal(secondPayload.cache.ageSeconds, 60);
	assert.equal(secondPayload.items[0].id, 'youtube_cache1');
	assert.equal(fetchCalls, 1);
});

test('social-feed returns stale cache after refresh failure within stale TTL', async () => {
	const nowMsRef = { value: Date.parse('2026-07-26T10:00:00Z') };
	let mode = 'ok';
	const api = loadSocialFeedModule({
		nowMsRef,
		fetchImpl: async () => {
			if (mode === 'ok') {
				return new Response(buildRssXml('stale1', 'Stale Keep'), { status: 200 });
			}
			return new Response('upstream unavailable', { status: 503 });
		},
	});

	const seeded = await api.onRequestGet(requestContext());
	const seededPayload = await seeded.json();
	assert.equal(seededPayload.cache.stale, false);
	assert.equal(seededPayload.items[0].id, 'youtube_stale1');

	mode = 'fail';
	nowMsRef.value += CACHE_TTL_MS + 1;

	const stale = await api.onRequestGet(requestContext());
	const stalePayload = await stale.json();
	assert.equal(stale.status, 200);
	assert.equal(stalePayload.cache.hit, true);
	assert.equal(stalePayload.cache.stale, true);
	assert.equal(stalePayload.items[0].id, 'youtube_stale1');
	assert.ok(
		stalePayload.warnings.some((warning) =>
			String(warning).includes('Returned stale feed after refresh failure')
		)
	);
});

test('social-feed force refresh bypasses fresh cache and expires stale cache past TTL', async () => {
	const nowMsRef = { value: Date.parse('2026-07-26T10:00:00Z') };
	let mode = 'ok';
	let fetchCalls = 0;
	const api = loadSocialFeedModule({
		nowMsRef,
		fetchImpl: async () => {
			fetchCalls += 1;
			if (mode === 'ok') {
				return new Response(buildRssXml(`force${fetchCalls}`, `Force ${fetchCalls}`), {
					status: 200,
				});
			}
			return new Response('gone', { status: 500 });
		},
	});

	const first = await api.onRequestGet(requestContext());
	const firstPayload = await first.json();
	assert.equal(firstPayload.items[0].id, 'youtube_force1');
	assert.equal(fetchCalls, 1);

	const forced = await api.onRequestGet(
		requestContext('https://example.com/api/social-feed?refresh=1')
	);
	const forcedPayload = await forced.json();
	assert.equal(forced.status, 200);
	assert.equal(forcedPayload.cache.hit, false);
	assert.equal(forcedPayload.items[0].id, 'youtube_force2');
	assert.equal(fetchCalls, 2);

	mode = 'fail';
	// Age must exceed STALE_TTL_SECONDS after integer second flooring.
	nowMsRef.value += STALE_TTL_MS + 1000;
	const expired = await api.onRequestGet(requestContext());
	const expiredPayload = await expired.json();
	assert.equal(expired.status, 500);
	assert.equal(expiredPayload.ok, false);
	assert.equal(expiredPayload.error, 'Failed to load social feed.');
	assert.equal(expiredPayload.items.length, 0);
});

test('social-feed clamps limit and documents cache TTL constants', () => {
	const source = readWorkspaceFile('functions/api/social-feed.js');
	assert.match(source, /const CACHE_TTL_SECONDS = 15 \* 60;/);
	assert.match(source, /const STALE_TTL_SECONDS = 24 \* 60 \* 60;/);
	assert.match(source, /const MAX_LIMIT = 200;/);
	assert.match(source, /url\.searchParams\.get\('refresh'\) === '1'/);
	assert.match(source, /staleAgeSeconds <= STALE_TTL_SECONDS/);
});
