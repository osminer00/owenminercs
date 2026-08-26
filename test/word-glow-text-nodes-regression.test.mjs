import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const componentsSource = readFileSync(new URL('../scripts/components.js', import.meta.url), 'utf8');

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
			if (depth === 0) {
				const prefix = start >= 6 && source.slice(start - 6, start) === 'async ' ? 'async ' : '';
				return prefix + source.slice(start, i + 1);
			}
		}
	}

	assert.fail(`${functionName} body should close`);
}

function extractConstAssignment(source, constName) {
	const start = source.indexOf(`const ${constName}`);
	assert.notEqual(start, -1, `${constName} should exist`);
	const end = source.indexOf(';', start);
	assert.notEqual(end, -1, `${constName} assignment should end`);
	return source.slice(start, end + 1);
}

class FakeFragment {
	constructor() {
		this.childNodes = [];
	}

	appendChild(child) {
		this.childNodes.push(child);
		return child;
	}
}

class FakeElement {
	constructor(tagName = 'div') {
		this.tagName = String(tagName).toUpperCase();
		this.childNodes = [];
		this.parentElement = null;
		this.parentNode = null;
		this.attrs = new Map();
		this.className = '';
		this._text = '';
	}

	get firstChild() {
		return this.childNodes[0] || null;
	}

	get classList() {
		const self = this;
		return {
			contains(name) {
				return self.className.split(/\s+/).filter(Boolean).includes(name);
			},
			add(name) {
				const next = new Set(self.className.split(/\s+/).filter(Boolean));
				next.add(name);
				self.className = Array.from(next).join(' ');
			},
			remove(name) {
				self.className = self.className
					.split(/\s+/)
					.filter((cls) => cls && cls !== name)
					.join(' ');
			},
		};
	}

	get textContent() {
		if (this.childNodes.length) {
			return this.childNodes.map((child) => child.textContent ?? child.nodeValue ?? '').join('');
		}
		return this._text;
	}

	set textContent(value) {
		this.replaceChildren();
		const text = String(value);
		this._text = '';
		if (text) this.appendChild(createTextNode(text));
	}

	getAttribute(name) {
		return this.attrs.has(name) ? this.attrs.get(name) : null;
	}

	setAttribute(name, value) {
		this.attrs.set(name, String(value));
	}

	hasAttribute(name) {
		return this.attrs.has(name);
	}

	appendChild(child) {
		if (child.parentNode && typeof child.parentNode.removeChild === 'function') {
			child.parentNode.removeChild(child);
		}
		child.parentElement = this;
		child.parentNode = this;
		this.childNodes.push(child);
		return child;
	}

	removeChild(child) {
		this.childNodes = this.childNodes.filter((node) => node !== child);
		child.parentElement = null;
		child.parentNode = null;
		return child;
	}

	replaceChild(newChild, oldChild) {
		const index = this.childNodes.indexOf(oldChild);
		assert.notEqual(index, -1, 'replaceChild target should already be a child');
		oldChild.parentElement = null;
		oldChild.parentNode = null;
		const inserted = newChild instanceof FakeFragment ? [...newChild.childNodes] : [newChild];
		for (const node of inserted) {
			node.parentElement = this;
			node.parentNode = this;
		}
		this.childNodes.splice(index, 1, ...inserted);
		if (newChild instanceof FakeFragment) newChild.childNodes = [];
		return oldChild;
	}

	replaceChildren() {
		for (const child of this.childNodes) {
			child.parentElement = null;
			child.parentNode = null;
		}
		this.childNodes = [];
		this._text = '';
	}

	matchesOne(part) {
		const selector = String(part).trim();
		if (!selector) return false;
		const taggedAttr = selector.match(/^([a-zA-Z][\w-]*)(\[.+\])$/);
		if (taggedAttr) {
			return this.tagName === taggedAttr[1].toUpperCase() && this.matchesOne(taggedAttr[2]);
		}
		if (selector.startsWith('.')) {
			return selector
				.slice(1)
				.split('.')
				.filter(Boolean)
				.every((cls) => this.classList.contains(cls));
		}
		if (selector.startsWith('[')) {
			const body = selector.slice(1, -1);
			const eq = body.indexOf('=');
			if (eq === -1) return this.hasAttribute(body);
			const name = body.slice(0, eq);
			const raw = body.slice(eq + 1).replace(/^["']|["']$/g, '');
			return this.getAttribute(name) === raw;
		}
		return this.tagName === selector.toUpperCase();
	}

	matches(selector) {
		return String(selector)
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean)
			.some((part) => this.matchesOne(part));
	}

	closest(selector) {
		let node = this;
		while (node) {
			if (typeof node.matches === 'function' && node.matches(selector)) return node;
			node = node.parentElement;
		}
		return null;
	}

	*descendants() {
		for (const child of this.childNodes) {
			if (!(child instanceof FakeElement)) continue;
			yield child;
			yield* child.descendants();
		}
	}
}

function createTextNode(value) {
	return {
		nodeType: 3,
		nodeValue: String(value),
		textContent: String(value),
		parentElement: null,
		parentNode: null,
	};
}

function collectTextNodes(root) {
	const out = [];
	const visit = (node) => {
		if (!node) return;
		if (!(node instanceof FakeElement)) {
			out.push(node);
			return;
		}
		for (const child of node.childNodes) visit(child);
	};
	visit(root);
	return out;
}

class FakeTreeWalker {
	constructor(root, _whatToShow, filter) {
		this._nodes = collectTextNodes(root);
		this._index = -1;
		this._filter = filter;
	}

	nextNode() {
		while (this._index + 1 < this._nodes.length) {
			this._index += 1;
			const node = this._nodes[this._index];
			if (this._filter.acceptNode(node) === 1) return node;
		}
		return null;
	}
}

function loadWordGlowTextHelpers() {
	const document = {
		createElement(tag) {
			return new FakeElement(tag);
		},
		createTextNode,
		createDocumentFragment() {
			return new FakeFragment();
		},
		createTreeWalker(root, whatToShow, filter) {
			return new FakeTreeWalker(root, whatToShow, filter);
		},
	};

	const sandbox = {
		String,
		Boolean,
		Array,
		Math,
		Element: FakeElement,
		document,
		NodeFilter: {
			SHOW_TEXT: 4,
			FILTER_REJECT: 2,
			FILTER_ACCEPT: 1,
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		const WORD_GLOW_MIN_PROSE_CHARS = 200;
		${extractConstAssignment(componentsSource, 'WORD_GLOW_SKIP')}
		${extractFunction(componentsSource, 'isWordGlowProseBlock')}
		${extractFunction(componentsSource, 'collectWordGlowTextNodes')}
		${extractFunction(componentsSource, 'wrapWordsInTextNode')}
		this.__helpers = {
			WORD_GLOW_SKIP,
			isWordGlowProseBlock,
			collectWordGlowTextNodes,
			wrapWordsInTextNode,
			document,
			NodeFilter,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'word-glow text helpers should load');
	return sandbox.__helpers;
}

function longProse(prefix = 'Owen writes about CS2 skins, setups, and streaming so often that') {
	const filler = ' word';
	let text = prefix;
	while (text.replace(/\s+/g, ' ').trim().length < 200) text += filler;
	return text;
}

test('collectWordGlowTextNodes accepts long prose and skips chrome, code, links, and existing glows', () => {
	const { collectWordGlowTextNodes } = loadWordGlowTextHelpers();
	const copy = longProse();

	const article = new FakeElement('div');
	const paragraph = new FakeElement('p');
	const emphasis = new FakeElement('em');
	emphasis.textContent = copy;
	paragraph.appendChild(emphasis);
	article.appendChild(paragraph);

	const accepted = Array.from(collectWordGlowTextNodes(article));
	assert.equal(accepted.length, 1);
	assert.equal(accepted[0].nodeValue, copy);

	const shortParagraph = new FakeElement('p');
	shortParagraph.textContent = 'Too short for per-word glow.';
	assert.equal(collectWordGlowTextNodes(shortParagraph).length, 0);

	const whitespaceOnly = new FakeElement('p');
	whitespaceOnly.appendChild(createTextNode('   \n\t  '));
	assert.equal(collectWordGlowTextNodes(whitespaceOnly).length, 0);

	const nav = new FakeElement('a');
	nav.className = 'site-nav-link';
	nav.setAttribute('href', '/');
	nav.textContent = copy;
	assert.equal(collectWordGlowTextNodes(nav).length, 0);

	const heading = new FakeElement('h2');
	heading.textContent = copy;
	assert.equal(collectWordGlowTextNodes(heading).length, 0);

	const code = new FakeElement('code');
	code.textContent = copy;
	assert.equal(collectWordGlowTextNodes(code).length, 0);

	const label = new FakeElement('p');
	label.className = 'keep-card__label';
	label.textContent = copy;
	assert.equal(collectWordGlowTextNodes(label).length, 0);

	const skipped = new FakeElement('p');
	skipped.setAttribute('data-no-word-glow', '');
	skipped.textContent = copy;
	assert.equal(collectWordGlowTextNodes(skipped).length, 0);

	const linked = new FakeElement('p');
	const anchor = new FakeElement('a');
	anchor.setAttribute('href', 'https://example.com/post');
	anchor.textContent = copy;
	linked.appendChild(anchor);
	assert.equal(collectWordGlowTextNodes(linked).length, 0);

	const alreadyWrapped = new FakeElement('p');
	const glow = new FakeElement('span');
	glow.className = 'text-word-glow';
	glow.textContent = copy;
	alreadyWrapped.appendChild(glow);
	assert.equal(collectWordGlowTextNodes(alreadyWrapped).length, 0);

	const lineGlow = new FakeElement('p');
	const line = new FakeElement('span');
	line.className = 'text-word-glow--line';
	const inner = new FakeElement('strong');
	inner.textContent = copy;
	line.appendChild(inner);
	lineGlow.appendChild(line);
	assert.equal(collectWordGlowTextNodes(lineGlow).length, 0);
});

test('wrapWordsInTextNode splits on whitespace and wraps only word tokens', () => {
	const { wrapWordsInTextNode } = loadWordGlowTextHelpers();
	const paragraph = new FakeElement('p');
	const original = createTextNode('Hello,   world.\nNext');
	paragraph.appendChild(original);

	wrapWordsInTextNode(original);

	assert.equal(original.parentNode, null);
	assert.equal(paragraph.childNodes.length, 5);

	const [hello, spaces, world, newline, next] = paragraph.childNodes;
	assert.equal(hello.className, 'text-word-glow');
	assert.equal(hello.textContent, 'Hello,');
	assert.equal(spaces.nodeValue, '   ');
	assert.equal(world.className, 'text-word-glow');
	assert.equal(world.textContent, 'world.');
	assert.equal(newline.nodeValue, '\n');
	assert.equal(next.className, 'text-word-glow');
	assert.equal(next.textContent, 'Next');
	assert.equal(paragraph.textContent, 'Hello,   world.\nNext');

	const padded = new FakeElement('p');
	const paddedNode = createTextNode('  pin  ');
	padded.appendChild(paddedNode);
	wrapWordsInTextNode(paddedNode);
	assert.equal(padded.childNodes.length, 3);
	assert.equal(padded.childNodes[0].nodeValue, '  ');
	assert.equal(padded.childNodes[1].className, 'text-word-glow');
	assert.equal(padded.childNodes[1].textContent, 'pin');
	assert.equal(padded.childNodes[2].nodeValue, '  ');
});
