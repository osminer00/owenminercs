import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const feedSource = readFileSync(
	new URL('../functions/api/social-feed.js', import.meta.url),
	'utf8'
);

function extractFunction(source, functionName) {
	const start = source.indexOf(`function ${functionName}`);
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

function loadFeedHelpers() {
	const sandbox = {
		String,
		Number,
		Boolean,
		Date,
		JSON,
		encodeURIComponent,
		URL,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(feedSource, 'parsePositiveInt')}
		${extractFunction(feedSource, 'truncateText')}
		${extractFunction(feedSource, 'parseIsoDurationToSeconds')}
		${extractFunction(feedSource, 'makeYouTubeCard')}
		${extractFunction(feedSource, 'extractTag')}
		${extractFunction(feedSource, 'extractAttribute')}
		${extractFunction(feedSource, 'parseYouTubeFeedXml')}
		this.__helpers = {
			parsePositiveInt,
			truncateText,
			parseIsoDurationToSeconds,
			makeYouTubeCard,
			extractTag,
			extractAttribute,
			parseYouTubeFeedXml,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

function cardFields(card) {
	if (!card) return null;
	return {
		id: String(card.id),
		platform: String(card.platform),
		contentType: String(card.contentType),
		title: String(card.title),
		description: String(card.description),
		publishedAt: String(card.publishedAt),
		permalink: String(card.permalink),
		thumbnailUrl: String(card.media?.thumbnailUrl),
		embedUrl: String(card.media?.embedUrl),
		aspectRatio: String(card.media?.aspectRatio),
		kind: String(card.media?.kind),
		viewCount: Number(card.metrics?.viewCount),
		likeCount: Number(card.metrics?.likeCount),
		commentCount: Number(card.metrics?.commentCount),
		isLive: Boolean(card.isLive),
	};
}

test('parseIsoDurationToSeconds converts ISO-8601 clock times and rejects invalid values', () => {
	const { parseIsoDurationToSeconds } = loadFeedHelpers();

	assert.equal(parseIsoDurationToSeconds('PT1H2M3S'), 3723);
	assert.equal(parseIsoDurationToSeconds('PT70S'), 70);
	assert.equal(parseIsoDurationToSeconds('PT1M10S'), 70);
	assert.equal(parseIsoDurationToSeconds('PT1H'), 3600);
	assert.equal(parseIsoDurationToSeconds('P1D'), 0);
	assert.equal(parseIsoDurationToSeconds('PT70.5S'), null);
	assert.equal(parseIsoDurationToSeconds('70'), null);
	assert.equal(parseIsoDurationToSeconds(''), null);
	assert.equal(parseIsoDurationToSeconds(null), null);
});

test('parsePositiveInt and truncateText reject junk and collapse whitespace', () => {
	const { parsePositiveInt, truncateText } = loadFeedHelpers();

	assert.equal(parsePositiveInt('12', 60), 12);
	assert.equal(parsePositiveInt('0', 60), 60);
	assert.equal(parsePositiveInt('-3', 60), 60);
	assert.equal(parsePositiveInt('nope', 60), 60);
	assert.equal(parsePositiveInt(undefined, 60), 60);

	assert.equal(truncateText('  hello   world  ', 20), 'hello world');
	assert.equal(truncateText('   ', 20), '');
	assert.equal(truncateText('abcdefghij', 8), 'abcdefg…');
});

test('makeYouTubeCard classifies shorts at 70s, encodes ids, and treats live/upcoming as live', () => {
	const { makeYouTubeCard } = loadFeedHelpers();

	const shortCard = cardFields(
		makeYouTubeCard({
			videoId: 'abc def',
			title: '  Clip  ',
			description: '  Two   lines  ',
			publishedAt: '2026-05-01T00:00:00Z',
			thumbnailUrl: ' https://i.ytimg.com/vi/abc/hqdefault.jpg ',
			durationSeconds: 70,
			viewCount: '12',
			likeCount: 'not-a-number',
			commentCount: '',
			liveBroadcastContent: 'none',
		})
	);
	assert.equal(shortCard.contentType, 'short');
	assert.equal(shortCard.id, 'youtube_abc def');
	assert.equal(shortCard.permalink, 'https://www.youtube.com/watch?v=abc%20def');
	assert.equal(shortCard.embedUrl, 'https://www.youtube.com/embed/abc%20def?rel=0');
	assert.equal(shortCard.kind, 'embed');
	assert.equal(shortCard.aspectRatio, '16:9');
	assert.equal(shortCard.title, 'Clip');
	assert.equal(shortCard.description, 'Two lines');
	assert.equal(shortCard.thumbnailUrl, 'https://i.ytimg.com/vi/abc/hqdefault.jpg');
	assert.equal(shortCard.viewCount, 12);
	assert.equal(shortCard.likeCount, 0);
	assert.equal(shortCard.commentCount, 0);
	assert.equal(shortCard.isLive, false);
	assert.equal(shortCard.publishedAt, '2026-05-01T00:00:00Z');

	const videoCard = cardFields(
		makeYouTubeCard({
			videoId: 'longVid',
			title: '',
			durationSeconds: 71,
			publishedAt: '2026-05-02T00:00:00Z',
		})
	);
	assert.equal(videoCard.contentType, 'video');
	assert.equal(videoCard.title, 'Untitled video');
	assert.equal(videoCard.isLive, false);

	const missingDuration = cardFields(
		makeYouTubeCard({
			videoId: 'rssVid',
			publishedAt: '2026-05-03T00:00:00Z',
		})
	);
	assert.equal(missingDuration.contentType, 'video');

	assert.equal(
		cardFields(
			makeYouTubeCard({
				videoId: 'live1',
				publishedAt: '2026-05-04T00:00:00Z',
				liveBroadcastContent: 'LIVE',
			})
		).isLive,
		true
	);
	assert.equal(
		cardFields(
			makeYouTubeCard({
				videoId: 'soon',
				publishedAt: '2026-05-04T00:00:00Z',
				liveBroadcastContent: 'upcoming',
			})
		).isLive,
		true
	);
	assert.equal(
		cardFields(
			makeYouTubeCard({
				videoId: 'details',
				publishedAt: '2026-05-04T00:00:00Z',
				liveStreamingDetails: { actualStartTime: '2026-05-04T00:00:00Z' },
			})
		).isLive,
		true
	);

	assert.equal(makeYouTubeCard({ videoId: '   ' }), null);
	assert.equal(makeYouTubeCard({}), null);
});

test('parseYouTubeFeedXml unwraps CDATA, skips missing ids, and honors the limit', () => {
	const { parseYouTubeFeedXml, extractTag, extractAttribute } = loadFeedHelpers();

	const xml = `
		<feed>
			<entry>
				<title>Ignored because no video id</title>
			</entry>
			<entry>
				<title><![CDATA[ First <b>clip</b> ]]></title>
				<yt:videoId> vidOne </yt:videoId>
				<published>2026-01-01T00:00:00Z</published>
				<media:description><![CDATA[  Hello   world  ]]></media:description>
				<media:thumbnail url="https://i.ytimg.com/vi/vidOne/hqdefault.jpg" />
			</entry>
			<entry>
				<title>Still no id</title>
			</entry>
			<entry>
				<title>Second</title>
				<yt:videoId>vidTwo</yt:videoId>
				<published>2026-01-02T00:00:00Z</published>
			</entry>
		</feed>
	`;

	assert.equal(
		extractTag(
			'<title><![CDATA[ First <b>clip</b> ]]></title>',
			'title'
		),
		'First clip'
	);
	assert.equal(
		extractAttribute(
			'<media:thumbnail url="https://i.ytimg.com/vi/vidOne/hqdefault.jpg" />',
			'media:thumbnail',
			'url'
		),
		'https://i.ytimg.com/vi/vidOne/hqdefault.jpg'
	);

	const limited = Array.from(parseYouTubeFeedXml(xml, 1), cardFields);
	assert.equal(limited.length, 1);
	assert.equal(limited[0].id, 'youtube_vidOne');
	assert.equal(limited[0].title, 'First clip');
	assert.equal(limited[0].description, 'Hello world');
	assert.equal(limited[0].thumbnailUrl, 'https://i.ytimg.com/vi/vidOne/hqdefault.jpg');
	assert.equal(limited[0].contentType, 'video');
	assert.equal(limited[0].publishedAt, '2026-01-01T00:00:00Z');

	const both = Array.from(parseYouTubeFeedXml(xml, 10), (card) => String(card.id));
	assert.deepEqual(both, ['youtube_vidOne', 'youtube_vidTwo']);
});
