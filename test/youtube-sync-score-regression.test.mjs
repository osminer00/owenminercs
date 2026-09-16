import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}(`);
	assert.notEqual(start, -1, `${functionName} should exist`);

	const paramsStart = source.indexOf('(', start);
	assert.notEqual(paramsStart, -1, `${functionName} should have parameters`);

	let parenDepth = 0;
	let paramsEnd = -1;
	for (let i = paramsStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '(') parenDepth += 1;
		if (char === ')') {
			parenDepth -= 1;
			if (parenDepth === 0) {
				paramsEnd = i;
				break;
			}
		}
	}
	assert.notEqual(paramsEnd, -1, `${functionName} parameter list should close`);

	const braceStart = source.indexOf('{', paramsEnd);
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

function loadScoreContent(nowMs) {
	const source = readWorkspaceFile('scripts/sync-youtube-local-feed.mjs');
	const sandbox = {
		Math,
		Number,
		Date: {
			now: () => nowMs,
			parse: Date.parse,
		},
	};

	vm.runInNewContext(
		[extractFunction(source, 'scoreContent'), 'this.scoreContent = scoreContent;'].join('\n'),
		sandbox
	);

	assert.equal(typeof sandbox.scoreContent, 'function');
	return sandbox.scoreContent;
}

const NOW_MS = Date.parse('2026-09-16T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function isoDaysAgo(days) {
	return new Date(NOW_MS - days * DAY_MS).toISOString();
}

test('YouTube scoreContent ranks more views and likes higher when recency matches', () => {
	const scoreContent = loadScoreContent(NOW_MS);
	const publishedAt = isoDaysAgo(1);

	const lowViews = scoreContent({ viewCount: 10, likeCount: 5, publishedAt });
	const highViews = scoreContent({ viewCount: 10_000, likeCount: 5, publishedAt });
	const highLikes = scoreContent({ viewCount: 10, likeCount: 5_000, publishedAt });

	assert.ok(highViews > lowViews, 'view count should raise rank logarithmically');
	assert.ok(highLikes > lowViews, 'like count should raise rank logarithmically');
	assert.equal(
		scoreContent({ viewCount: 10, likeCount: 5, publishedAt }),
		lowViews,
		'scores should be deterministic for the same inputs'
	);
});

test('YouTube scoreContent applies a 60-day recency window and treats missing dates as old', () => {
	const scoreContent = loadScoreContent(NOW_MS);
	const counts = { viewCount: 100, likeCount: 10 };

	const fresh = scoreContent({ ...counts, publishedAt: isoDaysAgo(0) });
	const mid = scoreContent({ ...counts, publishedAt: isoDaysAgo(30) });
	const agedOut = scoreContent({ ...counts, publishedAt: isoDaysAgo(60) });
	const older = scoreContent({ ...counts, publishedAt: isoDaysAgo(120) });
	const missing = scoreContent({ ...counts });
	const invalid = scoreContent({ ...counts, publishedAt: 'not-a-date' });
	const future = scoreContent({ ...counts, publishedAt: isoDaysAgo(-2) });

	assert.ok(fresh > mid, 'newer videos should outrank 30-day-old videos');
	assert.ok(mid > agedOut, 'recency should keep decaying until day 60');
	assert.equal(agedOut, older, 'videos older than 60 days should share a zero recency boost');
	assert.equal(missing, agedOut, 'missing publishedAt should use the 365-day fallback (no recency)');
	assert.equal(invalid, agedOut, 'unparseable publishedAt should also skip recency');
	assert.equal(future, fresh, 'future timestamps should clamp age to 0 rather than penalize');
});

test('YouTube scoreContent clamps negative counts and treats missing stats as zero', () => {
	const scoreContent = loadScoreContent(NOW_MS);
	const publishedAt = isoDaysAgo(5);

	const zero = scoreContent({ viewCount: 0, likeCount: 0, publishedAt });
	const missing = scoreContent({ publishedAt });
	const negative = scoreContent({ viewCount: -50, likeCount: -9, publishedAt });
	const numericStrings = scoreContent({ viewCount: '200', likeCount: '20', publishedAt });

	assert.equal(missing, zero);
	assert.equal(negative, zero);
	assert.ok(numericStrings > zero, 'numeric strings should still contribute to rank');
	assert.ok(Number.isFinite(zero));
	assert.ok(Number.isFinite(numericStrings));
});
