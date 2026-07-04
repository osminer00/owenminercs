import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const searchHtml = readFileSync(new URL('../search.html', import.meta.url), 'utf8');
const syncScriptPath = fileURLToPath(new URL('../scripts/sync-x-top-posts.py', import.meta.url));

function runPythonWithSyncModule(code, extraEnv = {}) {
	return execFileSync('python3', ['-c', code], {
		encoding: 'utf8',
		env: {
			...process.env,
			SYNC_X_TOP_POSTS_PATH: syncScriptPath,
			...extraEnv,
		},
	});
}

test('search page loads assets from the site root for /search/ rewrites', () => {
	assert.match(searchHtml, /href="\/css\/owenminercs\.css"/);
	assert.match(searchHtml, /src="\/scripts\/components\.js"/);
	assert.match(searchHtml, /src="\/scripts\/search-page\.js"/);
	assert.match(searchHtml, /src="\/scripts\/support-links\.js"/);

	assert.doesNotMatch(searchHtml, /href="css\//);
	assert.doesNotMatch(searchHtml, /src="\.\/scripts\//);
	assert.doesNotMatch(searchHtml, /src="scripts\//);
});

test('X top-post sync refuses to overwrite existing data with an empty result set', () => {
	const tempDir = mkdtempSync(join(tmpdir(), 'x-sync-'));
	const targetPath = join(tempDir, 'x-top-posts.json');
	const existingPosts = [{ platform: 'x', title: 'Keep this post' }];
	writeFileSync(targetPath, `${JSON.stringify(existingPosts, null, 2)}\n`, 'utf8');

	const output = runPythonWithSyncModule(
		`
import importlib.util
import os
from pathlib import Path

spec = importlib.util.spec_from_file_location("sync_x_top_posts", os.environ["SYNC_X_TOP_POSTS_PATH"])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

try:
    module.write_posts(Path(os.environ["TARGET_PATH"]), [], "OwenMiner")
except RuntimeError as error:
    print(str(error))
else:
    raise SystemExit("expected RuntimeError")
`,
		{ TARGET_PATH: targetPath }
	);

	assert.match(
		output,
		/Refusing to overwrite existing X top-post data with 0 posts for @OwenMiner\./
	);
	assert.deepEqual(JSON.parse(readFileSync(targetPath, 'utf8')), existingPosts);
});

test('X top-post sync can write an empty initial result when no data exists yet', () => {
	const tempDir = mkdtempSync(join(tmpdir(), 'x-sync-'));
	const targetPath = join(tempDir, 'x-top-posts.json');

	runPythonWithSyncModule(
		`
import importlib.util
import os
from pathlib import Path

spec = importlib.util.spec_from_file_location("sync_x_top_posts", os.environ["SYNC_X_TOP_POSTS_PATH"])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

module.write_posts(Path(os.environ["TARGET_PATH"]), [], "OwenMiner")
`,
		{ TARGET_PATH: targetPath }
	);

	assert.deepEqual(JSON.parse(readFileSync(targetPath, 'utf8')), []);
});
