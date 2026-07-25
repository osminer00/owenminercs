import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
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

function loadSuggestionHelpers(relativePath) {
	const source = readWorkspaceFile(relativePath);
	const sandbox = {
		crypto: {
			randomUUID,
			subtle: globalThis.crypto?.subtle,
		},
		TextEncoder,
		Date,
		console,
	};

	vm.runInNewContext(
		[
			extractFunction(source, 'parsePositiveInt'),
			extractFunction(source, 'cleanText'),
			extractFunction(source, 'validateSuggestion'),
			extractFunction(source, 'pickClientIp'),
			'this.__helpers = { parsePositiveInt, cleanText, validateSuggestion, pickClientIp };',
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, `helpers should load from ${relativePath}`);
	return sandbox.__helpers;
}

for (const runtime of [
	{ label: 'Cloudflare', path: 'functions/api/music-suggestions.js' },
	{ label: 'Netlify', path: 'netlify/functions/music-suggestions.js' },
]) {
	test(`${runtime.label} music suggestions reject honeypot and missing song fields`, () => {
		const { validateSuggestion } = loadSuggestionHelpers(runtime.path);

		assert.equal(
			validateSuggestion({ songTitle: 'Song', artistName: 'Artist', website: 'bot' }).error,
			'Invalid submission.'
		);
		assert.equal(
			validateSuggestion({ songTitle: '  ', artistName: 'Artist' }).error,
			'Song title and artist are required.'
		);
		assert.equal(
			validateSuggestion({ songTitle: 'Song', artistName: '' }).error,
			'Song title and artist are required.'
		);
	});

	test(`${runtime.label} music suggestions normalize text and default anonymous viewers`, () => {
		const { validateSuggestion, cleanText, parsePositiveInt } = loadSuggestionHelpers(
			runtime.path
		);

		assert.equal(cleanText('  heavy   spaces\n\there  ', 20), 'heavy spaces here');
		assert.equal(cleanText('abcdefghijklmnopqrstuvwxyz', 10), 'abcdefghij');
		assert.equal(parsePositiveInt('0', 20), 20);
		assert.equal(parsePositiveInt('-3', 20), 20);
		assert.equal(parsePositiveInt('7', 20), 7);
		assert.equal(parsePositiveInt('nope', 20), 20);

		const { error, suggestion } = validateSuggestion({
			songTitle: '  Neon  Dreams  ',
			artistName: '  Bigfoot  ',
			viewerName: '   ',
			note: 'please play this',
		});

		assert.equal(error, undefined);
		assert.equal(suggestion.songTitle, 'Neon Dreams');
		assert.equal(suggestion.artistName, 'Bigfoot');
		assert.equal(suggestion.viewerName, 'Anonymous');
		assert.equal(suggestion.note, 'please play this');
		assert.match(String(suggestion.id), /^[0-9a-f-]{36}$/i);
		assert.ok(Number.isFinite(Date.parse(suggestion.createdAt)));
	});
}

test('Cloudflare music suggestions prefer CF connecting IP for rate keys', () => {
	const { pickClientIp } = loadSuggestionHelpers('functions/api/music-suggestions.js');
	const request = {
		headers: {
			get(name) {
				const headers = {
					'cf-connecting-ip': '203.0.113.9',
					'x-forwarded-for': '198.51.100.2, 203.0.113.9',
					'x-real-ip': '192.0.2.1',
				};
				return headers[name] || null;
			},
		},
	};

	assert.equal(pickClientIp(request), '203.0.113.9');
});

test('Netlify music suggestions prefer Netlify client IP then first forwarded hop', () => {
	const { pickClientIp } = loadSuggestionHelpers('netlify/functions/music-suggestions.js');

	assert.equal(
		pickClientIp({
			'x-nf-client-connection-ip': '203.0.113.10',
			'x-forwarded-for': '198.51.100.3, 203.0.113.10',
		}),
		'203.0.113.10'
	);
	assert.equal(pickClientIp({ 'x-forwarded-for': '198.51.100.4, 203.0.113.11' }), '198.51.100.4');
	assert.equal(pickClientIp({}), 'unknown');
});
