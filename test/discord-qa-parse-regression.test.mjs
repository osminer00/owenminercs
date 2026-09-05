import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const cloudflareSource = readFileSync(
	new URL('../functions/api/discord-qa.js', import.meta.url),
	'utf8'
);
const netlifySource = readFileSync(
	new URL('../netlify/functions/discord-qa.js', import.meta.url),
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

function loadQaHelpers(source) {
	const sandbox = { String, Array };
	vm.createContext(sandbox);
	vm.runInContext(
		`
		this.__helpers = (function () {
			${extractFunction(source, 'parseMarkdownQA')}
			${extractFunction(source, 'parseEmbedQA')}
			${extractFunction(source, 'normalizeChannelName')}
			return { parseMarkdownQA, parseEmbedQA, normalizeChannelName };
		})();
		`,
		sandbox
	);
	return sandbox.__helpers;
}

function qaFields(parsed) {
	if (parsed == null) return null;
	return {
		question: String(parsed.question),
		answer: String(parsed.answer),
	};
}

function assertHostParity(assertCase) {
	const cloudflare = loadQaHelpers(cloudflareSource);
	const netlify = loadQaHelpers(netlifySource);
	assertCase(cloudflare, 'cloudflare');
	assertCase(netlify, 'netlify');
}

test('parseMarkdownQA requires a Q/A pair split by a blank-or-newline break', () => {
	assertHostParity((helpers) => {
		assert.equal(helpers.parseMarkdownQA(null), null);
		assert.equal(helpers.parseMarkdownQA(''), null);
		assert.equal(helpers.parseMarkdownQA(42), null);
		assert.equal(helpers.parseMarkdownQA('Just a Discord message'), null);
		assert.equal(helpers.parseMarkdownQA('**Q**: only a question'), null);
		assert.equal(helpers.parseMarkdownQA('**Q**: same line **A**: answer'), null);

		assert.deepEqual(
			qaFields(helpers.parseMarkdownQA('**Q**: How tall?\n**A**: 6 foot 7.')),
			{ question: 'How tall?', answer: '6 foot 7.' }
		);
		assert.deepEqual(
			qaFields(helpers.parseMarkdownQA('**q**:  spaced  \n\n**a**:  still works  ')),
			{ question: 'spaced', answer: 'still works' }
		);
		assert.deepEqual(
			qaFields(
				helpers.parseMarkdownQA('**Q**: first\n**A**: keep the rest\n**Q**: later\n**A**: ignored')
			),
			{ question: 'first', answer: 'keep the rest\n**Q**: later\n**A**: ignored' }
		);
	});
});

test('parseEmbedQA uses the first embed description and strips a Q: title prefix', () => {
	assertHostParity((helpers) => {
		assert.equal(helpers.parseEmbedQA(null), null);
		assert.equal(helpers.parseEmbedQA({}), null);
		assert.equal(helpers.parseEmbedQA([]), null);
		assert.equal(helpers.parseEmbedQA([{ title: 'Q: Missing body' }]), null);
		assert.equal(helpers.parseEmbedQA([{ title: 'Q: Empty', description: '   ' }]), null);

		assert.deepEqual(
			qaFields(
				helpers.parseEmbedQA([
					{ title: '  Q: Favorite keyboard?  ', description: '  Wooting 60HE  ' },
					{ title: 'Q: Later', description: 'should not win' },
				])
			),
			{ question: 'Favorite keyboard?', answer: 'Wooting 60HE' }
		);
		assert.deepEqual(
			qaFields(helpers.parseEmbedQA([{ description: 'Answer-only embed' }])),
			{ question: 'Question', answer: 'Answer-only embed' }
		);
	});
});

test('normalizeChannelName trims, lowercases, and strips a single leading hash', () => {
	assertHostParity((helpers) => {
		assert.equal(helpers.normalizeChannelName(null), '');
		assert.equal(helpers.normalizeChannelName(''), '');
		assert.equal(helpers.normalizeChannelName(12), '');
		assert.equal(helpers.normalizeChannelName('  #Questions-And-Answers  '), 'questions-and-answers');
		assert.equal(helpers.normalizeChannelName('##double'), '#double');
		assert.equal(helpers.normalizeChannelName('questions-and-answers'), 'questions-and-answers');
	});
});
