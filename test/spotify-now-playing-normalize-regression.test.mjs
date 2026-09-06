import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const cloudflareSource = readFileSync(
	new URL('../functions/api/spotify-now-playing.js', import.meta.url),
	'utf8'
);
const netlifySource = readFileSync(
	new URL('../netlify/functions/spotify-now-playing.js', import.meta.url),
	'utf8'
);

const FIXED_ISO = '2026-09-06T10:00:00.000Z';

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

class FrozenDate extends Date {
	constructor(...args) {
		if (args.length === 0) {
			super(FIXED_ISO);
			return;
		}
		super(...args);
	}
}

function loadNormalize(source, envVars = {}) {
	const sandbox = {
		Boolean,
		Number,
		Array,
		String,
		Date: FrozenDate,
		process: { env: { ...envVars } },
	};
	vm.createContext(sandbox);
	vm.runInContext(
		`
		this.__normalize = (function () {
			${extractFunction(source, 'normalizeNowPlaying')}
			return normalizeNowPlaying;
		})();
		`,
		sandbox
	);
	return sandbox.__normalize;
}

function nowPlayingFields(result) {
	return {
		ok: Boolean(result.ok),
		isPlaying: Boolean(result.isPlaying),
		currentlyPlayingType:
			result.currentlyPlayingType == null ? null : String(result.currentlyPlayingType),
		track: result.track == null ? null : String(result.track),
		artist: result.artist == null ? null : String(result.artist),
		album: result.album == null ? null : String(result.album),
		artworkUrl: result.artworkUrl == null ? null : String(result.artworkUrl),
		spotifyUrl: result.spotifyUrl == null ? null : String(result.spotifyUrl),
		progressMs: Number(result.progressMs),
		durationMs: Number(result.durationMs),
		jamUrl: result.jamUrl == null ? null : String(result.jamUrl),
		generatedAt: String(result.generatedAt),
	};
}

function normalizeOnHost(host, payload, jamUrl) {
	const envVars = jamUrl === undefined ? {} : { SPOTIFY_JAM_URL: jamUrl };
	if (host === 'cloudflare') {
		return nowPlayingFields(loadNormalize(cloudflareSource)(payload, envVars));
	}
	return nowPlayingFields(loadNormalize(netlifySource, envVars)(payload));
}

function assertHostParity(payload, jamUrl, expected) {
	assert.deepEqual(normalizeOnHost('cloudflare', payload, jamUrl), expected);
	assert.deepEqual(normalizeOnHost('netlify', payload, jamUrl), expected);
}

test('normalizeNowPlaying maps an empty payload to idle fields and a frozen timestamp', () => {
	assertHostParity(undefined, undefined, {
		ok: true,
		isPlaying: false,
		currentlyPlayingType: null,
		track: null,
		artist: null,
		album: null,
		artworkUrl: null,
		spotifyUrl: null,
		progressMs: 0,
		durationMs: 0,
		jamUrl: null,
		generatedAt: FIXED_ISO,
	});
});

test('normalizeNowPlaying joins artists, uses the first artwork, and reads jamUrl from env', () => {
	const payload = {
		is_playing: true,
		currently_playing_type: 'track',
		progress_ms: 1234,
		item: {
			name: 'Never Gonna Give You Up',
			duration_ms: 213000,
			external_urls: { spotify: 'https://open.spotify.com/track/abc' },
			artists: [{ name: 'Rick Astley' }, { name: '' }, { name: 'Another' }],
			album: {
				name: 'Whenever You Need Somebody',
				images: [
					{ url: 'https://i.scdn.co/large.jpg' },
					{ url: 'https://i.scdn.co/small.jpg' },
				],
			},
		},
	};

	assertHostParity(payload, 'https://open.spotify.com/jam/room', {
		ok: true,
		isPlaying: true,
		currentlyPlayingType: 'track',
		track: 'Never Gonna Give You Up',
		artist: 'Rick Astley, Another',
		album: 'Whenever You Need Somebody',
		artworkUrl: 'https://i.scdn.co/large.jpg',
		spotifyUrl: 'https://open.spotify.com/track/abc',
		progressMs: 1234,
		durationMs: 213000,
		jamUrl: 'https://open.spotify.com/jam/room',
		generatedAt: FIXED_ISO,
	});
});

test('normalizeNowPlaying treats non-array artists and non-finite durations as empty/zero', () => {
	const payload = {
		is_playing: 0,
		progress_ms: '1200',
		item: {
			name: 'Solo',
			duration_ms: Number.NaN,
			artists: { name: 'Not An Array' },
			album: { name: 'Demo', images: [] },
		},
	};

	assertHostParity(payload, '', {
		ok: true,
		isPlaying: false,
		currentlyPlayingType: null,
		track: 'Solo',
		artist: null,
		album: 'Demo',
		artworkUrl: null,
		spotifyUrl: null,
		progressMs: 0,
		durationMs: 0,
		jamUrl: null,
		generatedAt: FIXED_ISO,
	});
});
