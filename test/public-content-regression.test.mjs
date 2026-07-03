import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const checkerPath = new URL('../dev/public-content-regression-check.mjs', import.meta.url);

async function writeFixture(root, relativePath, content) {
	const absolutePath = path.join(root, relativePath);
	await mkdir(path.dirname(absolutePath), { recursive: true });
	await writeFile(absolutePath, content, 'utf8');
}

async function withFixture(files, callback) {
	const root = await mkdtemp(path.join(tmpdir(), 'owenminercs-content-check-'));
	try {
		await Promise.all(
			Object.entries(files).map(([relativePath, content]) =>
				writeFixture(root, relativePath, content)
			)
		);
		return callback(root);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

function runChecker(cwd) {
	return spawnSync(process.execPath, [checkerPath], {
		cwd,
		encoding: 'utf8',
	});
}

test('public content checker ignores generated search index artifacts by basename', async () => {
	await withFixture(
		{
			'index.html': '<!doctype html><title>Public page</title><p>Safe content.</p>',
			'data/site-search-index.json': '{"entries":[{"text":"DMACC appears in generated local snippets"}]}',
			'nested/search-manual-keywords.json': '{"legacy":["DMACC"]}',
		},
		(root) => {
			const result = runChecker(root);

			assert.equal(result.status, 0, result.stderr || result.stdout);
			assert.match(result.stdout, /Public content regression check passed\./);
		}
	);
});

test('public content checker still fails forbidden text in public html', async () => {
	await withFixture(
		{
			'index.html': '<!doctype html><title>Public page</title><p>DMACC should not publish.</p>',
			'data/site-search-index.json': '{"entries":[{"text":"generated snippets are ignored"}]}',
		},
		(root) => {
			const result = runChecker(root);

			assert.notEqual(result.status, 0);
			assert.match(result.stderr, /Forbidden public content found:/);
			assert.match(result.stderr, /index\.html:1 contains DMACC public mention/);
		}
	);
});
