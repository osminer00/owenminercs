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

function loadPostBuilderHelpers() {
	const source = readWorkspaceFile('Posts/scripts/post-builder.js');
	const sandbox = { String, Math, Array };

	vm.runInNewContext(
		[
			'var posts = [];',
			extractFunction(source, 'slugify'),
			extractFunction(source, 'uniqueId'),
			extractFunction(source, 'cleanText'),
			extractFunction(source, 'capitalizeWords'),
			extractFunction(source, 'truncateText'),
			extractFunction(source, 'topicFromPrompt'),
			extractFunction(source, 'parseKeywords'),
			extractFunction(source, 'buildHashtags'),
			extractFunction(source, 'generateCopyDraft'),
			extractFunction(source, 'escapeAttr'),
			extractFunction(source, 'escapeHtml'),
			`this.__helpers = {
				slugify,
				uniqueId,
				parseKeywords,
				buildHashtags,
				generateCopyDraft,
				escapeAttr,
				escapeHtml,
				setPosts: function (next) {
					posts.length = 0;
					for (var i = 0; i < next.length; i += 1) posts.push(next[i]);
				},
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'post-builder helpers should load');
	return sandbox.__helpers;
}

function copyDraft(draft) {
	return {
		topicTitle: draft.topicTitle,
		intro: draft.intro,
		seoTitle: draft.seoTitle,
		seoDescription: draft.seoDescription,
		socialSnippet: draft.socialSnippet,
	};
}

test('slugify lowercases titles, drops punctuation, and collapses dashes for post ids', () => {
	const { slugify } = loadPostBuilderHelpers();

	assert.equal(slugify('2026-09-01-Hello World!'), '2026-09-01-hello-world');
	assert.equal(slugify('  Desk   Setup  '), 'desk-setup');
	assert.equal(slugify('PC & monitors'), 'pc-monitors');
	assert.equal(slugify('---Wow---'), 'wow');
	assert.equal(slugify(''), '');
	assert.equal(slugify(null), '');
});

test('uniqueId returns the base id or appends -2, -3 when that id is already in memory', () => {
	const helpers = loadPostBuilderHelpers();

	helpers.setPosts([]);
	assert.equal(helpers.uniqueId('desk-setup'), 'desk-setup');
	assert.equal(helpers.uniqueId(''), 'post');

	helpers.setPosts([{ id: 'desk-setup' }, { id: 'desk-setup-2' }, { title: 'no id' }]);
	assert.equal(helpers.uniqueId('desk-setup'), 'desk-setup-3');
	assert.equal(helpers.uniqueId('new-post'), 'new-post');
});

test('parseKeywords splits a comma list, trims blanks, and keeps at most four tokens', () => {
	const { parseKeywords } = loadPostBuilderHelpers();

	const tags = Array.from(parseKeywords(' CS2 ,  skins, , keyboard, desk, extra '));
	assert.equal(tags.length, 4);
	assert.equal(tags[0], 'CS2');
	assert.equal(tags[1], 'skins');
	assert.equal(tags[2], 'keyboard');
	assert.equal(tags[3], 'desk');
	assert.equal(Array.from(parseKeywords('')).length, 0);
	assert.equal(Array.from(parseKeywords(null)).length, 0);
});

test('buildHashtags compact first-three-word tags, dedupes, and always includes #owenminercs', () => {
	const { buildHashtags } = loadPostBuilderHelpers();

	const tags = Array.from(
		buildHashtags('Desk Setup 2024 Extra', ['desk setup 2024 more', 'CS2 Knife Review'])
	);
	assert.equal(tags[0], '#desksetup2024');
	assert.equal(tags[1], '#cs2knifereview');
	assert.ok(tags.includes('#owenminercs'));
	assert.ok(tags.length <= 5);
	assert.equal(
		tags.filter((tag) => tag === '#desksetup2024').length,
		1,
		'duplicate compact tags from later keywords are skipped'
	);

	const onlyBrand = Array.from(buildHashtags('', []));
	assert.equal(onlyBrand.length, 1);
	assert.equal(onlyBrand[0], '#owenminercs');
});

test('generateCopyDraft falls back to balanced tone, truncates SEO fields, and appends hashtags', () => {
	const { generateCopyDraft } = loadPostBuilderHelpers();

	const hype = copyDraft(
		generateCopyDraft('New Wooting 60HE photos.', 'hype', 'keyboard, typing')
	);
	assert.equal(hype.topicTitle, 'New Wooting 60he Photos');
	assert.match(hype.intro, /just dropped/);
	assert.ok(hype.seoTitle.length <= 58);
	assert.ok(hype.seoDescription.length <= 155);
	assert.match(hype.seoDescription, /keyboard/);
	assert.match(hype.socialSnippet, /#owenminercs/);

	const unknown = copyDraft(generateCopyDraft('Quick desk update', 'loud', ''));
	assert.match(unknown.intro, /^New post:/);
	assert.match(unknown.seoDescription, /Includes photos and a quick summary/);

	const empty = copyDraft(generateCopyDraft('', 'casual', ''));
	assert.equal(empty.topicTitle, 'New Post Update');
	assert.match(empty.intro, /^Quick update:/);
});

test('escapeAttr and escapeHtml encode markup so preview innerHTML cannot break out of tags', () => {
	const { escapeAttr, escapeHtml } = loadPostBuilderHelpers();

	assert.equal(escapeAttr('shot.jpg'), 'shot.jpg');
	assert.equal(escapeAttr('a&b"c<d'), 'a&amp;b&quot;c&lt;d');
	assert.equal(
		escapeHtml('<img src="x" onerror="alert(1)">'),
		'&lt;img src="x" onerror="alert(1)"&gt;'
	);
	assert.equal(escapeHtml('A & B'), 'A &amp; B');
});
