import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../scripts/music-listen-along.js', import.meta.url), 'utf8');

function extractFunction(src, functionName) {
	const pattern = new RegExp(`(?:async\\s+)?function\\s+${functionName}\\s*\\(`);
	const match = pattern.exec(src);
	assert.ok(match, `${functionName} should exist`);

	let parenDepth = 0;
	let paramsEnd = -1;
	for (let i = src.indexOf('(', match.index); i < src.length; i += 1) {
		const char = src[i];
		if (char === '(') parenDepth += 1;
		if (char === ')') {
			parenDepth -= 1;
			if (parenDepth === 0) {
				paramsEnd = i;
				break;
			}
		}
	}
	assert.notEqual(paramsEnd, -1, `${functionName} parameters should close`);

	const braceStart = src.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${functionName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < src.length; i += 1) {
		const char = src[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return src.slice(match.index, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function loadHelpers() {
	const context = { console };
	vm.createContext(context);
	vm.runInContext(
		`
		${extractFunction(source, 'escapeHtml')}
		${extractFunction(source, 'formatDuration')}
		this.escapeHtml = escapeHtml;
		this.formatDuration = formatDuration;
		`,
		context
	);
	return {
		escapeHtml: context.escapeHtml,
		formatDuration: context.formatDuration,
	};
}

function loadRenderNowPlaying() {
	const trackTitle = { textContent: '' };
	const trackArtist = { textContent: '' };
	const trackAlbum = { textContent: '' };
	const trackArtwork = { src: '', alt: '' };
	const trackProgressFill = { style: { width: '' } };
	const trackProgressLabel = { textContent: '' };
	const listenButton = { href: '', textContent: '' };
	const openTrackButton = { href: '' };
	const nowPlayingStatus = { textContent: '', dataset: {} };
	const nowPlayingRoot = {
		classList: {
			remove() {},
		},
	};

	const context = {
		console,
		trackTitle,
		trackArtist,
		trackAlbum,
		trackArtwork,
		trackProgressFill,
		trackProgressLabel,
		listenButton,
		openTrackButton,
		nowPlayingStatus,
		nowPlayingRoot,
	};
	vm.createContext(context);
	vm.runInContext(
		`
		${extractFunction(source, 'escapeHtml')}
		${extractFunction(source, 'formatDuration')}
		${extractFunction(source, 'setNowPlayingStatus')}
		${extractFunction(source, 'renderNowPlaying')}
		this.renderNowPlaying = renderNowPlaying;
		`,
		context
	);

	return {
		renderNowPlaying: context.renderNowPlaying,
		trackTitle,
		trackProgressFill,
		trackProgressLabel,
		listenButton,
		openTrackButton,
		trackArtwork,
		nowPlayingStatus,
	};
}

test('formatDuration handles finite, negative, and non-finite inputs', () => {
	const { formatDuration } = loadHelpers();

	assert.equal(formatDuration(0), '0:00');
	assert.equal(formatDuration(1000), '0:01');
	assert.equal(formatDuration(65_000), '1:05');
	assert.equal(formatDuration(3_661_000), '61:01');
	assert.equal(formatDuration(-5), '0:00');
	assert.equal(formatDuration(Number.NaN), '0:00');
	assert.equal(formatDuration(Number.POSITIVE_INFINITY), '0:00');
});

test('escapeHtml escapes markup that could break suggestion list HTML', () => {
	const { escapeHtml } = loadHelpers();

	assert.equal(
		escapeHtml(`<script>alert("x")</script>&'`),
		'&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;'
	);
	assert.equal(escapeHtml(null), '');
	assert.equal(escapeHtml(undefined), '');
});

test('renderNowPlaying clamps progress and prefers jam URL for listen CTA', () => {
	const ui = loadRenderNowPlaying();

	ui.renderNowPlaying({
		track: 'Song',
		artist: 'Artist',
		album: 'Album',
		artworkUrl: 'https://example.com/art.jpg',
		progressMs: 150_000,
		durationMs: 100_000,
		jamUrl: 'https://open.spotify.com/jam/abc',
		spotifyUrl: 'https://open.spotify.com/track/xyz',
		isPlaying: true,
	});

	assert.equal(ui.trackProgressFill.style.width, '100.00%');
	assert.equal(ui.trackProgressLabel.textContent, '2:30 / 1:40');
	assert.equal(ui.listenButton.href, 'https://open.spotify.com/jam/abc');
	assert.equal(ui.listenButton.textContent, 'Join my Spotify Jam');
	assert.equal(ui.openTrackButton.href, 'https://open.spotify.com/track/xyz');
	assert.equal(ui.nowPlayingStatus.textContent, 'Live now playing');
	assert.equal(ui.nowPlayingStatus.dataset.state, 'ok');

	ui.renderNowPlaying({
		progressMs: Number.NaN,
		durationMs: 0,
		isPlaying: false,
	});
	assert.equal(ui.trackProgressFill.style.width, '0.00%');
	assert.equal(ui.trackProgressLabel.textContent, '0:00 / 0:00');
	assert.equal(ui.listenButton.href, 'https://open.spotify.com/');
	assert.equal(ui.listenButton.textContent, 'Listen along in Spotify');
	assert.match(ui.trackArtwork.alt, /placeholder/i);
});
