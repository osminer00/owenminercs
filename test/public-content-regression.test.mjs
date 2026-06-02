import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const scriptPath = new URL('../dev/public-content-regression-check.mjs', import.meta.url);

function runContentCheck(cwd) {
	return spawnSync(process.execPath, [scriptPath], {
		cwd,
		encoding: 'utf8',
	});
}

test('public content check ignores generated search indexes without hiding real page violations', async () => {
	const tempRoot = await mkdtemp(path.join(tmpdir(), 'owenminercs-content-check-'));

	try {
		await writeFile(
			path.join(tempRoot, 'site-search-index.json'),
			JSON.stringify({ staleSnippet: 'DMACC should be ignored in generated search data' })
		);
		await writeFile(
			path.join(tempRoot, 'index.html'),
			'<main>Public page copy is safe.</main>'
		);

		const generatedOnly = runContentCheck(tempRoot);

		assert.equal(generatedOnly.status, 0, generatedOnly.stderr || generatedOnly.stdout);
		assert.match(generatedOnly.stdout, /Public content regression check passed\./);

		await writeFile(
			path.join(tempRoot, 'about.html'),
			'<main>DMACC should fail in public HTML.</main>'
		);

		const publicViolation = runContentCheck(tempRoot);

		assert.notEqual(publicViolation.status, 0);
		assert.match(publicViolation.stderr, /about\.html:1 contains DMACC public mention/);
		assert.doesNotMatch(publicViolation.stderr, /site-search-index\.json/);
	} finally {
		await rm(tempRoot, { recursive: true, force: true });
	}
});
