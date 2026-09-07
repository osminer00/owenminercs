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

class FakeNode {
	constructor(tagName) {
		this.tagName = String(tagName).toUpperCase();
		this.className = '';
		this.children = [];
		this.style = {};
		this.attrs = {};
		this.listeners = {};
		this.title = '';
	}

	appendChild(child) {
		this.children.push(child);
		child.parentNode = this;
		return child;
	}

	setAttribute(name, value) {
		this.attrs[String(name)] = String(value);
	}

	addEventListener(type, fn, options) {
		this.listeners[type] = this.listeners[type] || [];
		this.listeners[type].push({ fn, options });
	}

	fire(type) {
		for (const entry of this.listeners[type] || []) entry.fn();
	}
}

class HTMLIFrameElement extends FakeNode {
	constructor() {
		super('iframe');
		this._src = '';
		this.loading = '';
		this.allowFullscreen = false;
		this.referrerPolicy = '';
		this.allow = '';
		this.contentWindow = {
			messages: [],
			postMessage(message, targetOrigin) {
				this.messages.push({ message, targetOrigin });
			},
		};
	}

	get src() {
		return this._src;
	}

	set src(value) {
		this._src = String(value);
	}
}

class HTMLVideoElement extends FakeNode {
	constructor({ playShouldReject = false } = {}) {
		super('video');
		this._src = '';
		this.controls = false;
		this.preload = '';
		this.playsInline = false;
		this.autoplay = false;
		this.muted = false;
		this.defaultMuted = false;
		this.playCalls = 0;
		this.playShouldReject = playShouldReject;
	}

	get src() {
		return this._src;
	}

	set src(value) {
		this._src = String(value);
	}

	play() {
		this.playCalls += 1;
		if (this.playShouldReject) return Promise.reject(new Error('autoplay blocked'));
		return Promise.resolve();
	}
}

function loadPlayerFactory({ playShouldReject = false } = {}) {
	const timeouts = [];
	const rafs = [];
	const documentFake = {
		createElement(tag) {
			const name = String(tag).toLowerCase();
			if (name === 'iframe') return new HTMLIFrameElement();
			if (name === 'video') return new HTMLVideoElement({ playShouldReject });
			return new FakeNode(name);
		},
	};

	const sandbox = {
		String,
		URL,
		JSON,
		Promise,
		HTMLIFrameElement,
		HTMLVideoElement,
		document: documentFake,
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
		${extractFunction(socialCloudSource, 'wireIframeResizeToSlot')}
		${extractFunction(socialCloudSource, 'createPlayerElement')}
		this.__helpers = { createPlayerElement, getAutoplayEmbedUrl };
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

function videoChild(wrap) {
	return wrap.children.find((child) => child instanceof HTMLVideoElement) || null;
}

function iframeChild(wrap) {
	const shell = wrap.children.find((child) => child.className === 'smc-player-iframe-shell');
	if (!shell) return null;
	return shell.children.find((child) => child instanceof HTMLIFrameElement) || null;
}

test('createPlayerElement returns null without an embed src', () => {
	const { createPlayerElement } = loadPlayerFactory();
	assert.equal(createPlayerElement(null, { title: 'Nope' }), null);
	assert.equal(createPlayerElement({}, { title: 'Nope' }), null);
	assert.equal(createPlayerElement({ kind: 'video', src: '' }, { title: 'Nope' }), null);
});

test('createPlayerElement builds a muted autoplay video and swallows play() rejection', () => {
	const helpers = loadPlayerFactory({ playShouldReject: true });
	const { createPlayerElement, flushTimeouts } = helpers;
	const wrap = createPlayerElement(
		{ kind: 'video', src: 'https://v.redd.it/abc.mp4', className: 'reddit' },
		{ platform: 'reddit', title: 'Clip' },
		true
	);

	assert.equal(wrap.className, 'smc-player reddit');
	const video = videoChild(wrap);
	assert.ok(video instanceof HTMLVideoElement);
	assert.equal(video.src, 'https://v.redd.it/abc.mp4');
	assert.equal(video.controls, true);
	assert.equal(video.preload, 'auto');
	assert.equal(video.playsInline, true);
	assert.equal(video.autoplay, true);
	assert.equal(video.muted, true);
	assert.equal(video.defaultMuted, true);
	assert.equal(video.attrs.muted, '');
	assert.equal(video.title, 'reddit video: Clip');

	assert.equal(video.playCalls, 0);
	assert.deepEqual(
		helpers.timeouts.map((item) => item.ms),
		[0]
	);
	video.fire('loadeddata');
	assert.equal(video.playCalls, 1);
	flushTimeouts();
	assert.equal(video.playCalls, 2);
});

test('createPlayerElement uses metadata preload for non-autoplay video and titles untitled items', () => {
	const { createPlayerElement } = loadPlayerFactory();
	const wrap = createPlayerElement(
		{ kind: 'video', src: 'https://video.twimg.com/clip.mp4', className: 'x' },
		{}
	);
	const video = videoChild(wrap);
	assert.equal(wrap.className, 'smc-player x');
	assert.equal(video.preload, 'metadata');
	assert.equal(video.autoplay, false);
	assert.equal(video.muted, false);
	assert.equal(video.title, 'Social video: Untitled content');
	assert.equal(video.listeners.loadeddata, undefined);
});

test('createPlayerElement mounts a lazy iframe, refits the slot, and cues YouTube only when autoplaying', () => {
	const helpers = loadPlayerFactory();
	const { createPlayerElement, getAutoplayEmbedUrl, flushRafs } = helpers;
	const ytSrc = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
	const lazyWrap = createPlayerElement(
		{ kind: 'iframe', src: ytSrc, className: 'youtube' },
		{ platform: 'YouTube', title: 'Never Gonna Give You Up' }
	);
	const lazyIframe = iframeChild(lazyWrap);
	assert.equal(lazyWrap.className, 'smc-player youtube');
	assert.equal(lazyIframe.src, ytSrc);
	assert.equal(lazyIframe.loading, 'lazy');
	assert.equal(lazyIframe.allowFullscreen, true);
	assert.equal(lazyIframe.referrerPolicy, 'strict-origin-when-cross-origin');
	assert.equal(lazyIframe.allow, 'autoplay; encrypted-media; picture-in-picture; clipboard-write; web-share');
	assert.equal(typeof lazyWrap.__smcRefitIframe, 'function');
	assert.equal(lazyIframe.style.width, undefined);
	flushRafs();
	assert.equal(lazyIframe.style.width, '100%');
	assert.equal(lazyIframe.style.height, '100%');
	assert.equal(lazyIframe.listeners.load.length, 1);
	assert.equal(lazyIframe.contentWindow.messages.length, 0);

	const autoWrap = createPlayerElement(
		{ kind: 'iframe', src: ytSrc, className: 'youtube' },
		{ platform: 'YouTube', title: 'Never Gonna Give You Up' },
		true
	);
	const autoIframe = iframeChild(autoWrap);
	const expected = getAutoplayEmbedUrl(ytSrc);
	assert.equal(autoIframe.src, expected);
	assert.match(expected, /[?&]mute=1/);
	assert.match(expected, /[?&]autoplay=1/);
	assert.equal(autoIframe.loading, 'eager');
	autoIframe.fire('load');
	assert.equal(autoIframe.contentWindow.messages.length, 1);
	assert.equal(
		autoIframe.contentWindow.messages[0].message,
		JSON.stringify({ event: 'command', func: 'playVideo', args: [] })
	);
	assert.equal(autoIframe.contentWindow.messages[0].targetOrigin, '*');
});

test('createPlayerElement does not cue TikTok autoplay iframes', () => {
	const { createPlayerElement } = loadPlayerFactory();
	const wrap = createPlayerElement(
		{
			kind: 'iframe',
			src: 'https://www.tiktok.com/player/v1/7345123456789012345',
			className: 'tiktok',
		},
		{ platform: 'tiktok', title: 'Dance' },
		true
	);
	const iframe = iframeChild(wrap);
	assert.equal(iframe.loading, 'eager');
	assert.match(iframe.src, /[?&]muted=1/);
	assert.match(iframe.src, /[?&]autoplay=1/);
	iframe.fire('load');
	assert.equal(iframe.contentWindow.messages.length, 0);
});
