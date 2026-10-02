import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const marker = `function ${functionName}(`;
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const paramsStart = source.indexOf('(', start);
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

function hostify(value) {
	return JSON.parse(JSON.stringify(value));
}

function loadHelpers(relativePath, names) {
	const source = readWorkspaceFile(relativePath);
	const sandbox = {};
	vm.runInNewContext(
		[...names.map((name) => extractFunction(source, name)), `this.__helpers = { ${names.join(', ')} };`].join(
			'\n'
		),
		sandbox
	);
	for (const name of names) {
		assert.equal(typeof sandbox.__helpers[name], 'function', name);
	}
	return sandbox.__helpers;
}

const importer = loadHelpers('scripts/import-ebay-listings-export.mjs', [
	'toText',
	'splitImages',
	'normalizeRow',
]);
const images = loadHelpers('scripts/enrich-ebay-images.mjs', ['normalizeImageUrl', 'pickImageFromHtml']);

test('eBay image lists split on commas, newlines, and pipes', () => {
	const { splitImages } = importer;
	assert.deepEqual(hostify(splitImages(null)), []);
	assert.deepEqual(hostify(splitImages('   ')), []);
	assert.deepEqual(hostify(splitImages([' a.jpg ', '', '  ', 'b.jpg'])), ['a.jpg', 'b.jpg']);
	assert.deepEqual(hostify(splitImages(' a.jpg | b.jpg,\nc.jpg ')), ['a.jpg', 'b.jpg', 'c.jpg']);
});

test('eBay listing rows keep one primary image and omit blank optional fields', () => {
	const { normalizeRow } = importer;

	const listing = hostify(
		normalizeRow({
			name: 'Ignored name',
			title: 'Wooting 60HE',
			link: 'https://www.ebay.com/itm/123',
			currentPrice: 19.5,
			image: '',
			primaryImage: 'https://i.ebayimg.com/primary.jpg',
			images: 'https://i.ebayimg.com/primary.jpg, https://i.ebayimg.com/extra.jpg',
			imageUrls: ['https://i.ebayimg.com/extra.jpg', ' https://i.ebayimg.com/third.jpg '],
			additionalImages: '',
			condition: ' Used ',
			shipping: '',
			publishedAt: '',
			section: ' keyboards ',
		})
	);
	assert.deepEqual(listing, {
		title: 'Wooting 60HE',
		url: 'https://www.ebay.com/itm/123',
		price: '19.5',
		image: 'https://i.ebayimg.com/primary.jpg',
		section: 'keyboards',
		images: [
			'https://i.ebayimg.com/primary.jpg',
			'https://i.ebayimg.com/extra.jpg',
			'https://i.ebayimg.com/third.jpg',
		],
		condition: 'Used',
	});

	const sparse = hostify(
		normalizeRow({
			listingTitle: 'Mouse',
			listingUrl: 'https://www.ebay.com/itm/9',
			listingPrice: '$12',
			image: 'https://i.ebayimg.com/only.jpg',
		})
	);
	assert.deepEqual(sparse, {
		title: 'Mouse',
		url: 'https://www.ebay.com/itm/9',
		price: '$12',
		image: 'https://i.ebayimg.com/only.jpg',
		section: 'garage',
	});
	assert.equal(Object.hasOwn(sparse, 'images'), false);
	assert.equal(Object.hasOwn(sparse, 'shipping'), false);
	assert.equal(Object.hasOwn(sparse, 'publishedAt'), false);
	assert.equal(Object.hasOwn(sparse, 'condition'), false);
});

test('eBay image enrichment prefers og:image and decodes listing URLs', () => {
	const { normalizeImageUrl, pickImageFromHtml } = images;

	assert.equal(normalizeImageUrl('  https://i.ebayimg.com/a&amp;b=%7E1  '), 'https://i.ebayimg.com/a&b=~1');
	assert.equal(normalizeImageUrl('https://i.ebayimg.com/a&lt;b.jpg'), 'https://i.ebayimg.com/a&lt;b.jpg');

	assert.equal(
		pickImageFromHtml(
			'<meta property="og:image" content=" https://i.ebayimg.com/og&amp;id=%7E1 "><img src="https://i.ebayimg.com/later.jpg">'
		),
		'https://i.ebayimg.com/og&id=~1'
	);
	assert.equal(
		pickImageFromHtml('<meta content=\'https://i.ebayimg.com/second.jpg\' property="og:image">'),
		'https://i.ebayimg.com/second.jpg'
	);
	assert.equal(
		pickImageFromHtml('<div>https://i.ebayimg.com/s-l1600.jpg?set_id=1</div>'),
		'https://i.ebayimg.com/s-l1600.jpg?set_id=1'
	);
	assert.equal(pickImageFromHtml('<html>no listing photo</html>'), '');
	assert.equal(pickImageFromHtml(''), '');
});
