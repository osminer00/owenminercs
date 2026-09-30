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

function loadSupportLinkHelpers() {
	const source = readWorkspaceFile('scripts/support-links.js');
	const sandbox = {};
	vm.runInNewContext(
		[
			extractFunction(source, 'isHttpUrl'),
			extractFunction(source, 'apply'),
			`function makeAnchor() {
				const attrs = {};
				return {
					setAttribute(name, value) { attrs[name] = value; },
					get(name) { return attrs[name]; },
				};
			}
			const anchors = {
				'a[data-kofi-link]': [makeAnchor()],
				'a[data-streamelements-tip-link]': [makeAnchor()],
				'a[data-steam-trade-link]': [makeAnchor()],
			};
			const document = {
				querySelectorAll(selector) { return anchors[selector] || []; },
			};
			this.__helpers = { isHttpUrl, apply, anchors };`,
		].join('\n'),
		sandbox
	);
	assert.equal(typeof sandbox.__helpers.apply, 'function');
	return sandbox.__helpers;
}

test('support links only write trimmed http(s) donation and trade hrefs', () => {
	const { isHttpUrl, apply, anchors } = loadSupportLinkHelpers();

	assert.equal(isHttpUrl('  HTTPS://ko-fi.com/owenminer  '), true);
	assert.equal(isHttpUrl('javascript:alert(1)'), false);
	assert.equal(isHttpUrl('data:text/html,hi'), false);
	assert.equal(isHttpUrl(''), false);
	assert.equal(isHttpUrl(null), false);

	apply(null);
	apply({
		ko_fi: '  https://ko-fi.com/owenminer  ',
		streamelements_tip: 'javascript:alert(1)',
		steam_trade_offer: 'http://steamcommunity.com/tradeoffer/new/?partner=1',
	});
	apply({
		ko_fi: 'data:text/html,hi',
		streamelements_tip: ' https://streamelements.com/owenminercs/tip ',
		steam_trade_offer: 'not a url',
	});

	assert.equal(anchors['a[data-kofi-link]'][0].get('href'), 'https://ko-fi.com/owenminer');
	assert.equal(
		anchors['a[data-streamelements-tip-link]'][0].get('href'),
		'https://streamelements.com/owenminercs/tip'
	);
	assert.equal(
		anchors['a[data-steam-trade-link]'][0].get('href'),
		'http://steamcommunity.com/tradeoffer/new/?partner=1'
	);
});
