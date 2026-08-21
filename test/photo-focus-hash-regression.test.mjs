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

function extractNamedIife(source, functionName) {
	const start = source.indexOf(`(function ${functionName}`);
	assert.notEqual(start, -1, `${functionName} IIFE should exist`);
	const braceStart = source.indexOf('{', start);
	assert.notEqual(braceStart, -1, `${functionName} IIFE should have a body`);

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(start, i + 1);
		}
	}

	assert.fail(`${functionName} IIFE should close`);
}

function makeImg(src) {
	return {
		src,
		style: {},
		scrolled: null,
		getAttribute(name) {
			return name === 'src' ? src : null;
		},
		scrollIntoView(opts) {
			this.scrolled = opts;
		},
	};
}

function loadPhotoFocusHelpers(options = {}) {
	const iifeSource = extractNamedIife(componentsSource, 'initPhotoFocusFromHash');
	const imgs = options.imgs || [];
	const pendingTimeouts = [];
	const location = {
		hash: options.hash || '',
		href: options.href || 'https://www.owenminercs.com/Photography/photos.html',
	};

	const sandbox = {
		String,
		Math,
		Number,
		URL,
		location,
		imgs,
		pendingTimeouts,
		window: {
			location,
			setTimeout(fn, ms) {
				pendingTimeouts.push({ fn, ms });
				return pendingTimeouts.length;
			},
		},
		document: {
			querySelectorAll(selector) {
				if (selector === 'img[src], picture > img[src]') return imgs;
				return [];
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(iifeSource, 'hash8')}
		${extractFunction(iifeSource, 'resolveUrl')}
		${extractFunction(iifeSource, 'run')}
		this.__helpers = {
			hash8,
			resolveUrl,
			run,
			location,
			imgs,
			pendingTimeouts,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('hash8 returns a stable 8-character hex digest', () => {
	const helpers = loadPhotoFocusHelpers();
	const empty = helpers.hash8('');
	const photo = helpers.hash8('https://www.owenminercs.com/Photography/images/keep.jpg');

	assert.match(empty, /^[0-9a-f]{8}$/);
	assert.match(photo, /^[0-9a-f]{8}$/);
	assert.equal(helpers.hash8(''), empty);
	assert.notEqual(empty, photo);
	assert.notEqual(
		helpers.hash8('https://www.owenminercs.com/Photography/images/keep.jpg'),
		helpers.hash8('https://www.owenminercs.com/Photography/images/other.jpg')
	);
});

test('resolveUrl absolutizes relative image paths and keeps already-absolute URLs', () => {
	const helpers = loadPhotoFocusHelpers();
	assert.equal(
		helpers.resolveUrl(
			'images/keep.jpg',
			'https://www.owenminercs.com/Photography/photos.html'
		),
		'https://www.owenminercs.com/Photography/images/keep.jpg'
	);
	assert.equal(
		helpers.resolveUrl(
			'https://cdn.example/photos/a.jpg',
			'https://www.owenminercs.com/Photography/photos.html'
		),
		'https://cdn.example/photos/a.jpg'
	);
	assert.equal(helpers.resolveUrl('not a url', ':::bad-base'), 'not a url');
});

test('photo hash focus ignores non keep-img hashes and unmatched images', () => {
	const miss = makeImg('images/keep.jpg');
	const helpers = loadPhotoFocusHelpers({
		hash: '#section',
		imgs: [miss],
	});

	helpers.run();
	assert.equal(miss.scrolled, null);

	helpers.location.hash = '#keep-img-zzzzzzzz';
	helpers.run();
	assert.equal(miss.scrolled, null);

	helpers.location.hash = '#keep-img-abc';
	helpers.run();
	assert.equal(miss.scrolled, null);
});

test('photo hash focus scrolls the matching image and clears the outline after timeout', () => {
	const matchSrc = 'images/keep.jpg';
	const match = makeImg(matchSrc);
	const other = makeImg('images/other.jpg');
	const helpers = loadPhotoFocusHelpers({
		imgs: [other, match],
		href: 'https://www.owenminercs.com/Photography/photos.html',
	});

	const abs = helpers.resolveUrl(matchSrc, helpers.location.href);
	const digest = helpers.hash8(abs);
	helpers.location.hash = `#keep-img-${digest.toUpperCase()}`;

	helpers.run();

	assert.equal(match.scrolled.block, 'center');
	assert.equal(match.scrolled.behavior, 'smooth');
	assert.equal(other.scrolled, null);
	assert.equal(match.style.outline, '2px solid rgba(255, 190, 90, 0.95)');
	assert.equal(match.style.outlineOffset, '3px');
	assert.equal(helpers.pendingTimeouts.length, 1);
	assert.equal(helpers.pendingTimeouts[0].ms, 2200);

	helpers.pendingTimeouts[0].fn();
	assert.equal(match.style.outline, '');
	assert.equal(match.style.outlineOffset, '');
});
