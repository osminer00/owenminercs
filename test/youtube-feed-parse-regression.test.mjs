import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractFunction(source, functionName) {
	const marker = `function ${functionName}(`;
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, `${functionName} should exist`);
	const declaredAt = source.slice(Math.max(0, start - 6), start) === 'async ' ? start - 6 : start;

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
			if (depth === 0) return source.slice(declaredAt, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function hostify(value) {
	return JSON.parse(JSON.stringify(value));
}

function loadYouTubeFeedHelpers() {
	const source = readWorkspaceFile('functions/api/social-feed.js');
	const sandbox = {};
	vm.runInNewContext(
		[
			extractFunction(source, 'truncateText'),
			extractFunction(source, 'parseIsoDurationToSeconds'),
			extractFunction(source, 'makeYouTubeCard'),
			extractFunction(source, 'extractTag'),
			extractFunction(source, 'extractAttribute'),
			extractFunction(source, 'parseYouTubeFeedXml'),
			'this.__helpers = { truncateText, parseIsoDurationToSeconds, makeYouTubeCard, parseYouTubeFeedXml };',
		].join('\n'),
		sandbox
	);
	assert.equal(typeof sandbox.__helpers.makeYouTubeCard, 'function');
	return sandbox.__helpers;
}

const helpers = loadYouTubeFeedHelpers();

test('YouTube cards classify shorts, live flags, counts, and encoded ids', () => {
	const { makeYouTubeCard, parseIsoDurationToSeconds, truncateText } = helpers;

	assert.equal(parseIsoDurationToSeconds(null), null);
	assert.equal(parseIsoDurationToSeconds(''), null);
	assert.equal(parseIsoDurationToSeconds('1:30'), null);
	assert.equal(parseIsoDurationToSeconds('PT'), 0);
	assert.equal(parseIsoDurationToSeconds('PT1M5S'), 65);
	assert.equal(parseIsoDurationToSeconds('PT1H2M3S'), 3723);
	assert.equal(parseIsoDurationToSeconds('PT70S'), 70);
	assert.equal(parseIsoDurationToSeconds('PT1M11S'), 71);

	assert.equal(makeYouTubeCard({ title: 'Missing id' }), null);
	assert.equal(makeYouTubeCard({ videoId: '   ' }), null);

	const shortCard = hostify(
		makeYouTubeCard({
			videoId: 'dQw4w9WgXcQ',
			title: '  Hello   world  ',
			description: 'Line\n\nbreak',
			publishedAt: '2026-01-02T03:04:05.000Z',
			thumbnailUrl: ' https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg ',
			durationSeconds: 70,
			viewCount: '1200',
			likeCount: 'nope',
			commentCount: 4,
			liveBroadcastContent: 'LIVE',
		})
	);
	assert.deepEqual(shortCard, {
		id: 'youtube_dQw4w9WgXcQ',
		platform: 'youtube',
		contentType: 'short',
		title: 'Hello world',
		description: 'Line break',
		publishedAt: '2026-01-02T03:04:05.000Z',
		permalink: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
		media: {
			kind: 'embed',
			thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
			embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0',
			aspectRatio: '16:9',
		},
		metrics: {
			viewCount: 1200,
			likeCount: 0,
			commentCount: 4,
		},
		isLive: true,
	});

	const longCard = hostify(
		makeYouTubeCard({
			videoId: 'a/b',
			title: 'a'.repeat(121),
			description: 'b'.repeat(261),
			publishedAt: '2026-02-02T00:00:00.000Z',
			durationSeconds: 71,
			liveBroadcastContent: 'none',
			liveStreamingDetails: { actualStartTime: '2026-02-02T00:00:00.000Z' },
		})
	);
	assert.equal(longCard.contentType, 'video');
	assert.equal(longCard.isLive, true);
	assert.equal(longCard.title, `${'a'.repeat(119)}…`);
	assert.equal(longCard.description, `${'b'.repeat(259)}…`);
	assert.equal(longCard.permalink, 'https://www.youtube.com/watch?v=a%2Fb');
	assert.equal(longCard.media.embedUrl, 'https://www.youtube.com/embed/a%2Fb?rel=0');
	assert.equal(truncateText('   ', 10), '');

	const upcoming = hostify(
		makeYouTubeCard({
			videoId: 'upcomingId1',
			title: '',
			publishedAt: '2026-03-03T00:00:00.000Z',
			durationSeconds: null,
			liveBroadcastContent: 'upcoming',
		})
	);
	assert.equal(upcoming.contentType, 'video');
	assert.equal(upcoming.title, 'Untitled video');
	assert.equal(upcoming.isLive, true);
	assert.equal(upcoming.metrics.viewCount, 0);
});

test('YouTube RSS parsing keeps CDATA text, drops id-less entries, and stays within the limit', () => {
	const { parseYouTubeFeedXml } = helpers;
	const xml = `
		<feed>
			<entry>
				<yt:videoId>vidOne123</yt:videoId>
				<title><![CDATA[Desk tour]]></title>
				<media:description><b>Hello</b> world</media:description>
				<published>2026-01-01T00:00:00Z</published>
				<media:thumbnail url="https://i.ytimg.com/vi/vidOne123/hqdefault.jpg" width="480"/>
			</entry>
			<entry>
				<yt:videoId>   </yt:videoId>
				<title>Skipped</title>
			</entry>
			<entry>
				<title>No id</title>
			</entry>
			<entry>
				<yt:videoId>vidTwo456</yt:videoId>
				<title>Second</title>
				<published>2026-02-01T00:00:00Z</published>
			</entry>
		</feed>
	`;

	const cards = hostify(parseYouTubeFeedXml(xml, 10));
	assert.equal(cards.length, 2);
	assert.equal(cards[0].id, 'youtube_vidOne123');
	assert.equal(cards[0].title, 'Desk tour');
	assert.equal(cards[0].description, 'Hello world');
	assert.equal(cards[0].publishedAt, '2026-01-01T00:00:00Z');
	assert.equal(cards[0].contentType, 'video');
	assert.equal(cards[0].isLive, false);
	assert.equal(
		cards[0].media.thumbnailUrl,
		'https://i.ytimg.com/vi/vidOne123/hqdefault.jpg'
	);
	assert.equal(cards[1].id, 'youtube_vidTwo456');
	assert.equal(cards[1].title, 'Second');
	assert.equal(cards[1].media.thumbnailUrl, '');

	const limited = hostify(parseYouTubeFeedXml(xml, 1));
	assert.deepEqual(
		limited.map((card) => card.id),
		['youtube_vidOne123']
	);
	assert.deepEqual(hostify(parseYouTubeFeedXml('<feed></feed>', 5)), []);
	assert.deepEqual(hostify(parseYouTubeFeedXml(xml, 0)), []);
});
