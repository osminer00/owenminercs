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

function loadEbaySyncHelpers() {
	const source = readWorkspaceFile('scripts/sync-ebay-listings.mjs');
	const sandbox = {
		String,
		Number,
		Map,
		Array,
		RegExp,
	};

	vm.runInNewContext(
		[
			extractFunction(source, 'parseArgs'),
			extractFunction(source, 'decodeXml'),
			extractFunction(source, 'readTag'),
			extractFunction(source, 'extractPrice'),
			extractFunction(source, 'extractImage'),
			extractFunction(source, 'sanitizeText'),
			extractFunction(source, 'normalizeTitle'),
			extractFunction(source, 'parseRssItems'),
			extractFunction(source, 'buildPaidLookup'),
			`this.__helpers = {
				parseArgs,
				decodeXml,
				readTag,
				extractPrice,
				extractImage,
				sanitizeText,
				normalizeTitle,
				parseRssItems,
				buildPaidLookup,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'ebay sync helpers should load');
	return sandbox.__helpers;
}

test('eBay sync parseArgs supports flags with and without values', () => {
	const { parseArgs } = loadEbaySyncHelpers();

	assert.deepEqual(parseArgs(['--user', 'owenm00', '--limit', '5', '--dry-run']), {
		user: 'owenm00',
		limit: '5',
		'dry-run': true,
	});
	assert.deepEqual(parseArgs(['--out']), { out: true });
	assert.deepEqual(parseArgs(['plain', 'values']), {});
});

test('eBay sync XML helpers decode entities, prices, and image sources', () => {
	const { decodeXml, readTag, extractPrice, extractImage, sanitizeText, normalizeTitle } =
		loadEbaySyncHelpers();

	assert.equal(decodeXml('A &amp; B &lt;C&gt; &quot;q&quot; &#39;s&#39;'), 'A & B <C> "q" \'s\'');
	assert.equal(decodeXml('<![CDATA[plain]]>'), 'plain');
	assert.equal(readTag('<title>Signed Print</title>', 'title'), 'Signed Print');
	assert.equal(readTag('<item></item>', 'title'), '');
	assert.equal(extractPrice('Signed print $12.50 shipped', ''), '$12.50');
	assert.equal(extractPrice('No dollars here', 'still none'), '');
	assert.equal(
		extractImage('Intro <img src="https://cdn.example/a.jpg" alt="x"> more'),
		'https://cdn.example/a.jpg'
	);
	assert.equal(extractImage('no image'), '');
	assert.equal(sanitizeText('<b>Bold</b>   text\nnext'), 'Bold text next');
	assert.equal(normalizeTitle('  Mixed CASE Title  '), 'mixed case title');
});

test('eBay sync parseRssItems respects limit and maps listing fields', () => {
	const { parseRssItems } = loadEbaySyncHelpers();
	const xml = `
		<rss><channel>
			<item>
				<title>Sticker Pack</title>
				<link>https://www.ebay.com/itm/1</link>
				<description><![CDATA[Nice pack for $6.00 <img src="https://cdn.example/s.jpg">]]></description>
				<pubDate>Mon, 01 Jan 2026 12:00:00 GMT</pubDate>
			</item>
			<item>
				<title>Photo Print</title>
				<link>https://www.ebay.com/itm/2</link>
				<description>Print listed at $20</description>
				<pubDate>Tue, 02 Jan 2026 12:00:00 GMT</pubDate>
			</item>
			<item>
				<title>Third</title>
				<link>https://www.ebay.com/itm/3</link>
				<description>$1</description>
			</item>
		</channel></rss>
	`;

	const items = parseRssItems(xml, 2);
	assert.equal(items.length, 2);
	assert.equal(items[0].title, 'Sticker Pack');
	assert.equal(items[0].url, 'https://www.ebay.com/itm/1');
	assert.equal(items[0].price, '$6.00');
	assert.equal(items[0].image, 'https://cdn.example/s.jpg');
	assert.equal(items[0].publishedAt, 'Mon, 01 Jan 2026 12:00:00 GMT');
	assert.equal(items[1].title, 'Photo Print');
	assert.equal(items[1].price, '$20');
	assert.equal(items[1].image, '');
});

test('eBay sync buildPaidLookup indexes paid prices by normalized title', () => {
	const { buildPaidLookup } = loadEbaySyncHelpers();

	const lookup = buildPaidLookup({
		items: [
			{ title: '  Signed Print  ', paidPrice: '$18' },
			{ title: 'Missing price', paidPrice: '  ' },
			{ title: '', paidPrice: '$1' },
			{ title: 'Sticker Pack', paidPrice: '$6' },
		],
	});

	assert.equal(lookup.get('signed print'), '$18');
	assert.equal(lookup.get('sticker pack'), '$6');
	assert.equal(lookup.has('missing price'), false);
	assert.equal(lookup.size, 2);
	assert.equal(buildPaidLookup(null).size, 0);
});
