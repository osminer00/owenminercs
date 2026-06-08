import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const checkerPath = fileURLToPath(new URL('../dev/public-content-regression-check.mjs', import.meta.url));

async function withFixture(callback) {
	const root = await mkdtemp(path.join(tmpdir(), 'public-content-check-'));
	try {
		await callback(root);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

function runChecker(cwd) {
	return execFileAsync(process.execPath, [checkerPath], { cwd });
}

test('public content check ignores generated search JSON by basename', async () => {
	await withFixture(async (root) => {
		const dataDir = path.join(root, 'data');
		await mkdir(dataDir);
		await writeFile(path.join(root, 'index.html'), '<h1>Clean public page</h1>\n');
		await writeFile(
			path.join(dataDir, 'site-search-index.json'),
			JSON.stringify([{ snippet: 'Stale generated DMACC snippet' }])
		);
		await writeFile(
			path.join(dataDir, 'search-manual-keywords.json'),
			JSON.stringify({ terms: ['DMACC'] })
		);

		const { stdout } = await runChecker(root);

		assert.match(stdout, /Public content regression check passed\./);
	});
});

test('public content check still fails for non-generated public files', async () => {
	await withFixture(async (root) => {
		const dataDir = path.join(root, 'data');
		await mkdir(dataDir);
		await writeFile(path.join(root, 'index.html'), '<h1>Clean public page</h1>\n');
		await writeFile(path.join(dataDir, 'profile.json'), '{"bio":"DMACC should fail here"}\n');

		await assert.rejects(
			() => runChecker(root),
			(error) => {
				assert.match(
					`${error.stdout}\n${error.stderr}`,
					/data\/profile\.json:1 contains DMACC public mention/
				);
				return true;
			}
		);
	});
});
