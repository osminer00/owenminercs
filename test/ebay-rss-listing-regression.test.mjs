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
	const declaredAt = source.slice(Math.max(0, start - 6), start) === 'async ' ? start - 6 : start;

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
			if (depth === 0) return source.slice(declaredAt, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function hostify(value) {
	return JSON.parse(JSON.stringify(value));
}

function loadEbayRssHelpers() {
	const source = readWorkspaceFile('scripts/sync-ebay-listings.mjs');
	const sandbox = {};
	vm.runInNewContext(
		[
			extractFunction(source, 'decodeXml'),
			extractFunction(source, 'readTag'),
			extractFunction(source, 'extractPrice'),
			extractFunction(source, 'extractImage'),
			extractFunction(source, 'sanitizeText'),
			extractFunction(source, 'parseRssItems'),
			'this.__helpers = { decodeXml, extractPrice, extractImage, sanitizeText, parseRssItems };',
		].join('\n'),
		sandbox
	);
	assert.equal(typeof sandbox.__helpers.parseRssItems, 'function');
	return sandbox.__helpers;
}

const helpers = loadEbayRssHelpers();

const SAMPLE_FEED = `
<rss>
  <item>
    <title><![CDATA[Wooting &amp; 60HE &quot;sale&quot; <b>$24.00</b>]]></title>
    <link>https://www.ebay.com/itm/123<br></link>
    <description><![CDATA[<p>Ships fast</p><img src="https://i.ebayimg.com/a.jpg?x=1&amp;y=2">]]></description>
    <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Second sticker</title>
    <link>https://www.ebay.com/itm/456</link>
    <description>No price here</description>
  </item>
  <item>
    <title>A &lt;script&gt;alert(1)&lt;/script&gt; pack</title>
    <link>https://www.ebay.com/itm/789</link>
    <description>Listed at $8</description>
  </item>
</rss>
`;

test('eBay RSS listings decode entities, strip markup, and keep the first dollar price', () => {
	const { parseRssItems } = helpers;
	const items = hostify(parseRssItems(SAMPLE_FEED, 10));

	assert.equal(items.length, 3);
	assert.deepEqual(items[0], {
		title: 'Wooting & 60HE "sale" $24.00',
		url: 'https://www.ebay.com/itm/123',
		price: '$24.00',
		image: 'https://i.ebayimg.com/a.jpg?x=1&y=2',
		publishedAt: 'Mon, 01 Jan 2024 00:00:00 GMT',
	});
	assert.deepEqual(items[1], {
		title: 'Second sticker',
		url: 'https://www.ebay.com/itm/456',
		price: '',
		image: '',
		publishedAt: '',
	});
	assert.equal(items[2].title, 'A alert(1) pack');
	assert.equal(items[2].price, '$8');
	assert.equal(items[2].image, '');
});

test('eBay RSS parsing honors the item limit and ignores feeds without items', () => {
	const { parseRssItems, extractPrice } = helpers;

	assert.deepEqual(
		hostify(parseRssItems(SAMPLE_FEED, 1)).map((item) => item.url),
		['https://www.ebay.com/itm/123']
	);
	assert.deepEqual(hostify(parseRssItems('<rss></rss>', 5)), []);
	assert.equal(extractPrice('Keyboard', 'Ships tomorrow'), '');
	assert.equal(extractPrice('Sale $10', 'was $99.00'), '$10');
});
