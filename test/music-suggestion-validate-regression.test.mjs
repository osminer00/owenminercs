import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const cloudflareSource = readFileSync(
	new URL('../functions/api/music-suggestions.js', import.meta.url),
	'utf8'
);
const netlifySource = readFileSync(
	new URL('../netlify/functions/music-suggestions.js', import.meta.url),
	'utf8'
);

const FIXED_ISO = '2026-09-05T10:00:00.000Z';

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

function loadSuggestionHelpers(source, uuid = 'test-suggestion-id') {
	class FrozenDate extends Date {
		constructor(...args) {
			if (args.length === 0) {
				super(FIXED_ISO);
				return;
			}
			super(...args);
		}
	}

	const sandbox = {
		String,
		Number,
		Date: FrozenDate,
		crypto: {
			randomUUID() {
				return uuid;
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		this.__helpers = (function () {
			${extractFunction(source, 'parsePositiveInt')}
			${extractFunction(source, 'cleanText')}
			${extractFunction(source, 'validateSuggestion')}
			return { parsePositiveInt, cleanText, validateSuggestion };
		})();
		`,
		sandbox
	);
	return sandbox.__helpers;
}

function suggestionFields(result) {
	if (result.error) return { error: String(result.error) };
	const suggestion = result.suggestion;
	return {
		id: String(suggestion.id),
		songTitle: String(suggestion.songTitle),
		artistName: String(suggestion.artistName),
		viewerName: String(suggestion.viewerName),
		note: String(suggestion.note),
		createdAt: String(suggestion.createdAt),
	};
}

function assertHostParity(assertCase) {
	const cloudflare = loadSuggestionHelpers(cloudflareSource);
	const netlify = loadSuggestionHelpers(netlifySource);
	assertCase(cloudflare, 'cloudflare');
	assertCase(netlify, 'netlify');
}

test('parsePositiveInt rejects non-positive values and falls back', () => {
	assertHostParity((helpers) => {
		assert.equal(helpers.parsePositiveInt(undefined, 20), 20);
		assert.equal(helpers.parsePositiveInt('', 20), 20);
		assert.equal(helpers.parsePositiveInt('0', 20), 20);
		assert.equal(helpers.parsePositiveInt('-3', 20), 20);
		assert.equal(helpers.parsePositiveInt('nope', 20), 20);
		assert.equal(helpers.parsePositiveInt('8', 20), 8);
		assert.equal(helpers.parsePositiveInt(50, 20), 50);
	});
});

test('validateSuggestion rejects honeypot and missing title/artist, then trims and caps fields', () => {
	assertHostParity((helpers) => {
		assert.deepEqual(suggestionFields(helpers.validateSuggestion({})), {
			error: 'Song title and artist are required.',
		});
		assert.deepEqual(
			suggestionFields(helpers.validateSuggestion({ songTitle: '  ', artistName: 'Artist' })),
			{ error: 'Song title and artist are required.' }
		);
		assert.deepEqual(
			suggestionFields(helpers.validateSuggestion({ songTitle: 'Song', artistName: '' })),
			{ error: 'Song title and artist are required.' }
		);
		assert.deepEqual(
			suggestionFields(
				helpers.validateSuggestion({
					songTitle: 'Song',
					artistName: 'Artist',
					website: 'https://spam.example',
				})
			),
			{ error: 'Invalid submission.' }
		);

		const accepted = suggestionFields(
			helpers.validateSuggestion({
				songTitle: '  Never   Gonna  ',
				artistName: ' Rick  Astley ',
				viewerName: '',
				note: '   ',
				website: '   ',
			})
		);
		assert.deepEqual(accepted, {
			id: 'test-suggestion-id',
			songTitle: 'Never Gonna',
			artistName: 'Rick Astley',
			viewerName: 'Anonymous',
			note: '',
			createdAt: FIXED_ISO,
		});

		const longTitle = 'T'.repeat(200);
		const longArtist = 'A'.repeat(200);
		const longViewer = 'V'.repeat(90);
		const longNote = 'N'.repeat(300);
		const capped = suggestionFields(
			helpers.validateSuggestion({
				songTitle: longTitle,
				artistName: longArtist,
				viewerName: longViewer,
				note: longNote,
			})
		);
		assert.equal(capped.songTitle, 'T'.repeat(120));
		assert.equal(capped.artistName, 'A'.repeat(120));
		assert.equal(capped.viewerName, 'V'.repeat(60));
		assert.equal(capped.note, 'N'.repeat(220));
	});
});
