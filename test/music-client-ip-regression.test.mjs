import assert from 'node:assert/strict';
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

function loadPickClientIp(source) {
	const sandbox = { String };
	vm.createContext(sandbox);
	vm.runInContext(
		`
		this.__pick = (function () {
			${extractFunction(source, 'pickClientIp')}
			return pickClientIp;
		})();
		`,
		sandbox
	);
	return sandbox.__pick;
}

function cloudflareRequest(headers) {
	const normalized = Object.fromEntries(
		Object.entries(headers).map(([key, value]) => [key, value])
	);
	return {
		headers: {
			get(name) {
				return Object.prototype.hasOwnProperty.call(normalized, name)
					? normalized[name]
					: null;
			},
		},
	};
}

test('Cloudflare pickClientIp prefers cf-connecting-ip, then first forwarded hop, then x-real-ip', () => {
	const pickClientIp = loadPickClientIp(cloudflareSource);

	assert.equal(pickClientIp(cloudflareRequest({})), 'unknown');
	assert.equal(
		pickClientIp(
			cloudflareRequest({
				'cf-connecting-ip': '203.0.113.10',
				'x-forwarded-for': '198.51.100.1, 203.0.113.10',
				'x-real-ip': '192.0.2.9',
			})
		),
		'203.0.113.10'
	);
	assert.equal(
		pickClientIp(
			cloudflareRequest({
				'x-forwarded-for': ' 198.51.100.2 , 203.0.113.10',
				'x-real-ip': '192.0.2.9',
			})
		),
		'198.51.100.2'
	);
	assert.equal(
		pickClientIp(
			cloudflareRequest({
				'x-forwarded-for': '   ',
				'x-real-ip': '192.0.2.9',
			})
		),
		'192.0.2.9'
	);
	assert.equal(pickClientIp(cloudflareRequest({ 'x-real-ip': '192.0.2.8' })), '192.0.2.8');
});

test('Netlify pickClientIp prefers the Netlify client header and does not read x-real-ip', () => {
	const pickClientIp = loadPickClientIp(netlifySource);

	assert.equal(pickClientIp(), 'unknown');
	assert.equal(pickClientIp({}), 'unknown');
	assert.equal(
		pickClientIp({
			'x-nf-client-connection-ip': '203.0.113.20',
			'x-forwarded-for': '198.51.100.3',
			'x-real-ip': '192.0.2.4',
		}),
		'203.0.113.20'
	);
	assert.equal(
		pickClientIp({
			'X-Nf-Client-Connection-Ip': '203.0.113.21',
			'X-Forwarded-For': '198.51.100.4',
		}),
		'203.0.113.21'
	);
	assert.equal(
		pickClientIp({
			'x-forwarded-for': ' 198.51.100.5 , 203.0.113.20',
			'x-real-ip': '192.0.2.4',
		}),
		'198.51.100.5'
	);
	assert.equal(
		pickClientIp({
			'X-Forwarded-For': '198.51.100.6',
		}),
		'198.51.100.6'
	);
	assert.equal(
		pickClientIp({
			'x-forwarded-for': '  , 198.51.100.7',
			'x-real-ip': '192.0.2.4',
		}),
		'unknown'
	);
	assert.equal(pickClientIp({ 'x-real-ip': '192.0.2.4' }), 'unknown');
});
