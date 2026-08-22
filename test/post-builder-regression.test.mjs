import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const postBuilderSource = readFileSync(
	new URL('../Posts/scripts/post-builder.js', import.meta.url),
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

function loadPostBuilderHelpers(options = {}) {
	const sandbox = {
		String,
		Array,
		posts: Array.isArray(options.posts) ? options.posts.slice() : [],
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		var posts = this.posts;
		${extractFunction(postBuilderSource, 'slugify')}
		${extractFunction(postBuilderSource, 'uniqueId')}
		${extractFunction(postBuilderSource, 'cleanText')}
		${extractFunction(postBuilderSource, 'capitalizeWords')}
		${extractFunction(postBuilderSource, 'truncateText')}
		${extractFunction(postBuilderSource, 'topicFromPrompt')}
		${extractFunction(postBuilderSource, 'parseKeywords')}
		${extractFunction(postBuilderSource, 'buildHashtags')}
		${extractFunction(postBuilderSource, 'generateCopyDraft')}
		${extractFunction(postBuilderSource, 'escapeAttr')}
		${extractFunction(postBuilderSource, 'escapeHtml')}
		this.__helpers = {
			slugify,
			uniqueId,
			cleanText,
			capitalizeWords,
			truncateText,
			topicFromPrompt,
			parseKeywords,
			buildHashtags,
			generateCopyDraft,
			escapeAttr,
			escapeHtml,
			posts,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('slugify strips punctuation and collapses dashes for post ids', () => {
	const { slugify } = loadPostBuilderHelpers();

	assert.equal(slugify('Hello World!'), 'hello-world');
	assert.equal(slugify('2026-08-22-New Post!!!'), '2026-08-22-new-post');
	assert.equal(slugify('  --Foo--Bar--  '), 'foo-bar');
	assert.equal(slugify('Setup & Lighting <script>'), 'setup-lighting-script');
	assert.equal(slugify(''), '');
	assert.equal(slugify(null), '');
});

test('uniqueId reuses a free slug and suffixes colliding post ids', () => {
	const { uniqueId } = loadPostBuilderHelpers({
		posts: [{ id: 'cabin-light' }, { id: 'cabin-light-2' }, { id: 'post' }],
	});

	assert.equal(uniqueId('fresh-slug'), 'fresh-slug');
	assert.equal(uniqueId('cabin-light'), 'cabin-light-3');
	assert.equal(uniqueId(''), 'post-2');
	assert.equal(uniqueId(null), 'post-2');
});

test('escapeHtml and escapeAttr keep preview markup from executing untrusted copy', () => {
	const { escapeHtml, escapeAttr } = loadPostBuilderHelpers();

	assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
	assert.equal(escapeHtml('a & b'), 'a &amp; b');
	assert.equal(
		escapeAttr('shot.webp" onerror="alert(1)'),
		'shot.webp&quot; onerror=&quot;alert(1)'
	);
	assert.equal(escapeAttr('<logo>'), '&lt;logo>');
	assert.equal(escapeAttr('a & b'), 'a &amp; b');
});

test('copy helpers parse keywords, truncate SEO fields, and keep a brand hashtag', () => {
	const { parseKeywords, topicFromPrompt, truncateText, buildHashtags, generateCopyDraft } =
		loadPostBuilderHelpers();

	assert.deepEqual(Array.from(parseKeywords(' cs2,  skins, , foo, bar, baz ')), [
		'cs2',
		'skins',
		'foo',
		'bar',
	]);
	assert.deepEqual(Array.from(parseKeywords('')), []);
	assert.equal(topicFromPrompt(''), 'new post update');
	assert.equal(topicFromPrompt('Hello world. Extra sentence here.'), 'Hello world');
	assert.equal(
		topicFromPrompt('one two three four five six seven eight nine'),
		'one two three four five six seven eight'
	);

	assert.equal(truncateText('short', 20), 'short');
	assert.equal(truncateText('abcdefghij', 6), 'abcde…');

	const tags = Array.from(buildHashtags('Cabin Light', ['CS2', 'cabin light']));
	assert.ok(tags.includes('#owenminercs'));
	assert.equal(tags[0], '#cabinlight');
	assert.ok(tags.length <= 5);

	const hype = generateCopyDraft('New desk tour dropped.', 'hype', 'desk, rgb');
	assert.match(hype.intro, /just dropped/i);
	assert.match(hype.seoTitle, /Owen Miner/);
	assert.ok(hype.seoTitle.length <= 58);
	assert.ok(hype.seoDescription.length <= 155);
	assert.match(hype.socialSnippet, /#owenminercs/);

	const unknownTone = generateCopyDraft('New desk tour dropped.', 'unknown', '');
	assert.match(unknownTone.intro, /^New post:/);
});
