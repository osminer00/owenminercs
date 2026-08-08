import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');

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

function loadShortFormHelpers() {
	class Element {
		constructor() {
			this.dataset = {};
			this.classList = {
				_values: new Set(),
				contains(value) {
					return this._values.has(value);
				},
				add(value) {
					this._values.add(value);
				},
			};
			this._attrs = {};
			this.parent = null;
		}

		getAttribute(name) {
			return Object.prototype.hasOwnProperty.call(this._attrs, name)
				? this._attrs[name]
				: null;
		}

		setAttribute(name, value) {
			this._attrs[name] = String(value);
		}

		closest(selector) {
			const tokens = String(selector)
				.split(',')
				.map((part) => part.trim())
				.filter(Boolean);
			let node = this;
			while (node) {
				for (const token of tokens) {
					if (token.startsWith('[data-short-form="1"]')) {
						if (node.dataset?.shortForm === '1') return node;
						continue;
					}
					if (token.startsWith('.')) {
						if (node.classList.contains(token.slice(1))) return node;
					}
				}
				node = node.parent;
			}
			return null;
		}
	}

	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		Array,
		URL,
		console,
		Element,
		window: {
			location: {
				origin: 'https://www.owenminercs.com',
				href: 'https://www.owenminercs.com/Socials/socials.html',
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(componentsSource, 'isShortFormIframeSrc')}
		${extractFunction(componentsSource, 'getYouTubeEmbedId')}
		${extractFunction(componentsSource, 'buildShortFormLoopSrc')}
		${extractFunction(componentsSource, 'shouldLoopVideoElement')}
		this.__helpers = {
			isShortFormIframeSrc,
			getYouTubeEmbedId,
			buildShortFormLoopSrc,
			shouldLoopVideoElement,
			Element,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('short-form iframe detection covers TikTok, Reels, Shorts, and portrait embeds', () => {
	const { isShortFormIframeSrc, Element } = loadShortFormHelpers();

	assert.equal(isShortFormIframeSrc('', null), false);
	assert.equal(
		isShortFormIframeSrc('https://www.tiktok.com/embed/v2/123', { className: '', title: '' }),
		true
	);
	assert.equal(
		isShortFormIframeSrc('https://www.instagram.com/reel/ABC123/', {
			className: '',
			title: '',
		}),
		true
	);
	assert.equal(
		isShortFormIframeSrc('https://www.youtube.com/shorts/abcdefghijk', {
			className: '',
			title: '',
		}),
		true
	);

	const portraitEmbed = new Element();
	portraitEmbed.setAttribute('width', '270');
	portraitEmbed.setAttribute('height', '480');
	assert.equal(
		isShortFormIframeSrc('https://www.youtube.com/embed/abcdefghijk', portraitEmbed),
		true
	);

	const landscapeEmbed = new Element();
	landscapeEmbed.setAttribute('width', '1280');
	landscapeEmbed.setAttribute('height', '720');
	assert.equal(
		isShortFormIframeSrc('https://www.youtube.com/embed/abcdefghijk', landscapeEmbed),
		false
	);

	const markedEmbed = new Element();
	markedEmbed.classList.add('short-form');
	markedEmbed.title = 'Short clip';
	assert.equal(
		isShortFormIframeSrc('https://www.youtube.com/embed/abcdefghijk', markedEmbed),
		true
	);

	// Invalid absolute URLs skip URL parsing and fall back to substring checks.
	assert.equal(isShortFormIframeSrc('http://[::youtube.com/shorts/xyz', null), true);
	assert.equal(isShortFormIframeSrc('http://[::example.com/watch', null), false);
});

test('short-form loop src forces loop/playsinline and YouTube playlist self-reference', () => {
	const { getYouTubeEmbedId, buildShortFormLoopSrc } = loadShortFormHelpers();

	assert.equal(getYouTubeEmbedId('https://www.youtube.com/embed/AbCdEfGhIjK'), 'AbCdEfGhIjK');
	assert.equal(getYouTubeEmbedId('https://www.youtube.com/shorts/ShortId99'), 'ShortId99');
	assert.equal(getYouTubeEmbedId('https://www.youtube.com/watch?v=WatchId123'), 'WatchId123');
	assert.equal(getYouTubeEmbedId(''), '');

	const looped = new URL(
		buildShortFormLoopSrc('https://www.youtube.com/embed/AbCdEfGhIjK?autoplay=1')
	);
	assert.equal(looped.searchParams.get('loop'), '1');
	assert.equal(looped.searchParams.get('playsinline'), '1');
	assert.equal(looped.searchParams.get('playlist'), 'AbCdEfGhIjK');
	assert.equal(looped.searchParams.get('autoplay'), '1');

	assert.equal(
		buildShortFormLoopSrc('https://example.com/player'),
		'https://example.com/player?loop=1&playsinline=1'
	);
	assert.equal(
		buildShortFormLoopSrc('https://example.com/player?foo=1'),
		'https://example.com/player?foo=1&loop=1&playsinline=1'
	);
	assert.equal(buildShortFormLoopSrc(''), '');
});

test('shouldLoopVideoElement honors opt-out, short markers, and ancestor short-form wrappers', () => {
	const { shouldLoopVideoElement, Element } = loadShortFormHelpers();

	assert.equal(shouldLoopVideoElement(null), false);

	const optedOut = new Element();
	optedOut.dataset.noLoop = '1';
	optedOut.dataset.shortForm = '1';
	assert.equal(shouldLoopVideoElement(optedOut), false);

	const marked = new Element();
	marked.dataset.shortForm = '1';
	assert.equal(shouldLoopVideoElement(marked), true);

	const bySrc = new Element();
	bySrc.src = 'https://www.tiktok.com/@owen/video/1';
	assert.equal(shouldLoopVideoElement(bySrc), true);

	const byClass = new Element();
	byClass.classList.add('reel');
	assert.equal(shouldLoopVideoElement(byClass), true);

	const wrapper = new Element();
	wrapper.dataset.shortForm = '1';
	const nested = new Element();
	nested.parent = wrapper;
	assert.equal(shouldLoopVideoElement(nested), true);

	const plain = new Element();
	plain.src = 'https://cdn.example.com/longform.mp4';
	assert.equal(shouldLoopVideoElement(plain), false);
});
