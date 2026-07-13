import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const syncScriptPath = new URL('../scripts/sync-x-top-posts.py', import.meta.url).pathname;

test('X top-post sync refuses to overwrite non-empty data with zero posts', () => {
	const tempDir = mkdtempSync(join(tmpdir(), 'owen-x-sync-'));
	try {
		const targetPath = join(tempDir, 'x-top-posts.json');
		const existing = [
			{
				platform: 'x',
				title: 'Existing post',
				url: 'https://x.com/OwenMiner/status/1',
			},
		];
		writeFileSync(targetPath, `${JSON.stringify(existing, null, 2)}\n`, 'utf8');

		const result = spawnSync(
			'python3',
			[
				'-c',
				`
import importlib.util
from pathlib import Path
import sys

spec = importlib.util.spec_from_file_location("sync_x_top_posts", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.write_posts(Path(sys.argv[2]), [])
`,
				syncScriptPath,
				targetPath,
			],
			{ encoding: 'utf8' }
		);

		assert.notEqual(result.status, 0, 'empty sync should fail closed');
		assert.match(result.stderr, /Refusing to overwrite/);
		assert.deepEqual(JSON.parse(readFileSync(targetPath, 'utf8')), existing);
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
});
