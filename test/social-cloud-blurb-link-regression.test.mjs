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

class HTMLElement {
	constructor(tagName = 'div') {
		this.tagName = String(tagName).toUpperCase();
		this.childNodes = [];
		this.className = '';
		this.href = '';
		this.target = '';
		this.rel = '';
		this._text = '';
	}

	set textContent(value) {
		this._text = String(value);
		this.childNodes = [];
	}

	get textContent() {
		if (!this.childNodes.length) return this._text;
		return this.childNodes.map((node) => node.textContent ?? node.data ?? '').join('');
	}

	appendChild(node) {
		this.childNodes.push(node);
		return node;
	}
}

function makeDocument() {
	return {
		createElement(tag) {
			return new HTMLElement(tag);
		},
		createTextNode(data) {
			return { nodeType: 3, data: String(data), textContent: String(data) };
		},
	};
}

function loadBlurbHelpers() {
	const source = readWorkspaceFile('Socials/scripts/social-cloud.js');
	const sandbox = {
		String,
		HTMLElement,
		document: makeDocument(),
	};
	vm.runInNewContext(
		[
			extractFunction(source, 'isHttpUrl'),
			extractFunction(source, 'createBlurbLink'),
			extractFunction(source, 'setBlurbContent'),
			'this.createBlurbLink = createBlurbLink;',
			'this.setBlurbContent = setBlurbContent;',
			'this.isHttpUrl = isHttpUrl;',
		].join('\n'),
		sandbox
	);
	return sandbox;
}

function flattenChildren(element) {
	return Array.from(element.childNodes || []).map((node) => {
		if (node && node.tagName === 'A') {
			return {
				type: 'a',
				href: String(node.href),
				text: String(node.textContent),
				className: String(node.className),
				target: String(node.target),
				rel: String(node.rel),
			};
		}
		return { type: 'text', text: String(node.textContent ?? node.data ?? '') };
	});
}

test('createBlurbLink only builds http(s) anchors with noopener chrome', () => {
	const { createBlurbLink, isHttpUrl } = loadBlurbHelpers();

	const link = createBlurbLink('https://www.twitch.tv/owenminercs', 'Twitch');
	assert.equal(link.tagName, 'A');
	assert.equal(link.href, 'https://www.twitch.tv/owenminercs');
	assert.equal(link.textContent, 'Twitch');
	assert.equal(link.className, 'smc-inline-link');
	assert.equal(link.target, '_blank');
	assert.equal(link.rel, 'noopener noreferrer');

	const unlabeled = createBlurbLink('http://example.com/a', '');
	assert.equal(unlabeled.href, 'http://example.com/a');
	assert.equal(unlabeled.textContent, 'http://example.com/a');

	assert.equal(createBlurbLink('javascript:alert(1)', 'xss'), null);
	assert.equal(createBlurbLink('/relative', 'rel'), null);
	assert.equal(createBlurbLink('', 'empty'), null);
	assert.equal(isHttpUrl(' javascript:alert(1) '), false);
});

test('setBlurbContent turns markdown and plain http(s) URLs into links and leaves javascript as text', () => {
	const { setBlurbContent } = loadBlurbHelpers();

	assert.doesNotThrow(() => setBlurbContent(null, 'https://example.com'));
	assert.doesNotThrow(() => setBlurbContent({ textContent: 'keep' }, 'https://example.com'));

	const element = new HTMLElement('p');
	element.appendChild({ textContent: 'stale' });
	setBlurbContent(element, '');
	assert.equal(element.childNodes.length, 0);
	assert.equal(element.textContent, '');

	setBlurbContent(
		element,
		'See [Twitch](https://www.twitch.tv/owenminercs) and https://x.com/OwenMiner.'
	);
	const mixed = flattenChildren(element);
	assert.equal(mixed.length, 5);
	assert.equal(mixed[0].type, 'text');
	assert.equal(mixed[0].text, 'See ');
	assert.equal(mixed[1].type, 'a');
	assert.equal(mixed[1].href, 'https://www.twitch.tv/owenminercs');
	assert.equal(mixed[1].text, 'Twitch');
	assert.equal(mixed[2].type, 'text');
	assert.equal(mixed[2].text, ' and ');
	assert.equal(mixed[3].type, 'a');
	assert.equal(mixed[3].href, 'https://x.com/OwenMiner');
	assert.equal(mixed[3].text, 'https://x.com/OwenMiner');
	assert.equal(mixed[4].type, 'text');
	assert.equal(mixed[4].text, '.');

	setBlurbContent(element, 'Read https://example.com/path). leftover');
	const punctuated = flattenChildren(element);
	assert.equal(punctuated.length, 4);
	assert.equal(punctuated[0].type, 'text');
	assert.equal(punctuated[0].text, 'Read ');
	assert.equal(punctuated[1].type, 'a');
	assert.equal(punctuated[1].href, 'https://example.com/path');
	assert.equal(punctuated[1].text, 'https://example.com/path');
	assert.equal(punctuated[2].type, 'text');
	assert.equal(punctuated[2].text, ').');
	assert.equal(punctuated[3].type, 'text');
	assert.equal(punctuated[3].text, ' leftover');

	setBlurbContent(element, 'Do not click [xss](javascript:alert(1)) please');
	const blocked = flattenChildren(element);
	assert.equal(blocked.length, 1);
	assert.equal(blocked[0].type, 'text');
	assert.equal(blocked[0].text, 'Do not click [xss](javascript:alert(1)) please');
});
