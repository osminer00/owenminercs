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

	const paramsStart = source.indexOf('(', start);
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

function extractConst(source, name) {
	const marker = `const ${name} =`;
	const start = source.indexOf(marker);
	assert.notEqual(start, -1, `${name} should exist`);
	const end = source.indexOf(';', start);
	assert.notEqual(end, -1, `${name} should end`);
	return source.slice(start, end + 1);
}

function loadSiteFeedHelpers() {
	const source = readWorkspaceFile('scripts/site-feed.js');
	const sandbox = {};
	vm.runInNewContext(
		[
			extractConst(source, 'KO_FI_TIP_URL'),
			extractConst(source, 'STREAMELEMENTS_TIP_URL'),
			extractFunction(source, 'escapeHtml'),
			extractFunction(source, 'linkifyKoFiAndStreamElements'),
			'this.__helpers = { linkifyKoFiAndStreamElements };',
		].join('\n'),
		sandbox
	);
	assert.equal(typeof sandbox.__helpers.linkifyKoFiAndStreamElements, 'function');
	return sandbox.__helpers;
}

const { linkifyKoFiAndStreamElements } = loadSiteFeedHelpers();

test('site feed summaries escape HTML before linking donation names', () => {
	assert.equal(linkifyKoFiAndStreamElements(null), '');
	assert.equal(linkifyKoFiAndStreamElements(12), '');
	assert.equal(linkifyKoFiAndStreamElements(''), '');

	const html = linkifyKoFiAndStreamElements(
		'Tip on Ko-fi & StreamElements. <img src=x onerror="alert(1)"> "quotes"'
	);
	assert.equal(
		html,
		'Tip on <a href="https://ko-fi.com/owenminer" data-kofi-link class="site-feed-inline-tip" target="_blank" rel="noopener noreferrer">Ko-fi</a> &amp; <a href="https://streamelements.com/owenminercs/tip" data-streamelements-tip-link class="site-feed-inline-tip" target="_blank" rel="noopener noreferrer">StreamElements</a>. &lt;img src=x onerror=&quot;alert(1)&quot;&gt; &quot;quotes&quot;'
	);
	assert.equal(html.includes('<img'), false);
	assert.equal(html.includes('javascript:'), false);
});

test('site feed donation links require the exact brand words', () => {
	assert.equal(linkifyKoFiAndStreamElements('ko-fi and streamelements'), 'ko-fi and streamelements');
	assert.equal(
		linkifyKoFiAndStreamElements('Ko-fisher mentioned StreamElementsExtra'),
		'Ko-fisher mentioned StreamElementsExtra'
	);

	const both = linkifyKoFiAndStreamElements('Ko-fi then Ko-fi');
	assert.equal(both.match(/data-kofi-link/g).length, 2);
	assert.equal(both.includes('https://ko-fi.com/owenminer'), true);
	assert.equal(both.includes('data-streamelements-tip-link'), false);
});
