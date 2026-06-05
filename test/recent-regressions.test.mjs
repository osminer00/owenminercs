import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import vm from 'node:vm';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const repoRoot = path.resolve(new URL('..', import.meta.url).pathname);
const contentCheckScript = path.join(repoRoot, 'dev/public-content-regression-check.mjs');

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

async function withTempSite(callback) {
	const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'owenminercs-content-check-'));
	try {
		return await callback(tmpDir);
	} finally {
		await rm(tmpDir, { recursive: true, force: true });
	}
}

async function runContentCheck(cwd) {
	return execFileAsync(process.execPath, [contentCheckScript], { cwd });
}

function steamInventoryPayload(count) {
	return {
		success: 1,
		more: false,
		assets: Array.from({ length: count }, (_, index) => ({
			assetid: String(1000 + index),
			classid: `class-${index}`,
			instanceid: '1',
			amount: '1',
			appid: 730,
			contextid: 2,
		})),
		descriptions: Array.from({ length: count }, (_, index) => ({
			classid: `class-${index}`,
			instanceid: '1',
			name: `AK-47 | Regression ${index}`,
			market_name: `AK-47 | Regression ${index}`,
			market_hash_name: `AK-47 | Regression ${index}`,
			type: 'Rifle',
			tradable: 1,
			marketable: 1,
			tags: [{ category: 'Rarity', localized_tag_name: 'Covert' }],
		})),
	};
}

function jsonResponse(payload) {
	return {
		ok: true,
		status: 200,
		async json() {
			return payload;
		},
		async text() {
			return JSON.stringify(payload);
		},
	};
}

test('public content checker ignores generated search indexes but still scans public files', async () => {
	await withTempSite(async (siteDir) => {
		await writeFile(
			path.join(siteDir, 'site-search-index.json'),
			JSON.stringify({ staleSnippet: 'DMACC should be ignored in generated search output' })
		);
		await writeFile(
			path.join(siteDir, 'search-manual-keywords.json'),
			JSON.stringify({ staleSnippet: '"alumniOf": "ignored generated search metadata"' })
		);
		await writeFile(path.join(siteDir, 'index.html'), '<main>Current public copy</main>');

		const { stdout } = await runContentCheck(siteDir);

		assert.match(stdout, /Public content regression check passed\./);
	});
});

test('public content checker reports forbidden copy in public HTML', async () => {
	await withTempSite(async (siteDir) => {
		await writeFile(
			path.join(siteDir, 'index.html'),
			'<main>DMACC should be flagged here</main>'
		);

		await assert.rejects(runContentCheck(siteDir), (error) => {
			const output = `${error.stdout || ''}\n${error.stderr || ''}`;
			assert.match(output, /Forbidden public content found:/);
			assert.match(output, /index\.html:1 contains DMACC public mention/);
			return true;
		});
	});
});

test('Twitch registration timing-safe comparison accepts non-string values without throwing', async () => {
	const source = await readFile(
		path.join(repoRoot, 'functions/api/twitch-register-eventsub.js'),
		'utf8'
	);
	const functionSource = extractFunction(source, 'timingSafeEqual');
	const timingSafeEqual = vm.runInNewContext(`${functionSource}\ntimingSafeEqual;`);

	assert.equal(timingSafeEqual(12345, '12345'), true);
	assert.equal(timingSafeEqual(12345, '12346'), false);
	assert.equal(timingSafeEqual(12345, '123456'), false);
});

test('Steam CS2 inventory pricing caps unique market lookups', async () => {
	const { handler } = require('../netlify/functions/steam-cs2-inventory.js');
	const originalFetch = global.fetch;
	const payload = steamInventoryPayload(85);
	const pricedNames = [];

	global.fetch = async (url) => {
		const requestUrl = String(url);
		if (requestUrl.includes('/inventory/')) {
			return jsonResponse(payload);
		}
		if (requestUrl.includes('/market/priceoverview/')) {
			pricedNames.push(new URL(requestUrl).searchParams.get('market_hash_name'));
			return jsonResponse({
				success: true,
				lowest_price: '$125.00',
				median_price: '$130.00',
			});
		}
		assert.fail(`Unexpected Steam test fetch: ${requestUrl}`);
	};

	try {
		const response = await handler({
			httpMethod: 'GET',
			queryStringParameters: {
				profile: '76561198000000000',
				featured: '0',
				limit: '300',
			},
		});
		const body = JSON.parse(response.body);

		assert.equal(response.statusCode, 200);
		assert.equal(body.totalItems, 85);
		assert.equal(pricedNames.length, 80);
		assert.equal(new Set(pricedNames).size, 80);
		assert.equal(body.items[0].pricing.lowestPriceUsd, 125);
		assert.equal(body.items[79].pricing.lowestPriceUsd, 125);
		assert.equal(body.items[80].pricing, null);
	} finally {
		global.fetch = originalFetch;
	}
});
