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

function loadDonatorCsvHelpers() {
	const source = readWorkspaceFile('dev/sync-donators-from-csv.mjs');
	const sandbox = {};
	vm.runInNewContext(
		[
			extractFunction(source, 'parseArgs'),
			extractFunction(source, 'parseCsv'),
			extractFunction(source, 'getField'),
			extractFunction(source, 'toSupporter'),
			extractFunction(source, 'dedupeSupporters'),
			'this.__helpers = { parseArgs, parseCsv, getField, toSupporter, dedupeSupporters };',
		].join('\n'),
		sandbox
	);
	assert.equal(typeof sandbox.__helpers.parseCsv, 'function');
	return sandbox.__helpers;
}

const helpers = loadDonatorCsvHelpers();

test('donator CSV keeps quoted commas, escaped quotes, and embedded newlines', () => {
	const { parseCsv } = helpers;
	const csv =
		' Name , Tip Amount , Message \r\n' +
		'"Miner, Owen","$10.00","He said ""thanks"""\r\n' +
		',,\r\n' +
		'Pat,"5","line1\nline2"\r\n';

	assert.deepEqual(hostify(parseCsv(csv)), [
		{
			Name: 'Miner, Owen',
			'Tip Amount': '$10.00',
			Message: 'He said "thanks"',
		},
		{
			Name: 'Pat',
			'Tip Amount': '5',
			Message: 'line1\nline2',
		},
	]);
	assert.deepEqual(hostify(parseCsv('')), []);
	assert.deepEqual(hostify(parseCsv('name,amount\r\n')), []);
});

test('donator rows map export aliases and fill anonymous or platform defaults', () => {
	const { toSupporter } = helpers;

	assert.deepEqual(
		hostify(
			toSupporter(
				{
					'Display Name': 'Owen',
					'Tip Amount': '12',
					Currency: 'USD',
					Note: 'gg',
					'Created At': '2026-01-02',
				},
				'kofi'
			)
		),
		{
			name: 'Owen',
			platform: 'kofi',
			kind: 'donation',
			amount: '12',
			currency: 'USD',
			date: '2026-01-02',
			message: 'gg',
		}
	);

	assert.deepEqual(
		hostify(toSupporter({ Subscriber: '   ' }, 'twitch')),
		{
			name: 'Anonymous',
			platform: 'twitch',
			kind: 'subscription',
			amount: '',
			currency: '',
			date: '',
			message: '',
		}
	);

	assert.deepEqual(
		hostify(toSupporter({ From: 'Ada', Type: 'bits' }, 'youtube', { kind: 'donation', amount: '3' })),
		{
			name: 'Ada',
			platform: 'youtube',
			kind: 'bits',
			amount: '3',
			currency: '',
			date: '',
			message: '',
		}
	);

	assert.equal(hostify(toSupporter({}, 'twitch', { kind: 'donation' })).kind, 'donation');
});

test('donator dedupe is case-insensitive and ignores the message text', () => {
	const { dedupeSupporters } = helpers;
	const rows = dedupeSupporters([
		{
			name: 'Owen',
			platform: 'KoFi',
			kind: 'Donation',
			amount: '$10',
			currency: 'USD',
			date: '2026-01-01',
			message: 'first',
		},
		{
			name: 'owen',
			platform: 'kofi',
			kind: 'donation',
			amount: '$10',
			currency: 'usd',
			date: '2026-01-01',
			message: 'second',
		},
		{
			name: 'Owen',
			platform: 'kofi',
			kind: 'donation',
			amount: '$11',
			currency: 'USD',
			date: '2026-01-01',
			message: 'other amount',
		},
	]);

	const hosted = hostify(rows);
	assert.equal(hosted.length, 2);
	assert.equal(hosted[0].message, 'first');
	assert.equal(hosted[1].amount, '$11');
	assert.equal(hosted[1].message, 'other amount');
});

test('donator CSV args keep flag values and do not consume the next flag', () => {
	const { parseArgs } = helpers;
	const args = parseArgs([
		'--kofi-csv',
		'./exports/kofi.csv',
		'--out',
		'Donators/custom.json',
		'--help',
		'--twitch-csv',
		'--youtube-csv',
		'./exports/youtube.csv',
		'positional',
	]);

	assert.deepEqual(hostify(args), {
		out: 'Donators/custom.json',
		help: true,
		'kofi-csv': './exports/kofi.csv',
		'youtube-csv': './exports/youtube.csv',
	});
});
