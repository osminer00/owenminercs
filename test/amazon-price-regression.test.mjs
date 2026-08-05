import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../functions/amazon-price.js', import.meta.url), 'utf8');

function extractFunction(src, functionName) {
	const pattern = new RegExp(`(?:async\\s+)?function\\s+${functionName}\\s*\\(`);
	const match = pattern.exec(src);
	assert.ok(match, `${functionName} should exist`);

	let parenDepth = 0;
	let paramsEnd = -1;
	for (let i = src.indexOf('(', match.index); i < src.length; i += 1) {
		const char = src[i];
		if (char === '(') parenDepth += 1;
		if (char === ')') {
			parenDepth -= 1;
			if (parenDepth === 0) {
				paramsEnd = i;
				break;
			}
		}
	}
	assert.notEqual(paramsEnd, -1, `${functionName} parameters should close`);

	const braceStart = src.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${functionName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < src.length; i += 1) {
		const char = src[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) return src.slice(match.index, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function loadSigningHelpers() {
	const context = {
		console,
		crypto,
		REGION: 'us-east-1',
		SERVICE: 'ProductAdvertisingAPI',
	};
	vm.createContext(context);
	vm.runInContext(
		`
		${extractFunction(source, 'hmac')}
		${extractFunction(source, 'sha256hex')}
		${extractFunction(source, 'getSigningKey')}
		this.hmac = hmac;
		this.sha256hex = sha256hex;
		this.getSigningKey = getSigningKey;
		`,
		context
	);
	return {
		hmac: context.hmac,
		sha256hex: context.sha256hex,
		getSigningKey: context.getSigningKey,
	};
}

function parseAsins(raw) {
	return String(raw || '')
		.split(',')
		.map((s) => s.trim().toUpperCase())
		.filter((s) => /^[A-Z0-9]{10}$/.test(s))
		.slice(0, 10);
}

test('Amazon ASIN parsing rejects junk and caps at 10 unique-format IDs', () => {
	assert.deepEqual(parseAsins(''), []);
	assert.deepEqual(parseAsins('bad,also-bad,123'), []);
	assert.deepEqual(parseAsins('b07xyz1234'), ['B07XYZ1234']);
	assert.deepEqual(parseAsins(' B07XYZ1234 , invalid , A1B2C3D4E5 '), [
		'B07XYZ1234',
		'A1B2C3D4E5',
	]);

	const eleven = Array.from({ length: 11 }, (_, i) => `A${String(i).padStart(9, '0')}`).join(',');
	assert.equal(parseAsins(eleven).length, 10);
	assert.match(source, /\.slice\(0,\s*10\)/);
	assert.match(source, /\/\^\[A-Z0-9\]\{10\}\$\//);
});

test('PA-API signing helpers produce stable AWS4 key material', () => {
	const { hmac, sha256hex, getSigningKey } = loadSigningHelpers();

	assert.equal(
		sha256hex(''),
		'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
	);
	assert.equal(
		hmac('key', 'message').toString('hex'),
		crypto.createHmac('sha256', 'key').update('message').digest('hex')
	);

	const keyA = getSigningKey('wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', '20150830');
	const keyB = getSigningKey('wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', '20150830');
	const keyC = getSigningKey('wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', '20150831');

	assert.ok(Buffer.isBuffer(keyA));
	assert.equal(keyA.length, 32);
	assert.equal(keyA.toString('hex'), keyB.toString('hex'));
	assert.notEqual(keyA.toString('hex'), keyC.toString('hex'));
});

test('amazon-price handler validates method, config, and ASIN input without network', async () => {
	const { handler } = require('../functions/amazon-price.js');
	const previousAccess = process.env.AMAZON_PA_ACCESS_KEY;
	const previousSecret = process.env.AMAZON_PA_SECRET_KEY;

	try {
		delete process.env.AMAZON_PA_ACCESS_KEY;
		delete process.env.AMAZON_PA_SECRET_KEY;

		const options = await handler({ httpMethod: 'OPTIONS' });
		assert.equal(options.statusCode, 204);

		const unconfigured = await handler({
			httpMethod: 'GET',
			queryStringParameters: { asins: 'B07XYZ1234' },
		});
		assert.equal(unconfigured.statusCode, 200);
		assert.deepEqual(JSON.parse(unconfigured.body), { prices: {}, configured: false });

		process.env.AMAZON_PA_ACCESS_KEY = 'AKIAEXAMPLE';
		process.env.AMAZON_PA_SECRET_KEY = 'secret-example';

		const invalid = await handler({
			httpMethod: 'GET',
			queryStringParameters: { asins: 'nope,also-nope' },
		});
		assert.equal(invalid.statusCode, 400);
		assert.equal(JSON.parse(invalid.body).error, 'No valid ASINs provided');
	} finally {
		if (previousAccess === undefined) delete process.env.AMAZON_PA_ACCESS_KEY;
		else process.env.AMAZON_PA_ACCESS_KEY = previousAccess;
		if (previousSecret === undefined) delete process.env.AMAZON_PA_SECRET_KEY;
		else process.env.AMAZON_PA_SECRET_KEY = previousSecret;
	}
});
