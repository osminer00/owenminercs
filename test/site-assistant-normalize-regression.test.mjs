import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const cloudflareSource = readFileSync(
	new URL('../functions/api/site-assistant.js', import.meta.url),
	'utf8'
);
const netlifySource = readFileSync(
	new URL('../netlify/functions/site-assistant.js', import.meta.url),
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

function extractConst(source, name) {
	const match = source.match(new RegExp(`const ${name} = ([^;]+);`));
	assert.ok(match, `${name} should exist`);
	return match[0];
}

function loadAssistantHelpers(source) {
	const sandbox = { String, Array };
	vm.createContext(sandbox);
	vm.runInContext(
		`
		this.__helpers = (function () {
			${extractConst(source, 'MAX_HISTORY_MESSAGES')}
			${extractConst(source, 'MAX_MESSAGE_CHARS')}
			${extractConst(source, 'MAX_KNOWLEDGE_ENTRIES')}
			${extractConst(source, 'MAX_KNOWLEDGE_FIELD_CHARS')}
			${extractFunction(source, 'cleanText')}
			${extractFunction(source, 'normalizeMessages')}
			${extractFunction(source, 'normalizeKnowledgeEntries')}
			return {
				MAX_HISTORY_MESSAGES,
				MAX_MESSAGE_CHARS,
				MAX_KNOWLEDGE_ENTRIES,
				MAX_KNOWLEDGE_FIELD_CHARS,
				cleanText,
				normalizeMessages,
				normalizeKnowledgeEntries,
			};
		})();
		`,
		sandbox
	);
	return sandbox.__helpers;
}

function messageRows(value) {
	return Array.from(value, (row) => ({
		role: String(row.role),
		content: String(row.content),
	}));
}

function knowledgeRows(value) {
	return Array.from(value, (row) => ({
		title: String(row.title),
		url: String(row.url),
		summary: String(row.summary),
	}));
}

function assertHostParity(assertCase) {
	const cloudflare = loadAssistantHelpers(cloudflareSource);
	const netlify = loadAssistantHelpers(netlifySource);
	assertCase(cloudflare, 'cloudflare');
	assertCase(netlify, 'netlify');
}

test('normalizeMessages keeps the last 10 non-empty turns and coerces unknown roles to user', () => {
	assertHostParity((helpers) => {
		assert.deepEqual(messageRows(helpers.normalizeMessages(null)), []);
		assert.deepEqual(messageRows(helpers.normalizeMessages({})), []);
		assert.deepEqual(
			messageRows(
				helpers.normalizeMessages([
					{ role: 'system', content: 'ignore this role' },
					{ role: 'assistant', content: '  prior   reply  ' },
					{ role: 'user', content: '   ' },
					{ role: 'tool', content: 'what is the setup?' },
				])
			),
			[
				{ role: 'user', content: 'ignore this role' },
				{ role: 'assistant', content: 'prior reply' },
				{ role: 'user', content: 'what is the setup?' },
			]
		);

		const overflow = Array.from({ length: 14 }, (_, index) => ({
			role: 'user',
			content: `turn ${index + 1}`,
		}));
		const kept = messageRows(helpers.normalizeMessages(overflow));
		assert.equal(kept.length, helpers.MAX_HISTORY_MESSAGES);
		assert.equal(kept[0].content, 'turn 5');
		assert.equal(kept[kept.length - 1].content, 'turn 14');

		const long = 'x'.repeat(helpers.MAX_MESSAGE_CHARS + 40);
		const truncated = messageRows(helpers.normalizeMessages([{ role: 'user', content: long }]));
		assert.equal(truncated[0].content.length, helpers.MAX_MESSAGE_CHARS);
	});
});

test('normalizeKnowledgeEntries drops empty untitled rows and caps title/url/summary', () => {
	assertHostParity((helpers) => {
		assert.deepEqual(knowledgeRows(helpers.normalizeKnowledgeEntries(null)), []);
		assert.deepEqual(knowledgeRows(helpers.normalizeKnowledgeEntries({})), []);
		assert.deepEqual(
			knowledgeRows(
				helpers.normalizeKnowledgeEntries([
					{ title: '', url: '', summary: '' },
					{ title: '  Setup hub  ', url: '', summary: '' },
					{ title: '', url: '/qa', summary: '  Public FAQ  ' },
				])
			),
			[
				{ title: 'Setup hub', url: '/', summary: '' },
				{ title: 'Untitled', url: '/qa', summary: 'Public FAQ' },
			]
		);

		const overflow = Array.from({ length: helpers.MAX_KNOWLEDGE_ENTRIES + 5 }, (_, index) => ({
			title: `Page ${index + 1}`,
			url: `/p/${index + 1}`,
			summary: `Summary ${index + 1}`,
		}));
		const kept = knowledgeRows(helpers.normalizeKnowledgeEntries(overflow));
		assert.equal(kept.length, helpers.MAX_KNOWLEDGE_ENTRIES);
		assert.equal(kept[0].title, 'Page 1');
		assert.equal(kept[kept.length - 1].title, `Page ${helpers.MAX_KNOWLEDGE_ENTRIES}`);

		const longTitle = 'T'.repeat(200);
		const longUrl = 'U'.repeat(400);
		const longSummary = 'S'.repeat(helpers.MAX_KNOWLEDGE_FIELD_CHARS + 50);
		const capped = knowledgeRows(
			helpers.normalizeKnowledgeEntries([
				{ title: longTitle, url: longUrl, summary: longSummary },
			])
		);
		assert.equal(capped[0].title, 'T'.repeat(180));
		assert.equal(capped[0].url, 'U'.repeat(300));
		assert.equal(capped[0].summary, 'S'.repeat(helpers.MAX_KNOWLEDGE_FIELD_CHARS));
	});
});
