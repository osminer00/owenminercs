import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractConstSet(source, constName) {
	const start = source.indexOf(`const ${constName} = `);
	assert.notEqual(start, -1, `${constName} should exist`);

	const setStart = source.indexOf('new Set(', start);
	assert.notEqual(setStart, -1, `${constName} should be a Set`);

	let depth = 0;
	let started = false;
	for (let i = setStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '(' || char === '[' || char === '{') {
			depth += 1;
			started = true;
		}
		if (char === ')' || char === ']' || char === '}') {
			depth -= 1;
			if (started && depth === 0) {
				let end = i + 1;
				if (source[end] === ';') end += 1;
				return source.slice(start, end);
			}
		}
	}

	assert.fail(`${constName} Set should close`);
}

function extractConstArray(source, constName) {
	const start = source.indexOf(`const ${constName} = `);
	assert.notEqual(start, -1, `${constName} should exist`);

	const arrayStart = source.indexOf('[', start);
	assert.notEqual(arrayStart, -1, `${constName} should have an array body`);

	let depth = 0;
	for (let i = arrayStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '[') depth += 1;
		if (char === ']') {
			depth -= 1;
			if (depth === 0) {
				let end = i + 1;
				if (source[end] === ';') end += 1;
				return source.slice(start, end);
			}
		}
	}

	assert.fail(`${constName} array should close`);
}

function loadPublicContentRules() {
	const source = readWorkspaceFile('dev/public-content-regression-check.mjs');
	const sandbox = {
		Set,
		RegExp,
	};

	vm.runInNewContext(
		[
			extractConstSet(source, 'PUBLIC_EXTENSIONS'),
			extractConstSet(source, 'EXCLUDED_DIRS'),
			extractConstSet(source, 'EXCLUDED_FILES'),
			extractConstArray(source, 'FORBIDDEN_PUBLIC_CONTENT'),
			`this.__helpers = {
				PUBLIC_EXTENSIONS,
				EXCLUDED_DIRS,
				EXCLUDED_FILES,
				FORBIDDEN_PUBLIC_CONTENT,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'public content rules should load');
	return sandbox.__helpers;
}

const rules = loadPublicContentRules();

test('public content checker skips generated search JSON by basename', () => {
	const { EXCLUDED_FILES, PUBLIC_EXTENSIONS } = rules;

	assert.equal(PUBLIC_EXTENSIONS.has('.html'), true);
	assert.equal(PUBLIC_EXTENSIONS.has('.json'), true);
	assert.equal(EXCLUDED_FILES.has('site-search-index.json'), true);
	assert.equal(EXCLUDED_FILES.has('search-manual-keywords.json'), true);
	assert.equal(EXCLUDED_FILES.has('package.json'), true);
});

test('public content checker keeps high-risk bio and alumni patterns active', () => {
	const { FORBIDDEN_PUBLIC_CONTENT, EXCLUDED_DIRS } = rules;
	const labels = FORBIDDEN_PUBLIC_CONTENT.map((rule) => rule.label);

	assert.ok(labels.includes('DMACC public mention'));
	assert.ok(labels.includes('schema.org alumniOf field'));
	assert.ok(labels.includes('old graduate bio sentence'));
	assert.ok(labels.includes('old programming-at-school bio sentence'));

	assert.equal(EXCLUDED_DIRS.has('mockups'), true);
	assert.equal(EXCLUDED_DIRS.has('dev'), true);
	assert.equal(EXCLUDED_DIRS.has('memory'), true);

	const sample = 'I am a 23 year old graduate who studied at DMACC';
	const hits = FORBIDDEN_PUBLIC_CONTENT.filter((rule) => rule.pattern.test(sample)).map(
		(rule) => rule.label
	);
	assert.ok(hits.includes('DMACC public mention'));
	assert.ok(hits.includes('old graduate bio sentence'));
});
