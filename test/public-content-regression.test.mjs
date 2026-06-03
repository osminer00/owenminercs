import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const checkerPath = fileURLToPath(
	new URL('../dev/public-content-regression-check.mjs', import.meta.url)
);

function withTempSite(callback) {
	const dir = mkdtempSync(path.join(tmpdir(), 'public-content-regression-'));
	try {
		callback(dir);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function runChecker(cwd) {
	return spawnSync(process.execPath, [checkerPath], {
		cwd,
		encoding: 'utf8',
	});
}

test('public content regression check ignores generated search artifacts by basename', () => {
	withTempSite((siteRoot) => {
		mkdirSync(path.join(siteRoot, 'data'));
		writeFileSync(path.join(siteRoot, 'index.html'), '<main>Current public site copy.</main>\n');
		writeFileSync(
			path.join(siteRoot, 'data', 'site-search-index.json'),
			JSON.stringify([{ text: 'Generated stale DMACC snippet' }])
		);
		writeFileSync(
			path.join(siteRoot, 'search-manual-keywords.json'),
			JSON.stringify({ '/': ['DMACC generated keyword'] })
		);

		const result = runChecker(siteRoot);

		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.match(result.stdout, /Public content regression check passed\./);
	});
});

test('public content regression check still reports forbidden ordinary public files', () => {
	withTempSite((siteRoot) => {
		writeFileSync(path.join(siteRoot, 'page.html'), '<main>DMACC should not be public here.</main>\n');

		const result = runChecker(siteRoot);
		const output = `${result.stdout}\n${result.stderr}`;

		assert.notEqual(result.status, 0, output);
		assert.match(output, /page\.html:1 contains DMACC public mention/);
	});
});
