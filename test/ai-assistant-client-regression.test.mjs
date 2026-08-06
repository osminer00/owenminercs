import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const assistantSource = readFileSync(new URL('../scripts/ai-assistant.js', import.meta.url), 'utf8');

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

function loadAssistantClientHelpers() {
	const sandbox = { String };
	vm.createContext(sandbox);
	vm.runInContext(
		`
		const MAX_HISTORY_MESSAGES = 10;
		${extractFunction(assistantSource, 'escapeHtml')}
		this.escapeHtml = escapeHtml;
		this.MAX_HISTORY_MESSAGES = MAX_HISTORY_MESSAGES;
		`,
		sandbox
	);
	return sandbox;
}

test('ai-assistant client escapes HTML entities before rendering messages', () => {
	const { escapeHtml } = loadAssistantClientHelpers();
	assert.equal(
		escapeHtml(`<img src=x onerror="alert('xss')"> & "quote"`),
		'&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt; &amp; &quot;quote&quot;'
	);
	assert.equal(escapeHtml('plain text'), 'plain text');
});

test('ai-assistant client keeps chat history capped at MAX_HISTORY_MESSAGES', () => {
	assert.match(assistantSource, /const MAX_HISTORY_MESSAGES = 10;/);
	assert.match(
		assistantSource,
		/\.slice\(\s*-MAX_HISTORY_MESSAGES\s*\)/
	);
	assert.match(
		assistantSource,
		/state\.history = state\.history\.slice\(-MAX_HISTORY_MESSAGES\)/
	);

	const { MAX_HISTORY_MESSAGES } = loadAssistantClientHelpers();
	const history = Array.from({ length: 14 }, (_, index) => ({
		role: index % 2 === 0 ? 'user' : 'assistant',
		content: `m-${index}`,
	}));
	const capped = history.slice(-MAX_HISTORY_MESSAGES);
	assert.equal(capped.length, 10);
	assert.equal(capped[0].content, 'm-4');
	assert.equal(capped[9].content, 'm-13');
});
