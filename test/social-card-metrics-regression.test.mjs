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
	const braceStart = source.indexOf('{', start);
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

function loadCardMetrics() {
	const source = readWorkspaceFile('Socials/scripts/social-cloud.js');
	const script = [
		'normalizePlatformKey',
		'toSafeNumber',
		'isShortFormVideo',
		'getResolvedContentType',
		'getCardMetrics',
	]
		.map((name) => extractFunction(source, name))
		.join('\n');
	const sandbox = { globalThis: {} };
	vm.runInNewContext(`${script}\nglobalThis.getCardMetrics = getCardMetrics;`, sandbox);
	return sandbox.globalThis.getCardMetrics;
}

const getCardMetrics = loadCardMetrics();

function statLine(parts) {
	return parts.map((value) => value.toLocaleString()).join(' • ');
}

test('social card stats use Reddit upvotes and hide a zero comment count', () => {
	const metrics = getCardMetrics({
		platform: ' Reddit ',
		upvoteCount: 12,
		likeCount: 99,
		viewCount: 400,
		commentCount: 0,
		contentType: 'image',
	});

	assert.equal(metrics.viewCount, 400);
	assert.equal(metrics.likeCount, 12);
	assert.equal(metrics.commentCount, 0);
	assert.equal(metrics.label, `${statLine([12])} upvotes`);
	assert.equal(metrics.label.includes('views'), false);
	assert.equal(metrics.label.includes('likes'), false);
});

test('social card stats fall back to likes and include comments only when present', () => {
	const missingUpvotes = getCardMetrics({
		platform: 'reddit',
		likeCount: 4,
		commentCount: '8',
		contentType: 'post',
	});
	assert.equal(missingUpvotes.likeCount, 4);
	assert.equal(missingUpvotes.commentCount, 8);
	assert.equal(missingUpvotes.label, `${statLine([4])} upvotes • ${statLine([8])} comments`);

	const youtube = getCardMetrics({
		platform: 'youtube',
		viewCount: 20,
		likeCount: 3,
		upvoteCount: 9,
		commentCount: 2,
		contentType: 'video',
	});
	assert.equal(youtube.viewCount, 20);
	assert.equal(youtube.likeCount, 3);
	assert.equal(youtube.commentCount, 2);
	assert.equal(youtube.label, `${statLine([20])} views • ${statLine([3])} likes • ${statLine([2])} comments`);
});

test('social card stats treat X like a view platform and coerce junk counts to zero', () => {
	const twitter = getCardMetrics({
		platform: 'twitter',
		viewCount: 'nope',
		upvoteCount: 6,
		commentCount: 1,
		contentType: 'post',
	});
	assert.equal(twitter.viewCount, 0);
	assert.equal(twitter.likeCount, 6);
	assert.equal(twitter.commentCount, 1);
	assert.equal(twitter.label, `${statLine([0])} views • ${statLine([6])} likes • ${statLine([1])} comments`);

	const empty = getCardMetrics({});
	assert.deepEqual(
		{ viewCount: empty.viewCount, likeCount: empty.likeCount, commentCount: empty.commentCount },
		{ viewCount: 0, likeCount: 0, commentCount: 0 }
	);
	assert.equal(empty.label, `${statLine([0])} views • ${statLine([0])} likes`);
});
