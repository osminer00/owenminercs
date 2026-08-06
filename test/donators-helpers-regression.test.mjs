import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const donatorsSource = readFileSync(new URL('../scripts/donators.js', import.meta.url), 'utf8');

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

function extractVarObject(source, name) {
	const start = source.indexOf(`var ${name} = {`);
	assert.notEqual(start, -1, `${name} object should exist`);
	const braceStart = source.indexOf('{', start);
	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return source.slice(start, i + 1) + ';';
		}
	}
	assert.fail(`${name} object should close`);
}

function loadDonatorsHelpers() {
	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		Array,
		Date,
		URL,
		console,
		window: { location: { href: 'https://www.owenminercs.com/Donators/donators.html' } },
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractVarObject(donatorsSource, 'ACTIVE_PLATFORMS')}
		${extractVarObject(donatorsSource, 'PLATFORM_LABELS')}
		${extractFunction(donatorsSource, 'isHttpUrl')}
		${extractFunction(donatorsSource, 'kofiPageEmbedUrl')}
		${extractFunction(donatorsSource, 'normalizePlatform')}
		${extractFunction(donatorsSource, 'platformIsActive')}
		${extractFunction(donatorsSource, 'normalizeKind')}
		${extractFunction(donatorsSource, 'amountNumber')}
		${extractFunction(donatorsSource, 'asNumber')}
		${extractFunction(donatorsSource, 'currencyText')}
		${extractFunction(donatorsSource, 'escapeAttr')}
		${extractFunction(donatorsSource, 'buildSupportEvents')}
		this.__helpers = {
			isHttpUrl,
			kofiPageEmbedUrl,
			normalizePlatform,
			platformIsActive,
			normalizeKind,
			amountNumber,
			asNumber,
			currencyText,
			escapeAttr,
			buildSupportEvents,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('donators helpers validate tip URLs and build Ko-fi embed query params', () => {
	const { isHttpUrl, kofiPageEmbedUrl } = loadDonatorsHelpers();

	assert.equal(isHttpUrl('https://ko-fi.com/owenminer'), true);
	assert.equal(isHttpUrl('http://example.com'), true);
	assert.equal(isHttpUrl(' javascript:alert(1) '), false);
	assert.equal(isHttpUrl('mailto:owen@example.com'), false);
	assert.equal(isHttpUrl('/relative'), false);
	assert.equal(isHttpUrl(null), false);

	const embed = new URL(kofiPageEmbedUrl('https://ko-fi.com/owenminer'));
	assert.equal(embed.searchParams.get('hidefeed'), 'true');
	assert.equal(embed.searchParams.get('widget'), '1');
	assert.equal(embed.searchParams.get('embed'), '1');
	assert.equal(kofiPageEmbedUrl('::::'), '::::');
});

test('donators helpers normalize platforms/kinds and parse donation amounts safely', () => {
	const {
		normalizePlatform,
		platformIsActive,
		normalizeKind,
		amountNumber,
		asNumber,
		currencyText,
		escapeAttr,
	} = loadDonatorsHelpers();

	assert.equal(normalizePlatform(' KoFi '), 'other');
	assert.equal(normalizePlatform('kofi'), 'kofi');
	assert.equal(normalizePlatform('Twitch'), 'twitch');
	assert.equal(platformIsActive('kofi'), true);
	assert.equal(platformIsActive('streamelements'), true);
	assert.equal(platformIsActive('twitch'), false);

	assert.equal(normalizeKind('tip'), 'donation');
	assert.equal(normalizeKind('SUB'), 'subscription');
	assert.equal(normalizeKind('cheer'), 'bits');
	assert.equal(normalizeKind('weird'), 'other');

	assert.equal(amountNumber({ amount: '$12.50' }), 12.5);
	assert.equal(amountNumber({ amount: '1,234.00 USD' }), 1234);
	assert.equal(amountNumber({ amount: 'n/a' }), 0);
	assert.equal(amountNumber({}), 0);
	assert.equal(asNumber('3.2'), 3.2);
	assert.equal(asNumber('nope'), 0);
	assert.equal(currencyText(12.5), '$12.50');
	assert.equal(currencyText(0), '$0.00');
	assert.equal(currencyText(Number.NaN), '$0.00');
	assert.equal(escapeAttr('a&b"c<d>e'), 'a&amp;b&quot;c&lt;d&gt;e');
});

test('buildSupportEvents keeps active platforms, merges Twitch feed, and sorts newest first', () => {
	const { buildSupportEvents } = loadDonatorsHelpers();

	const events = buildSupportEvents(
		[
			{
				id: 'k1',
				name: 'Alice',
				platform: 'kofi',
				kind: 'donation',
				amount: '$20',
				date: '2026-01-01T12:00:00Z',
			},
			{
				id: 'ignored',
				name: 'Bob',
				platform: 'twitch',
				kind: 'bits',
				bits: 100,
				date: '2026-02-01T12:00:00Z',
			},
			{
				id: 'se1',
				name: '  ',
				platform: 'streamelements',
				kind: 'tip',
				amount: '5',
				date: '2026-03-01T12:00:00Z',
			},
			{
				id: 'zero',
				name: 'Zero',
				platform: 'kofi',
				kind: 'donation',
				amount: '0',
				date: '2026-04-01T12:00:00Z',
			},
		],
		{
			events: [
				{
					id: 't-bits',
					type: 'bits',
					userName: 'CheerGuy',
					bits: 250,
					createdAt: '2026-05-01T12:00:00Z',
				},
				{
					id: 't-gift',
					type: 'gift_sub',
					userName: 'Gifter',
					total: 5,
					createdAt: '2026-06-01T12:00:00Z',
				},
				{
					id: 't-follow',
					type: 'follow',
					userName: 'Follower',
					createdAt: '2026-07-01T12:00:00Z',
				},
			],
		}
	);

	assert.equal(events.length, 4);
	assert.equal(events[0].id, 't-gift');
	assert.equal(events[0].subscribers, 5);
	assert.equal(events[0].platform, 'twitch');
	assert.equal(events[1].id, 't-bits');
	assert.equal(events[1].bits, 250);
	assert.equal(events[2].id, 'se1');
	assert.equal(events[2].name, 'Anonymous');
	assert.equal(events[2].donations, 5);
	assert.equal(events[3].id, 'k1');
	assert.equal(events[3].donations, 20);
	assert.ok(!events.some((event) => event.id === 'ignored' || event.id === 'zero' || event.id === 't-follow'));
});
