import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');
const searchPageHtml = readFileSync(new URL('../search.html', import.meta.url), 'utf8');

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

function loadDisclosureHelper() {
	const sandbox = { String };
	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(componentsSource, 'stripFooterAmazonEarningsSuffix')}
		this.__helpers = { stripFooterAmazonEarningsSuffix };
		`,
		sandbox
	);
	return sandbox.__helpers;
}

test('footer disclosure strips duplicated Amazon earnings lines only before closing italics', () => {
	const { stripFooterAmazonEarningsSuffix } = loadDisclosureHelper();

	assert.equal(stripFooterAmazonEarningsSuffix(null), null);
	assert.equal(stripFooterAmazonEarningsSuffix(undefined), undefined);
	assert.equal(stripFooterAmazonEarningsSuffix(''), '');
	assert.equal(stripFooterAmazonEarningsSuffix(12), 12);

	assert.equal(
		stripFooterAmazonEarningsSuffix(
			'<i>Ko-fi tips. As an Amazon Associate I earn from qualifying purchases through eligible links on those pages.</i>'
		),
		'<i>Ko-fi tips.</i>'
	);
	assert.equal(
		stripFooterAmazonEarningsSuffix(
			'<i>Shop note. As an Amazon Associate I earn from qualifying purchases through eligible links on this page.</i>'
		),
		'<i>Shop note.</i>'
	);
	assert.equal(
		stripFooterAmazonEarningsSuffix(
			'<i>Support links. As an Amazon Associate I earn from qualifying purchases.</i>'
		),
		'<i>Support links.</i>'
	);
	assert.equal(
		stripFooterAmazonEarningsSuffix(
			'<i>As an Amazon Associate I earn from qualifying purchases through eligible links on those pages.</i>'
		),
		'<i></i>'
	);

	const keepOutsideItalics =
		'As an Amazon Associate I earn from qualifying purchases through eligible links on those pages.';
	assert.equal(stripFooterAmazonEarningsSuffix(keepOutsideItalics), keepOutsideItalics);
	assert.equal(
		stripFooterAmazonEarningsSuffix('<i>Amazon Associates Program membership is disclosed here.</i>'),
		'<i>Amazon Associates Program membership is disclosed here.</i>'
	);
});

test('shared footer uses the strip helper unless the page already has a page-specific Amazon note', () => {
	assert.match(componentsSource, /class SharedFooter extends HTMLElement/);
	assert.match(componentsSource, /stripFooterAmazonEarningsSuffix\(customDisclosure\)/);
	assert.match(componentsSource, /This page includes Amazon shopping links/);
	assert.match(
		componentsSource,
		/As an Amazon Associate I earn from qualifying purchases through eligible links on those pages/
	);

	const { stripFooterAmazonEarningsSuffix } = loadDisclosureHelper();
	const searchDisclosureMatch = searchPageHtml.match(
		/disclosure="([^"]+)"|disclosure='([^']+)'/
	);
	assert.ok(searchDisclosureMatch, 'search page should set a footer disclosure');
	const searchDisclosure = (searchDisclosureMatch[1] || searchDisclosureMatch[2] || '')
		.replaceAll('&#39;', "'")
		.replaceAll('&amp;', '&');
	assert.match(searchDisclosure, /As an Amazon Associate I earn from qualifying purchases/);
	assert.doesNotMatch(searchDisclosure, /This page includes Amazon shopping links/i);

	const stripped = stripFooterAmazonEarningsSuffix(searchDisclosure);
	assert.doesNotMatch(stripped, /As an Amazon Associate I earn from qualifying purchases/);
	assert.match(stripped, /Amazon Associates Program/);
});
