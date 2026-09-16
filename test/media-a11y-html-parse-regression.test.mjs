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

function loadHtmlParseHelpers() {
	const source = readWorkspaceFile('dev/media-accessibility-check.mjs');
	const sandbox = { String, RegExp };

	vm.runInNewContext(
		[
			extractFunction(source, 'cleanText'),
			extractFunction(source, 'decodeHtmlEntity'),
			extractFunction(source, 'stripTags'),
			extractFunction(source, 'extractAttr'),
			extractFunction(source, 'hasClass'),
			extractFunction(source, 'nearestHeading'),
			`this.__helpers = {
				cleanText,
				decodeHtmlEntity,
				stripTags,
				extractAttr,
				hasClass,
				nearestHeading,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'media accessibility HTML helpers should load');
	return sandbox.__helpers;
}

test('decodeHtmlEntity decodes named entities and chained &amp;lt; / &amp;gt; pairs', () => {
	const { decodeHtmlEntity } = loadHtmlParseHelpers();

	assert.equal(decodeHtmlEntity('a &amp; b'), 'a & b');
	assert.equal(decodeHtmlEntity('say &quot;hi&quot;'), 'say "hi"');
	assert.equal(decodeHtmlEntity('it&#39;s'), "it's");
	assert.equal(decodeHtmlEntity('&lt;img&gt;'), '<img>');
	assert.equal(
		decodeHtmlEntity('&amp;lt;b&amp;gt;'),
		'<b>',
		'&amp; is decoded first, so a following &lt;/&gt; pair still becomes tags'
	);
});

test('stripTags removes markup, then decodes entities and collapses whitespace', () => {
	const { stripTags } = loadHtmlParseHelpers();

	assert.equal(stripTags('<h2>Desk <em>Setup</em></h2>'), 'Desk Setup');
	assert.equal(stripTags('  <span>PC  &amp;  monitors</span>  '), 'PC & monitors');
	assert.equal(stripTags('plain text'), 'plain text');
	assert.equal(stripTags(''), '');
});

test('extractAttr reads quoted attributes and ignores unquoted or missing names', () => {
	const { extractAttr } = loadHtmlParseHelpers();

	assert.equal(extractAttr('<img src="/photos/desk.jpg" alt="Desk">', 'src'), '/photos/desk.jpg');
	assert.equal(extractAttr("<img ALT='Setup shot'>", 'alt'), 'Setup shot');
	assert.equal(extractAttr('<img src=/photos/desk.jpg>', 'src'), '');
	assert.equal(extractAttr('<img src="/photos/desk.jpg">', 'alt'), '');
});

test('hasClass matches whole class tokens so site-logo-wrap is not site-logo', () => {
	const { hasClass } = loadHtmlParseHelpers();

	assert.equal(hasClass('<img class="site-logo">', 'site-logo'), true);
	assert.equal(hasClass('<img class="thumb site-logo hero">', 'site-logo'), true);
	assert.equal(hasClass('<img class="site-logo-wrap">', 'site-logo'), false);
	assert.equal(hasClass('<img src="/x.jpg">', 'site-logo'), false);
});

test('nearestHeading uses the last h1-h4 in the 1800-character lookbehind', () => {
	const { nearestHeading } = loadHtmlParseHelpers();

	const html = [
		'<h1>Ignored older title</h1>',
		'<p>padding</p>'.repeat(20),
		'<h2>Keyboard <em>Hub</em></h2>',
		'<img src="/keyboard.jpg" alt="">',
		'<h3>After the image</h3>',
	].join('');
	const imgIndex = html.indexOf('<img');

	assert.equal(nearestHeading(html, imgIndex), 'Keyboard Hub');
	assert.equal(nearestHeading('<img src="/x.jpg">', 0), '');

	const farHeading = `<h2>Too far</h2>${'x'.repeat(1800)}<img src="/x.jpg">`;
	assert.equal(nearestHeading(farHeading, farHeading.indexOf('<img')), '');
});
