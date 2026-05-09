import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const contentCheckScript = new URL('../dev/public-content-regression-check.mjs', import.meta.url);
const pagesTwitchSource = readFileSync(
	new URL('../functions/api/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);
const netlifyTwitchSource = readFileSync(
	new URL('../netlify/functions/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);

function withTempSite(callback) {
	const dir = mkdtempSync(join(tmpdir(), 'owenminercs-content-check-'));
	try {
		return callback(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function runContentCheck(cwd) {
	return spawnSync(process.execPath, [contentCheckScript.pathname], {
		cwd,
		encoding: 'utf8',
	});
}

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const braceStart = source.indexOf('{', start);
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

function loadAuthorizationHelpers(source, helperNames) {
	const helperSource = helperNames.map((name) => extractFunction(source, name)).join('\n\n');
	return Function(`
		const REGISTER_SECRET_HEADER = 'x-twitch-register-secret';
		${helperSource}
		return { isAuthorizedRequest, timingSafeEqual };
	`)();
}

test('public content check ignores generated search JSON while scanning real public files', () => {
	withTempSite((siteDir) => {
		writeFileSync(join(siteDir, 'index.html'), '<!doctype html><title>Clean page</title>\n');
		writeFileSync(
			join(siteDir, 'site-search-index.json'),
			JSON.stringify([
				{ title: 'generated local snippet', text: 'DMACC should be ignored here' },
			])
		);
		writeFileSync(
			join(siteDir, 'search-manual-keywords.json'),
			JSON.stringify({ keywords: ['While at DMACC I learned how to write software'] })
		);

		const result = runContentCheck(siteDir);

		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /Public content regression check passed\./);
	});
});

test('public content check still fails forbidden content in non-generated JSON', () => {
	withTempSite((siteDir) => {
		writeFileSync(join(siteDir, 'index.html'), '<!doctype html><title>Clean page</title>\n');
		writeFileSync(
			join(siteDir, 'profile.json'),
			'{\n  "alumniOf": "Legacy school field must stay private"\n}\n'
		);

		const result = runContentCheck(siteDir);

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /profile\.json:2 contains schema\.org alumniOf field/);
	});
});

test('Twitch register auth compares non-string secrets for both deployment targets', () => {
	const pages = loadAuthorizationHelpers(pagesTwitchSource, [
		'timingSafeEqual',
		'isAuthorizedRequest',
	]);
	const netlify = loadAuthorizationHelpers(netlifyTwitchSource, [
		'timingSafeEqual',
		'getHeader',
		'isAuthorizedRequest',
	]);

	assert.equal(
		pages.isAuthorizedRequest(
			{ headers: new Headers({ 'x-twitch-register-secret': '12345' }) },
			12345
		),
		true,
		'Pages auth should accept a matching numeric secret binding'
	);
	assert.equal(
		netlify.isAuthorizedRequest({ 'x-twitch-register-secret': 12345 }, 12345),
		true,
		'Netlify auth should accept matching non-string header/env values'
	);
	assert.equal(
		netlify.isAuthorizedRequest({ 'x-twitch-register-secret': 12345 }, 67890),
		false,
		'Netlify auth must not treat different non-string values as equal'
	);
});

test('Twitch register auth source stays synchronized between deployment targets', () => {
	const pagesTimingSafeEqual = extractFunction(pagesTwitchSource, 'timingSafeEqual');
	const netlifyTimingSafeEqual = extractFunction(netlifyTwitchSource, 'timingSafeEqual');

	assert.match(pagesTimingSafeEqual, /a = String\(a\);/);
	assert.match(pagesTimingSafeEqual, /b = String\(b\);/);
	assert.match(netlifyTimingSafeEqual, /a = String\(a\);/);
	assert.match(netlifyTimingSafeEqual, /b = String\(b\);/);
});
