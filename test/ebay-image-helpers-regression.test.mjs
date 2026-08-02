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

function extractBetween(source, startMarker, endMarker) {
	const start = source.indexOf(startMarker);
	assert.notEqual(start, -1, `start marker should exist: ${startMarker}`);
	const end = source.indexOf(endMarker, start);
	assert.notEqual(end, -1, `end marker should exist: ${endMarker}`);
	return source.slice(start, end);
}

function loadMergeHelpers() {
	const source = readWorkspaceFile('scripts/merge-ebay-images.mjs');
	const mergeCore = extractBetween(
		source,
		'const byTitle = new Map();',
		'target.source = target.source || {};'
	);
	const sandbox = {
		String,
		Map,
		Array,
	};

	vm.runInNewContext(
		[
			extractFunction(source, 'normalize'),
			`function mergeListingImages(target, sourceItems) {
				${mergeCore}
				return updated;
			}`,
			`this.__helpers = { normalize, mergeListingImages };`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'eBay merge helpers should load');
	return sandbox.__helpers;
}

function loadEnrichHelpers() {
	const source = readWorkspaceFile('scripts/enrich-ebay-images.mjs');
	const sandbox = {
		String,
		Array,
		RegExp,
	};

	vm.runInNewContext(
		[
			extractFunction(source, 'normalizeImageUrl'),
			extractFunction(source, 'pickImageFromHtml'),
			`this.__helpers = { normalizeImageUrl, pickImageFromHtml };`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'eBay enrich helpers should load');
	return sandbox.__helpers;
}

const mergeHelpers = loadMergeHelpers();
const enrichHelpers = loadEnrichHelpers();

test('eBay image merge normalizes titles and only fills missing images', () => {
	const { normalize, mergeListingImages } = mergeHelpers;

	assert.equal(normalize('  Mixed CASE Title  '), 'mixed case title');
	assert.equal(normalize(null), '');

	const target = {
		items: [
			{ title: 'Signed Print', image: '' },
			{ title: 'Sticker Pack', image: 'https://cdn.example/keep.jpg' },
			{ title: 'Photo Print' },
			{ title: 'No Match', image: '' },
		],
	};

	const updated = mergeListingImages(target, [
		{ title: ' signed print ', image: 'https://cdn.example/signed.jpg' },
		{ title: 'Sticker Pack', imageUrl: 'https://cdn.example/should-not-overwrite.jpg' },
		{ title: 'Photo Print', image: 'https://cdn.example/photo.jpg' },
		{ title: '', image: 'https://cdn.example/ignored.jpg' },
		{ title: 'Missing image', image: '  ' },
	]);

	assert.equal(updated, 2);
	assert.equal(target.items[0].image, 'https://cdn.example/signed.jpg');
	assert.equal(target.items[1].image, 'https://cdn.example/keep.jpg');
	assert.equal(target.items[2].image, 'https://cdn.example/photo.jpg');
	assert.equal(target.items[3].image, '');
});

test('eBay image enrich normalizes URLs and prefers og:image over ebayimg fallbacks', () => {
	const { normalizeImageUrl, pickImageFromHtml } = enrichHelpers;

	assert.equal(
		normalizeImageUrl(' https://i.ebayimg.com/images/g/abc/s-l1600.jpg&amp;foo=1%7Ebar '),
		'https://i.ebayimg.com/images/g/abc/s-l1600.jpg&foo=1~bar'
	);

	assert.equal(
		pickImageFromHtml(
			'<html><head><meta property="og:image" content="https://i.ebayimg.com/images/g/og/s-l1600.jpg&amp;x=1"></head></html>'
		),
		'https://i.ebayimg.com/images/g/og/s-l1600.jpg&x=1'
	);

	assert.equal(
		pickImageFromHtml(
			'<html><head><meta content="https://i.ebayimg.com/images/g/rev/s-l1600.jpg" property="og:image"></head></html>'
		),
		'https://i.ebayimg.com/images/g/rev/s-l1600.jpg'
	);

	assert.equal(
		pickImageFromHtml(
			'<html><body>fallback https://i.ebayimg.com/images/g/fb/s-l500.jpg more</body></html>'
		),
		'https://i.ebayimg.com/images/g/fb/s-l500.jpg'
	);

	assert.equal(pickImageFromHtml('<html><body>no listing image</body></html>'), '');
});
