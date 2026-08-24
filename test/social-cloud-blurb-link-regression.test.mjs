import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const socialCloudSource = readFileSync(
	new URL('../Socials/scripts/social-cloud.js', import.meta.url),
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

	get textContent() {
		if (this.childNodes.length) {
			return this.childNodes
				.map((node) => node.textContent || node.data || '')
				.join('');
		}
		return this._text;
	}

	set textContent(value) {
		this.childNodes = [];
		this._text = String(value ?? '');
	}

	appendChild(node) {
		this.childNodes.push(node);
		return node;
	}
}

function loadBlurbHelpers() {
	const sandbox = {
		String,
		Boolean,
		RegExp,
		HTMLElement,
		document: {
			createElement(tagName) {
				return new HTMLElement(tagName);
			},
			createTextNode(data) {
				const text = String(data);
				return { nodeType: 3, data: text, textContent: text };
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'isHttpUrl')}
		${extractFunction(socialCloudSource, 'createBlurbLink')}
		${extractFunction(socialCloudSource, 'setBlurbContent')}
		${extractFunction(socialCloudSource, 'parseRedditUsernameFromUrl')}
		this.__helpers = {
			isHttpUrl,
			createBlurbLink,
			setBlurbContent,
			parseRedditUsernameFromUrl,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'social-cloud blurb helpers should load');
	return sandbox.__helpers;
}

test('createBlurbLink only accepts http(s) destinations and keeps labels as text', () => {
	const { createBlurbLink, isHttpUrl } = loadBlurbHelpers();

	assert.equal(isHttpUrl('https://www.twitch.tv/owenminercs'), true);
	assert.equal(isHttpUrl('http://example.com'), true);
	assert.equal(isHttpUrl('javascript:alert(1)'), false);
	assert.equal(isHttpUrl('mailto:owen@example.com'), false);
	assert.equal(isHttpUrl('/relative'), false);

	assert.equal(createBlurbLink('javascript:alert(1)', 'xss'), null);
	assert.equal(createBlurbLink('mailto:owen@example.com', 'mail'), null);

	const link = createBlurbLink('https://www.twitch.tv/owenminercs', '<img src=x onerror=alert(1)>');
	assert.ok(link instanceof HTMLElement);
	assert.equal(link.tagName, 'A');
	assert.equal(link.className, 'smc-inline-link');
	assert.equal(link.href, 'https://www.twitch.tv/owenminercs');
	assert.equal(link.target, '_blank');
	assert.equal(link.rel, 'noopener noreferrer');
	assert.equal(link.textContent, '<img src=x onerror=alert(1)>');
	assert.equal(link.childNodes.length, 0);
});

test('setBlurbContent autolinks http(s) URLs and markdown links without executing markup', () => {
	const { setBlurbContent } = loadBlurbHelpers();
	const el = new HTMLElement('p');

	setBlurbContent(el, 'See [Twitch](https://www.twitch.tv/owenminercs) and https://x.com/OwenMiner.');
	const nodes = Array.from(el.childNodes);
	assert.equal(nodes[0].textContent, 'See ');
	assert.equal(nodes[1].tagName, 'A');
	assert.equal(nodes[1].href, 'https://www.twitch.tv/owenminercs');
	assert.equal(nodes[1].textContent, 'Twitch');
	assert.equal(nodes[2].textContent, ' and ');
	assert.equal(nodes[3].tagName, 'A');
	assert.equal(nodes[3].href, 'https://x.com/OwenMiner');
	assert.equal(nodes[3].textContent, 'https://x.com/OwenMiner');
	assert.equal(nodes[4].textContent, '.');

	const hostile = new HTMLElement('p');
	setBlurbContent(
		hostile,
		'<img src=x onerror=alert(1)> [nope](javascript:alert(1)) javascript:alert(1)'
	);
	assert.equal(hostile.childNodes.length, 1);
	assert.equal(
		hostile.childNodes[0].textContent,
		'<img src=x onerror=alert(1)> [nope](javascript:alert(1)) javascript:alert(1)'
	);
	assert.equal(hostile.childNodes[0].tagName, undefined);

	setBlurbContent(el, '');
	assert.equal(el.childNodes.length, 0);
	assert.equal(el.textContent, '');
});

test('parseRedditUsernameFromUrl reads user and u profile paths and ignores other hosts', () => {
	const { parseRedditUsernameFromUrl } = loadBlurbHelpers();

	assert.equal(parseRedditUsernameFromUrl('https://www.reddit.com/user/OwenMCS'), 'OwenMCS');
	assert.equal(parseRedditUsernameFromUrl('https://old.reddit.com/u/OwenMCS/comments/abc'), 'OwenMCS');
	assert.equal(parseRedditUsernameFromUrl('https://www.reddit.com/r/GlobalOffensive/'), '');
	assert.equal(parseRedditUsernameFromUrl('https://example.com/user/OwenMCS'), '');
	assert.equal(parseRedditUsernameFromUrl(''), '');
});
