import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const searchSource = readFileSync(new URL('../search.html', import.meta.url), 'utf8');

test('search page loads same-origin assets from root for /search/ rewrites', () => {
	assert.match(searchSource, /href="\/css\/owenminercs\.css"/);
	assert.match(searchSource, /src="\/scripts\/components\.js"/);
	assert.match(searchSource, /src="\/scripts\/search-page\.js"/);
	assert.match(searchSource, /src="\/scripts\/support-links\.js"/);
});

test('X sync preserves existing data when upstream sources return no posts', () => {
	const tempRoot = mkdtempSync(join(tmpdir(), 'x-sync-empty-'));
	try {
		const scriptsDir = join(tempRoot, 'scripts');
		const dataDir = join(tempRoot, 'Socials', 'data');
		mkdirSync(scriptsDir, { recursive: true });
		mkdirSync(dataDir, { recursive: true });

		const scriptPath = join(scriptsDir, 'sync-x-top-posts.py');
		const dataPath = join(dataDir, 'x-top-posts.json');
		const existingPosts = [
			{
				platform: 'x',
				url: 'https://x.com/OwenMiner/status/1',
				likeCount: 10,
			},
		];

		copyFileSync(new URL('../scripts/sync-x-top-posts.py', import.meta.url), scriptPath);
		writeFileSync(dataPath, `${JSON.stringify(existingPosts, null, 2)}\n`);

		const result = spawnSync(
			'python3',
			[
				'-',
				scriptPath,
			],
			{
				encoding: 'utf8',
				input: `
import importlib.util
import sys
from pathlib import Path

module_path = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location("sync_x_top_posts", module_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

module.resolve_username_from_nav = lambda repo_root: "OwenMiner"
module.build_top_posts = lambda username: []

try:
    module.main()
except RuntimeError as exc:
    if "Refusing to overwrite existing X post data" not in str(exc):
        raise
else:
    raise AssertionError("Expected sync to refuse an empty overwrite")
`,
			}
		);

		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.deepEqual(JSON.parse(readFileSync(dataPath, 'utf8')), existingPosts);
	} finally {
		rmSync(tempRoot, { recursive: true, force: true });
	}
});
