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

function loadCloudflareNormalizer() {
	const source = readWorkspaceFile('functions/api/spotify-now-playing.js');
	const sandbox = {
		Array,
		Boolean,
		Number,
		Date,
	};

	vm.runInNewContext(
		[
			extractFunction(source, 'normalizeNowPlaying'),
			'this.__normalizeNowPlaying = normalizeNowPlaying;',
		].join('\n'),
		sandbox
	);

	assert.equal(typeof sandbox.__normalizeNowPlaying, 'function');
	return sandbox.__normalizeNowPlaying;
}

function loadNetlifyNormalizer(env = {}) {
	const source = readWorkspaceFile('netlify/functions/spotify-now-playing.js');
	const sandbox = {
		Array,
		Boolean,
		Number,
		Date,
		process: { env },
		Buffer,
		exports: {},
		module: { exports: {} },
		require() {
			return {
				json(statusCode, payload) {
					return { statusCode, body: JSON.stringify(payload) };
				},
			};
		},
	};

	vm.runInNewContext(
		[
			extractFunction(source, 'normalizeNowPlaying'),
			'this.__normalizeNowPlaying = normalizeNowPlaying;',
		].join('\n'),
		sandbox
	);

	assert.equal(typeof sandbox.__normalizeNowPlaying, 'function');
	return sandbox.__normalizeNowPlaying;
}

const SAMPLE_PAYLOAD = {
	is_playing: true,
	currently_playing_type: 'track',
	progress_ms: 12345,
	item: {
		name: 'Neon Drift',
		duration_ms: 210000,
		artists: [{ name: 'Owen' }, { name: null }, { name: 'Miner' }],
		album: {
			name: 'Desk Sessions',
			images: [
				{ url: 'https://example.com/art-large.jpg' },
				{ url: 'https://example.com/art-small.jpg' },
			],
		},
		external_urls: {
			spotify: 'https://open.spotify.com/track/abc123',
		},
	},
};

test('Cloudflare Spotify normalizer maps track fields and jam URL from env', () => {
	const normalizeNowPlaying = loadCloudflareNormalizer();
	const result = normalizeNowPlaying(SAMPLE_PAYLOAD, {
		SPOTIFY_JAM_URL: 'https://open.spotify.com/jam/demo',
	});

	assert.equal(result.ok, true);
	assert.equal(result.isPlaying, true);
	assert.equal(result.currentlyPlayingType, 'track');
	assert.equal(result.track, 'Neon Drift');
	assert.equal(result.artist, 'Owen, Miner');
	assert.equal(result.album, 'Desk Sessions');
	assert.equal(result.artworkUrl, 'https://example.com/art-large.jpg');
	assert.equal(result.spotifyUrl, 'https://open.spotify.com/track/abc123');
	assert.equal(result.progressMs, 12345);
	assert.equal(result.durationMs, 210000);
	assert.equal(result.jamUrl, 'https://open.spotify.com/jam/demo');
	assert.ok(Number.isFinite(Date.parse(result.generatedAt)));
});

test('Cloudflare Spotify normalizer returns idle defaults for empty payloads', () => {
	const normalizeNowPlaying = loadCloudflareNormalizer();
	const result = normalizeNowPlaying(
		{
			is_playing: false,
			progress_ms: 'not-a-number',
			item: null,
		},
		{}
	);

	assert.equal(result.ok, true);
	assert.equal(result.isPlaying, false);
	assert.equal(result.currentlyPlayingType, null);
	assert.equal(result.track, null);
	assert.equal(result.artist, null);
	assert.equal(result.album, null);
	assert.equal(result.artworkUrl, null);
	assert.equal(result.spotifyUrl, null);
	assert.equal(result.progressMs, 0);
	assert.equal(result.durationMs, 0);
	assert.equal(result.jamUrl, null);
});

test('Netlify Spotify normalizer maps the same track shape and reads jam URL from process.env', () => {
	const normalizeNowPlaying = loadNetlifyNormalizer({
		SPOTIFY_JAM_URL: 'https://open.spotify.com/jam/netlify',
	});
	const result = normalizeNowPlaying(SAMPLE_PAYLOAD);

	assert.equal(result.ok, true);
	assert.equal(result.isPlaying, true);
	assert.equal(result.track, 'Neon Drift');
	assert.equal(result.artist, 'Owen, Miner');
	assert.equal(result.artworkUrl, 'https://example.com/art-large.jpg');
	assert.equal(result.jamUrl, 'https://open.spotify.com/jam/netlify');
	assert.equal(result.progressMs, 12345);
	assert.equal(result.durationMs, 210000);
});

test('Spotify handlers reject non-GET methods and keep required Spotify env lookups', () => {
	const cloudflare = readWorkspaceFile('functions/api/spotify-now-playing.js');
	const netlify = readWorkspaceFile('netlify/functions/spotify-now-playing.js');

	assert.match(cloudflare, /Method not allowed\. Use GET\./);
	assert.match(netlify, /Method not allowed\. Use GET\./);
	assert.match(cloudflare, /SPOTIFY_CLIENT_ID/);
	assert.match(cloudflare, /SPOTIFY_CLIENT_SECRET/);
	assert.match(cloudflare, /SPOTIFY_REFRESH_TOKEN/);
	assert.match(netlify, /SPOTIFY_CLIENT_ID/);
	assert.match(netlify, /SPOTIFY_CLIENT_SECRET/);
	assert.match(netlify, /SPOTIFY_REFRESH_TOKEN/);
	assert.match(cloudflare, /response\.status === 204/);
	assert.match(netlify, /response\.status === 204/);
});
