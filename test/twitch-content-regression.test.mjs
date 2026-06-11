import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const twitchRegisterSource = readFileSync(
	new URL('../functions/api/twitch-register-eventsub.js', import.meta.url),
	'utf8'
);
const contentCheckerPath = new URL(
	'../dev/public-content-regression-check.mjs',
	import.meta.url
).pathname;

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

function loadTwitchRegisterAuth() {
	const factory = new Function(`
		const REGISTER_SECRET_HEADER = 'x-twitch-register-secret';
		${extractFunction(twitchRegisterSource, 'timingSafeEqual')}
		${extractFunction(twitchRegisterSource, 'isAuthorizedRequest')}
		return { isAuthorizedRequest, timingSafeEqual };
	`);
	return factory();
}

async function createTempSite(files) {
	const siteDir = await mkdtemp(join(tmpdir(), 'owenminercs-content-check-'));
	for (const [name, content] of Object.entries(files)) {
		await writeFile(join(siteDir, name), content);
	}
	return siteDir;
}

test('Twitch registration auth compares non-string env secrets by value', () => {
	const { isAuthorizedRequest, timingSafeEqual } = loadTwitchRegisterAuth();

	assert.equal(timingSafeEqual(12345, '12345'), true);
	assert.equal(timingSafeEqual(12345, '54321'), false);

	assert.equal(
		isAuthorizedRequest(
			{ headers: new Headers({ authorization: 'Bearer 12345' }) },
			12345
		),
		true
	);
	assert.equal(
		isAuthorizedRequest(
			{ headers: new Headers({ 'x-twitch-register-secret': '54321' }) },
			12345
		),
		false
	);
});

test('public content checker ignores generated search JSON artifacts', async () => {
	const siteDir = await createTempSite({
		'safe.html': '<!doctype html><title>Safe page</title>',
		'site-search-index.json': '{"text":"DMACC stale generated snippet"}',
		'search-manual-keywords.json':
			'{"text":"While at DMACC I learned how to write software"}',
	});

	const { stdout } = await execFileAsync(process.execPath, [contentCheckerPath], {
		cwd: siteDir,
	});

	assert.match(stdout, /Public content regression check passed\./);
});

test('public content checker still scans ordinary public JSON files', async () => {
	const siteDir = await createTempSite({
		'profile.json': '{"bio":"DMACC public mention"}',
	});

	await assert.rejects(
		execFileAsync(process.execPath, [contentCheckerPath], { cwd: siteDir }),
		(error) => {
			assert.match(error.stderr, /profile\.json:1 contains DMACC public mention/);
			return true;
		}
	);
});
