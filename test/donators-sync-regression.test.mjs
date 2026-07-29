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

function loadDonatorSyncHelpers() {
	const source = readWorkspaceFile('dev/sync-donators-from-csv.mjs');
	const sandbox = { String, Array, Object, Boolean, Number, Set };

	vm.runInNewContext(
		[
			extractFunction(source, 'parseCsv'),
			extractFunction(source, 'getField'),
			extractFunction(source, 'toSupporter'),
			extractFunction(source, 'dedupeSupporters'),
			`this.__helpers = {
				parseCsv,
				getField,
				toSupporter,
				dedupeSupporters,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'donator sync helpers should load');
	return sandbox.__helpers;
}

test('donator CSV parser handles quotes, commas, and CRLF rows', () => {
	const { parseCsv } = loadDonatorSyncHelpers();

	const rows = parseCsv(
		[
			'Name,Amount,Message',
			'"Miner, Owen",12.50,"Thanks, legend"',
			'Anon,5,Hello',
			'',
			'"Quoted ""Name""",1,"line1"',
		].join('\r\n')
	);

	assert.equal(rows.length, 3);
	assert.equal(rows[0].Name, 'Miner, Owen');
	assert.equal(rows[0].Amount, '12.50');
	assert.equal(rows[0].Message, 'Thanks, legend');
	assert.equal(rows[1].Name, 'Anon');
	assert.equal(rows[2].Name, 'Quoted "Name"');
});

test('donator mapping uses flexible headers and platform defaults', () => {
	const { toSupporter } = loadDonatorSyncHelpers();

	const kofi = toSupporter(
		{
			'Display Name': 'Bigfoot',
			'Tip Amount': '10',
			Currency: 'USD',
			'Created At': '2026-07-01',
			Note: 'Keep going',
		},
		'kofi',
		{ kind: 'donation' }
	);
	assert.equal(kofi.name, 'Bigfoot');
	assert.equal(kofi.platform, 'kofi');
	assert.equal(kofi.kind, 'donation');
	assert.equal(kofi.amount, '10');
	assert.equal(kofi.currency, 'USD');
	assert.equal(kofi.date, '2026-07-01');
	assert.equal(kofi.message, 'Keep going');

	const twitch = toSupporter(
		{
			Subscriber: 'ViewerOne',
			'Subscribed At': '2026-07-02',
		},
		'twitch'
	);
	assert.equal(twitch.name, 'ViewerOne');
	assert.equal(twitch.kind, 'subscription');
	assert.equal(twitch.amount, '');
	assert.equal(twitch.date, '2026-07-02');

	const anonymous = toSupporter({}, 'youtube', { kind: 'donation' });
	assert.equal(anonymous.name, 'Anonymous');
	assert.equal(anonymous.kind, 'donation');
	assert.equal(anonymous.platform, 'youtube');
});

test('donator dedupe keeps first unique supporter and drops exact duplicates', () => {
	const { dedupeSupporters } = loadDonatorSyncHelpers();

	const items = [
		{
			name: 'Pat',
			platform: 'kofi',
			kind: 'donation',
			amount: '5',
			currency: 'USD',
			date: '2026-07-01',
		},
		{
			name: 'pat',
			platform: 'KOFI',
			kind: 'Donation',
			amount: '5',
			currency: 'usd',
			date: '2026-07-01',
		},
		{
			name: 'Pat',
			platform: 'kofi',
			kind: 'donation',
			amount: '10',
			currency: 'USD',
			date: '2026-07-01',
		},
	];

	const deduped = dedupeSupporters(items);
	assert.equal(deduped.length, 2);
	assert.equal(deduped[0].name, 'Pat');
	assert.equal(deduped[0].amount, '5');
	assert.equal(deduped[1].amount, '10');
});
