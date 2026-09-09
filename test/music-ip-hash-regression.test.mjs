import assert from 'node:assert/strict';
import nodeCrypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const cloudflareSource = readFileSync(
	new URL('../functions/api/music-suggestions.js', import.meta.url),
	'utf8'
);
const netlifySource = readFileSync(
	new URL('../netlify/functions/music-suggestions.js', import.meta.url),
	'utf8'
);

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

function expectedHash(ip) {
	return nodeCrypto.createHash('sha256').update(ip, 'utf8').digest('hex').slice(0, 24);
}

function loadCloudflareHashIp() {
	const sandbox = {
		crypto: globalThis.crypto,
		TextEncoder,
		Uint8Array,
		Array,
	};
	vm.createContext(sandbox);
	vm.runInContext(
		`
		this.__hash = (function () {
			async ${extractFunction(cloudflareSource, 'hashIp')}
			return hashIp;
		})();
		`,
		sandbox
	);
	return sandbox.__hash;
}

function loadNetlifyHashIp() {
	const sandbox = {
		crypto: nodeCrypto,
	};
	vm.createContext(sandbox);
	vm.runInContext(
		`
		this.__hash = (function () {
			${extractFunction(netlifySource, 'hashIp')}
			return hashIp;
		})();
		`,
		sandbox
	);
	return sandbox.__hash;
}

test('Cloudflare and Netlify hashIp share a 24-char SHA-256 prefix', async () => {
	const cloudflareHashIp = loadCloudflareHashIp();
	const netlifyHashIp = loadNetlifyHashIp();

	const samples = ['1.2.3.4', 'unknown', '', '2001:db8::1'];
	for (const ip of samples) {
		const expected = expectedHash(ip);
		const cloudflare = await cloudflareHashIp(ip);
		const netlify = netlifyHashIp(ip);

		assert.equal(expected.length, 24);
		assert.match(expected, /^[0-9a-f]{24}$/);
		assert.equal(cloudflare, expected);
		assert.equal(netlify, expected);
	}

	assert.notEqual(expectedHash('1.2.3.4'), expectedHash('1.2.3.5'));
	assert.equal(expectedHash('1.2.3.4'), '6694f83c9f476da31f5df6bc');
});
