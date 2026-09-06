import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const cloudflareSource = readFileSync(
	new URL('../functions/api/live-status.js', import.meta.url),
	'utf8'
);
const netlifySource = readFileSync(
	new URL('../netlify/functions/live-status.js', import.meta.url),
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

function extractConst(source, name) {
	const match = source.match(new RegExp(`const ${name} = ([^;]+);`));
	assert.ok(match, `${name} should exist`);
	return match[0];
}

function loadOverride(source, envVars = {}) {
	const sandbox = {
		Boolean,
		String,
		process: { env: { ...envVars } },
	};
	vm.createContext(sandbox);
	vm.runInContext(
		`
		this.__override = (function () {
			${extractConst(source, 'FOLLOW_UPDATES_URL')}
			${extractFunction(source, 'manualOverrideStatus')}
			return manualOverrideStatus;
		})();
		`,
		sandbox
	);
	return sandbox.__override;
}

function overrideFields(result) {
	if (result == null) return null;
	return {
		live: Boolean(result.live),
		platform: String(result.platform),
		url: String(result.url),
	};
}

function overrideOnHost(host, envVars) {
	if (host === 'cloudflare') {
		return overrideFields(loadOverride(cloudflareSource)(envVars));
	}
	return overrideFields(loadOverride(netlifySource, envVars)());
}

function assertHostParity(envVars, expected) {
	assert.deepEqual(overrideOnHost('cloudflare', envVars), expected);
	assert.deepEqual(overrideOnHost('netlify', envVars), expected);
}

test('Cloudflare and Netlify live-status fallbacks stay on the same X profile URL', () => {
	assert.match(extractConst(cloudflareSource, 'FOLLOW_UPDATES_URL'), /https:\/\/x\.com\/OwenMiner/);
	assert.equal(
		extractConst(cloudflareSource, 'FOLLOW_UPDATES_URL'),
		extractConst(netlifySource, 'FOLLOW_UPDATES_URL')
	);
});

test('manualOverrideStatus accepts only 1/true/yes and ignores padded or unknown flags', () => {
	assertHostParity({}, null);
	assertHostParity({ LIVE_OVERRIDE_IS_LIVE: '' }, null);
	assertHostParity({ LIVE_OVERRIDE_IS_LIVE: '0' }, null);
	assertHostParity({ LIVE_OVERRIDE_IS_LIVE: 'false' }, null);
	assertHostParity({ LIVE_OVERRIDE_IS_LIVE: 'no' }, null);
	assertHostParity({ LIVE_OVERRIDE_IS_LIVE: 'on' }, null);
	assertHostParity({ LIVE_OVERRIDE_IS_LIVE: '1 ' }, null);
	assertHostParity({ LIVE_OVERRIDE_IS_LIVE: ' yes' }, null);

	const expectedLive = {
		live: true,
		platform: 'Live',
		url: 'https://x.com/OwenMiner',
	};
	assertHostParity({ LIVE_OVERRIDE_IS_LIVE: '1' }, expectedLive);
	assertHostParity({ LIVE_OVERRIDE_IS_LIVE: 'true' }, expectedLive);
	assertHostParity({ LIVE_OVERRIDE_IS_LIVE: 'YES' }, expectedLive);
	assertHostParity({ LIVE_OVERRIDE_IS_LIVE: 'True' }, expectedLive);
});

test('manualOverrideStatus uses override platform/url when live, else the shared fallback URL', () => {
	assertHostParity(
		{
			LIVE_OVERRIDE_IS_LIVE: 'yes',
			LIVE_OVERRIDE_PLATFORM: 'Twitch',
			LIVE_OVERRIDE_URL: 'https://www.twitch.tv/owenminercs',
		},
		{
			live: true,
			platform: 'Twitch',
			url: 'https://www.twitch.tv/owenminercs',
		}
	);

	assertHostParity(
		{
			LIVE_OVERRIDE_IS_LIVE: '1',
			LIVE_OVERRIDE_PLATFORM: '',
			LIVE_OVERRIDE_URL: '',
		},
		{
			live: true,
			platform: 'Live',
			url: 'https://x.com/OwenMiner',
		}
	);
});
