import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
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

function loadSocialFeedHelpers() {
	const source = readWorkspaceFile('functions/api/social-feed.js');
	const sandbox = {
		Number,
		String,
		Boolean,
		Date,
		encodeURIComponent,
		globalThis: {},
	};

	vm.runInNewContext(
		[
			extractFunction(source, 'parsePositiveInt'),
			extractFunction(source, 'truncateText'),
			extractFunction(source, 'parseIsoDurationToSeconds'),
			extractFunction(source, 'makeYouTubeCard'),
			extractFunction(source, 'extractTag'),
			extractFunction(source, 'extractAttribute'),
			extractFunction(source, 'parseYouTubeFeedXml'),
			`globalThis.__helpers = {
				parsePositiveInt,
				truncateText,
				parseIsoDurationToSeconds,
				makeYouTubeCard,
				parseYouTubeFeedXml,
			};`,
		].join('\n'),
		sandbox
	);

	return sandbox.globalThis.__helpers;
}

test('social-feed parses ISO-8601 durations and truncates text safely', () => {
	const { parseIsoDurationToSeconds, truncateText, parsePositiveInt } = loadSocialFeedHelpers();

	assert.equal(parseIsoDurationToSeconds('PT1M10S'), 70);
	assert.equal(parseIsoDurationToSeconds('PT45S'), 45);
	assert.equal(parseIsoDurationToSeconds('PT1H2M3S'), 3723);
	assert.equal(parseIsoDurationToSeconds('not-a-duration'), null);
	assert.equal(parseIsoDurationToSeconds(''), null);

	assert.equal(truncateText('  spaced\n\twords  ', 20), 'spaced words');
	assert.equal(truncateText('abcdefghij', 8), 'abcdefg…');
	assert.equal(parsePositiveInt('0', 60), 60);
	assert.equal(parsePositiveInt('120', 60), 120);
});

test('social-feed classifies shorts vs videos and marks live content', () => {
	const { makeYouTubeCard } = loadSocialFeedHelpers();

	const shortCard = makeYouTubeCard({
		videoId: 'short123',
		title: 'Clip',
		description: 'A short clip',
		publishedAt: '2026-07-01T00:00:00Z',
		thumbnailUrl: 'https://example.com/thumb.jpg',
		durationSeconds: 55,
		viewCount: '10',
		likeCount: '2',
		commentCount: '1',
	});
	assert.equal(shortCard.contentType, 'short');
	assert.equal(shortCard.isLive, false);
	assert.equal(shortCard.permalink, 'https://www.youtube.com/watch?v=short123');
	assert.equal(shortCard.media.embedUrl, 'https://www.youtube.com/embed/short123?rel=0');

	const liveCard = makeYouTubeCard({
		videoId: 'live123',
		title: 'Live now',
		durationSeconds: 3600,
		liveBroadcastContent: 'live',
	});
	assert.equal(liveCard.contentType, 'video');
	assert.equal(liveCard.isLive, true);

	assert.equal(makeYouTubeCard({ title: 'Missing id' }), null);
});

test('social-feed XML parser extracts entries and respects the limit', () => {
	const { parseYouTubeFeedXml } = loadSocialFeedHelpers();
	const xml = `
		<feed>
			<entry>
				<yt:videoId>abc111</yt:videoId>
				<title><![CDATA[First Title]]></title>
				<published>2026-07-01T12:00:00Z</published>
				<media:description>First description</media:description>
				<media:thumbnail url="https://example.com/a.jpg" />
			</entry>
			<entry>
				<yt:videoId>abc222</yt:videoId>
				<title>Second Title</title>
				<published>2026-07-02T12:00:00Z</published>
				<media:description>Second description</media:description>
				<media:thumbnail url="https://example.com/b.jpg" />
			</entry>
			<entry>
				<title>Missing video id should be skipped</title>
			</entry>
		</feed>
	`;

	const cards = parseYouTubeFeedXml(xml, 1);
	assert.equal(cards.length, 1);
	assert.equal(cards[0].id, 'youtube_abc111');
	assert.equal(cards[0].title, 'First Title');
	assert.equal(cards[0].media.thumbnailUrl, 'https://example.com/a.jpg');
	assert.equal(cards[0].contentType, 'video');
});
