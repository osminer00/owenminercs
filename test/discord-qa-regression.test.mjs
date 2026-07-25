import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

function loadDiscordQaHelpers(relativePath) {
	const source = readWorkspaceFile(relativePath);
	const sandbox = {};

	vm.runInNewContext(
		[
			extractFunction(source, 'parseMarkdownQA'),
			extractFunction(source, 'parseEmbedQA'),
			extractFunction(source, 'normalizeChannelName'),
			'this.__helpers = { parseMarkdownQA, parseEmbedQA, normalizeChannelName };',
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, `helpers should load from ${relativePath}`);
	return sandbox.__helpers;
}

function assertQaPair(actual, expected) {
	assert.ok(actual, 'expected a parsed Q/A pair');
	assert.equal(actual.question, expected.question);
	assert.equal(actual.answer, expected.answer);
}

for (const runtime of [
	{ label: 'Cloudflare', path: 'functions/api/discord-qa.js' },
	{ label: 'Netlify', path: 'netlify/functions/discord-qa.js' },
]) {
	test(`${runtime.label} discord-qa parses markdown Q/A pairs and rejects incomplete content`, () => {
		const { parseMarkdownQA } = loadDiscordQaHelpers(runtime.path);

		assertQaPair(parseMarkdownQA('**Q**: How tall are you?\n\n**A**: About 6\'2".'), {
			question: 'How tall are you?',
			answer: 'About 6\'2".',
		});
		assert.equal(parseMarkdownQA('just a normal message'), null);
		assert.equal(parseMarkdownQA('**Q**: Missing answer only'), null);
		assert.equal(parseMarkdownQA(null), null);
	});

	test(`${runtime.label} discord-qa parses embed Q/A and normalizes channel names`, () => {
		const { parseEmbedQA, normalizeChannelName } = loadDiscordQaHelpers(runtime.path);

		assertQaPair(
			parseEmbedQA([{ title: 'Q: Where do I report bugs?', description: 'Use Discord.' }]),
			{
				question: 'Where do I report bugs?',
				answer: 'Use Discord.',
			}
		);
		assertQaPair(parseEmbedQA([{ title: '', description: 'Answer body only' }]), {
			question: 'Question',
			answer: 'Answer body only',
		});
		assert.equal(parseEmbedQA([{ title: 'Q: No description' }]), null);
		assert.equal(parseEmbedQA([]), null);

		assert.equal(normalizeChannelName('#Questions-And-Answers'), 'questions-and-answers');
		assert.equal(normalizeChannelName('  Questions-And-Answers  '), 'questions-and-answers');
		assert.equal(normalizeChannelName(''), '');
		assert.equal(normalizeChannelName(null), '');
	});
}
