import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const syncScriptPath = new URL('../scripts/sync-x-top-posts.py', import.meta.url).pathname;
const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');

function runPython(snippet, extraArgs = []) {
	const result = spawnSync('python3', ['-c', snippet, syncScriptPath, ...extraArgs], {
		encoding: 'utf8',
	});
	assert.equal(
		result.status,
		0,
		`python helper failed:\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
	);
	return result.stdout.trim();
}

function loadHelper(expression) {
	return runPython(
		`
import importlib.util
import json
import sys

spec = importlib.util.spec_from_file_location("sync_x_top_posts", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
print(json.dumps(${expression}))
`
	);
}

test('X sync resolves the live nav username and keeps DEFAULT_USERNAME aligned', () => {
	assert.match(componentsSource, /https:\/\/x\.com\/OwenMiner\b/);
	assert.doesNotMatch(componentsSource, /https:\/\/x\.com\/OwenMinerCS\b/i);

	const resolved = JSON.parse(
		loadHelper(
			'module.resolve_username_from_nav(module.Path(sys.argv[1]).resolve().parents[1])'
		)
	);
	assert.equal(resolved, 'OwenMiner');

	const defaultUsername = JSON.parse(loadHelper('module.DEFAULT_USERNAME'));
	assert.equal(defaultUsername, 'OwenMiner');
});

test('X sync RSS parsing skips retweets/replies and dedupes status IDs', () => {
	const rss = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>RT by @Someone: ignore me</title>
    <guid>111</guid>
    <link>https://nitter.net/OwenMiner/status/111</link>
  </item>
  <item>
    <title>R to @Someone: reply</title>
    <guid>222</guid>
    <link>https://nitter.net/OwenMiner/status/222</link>
  </item>
  <item>
    <title>Original post</title>
    <guid>not-a-number</guid>
    <link>https://nitter.net/OwenMiner/status/333</link>
  </item>
  <item>
    <title>Duplicate status</title>
    <guid>333</guid>
    <link>https://nitter.net/OwenMiner/status/333</link>
  </item>
  <item>
    <title>Another original</title>
    <guid>444</guid>
    <link>https://nitter.net/OwenMiner/status/444</link>
  </item>
</channel></rss>`;

	const ids = JSON.parse(
		runPython(
			`
import importlib.util
import json
import sys

spec = importlib.util.spec_from_file_location("sync_x_top_posts", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
print(json.dumps(module.parse_rss_status_ids(sys.argv[2])))
`,
			[rss]
		)
	);

	assert.deepEqual(ids, ['333', '444']);
});

test('X sync build_content_item filters author mismatches, missing media, and low likes', () => {
	const cases = JSON.parse(
		runPython(
			`
import importlib.util
import json
import sys

spec = importlib.util.spec_from_file_location("sync_x_top_posts", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

username = "OwenMiner"
samples = [
    {
        "id": "1",
        "text": "wrong author",
        "likes": 10,
        "replies": 1,
        "views": 100,
        "created_at": "Wed, 01 Jul 2026 12:00:00 +0000",
        "url": "https://x.com/SomeoneElse/status/1",
        "author": {"screen_name": "SomeoneElse"},
        "media": {"all": [{"type": "photo", "url": "https://img/1.jpg", "width": 100, "height": 50}]},
    },
    {
        "id": "2",
        "text": "no media",
        "likes": 10,
        "replies": 1,
        "views": 100,
        "created_at": "Wed, 01 Jul 2026 12:00:00 +0000",
        "url": "https://x.com/OwenMiner/status/2",
        "author": {"screen_name": "OwenMiner"},
        "media": {"all": []},
    },
    {
        "id": "3",
        "text": "too few likes",
        "likes": 0,
        "replies": 1,
        "views": 100,
        "created_at": "Wed, 01 Jul 2026 12:00:00 +0000",
        "url": "https://x.com/OwenMiner/status/3",
        "author": {"screen_name": "OwenMiner"},
        "media": {"all": [{"type": "photo", "url": "https://img/3.jpg", "width": 100, "height": 50}]},
    },
    {
        "id": "4",
        "text": "  valid   photo  post  ",
        "likes": 5,
        "replies": 2,
        "views": 250,
        "created_at": "Wed, 01 Jul 2026 12:00:00 +0000",
        "url": "https://x.com/OwenMiner/status/4",
        "author": {"screen_name": "owenminer"},
        "media": {"all": [{"type": "photo", "url": "https://img/4.jpg", "width": 200, "height": 100}]},
    },
    {
        "id": "5",
        "text": "video post",
        "likes": 9,
        "replies": 0,
        "views": 900,
        "created_at": "Wed, 01 Jul 2026 13:00:00 +0000",
        "url": "https://x.com/OwenMiner/status/5",
        "author": {"screen_name": "OwenMiner"},
        "media": {
            "all": [
                {
                    "type": "video",
                    "url": "https://cdn/video.mp4",
                    "thumbnail_url": "https://cdn/thumb.jpg",
                    "width": 1280,
                    "height": 720,
                }
            ]
        },
    },
]

print(json.dumps([module.build_content_item(sample, username) for sample in samples]))
`
		)
	);

	assert.equal(cases[0], null);
	assert.equal(cases[1], null);
	assert.equal(cases[2], null);

	assert.equal(cases[3].platform, 'x');
	assert.equal(cases[3].contentType, 'photo');
	assert.equal(cases[3].title, 'valid photo post');
	assert.equal(cases[3].likeCount, 5);
	assert.equal(cases[3].aspectRatio, '200 / 100');
	assert.equal(cases[3].mediaKind, 'image');

	assert.equal(cases[4].contentType, 'video');
	assert.equal(cases[4].mediaKind, 'video');
	assert.equal(cases[4].thumbnail, 'https://cdn/thumb.jpg');
	assert.equal(cases[4].embedUrl, 'https://cdn/video.mp4');
	assert.equal(cases[4].aspectRatio, '1280 / 720');
});
