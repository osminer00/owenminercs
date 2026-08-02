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

function loadImportHelpers() {
	const source = readWorkspaceFile('scripts/import-ebay-listings-export.mjs');
	const sandbox = {
		String,
		Array,
		Set,
		Object,
	};

	vm.runInNewContext(
		[
			extractFunction(source, 'parseArgs'),
			extractFunction(source, 'toArray'),
			extractFunction(source, 'toText'),
			extractFunction(source, 'splitImages'),
			extractFunction(source, 'normalizeRow'),
			extractFunction(source, 'parseCsv'),
			`this.__helpers = {
				parseArgs,
				toArray,
				toText,
				splitImages,
				normalizeRow,
				parseCsv,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'eBay import helpers should load');
	return sandbox.__helpers;
}

const helpers = loadImportHelpers();

test('eBay import parseArgs supports valued flags and bare booleans', () => {
	const { parseArgs } = helpers;

	const parsed = parseArgs(['--in', 'export.csv', '--out', 'listings.json', '--seller', 'owenm00']);
	assert.equal(parsed.in, 'export.csv');
	assert.equal(parsed.out, 'listings.json');
	assert.equal(parsed.seller, 'owenm00');

	const bare = parseArgs(['--dry-run', '--in']);
	assert.equal(bare['dry-run'], true);
	assert.equal(bare.in, true);

	assert.equal(Object.keys(parseArgs(['plain', 'values'])).length, 0);
});

test('eBay import text/array helpers normalize empty and non-array values', () => {
	const { toArray, toText, splitImages } = helpers;

	assert.deepEqual(Array.from(toArray(['a', 'b'])), ['a', 'b']);
	assert.deepEqual(Array.from(toArray(null)), []);
	assert.deepEqual(Array.from(toArray({ items: 1 })), []);

	assert.equal(toText('  hello  '), 'hello');
	assert.equal(toText(null), '');
	assert.equal(toText(undefined), '');
	assert.equal(toText(12), '12');

	assert.deepEqual(Array.from(splitImages([' https://a.jpg ', '', 'https://b.jpg'])), [
		'https://a.jpg',
		'https://b.jpg',
	]);
	assert.deepEqual(Array.from(splitImages('https://a.jpg, https://b.jpg|https://c.jpg\nhttps://d.jpg')), [
		'https://a.jpg',
		'https://b.jpg',
		'https://c.jpg',
		'https://d.jpg',
	]);
	assert.deepEqual(Array.from(splitImages('')), []);
	assert.deepEqual(Array.from(splitImages(null)), []);
});

test('eBay import normalizeRow maps aliases, dedupes images, and drops empty rows', () => {
	const { normalizeRow } = helpers;

	const normalized = normalizeRow({
		name: '  Signed Print  ',
		itemUrl: ' https://www.ebay.com/itm/1 ',
		currentPrice: ' $18.00 ',
		condition: 'New',
		shippingText: 'Free',
		startTime: '2026-01-01',
		primaryImage: 'https://cdn.example/primary.jpg',
		images: 'https://cdn.example/primary.jpg, https://cdn.example/extra.jpg',
		section: '',
	});

	assert.equal(normalized.title, 'Signed Print');
	assert.equal(normalized.url, 'https://www.ebay.com/itm/1');
	assert.equal(normalized.price, '$18.00');
	assert.equal(normalized.image, 'https://cdn.example/primary.jpg');
	assert.deepEqual(Array.from(normalized.images), [
		'https://cdn.example/primary.jpg',
		'https://cdn.example/extra.jpg',
	]);
	assert.equal(normalized.section, 'garage');
	assert.equal(normalized.publishedAt, '2026-01-01');
	assert.equal(normalized.condition, 'New');
	assert.equal(normalized.shipping, 'Free');

	const singleImage = normalizeRow({
		title: 'Sticker Pack',
		url: 'https://www.ebay.com/itm/2',
		image: 'https://cdn.example/s.jpg',
	});
	assert.equal(singleImage.image, 'https://cdn.example/s.jpg');
	assert.equal('images' in singleImage, false);

	const incomplete = normalizeRow({ title: 'No URL', price: '$1' });
	assert.equal(incomplete.title, 'No URL');
	assert.equal(incomplete.url, '');
});

test('eBay import parseCsv maps header rows and ignores blank lines', () => {
	const { parseCsv } = helpers;

	const rows = parseCsv(
		['title,url,price', 'Print,https://ebay.test/1,$12', '', 'Stickers,https://ebay.test/2,$6', '  '].join(
			'\n'
		)
	);

	assert.equal(rows.length, 2);
	assert.equal(rows[0].title, 'Print');
	assert.equal(rows[0].url, 'https://ebay.test/1');
	assert.equal(rows[0].price, '$12');
	assert.equal(rows[1].title, 'Stickers');
	assert.equal(rows[1].price, '$6');

	assert.deepEqual(Array.from(parseCsv('title,url\n')), []);
	assert.deepEqual(Array.from(parseCsv('')), []);
});
