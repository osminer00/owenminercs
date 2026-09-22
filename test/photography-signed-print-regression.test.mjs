import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const photographySource = readFileSync(
	new URL('../Photography/scripts/photography.js', import.meta.url),
	'utf8'
);

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}(`);
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

function loadResolveSignedPrintUrl() {
	const sandbox = { Object };
	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(photographySource, 'resolveSignedPrintUrl')}
		this.__fn = resolveSignedPrintUrl;
		`,
		sandbox
	);
	assert.equal(typeof sandbox.__fn, 'function');
	return sandbox.__fn;
}

test('resolveSignedPrintUrl uses the gallery default when the photo omits signedPrintUrl', () => {
	const resolveSignedPrintUrl = loadResolveSignedPrintUrl();
	const defaultUrl = '/Garage%20Sale/garage-sale.html#for-sale';

	assert.equal(resolveSignedPrintUrl({}, defaultUrl), defaultUrl);
	assert.equal(resolveSignedPrintUrl({ title: 'Desk' }, defaultUrl), defaultUrl);
	assert.equal(resolveSignedPrintUrl({ title: 'Desk' }, '  /prints  '), '/prints');
	assert.equal(resolveSignedPrintUrl({}, ''), '');
	assert.equal(resolveSignedPrintUrl({}, null), '');
	assert.equal(resolveSignedPrintUrl({}, undefined), '');
});

test('resolveSignedPrintUrl prefers an explicit signedPrintUrl, including blank overrides that hide the CTA', () => {
	const resolveSignedPrintUrl = loadResolveSignedPrintUrl();
	const defaultUrl = '/Garage%20Sale/garage-sale.html#for-sale';

	assert.equal(
		resolveSignedPrintUrl(
			{ signedPrintUrl: 'https://example.com/print/desk' },
			defaultUrl
		),
		'https://example.com/print/desk'
	);
	assert.equal(
		resolveSignedPrintUrl({ signedPrintUrl: '  https://example.com/print/a  ' }, defaultUrl),
		'https://example.com/print/a'
	);

	// Explicit empty/null/whitespace means "no print link", even when a gallery default exists.
	assert.equal(resolveSignedPrintUrl({ signedPrintUrl: '' }, defaultUrl), '');
	assert.equal(resolveSignedPrintUrl({ signedPrintUrl: '   ' }, defaultUrl), '');
	assert.equal(resolveSignedPrintUrl({ signedPrintUrl: null }, defaultUrl), defaultUrl);

	assert.equal(
		resolveSignedPrintUrl({ signedPrintUrl: 42 }, defaultUrl),
		'42',
		'non-string values are stringified like the dialog path'
	);
});

test('openDialog wires the signed-print helper instead of inlining the override rules', () => {
	assert.match(photographySource, /function resolveSignedPrintUrl\(photo, defaultUrl\)/);
	assert.match(
		photographySource,
		/var printUrl = resolveSignedPrintUrl\(photo, config\.signedPrintDefaultUrl\);/
	);
});
