import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

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

function loadExtractSteamIdFromXml(relativePath) {
	const source = readWorkspaceFile(relativePath);
	const sandbox = {};
	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(source, 'extractSteamIdFromXml')}
		this.__fn = extractSteamIdFromXml;
		`,
		sandbox
	);
	assert.equal(typeof sandbox.__fn, 'function', `extractSteamIdFromXml should load from ${relativePath}`);
	return sandbox.__fn;
}

const cloudflareExtract = loadExtractSteamIdFromXml('functions/api/steam-cs2-inventory.js');
const netlifyExtract = loadExtractSteamIdFromXml('netlify/functions/steam-cs2-inventory.js');

function assertSteamIdXmlContract(extractSteamIdFromXml, label) {
	assert.equal(
		extractSteamIdFromXml('<profile><steamID64>76561198000000000</steamID64></profile>'),
		'76561198000000000',
		`${label}: plain steamID64 tag`
	);
	assert.equal(
		extractSteamIdFromXml('<profile><STEAMID64>76561198123456789</STEAMID64></profile>'),
		'76561198123456789',
		`${label}: case-insensitive tag`
	);
	assert.equal(
		extractSteamIdFromXml(
			'noise <steamID64>76561198000000001</steamID64> more <steamID64>76561198000000002</steamID64>'
		),
		'76561198000000001',
		`${label}: first match wins`
	);
	assert.equal(
		extractSteamIdFromXml('<profile><steamID64>12345</steamID64></profile>'),
		null,
		`${label}: rejects non-17-digit ids`
	);
	assert.equal(
		extractSteamIdFromXml('<profile><steamID64>7656119800000000a</steamID64></profile>'),
		null,
		`${label}: rejects non-digit steam ids`
	);
	assert.equal(extractSteamIdFromXml('<profile></profile>'), null, `${label}: missing tag`);
	assert.equal(extractSteamIdFromXml(''), null, `${label}: empty xml`);
}

test('Cloudflare Steam inventory extracts steamID64 from community XML', () => {
	assertSteamIdXmlContract(cloudflareExtract, 'Cloudflare');
});

test('Netlify Steam inventory matches Cloudflare steamID64 XML extraction', () => {
	assertSteamIdXmlContract(netlifyExtract, 'Netlify');

	const samples = [
		'<steamID64>76561198000000000</steamID64>',
		'<STEAMID64>76561198123456789</STEAMID64>',
		'<steamID64>12</steamID64>',
		'',
	];
	for (const sample of samples) {
		assert.equal(netlifyExtract(sample), cloudflareExtract(sample));
	}
});
