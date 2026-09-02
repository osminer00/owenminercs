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

class HTMLVideoElement {
	constructor({ paused = false } = {}) {
		this.paused = paused;
		this.pauseCalls = 0;
	}

	pause() {
		this.pauseCalls += 1;
		this.paused = true;
	}
}

class HTMLIFrameElement {
	constructor(src = '') {
		this._src = src;
		this.srcAssignments = [];
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
}

function wrapWith(nodes) {
	return {
		querySelector(selector) {
			if (selector === 'video') return nodes.video || null;
			if (selector === 'iframe') return nodes.iframe || null;
			return null;
		},
	};
}

function loadPauseHelpers(options = {}) {
	const sandbox = {
		String,
		URL,
		JSON,
		HTMLVideoElement,
		HTMLIFrameElement,
		window: {
			location: {
				origin: options.origin || 'https://owenminercs.com',
			},
		},
		state: options.state || {},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'pauseActivePlayback')}
		this.__helpers = { pauseActivePlayback };
		`,
		sandbox
	);

	return {
		pauseActivePlayback: sandbox.__helpers.pauseActivePlayback,
		state: sandbox.state,
	};
}

test('pauseActivePlayback pauses HTML video elements and skips already-paused videos', () => {
	const playing = new HTMLVideoElement({ paused: false });
	const idle = new HTMLVideoElement({ paused: true });
	const { pauseActivePlayback } = loadPauseHelpers({
		state: {
			playerWrap: wrapWith({ video: playing }),
			inlinePlayerWrap: wrapWith({ video: idle }),
		},
	});

	pauseActivePlayback();

	assert.equal(playing.pauseCalls, 1);
	assert.equal(playing.paused, true);
	assert.equal(idle.pauseCalls, 0);
});

test('pauseActivePlayback posts YouTube pauseVideo and reloads the iframe src', () => {
	const youtube = new HTMLIFrameElement(
		'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1'
	);
	const fallback = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
	const { pauseActivePlayback } = loadPauseHelpers({
		state: {
			playerWrap: wrapWith({ iframe: youtube }),
			embed: { kind: 'iframe', src: fallback },
		},
	});

	pauseActivePlayback();

	assert.equal(youtube.contentWindow.messages.length, 1);
	assert.equal(youtube.contentWindow.messages[0].targetOrigin, '*');
	assert.equal(
		youtube.contentWindow.messages[0].message,
		JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] })
	);
	assert.deepEqual(youtube.srcAssignments, [fallback]);
	assert.equal(youtube.src, fallback);
});

test('pauseActivePlayback reloads non-YouTube iframes without postMessage and ignores empty src', () => {
	const tiktok = new HTMLIFrameElement('https://www.tiktok.com/player/v1/123');
	const empty = new HTMLIFrameElement('   ');
	const malformed = new HTMLIFrameElement('http://[');
	const { pauseActivePlayback } = loadPauseHelpers({
		state: {
			playerWrap: wrapWith({ iframe: tiktok }),
			inlinePlayerWrap: wrapWith({ iframe: empty }),
			embed: { kind: 'video', src: 'https://ignored.example/embed' },
		},
	});

	pauseActivePlayback();

	assert.equal(tiktok.contentWindow.messages.length, 0);
	assert.deepEqual(tiktok.srcAssignments, ['https://www.tiktok.com/player/v1/123']);
	assert.deepEqual(empty.srcAssignments, []);

	const { pauseActivePlayback: pauseMalformed } = loadPauseHelpers({
		state: {
			playerWrap: wrapWith({ iframe: malformed }),
			embed: { kind: 'iframe', src: 'https://www.youtube.com/embed/fallback' },
		},
	});
	pauseMalformed();
	assert.equal(malformed.contentWindow.messages.length, 0);
	assert.deepEqual(malformed.srcAssignments, ['https://www.youtube.com/embed/fallback']);
});

test('pauseActivePlayback prefers a video element over a sibling iframe and no-ops without wraps', () => {
	const video = new HTMLVideoElement({ paused: false });
	const iframe = new HTMLIFrameElement('https://www.youtube.com/embed/abc');
	const { pauseActivePlayback } = loadPauseHelpers({
		state: {
			playerWrap: wrapWith({ video, iframe }),
		},
	});

	pauseActivePlayback();
	assert.equal(video.pauseCalls, 1);
	assert.equal(iframe.contentWindow.messages.length, 0);
	assert.deepEqual(iframe.srcAssignments, []);

	const { pauseActivePlayback: pauseEmpty } = loadPauseHelpers({ state: {} });
	pauseEmpty();
});
