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

function loadCardHelpers() {
	const source = readWorkspaceFile('Socials/scripts/view-all-content.js');
	const sandbox = {
		String,
		Number,
		Math,
		Array,
		Object,
		Map,
		Date,
		Intl,
	};

	vm.runInNewContext(
		[
			extractFunction(source, 'normalizePlatform'),
			extractFunction(source, 'parseTime'),
			extractFunction(source, 'utcDateKey'),
			extractFunction(source, 'platformSortKey'),
			extractFunction(source, 'pickPrimaryEntry'),
			extractFunction(source, 'labelForEntry'),
			extractFunction(source, 'formatDate'),
			extractFunction(source, 'escapeHtml'),
			extractFunction(source, 'escapeAttr'),
			extractFunction(source, 'renderCard'),
			`this.__helpers = { renderCard };`,
		].join('\n'),
		sandbox
	);

	assert.equal(typeof sandbox.__helpers.renderCard, 'function');
	return sandbox.__helpers;
}

const { renderCard } = loadCardHelpers();

function platformHrefs(html) {
	return [...html.matchAll(/class="vac-platform-btn" href="([^"]*)"/g)].map((match) => match[1]);
}

test('single view-all card escapes the longest title, truncates the caption, and omits a missing thumbnail', () => {
	const html = renderCard([
		{
			platform: 'youtube',
			contentType: 'video',
			title: '  <Hello & Co>  ',
			url: 'https://youtu.be/abc?q="x',
			thumbnail: '',
			caption: `<img src=x>${'c'.repeat(230)}`,
			publishedAt: '',
		},
	]);

	const peek = html.match(/class="keep-card__peek">\s*<p>([^<]*)<\/p>/);
	assert.ok(peek, 'peek paragraph should be present');
	assert.equal(peek[1], `&lt;img src=x&gt;${'c'.repeat(209)}…`);
	assert.match(html, /keep-card__video-slot">YouTube</);
	assert.match(html, /keep-card__label">&lt;Hello &amp; Co&gt;</);
	assert.match(html, /No thumbnail/);
	assert.doesNotMatch(html, /<img/i);
	assert.deepEqual(platformHrefs(html), ['https://youtu.be/abc?q=&quot;x']);
});

test('cross-post cards keep one button per platform, prefer the long-form primary link, and escape hrefs', () => {
	const html = renderCard([
		{
			platform: 'YouTube',
			contentType: 'short',
			title: 'short title',
			url: 'https://youtube.com/shorts/111',
			thumbnail: 'https://cdn.example/short.jpg?x="1"',
			caption: 'should not be the peek',
			publishedAt: '2024-05-01T00:00:00.000Z',
		},
		{
			platform: 'youtube',
			contentType: 'video',
			title: 'long form',
			url: 'https://www.youtube.com/watch?v=222&a="b"',
			thumbnail: '',
			caption: 'primary caption that is hidden because this is a cross post',
			publishedAt: '2020-01-01T00:00:00.000Z',
		},
		{
			platform: 'x',
			title: 'newer x',
			url: 'https://x.com/owenminer/status/1',
			thumbnail: '',
			publishedAt: '2024-06-01T00:00:00.000Z',
			caption: '',
		},
		{
			platform: 'X',
			title: 'older x duplicate should lose',
			url: 'https://x.com/owenminer/status/0',
			publishedAt: '2019-01-01T00:00:00.000Z',
		},
	]);

	assert.match(html, /Cross-post · 4 places/);
	assert.match(html, /Same clip grouped by publish date\/title match — open any platform below\./);
	assert.doesNotMatch(html, /should not be the peek/);
	assert.doesNotMatch(html, /primary caption that is hidden/);
	assert.match(
		html,
		/href="https:\/\/www\.youtube\.com\/watch\?v=222&amp;a=&quot;b&quot;" target="_blank" rel="noopener noreferrer" tabindex="-1"/
	);
	assert.match(html, /src="https:\/\/cdn\.example\/short\.jpg\?x=&quot;1&quot;"/);
	assert.doesNotMatch(html, /status\/0/);
	assert.deepEqual(platformHrefs(html), [
		'https://www.youtube.com/watch?v=222&amp;a=&quot;b&quot;',
		'https://youtube.com/shorts/111',
		'https://x.com/owenminer/status/1',
	]);
	assert.match(html, />YouTube<\/a>/);
	assert.match(html, />YouTube Short<\/a>/);
	assert.match(html, />X<\/a>/);
});

test('view-all cards fall back to Post, a hash thumbnail href, and an em dash when fields are blank', () => {
	const html = renderCard([
		{
			platform: 'twitch',
			title: '   ',
			url: '',
			thumbnail: 'https://cdn.example/blank.jpg',
			publishedAt: 'not-a-date',
			caption: '',
		},
	]);

	assert.match(html, /keep-card__video-slot">Twitch</);
	assert.match(html, /keep-card__label">Post</);
	assert.match(html, /keep-card__peek">\s*<p>—<\/p>/);
	assert.match(html, /class="vac-thumb-link" href="#"/);
	assert.doesNotMatch(html, /No thumbnail/);
	assert.deepEqual(platformHrefs(html), ['']);
});
