import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const checkerPath = new URL('../dev/public-content-regression-check.mjs', import.meta.url);

function runContentCheck(cwd) {
	return new Promise((resolve) => {
		const child = spawn(process.execPath, [checkerPath.pathname], {
			cwd,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		let stdout = '';
		let stderr = '';
		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');
		child.stdout.on('data', (chunk) => {
			stdout += chunk;
		});
		child.stderr.on('data', (chunk) => {
			stderr += chunk;
		});
		child.on('close', (code) => {
			resolve({ code, stdout, stderr });
		});
	});
}

async function withTempSite(callback) {
	const root = await mkdtemp(path.join(tmpdir(), 'public-content-regression-'));
	try {
		await callback(root);
	} finally {
		await rm(root, { force: true, recursive: true });
	}
}

test('public content checker ignores generated search JSON by basename', async () => {
	await withTempSite(async (root) => {
		await mkdir(path.join(root, 'data'));
		await writeFile(
			path.join(root, 'site-search-index.json'),
			JSON.stringify({
				entries: [{ snippet: 'Old DMACC snippet from a generated artifact' }],
			})
		);
		await writeFile(
			path.join(root, 'data', 'search-manual-keywords.json'),
			JSON.stringify({ keywords: ['DMACC generated manual search keyword'] })
		);
		await writeFile(
			path.join(root, 'index.html'),
			'<h1>Public page without stale bio copy</h1>'
		);

		const result = await runContentCheck(root);

		assert.equal(result.code, 0, result.stderr);
		assert.match(result.stdout, /Public content regression check passed\./);
	});
});

test('public content checker still fails real public html violations', async () => {
	await withTempSite(async (root) => {
		await writeFile(
			path.join(root, 'site-search-index.json'),
			JSON.stringify({
				entries: [{ snippet: 'Generated DMACC snippet should stay ignored' }],
			})
		);
		await writeFile(
			path.join(root, 'index.html'),
			'<p>DMACC should not be on public pages.</p>'
		);

		const result = await runContentCheck(root);

		assert.notEqual(result.code, 0);
		assert.match(result.stderr, /index\.html:1 contains DMACC public mention/);
		assert.doesNotMatch(result.stderr, /site-search-index\.json/);
	});
});
