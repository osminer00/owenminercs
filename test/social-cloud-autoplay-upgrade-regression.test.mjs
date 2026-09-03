import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const socialCloudSource = readFileSync(
	new URL('../Socials/scripts/social-cloud.js', import.meta.url),
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

class HTMLIFrameElement {
	constructor(src = '') {
		this._src = src;
		this.srcAssignments = [];
		this.listeners = {};
		this.loading = 'lazy';
		this._closest = null;
		this.contentWindow = {
			messages: [],
			postMessage(message, targetOrigin) {
				this.messages.push({ message, targetOrigin });
			},
		};
	}

	getAttribute(name) {
		if (name === 'src') return this._src;
		return null;
	}

	get src() {
		return this._src;
	}

	set src(value) {
		this._src = String(value);
		this.srcAssignments.push(this._src);
	}

	addEventListener(type, fn, _options) {
		this.listeners[type] = this.listeners[type] || [];
		this.listeners[type].push(fn);
	}

	closest(selector) {
		return selector === '.smc-player' ? this._closest : null;
	}

	fire(type) {
		for (const fn of this.listeners[type] || []) fn();
	}
}

class HTMLVideoElement {
	constructor({ playShouldReject = false } = {}) {
		this.muted = false;
		this.defaultMuted = false;
		this.playsInline = false;
		this.attrs = {};
		this.listeners = {};
		this.playCalls = 0;
		this.playShouldReject = playShouldReject;
	}

	setAttribute(name, value) {
		this.attrs[name] = value;
	}

	addEventListener(type, fn, _options) {
		this.listeners[type] = this.listeners[type] || [];
		this.listeners[type].push(fn);
	}

	play() {
		this.playCalls += 1;
		if (this.playShouldReject) return Promise.reject(new Error('autoplay blocked'));
		return Promise.resolve();
	}

	fire(type) {
		for (const fn of this.listeners[type] || []) fn();
	}
}

function loadAutoplayHelpers() {
	const timeouts = [];
	const rafs = [];
	const sandbox = {
		String,
		URL,
		JSON,
		Promise,
		HTMLIFrameElement,
		HTMLVideoElement,
		window: {
			location: { origin: 'https://owenminercs.com' },
			setTimeout(fn, ms) {
				timeouts.push({ fn, ms });
				return timeouts.length;
			},
			requestAnimationFrame(fn) {
				rafs.push(fn);
				return rafs.length;
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'getYouTubeVideoId')}
		${extractFunction(socialCloudSource, 'getAutoplayEmbedUrl')}
		${extractFunction(socialCloudSource, 'cueYouTubeIframePlay')}
		${extractFunction(socialCloudSource, 'upgradeIframeToAutoplay')}
		${extractFunction(socialCloudSource, 'startInlineVideoPlayback')}
		this.__helpers = {
			getAutoplayEmbedUrl,
			cueYouTubeIframePlay,
			upgradeIframeToAutoplay,
			startInlineVideoPlayback,
		};
		`,
		sandbox
	);

	return {
		...sandbox.__helpers,
		timeouts,
		rafs,
		flushTimeouts() {
			const pending = timeouts.splice(0);
			for (const item of pending) item.fn();
		},
		flushRafs() {
			const pending = rafs.splice(0);
			for (const fn of pending) fn();
		},
	};
}

test('cueYouTubeIframePlay posts playVideo immediately and retries on the two delayed ticks', () => {
	const { cueYouTubeIframePlay, timeouts, flushTimeouts } = loadAutoplayHelpers();
	const iframe = new HTMLIFrameElement('https://www.youtube.com/embed/dQw4w9WgXcQ');

	cueYouTubeIframePlay(iframe);

	assert.equal(iframe.contentWindow.messages.length, 1);
	assert.equal(iframe.contentWindow.messages[0].targetOrigin, '*');
	assert.equal(
		iframe.contentWindow.messages[0].message,
		JSON.stringify({ event: 'command', func: 'playVideo', args: [] })
	);
	assert.deepEqual(
		timeouts.map((item) => item.ms),
		[120, 450]
	);

	flushTimeouts();
	assert.equal(iframe.contentWindow.messages.length, 3);

	cueYouTubeIframePlay({ src: 'https://www.youtube.com/embed/not-an-iframe' });
	assert.equal(iframe.contentWindow.messages.length, 3);
});

test('upgradeIframeToAutoplay mutes YouTube, cues play, and refits the player slot', () => {
	const helpers = loadAutoplayHelpers();
	const { upgradeIframeToAutoplay, getAutoplayEmbedUrl, flushTimeouts, flushRafs } = helpers;
	const original = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
	const expected = getAutoplayEmbedUrl(original);
	assert.match(expected, /[?&]mute=1/);
	assert.match(expected, /[?&]enablejsapi=1/);
	assert.match(expected, /[?&]playlist=dQw4w9WgXcQ/);
	assert.match(expected, /[?&]origin=https%3A%2F%2Fowenminercs.com/);
	assert.doesNotMatch(expected, /[?&]muted=1/);

	const iframe = new HTMLIFrameElement(original);
	const refits = [];
	iframe._closest = {
		__smcRefitIframe() {
			refits.push(true);
		},
	};

	upgradeIframeToAutoplay(iframe, original);

	assert.equal(iframe.loading, 'eager');
	assert.deepEqual(iframe.srcAssignments, [expected]);
	assert.equal((iframe.listeners.load || []).length, 1);
	assert.equal(iframe.contentWindow.messages.length, 0);

	iframe.fire('load');
	flushTimeouts();
	assert.equal(iframe.contentWindow.messages.length, 3);

	flushRafs();
	assert.equal(refits.length, 1);

	upgradeIframeToAutoplay(iframe, original);
	assert.equal(iframe.srcAssignments.length, 1);
	assert.equal(iframe.contentWindow.messages.length, 4);
	flushTimeouts();
	assert.equal(iframe.contentWindow.messages.length, 6);
});

test('upgradeIframeToAutoplay skips empty src, non-iframes, and does not cue TikTok', () => {
	const { upgradeIframeToAutoplay, getAutoplayEmbedUrl, timeouts } = loadAutoplayHelpers();
	const tiktokSrc = 'https://www.tiktok.com/player/v1/1234567890';
	const tiktok = new HTMLIFrameElement(tiktokSrc);

	upgradeIframeToAutoplay(tiktok, tiktokSrc);

	const expected = getAutoplayEmbedUrl(tiktokSrc);
	assert.match(expected, /[?&]muted=1/);
	assert.doesNotMatch(expected, /[?&]mute=1/);
	assert.deepEqual(tiktok.srcAssignments, [expected]);
	assert.equal((tiktok.listeners.load || []).length, 0);
	assert.equal(tiktok.contentWindow.messages.length, 0);

	const leftoverTimeouts = timeouts.length;
	upgradeIframeToAutoplay(tiktok, '');
	upgradeIframeToAutoplay({ src: tiktokSrc }, tiktokSrc);
	assert.equal(tiktok.srcAssignments.length, 1);
	assert.equal(timeouts.length, leftoverTimeouts);
});

test('startInlineVideoPlayback mutes inline video and swallows autoplay rejection', () => {
	const { startInlineVideoPlayback, flushTimeouts } = loadAutoplayHelpers();
	const video = new HTMLVideoElement({ playShouldReject: true });

	startInlineVideoPlayback(video);

	assert.equal(video.muted, true);
	assert.equal(video.defaultMuted, true);
	assert.equal(video.attrs.muted, '');
	assert.equal(video.playsInline, true);
	assert.equal((video.listeners.loadeddata || []).length, 1);

	video.fire('loadeddata');
	flushTimeouts();
	assert.equal(video.playCalls, 2);

	startInlineVideoPlayback({ muted: false });
	assert.equal(video.playCalls, 2);
});
