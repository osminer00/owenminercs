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

function extractConstAssignment(source, constName) {
	const start = source.indexOf(`const ${constName} = `);
	assert.notEqual(start, -1, `${constName} should exist`);
	const end = source.indexOf(';', start);
	assert.notEqual(end, -1, `${constName} assignment should end`);
	return source.slice(start, end + 1);
}

function createMemoryStorage() {
	const store = new Map();
	return {
		getItem(key) {
			return store.has(key) ? store.get(key) : null;
		},
		setItem(key, value) {
			store.set(String(key), String(value));
		},
		removeItem(key) {
			store.delete(key);
		},
	};
}

function makeSpan(bookmarked) {
	const classes = new Set(bookmarked ? ['text-word-glow--bookmark'] : []);
	return {
		classList: {
			contains(name) {
				return classes.has(name);
			},
			add(name) {
				classes.add(name);
			},
			remove(name) {
				classes.delete(name);
			},
		},
		_classes: classes,
	};
}

function loadBookmarkHelpers(options = {}) {
	const localStorage = createMemoryStorage();
	for (const [key, value] of Object.entries(options.seed || {})) {
		localStorage.setItem(key, value);
	}

	const spans = Array.isArray(options.spans) ? options.spans : [];
	const location = { pathname: options.pathname == null ? '/' : options.pathname };
	const document = {
		querySelector(selector) {
			if (selector === '.text-word-glow') return spans[0] || null;
			return null;
		},
		querySelectorAll(selector) {
			if (selector === '.text-word-glow') return spans;
			return [];
		},
	};

	const sandbox = {
		JSON,
		Array,
		Set,
		Number,
		String,
		location,
		document,
		localStorage,
		spans,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractConstAssignment(componentsSource, 'WORD_GLOW_BOOKMARK_STORAGE_KEY')}
		${extractFunction(componentsSource, 'wordGlowBookmarkPathKey')}
		${extractFunction(componentsSource, 'listWordGlowSpansInDocumentOrder')}
		${extractFunction(componentsSource, 'persistWordGlowBookmarksFromDom')}
		${extractFunction(componentsSource, 'restoreWordGlowBookmarksFromStorage')}
		this.__helpers = {
			WORD_GLOW_BOOKMARK_STORAGE_KEY,
			wordGlowBookmarkPathKey,
			persistWordGlowBookmarksFromDom,
			restoreWordGlowBookmarksFromStorage,
			localStorage,
			spans,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('wordGlowBookmarkPathKey normalizes trailing slashes without collapsing root', () => {
	assert.equal(loadBookmarkHelpers({ pathname: '/' }).wordGlowBookmarkPathKey(), '/');
	assert.equal(loadBookmarkHelpers({ pathname: '' }).wordGlowBookmarkPathKey(), '/');
	assert.equal(
		loadBookmarkHelpers({ pathname: '/The Setup/' }).wordGlowBookmarkPathKey(),
		'/The Setup'
	);
	assert.equal(
		loadBookmarkHelpers({ pathname: '/Gaming/gaming.html' }).wordGlowBookmarkPathKey(),
		'/Gaming/gaming.html'
	);
});

test('persistWordGlowBookmarksFromDom stores bookmark indices and clears empty pages', () => {
	const spans = [makeSpan(true), makeSpan(false), makeSpan(true)];
	const helpers = loadBookmarkHelpers({
		pathname: '/QA/qa.html/',
		spans,
		seed: {
			'owenminercs-word-glow-bookmarks': JSON.stringify({ '/other': [9] }),
		},
	});

	helpers.persistWordGlowBookmarksFromDom();
	const stored = JSON.parse(
		helpers.localStorage.getItem(helpers.WORD_GLOW_BOOKMARK_STORAGE_KEY)
	);
	assert.deepEqual(Array.from(stored['/QA/qa.html']), [0, 2]);
	assert.deepEqual(Array.from(stored['/other']), [9]);

	spans[0].classList.remove('text-word-glow--bookmark');
	spans[2].classList.remove('text-word-glow--bookmark');
	helpers.persistWordGlowBookmarksFromDom();
	const cleared = JSON.parse(
		helpers.localStorage.getItem(helpers.WORD_GLOW_BOOKMARK_STORAGE_KEY)
	);
	assert.equal(Object.prototype.hasOwnProperty.call(cleared, '/QA/qa.html'), false);
	assert.deepEqual(Array.from(cleared['/other']), [9]);
});

test('persistWordGlowBookmarksFromDom skips pages with no word spans and rejects non-object stores', () => {
	const emptyHelpers = loadBookmarkHelpers({ pathname: '/empty', spans: [] });
	emptyHelpers.persistWordGlowBookmarksFromDom();
	assert.equal(
		emptyHelpers.localStorage.getItem(emptyHelpers.WORD_GLOW_BOOKMARK_STORAGE_KEY),
		null
	);

	const badHelpers = loadBookmarkHelpers({
		pathname: '/QA/qa.html',
		spans: [makeSpan(true)],
		seed: { 'owenminercs-word-glow-bookmarks': 'null' },
	});
	badHelpers.persistWordGlowBookmarksFromDom();
	assert.equal(
		badHelpers.localStorage.getItem(badHelpers.WORD_GLOW_BOOKMARK_STORAGE_KEY),
		'null'
	);
});

test('restoreWordGlowBookmarksFromStorage reapplies integer indices and ignores junk', () => {
	const spans = [makeSpan(false), makeSpan(false), makeSpan(false)];
	const helpers = loadBookmarkHelpers({
		pathname: '/Achievements/achievements',
		spans,
		seed: {
			'owenminercs-word-glow-bookmarks': JSON.stringify({
				'/Achievements/achievements': [0, '1', 1.5, -2, 2, 99],
			}),
		},
	});

	helpers.restoreWordGlowBookmarksFromStorage();
	assert.equal(spans[0]._classes.has('text-word-glow--bookmark'), true);
	assert.equal(spans[1]._classes.has('text-word-glow--bookmark'), false);
	assert.equal(spans[2]._classes.has('text-word-glow--bookmark'), true);

	const missing = loadBookmarkHelpers({
		pathname: '/Achievements/achievements',
		spans: [makeSpan(false)],
	});
	missing.restoreWordGlowBookmarksFromStorage();
	assert.equal(missing.spans[0]._classes.has('text-word-glow--bookmark'), false);

	const corrupt = loadBookmarkHelpers({
		pathname: '/Achievements/achievements',
		spans: [makeSpan(false)],
		seed: { 'owenminercs-word-glow-bookmarks': '{not-json' },
	});
	corrupt.restoreWordGlowBookmarksFromStorage();
	assert.equal(corrupt.spans[0]._classes.has('text-word-glow--bookmark'), false);
});
