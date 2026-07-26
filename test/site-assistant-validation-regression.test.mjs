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

function loadAssistantHelpers(relativePath) {
	const source = readWorkspaceFile(relativePath);
	const sandbox = {
		String,
		Array,
		Boolean,
	};

	vm.runInNewContext(
		[
			'const MAX_HISTORY_MESSAGES = 10;',
			'const MAX_MESSAGE_CHARS = 1200;',
			'const MAX_KNOWLEDGE_ENTRIES = 80;',
			'const MAX_KNOWLEDGE_FIELD_CHARS = 1000;',
			extractFunction(source, 'cleanText'),
			extractFunction(source, 'normalizeMessages'),
			extractFunction(source, 'normalizeKnowledgeEntries'),
			`this.__helpers = {
				cleanText,
				normalizeMessages,
				normalizeKnowledgeEntries,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, `helpers should load from ${relativePath}`);
	return sandbox.__helpers;
}

for (const runtime of [
	{ label: 'Cloudflare', path: 'functions/api/site-assistant.js' },
	{ label: 'Netlify', path: 'netlify/functions/site-assistant.js' },
]) {
	test(`${runtime.label} site assistant cleans text and enforces message history limits`, () => {
		const { cleanText, normalizeMessages } = loadAssistantHelpers(runtime.path);

		assert.equal(cleanText('  heavy   spaces\n\there  ', 20), 'heavy spaces here');
		assert.equal(cleanText('abcdefghijklmnopqrstuvwxyz', 10), 'abcdefghij');
		assert.equal(normalizeMessages(null).length, 0);
		assert.equal(normalizeMessages('not-an-array').length, 0);

		const history = Array.from({ length: 12 }, (_, index) => ({
			role: index % 2 === 0 ? 'user' : 'assistant',
			content: `message-${index}`,
		}));
		const normalized = normalizeMessages(history);
		assert.equal(normalized.length, 10);
		assert.equal(normalized[0].content, 'message-2');
		assert.equal(normalized[9].content, 'message-11');
		assert.equal(normalized[0].role, 'user');
		assert.equal(normalized[1].role, 'assistant');
	});

	test(`${runtime.label} site assistant coerces roles and drops empty messages`, () => {
		const { normalizeMessages } = loadAssistantHelpers(runtime.path);

		const normalized = normalizeMessages([
			{ role: 'system', content: 'should become user' },
			{ role: 'assistant', content: '   ' },
			{ role: 'assistant', content: 'kept assistant' },
			{ role: 'user', content: 'x'.repeat(1300) },
		]);

		assert.equal(normalized.length, 3);
		assert.equal(normalized[0].role, 'user');
		assert.equal(normalized[0].content, 'should become user');
		assert.equal(normalized[1].role, 'assistant');
		assert.equal(normalized[1].content, 'kept assistant');
		assert.equal(normalized[2].role, 'user');
		assert.equal(normalized[2].content.length, 1200);
	});

	test(`${runtime.label} site assistant normalizes and filters knowledge entries`, () => {
		const { normalizeKnowledgeEntries } = loadAssistantHelpers(runtime.path);

		assert.equal(normalizeKnowledgeEntries(null).length, 0);
		assert.equal(normalizeKnowledgeEntries({ title: 'nope' }).length, 0);

		const entries = Array.from({ length: 85 }, (_, index) => ({
			title: `Page ${index}`,
			url: `/page-${index}`,
			summary: `Summary ${index}`,
		}));
		const normalized = normalizeKnowledgeEntries(entries);
		assert.equal(normalized.length, 80);
		assert.equal(normalized[0].title, 'Page 0');
		assert.equal(normalized[79].title, 'Page 79');

		const filtered = normalizeKnowledgeEntries([
			{ title: '  Setup Hub  ', url: '  /The%20Setup/  ', summary: '  Desk  gear  ' },
			{ title: 'Untitled', url: '', summary: '' },
			{ title: '', url: '/orphan', summary: '' },
			{ title: 'Has summary', url: null, summary: 'y'.repeat(1200) },
		]);

		assert.equal(filtered.length, 2);
		assert.equal(filtered[0].title, 'Setup Hub');
		assert.equal(filtered[0].url, '/The%20Setup/');
		assert.equal(filtered[0].summary, 'Desk gear');
		assert.equal(filtered[1].title, 'Has summary');
		assert.equal(filtered[1].url, '/');
		assert.equal(filtered[1].summary.length, 1000);
	});
}

test('Cloudflare and Netlify site assistant keep matching body and knowledge caps', () => {
	const cloudflare = readWorkspaceFile('functions/api/site-assistant.js');
	const netlify = readWorkspaceFile('netlify/functions/site-assistant.js');

	for (const source of [cloudflare, netlify]) {
		assert.match(source, /const MAX_BODY_BYTES = 100_000;/);
		assert.match(source, /const MAX_HISTORY_MESSAGES = 10;/);
		assert.match(source, /const MAX_MESSAGE_CHARS = 1200;/);
		assert.match(source, /const MAX_KNOWLEDGE_ENTRIES = 80;/);
		assert.match(source, /const MAX_KNOWLEDGE_FIELD_CHARS = 1000;/);
		assert.match(source, /const MAX_KNOWLEDGE_BLOB_CHARS = 20_000;/);
	}
});
