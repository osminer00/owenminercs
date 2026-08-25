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

class FakeElement {
	constructor(tagName = 'div') {
		this.tagName = String(tagName).toUpperCase();
		this.childNodes = [];
		this.parentElement = null;
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
		if (child.parentElement && typeof child.parentElement.removeChild === 'function') {
			child.parentElement.removeChild(child);
		}
		child.parentElement = this;
		this.childNodes.push(child);
		return child;
	}

	removeChild(child) {
		this.childNodes = this.childNodes.filter((node) => node !== child);
		child.parentElement = null;
		return child;
	}

	replaceChildren() {
		for (const child of this.childNodes) child.parentElement = null;
		this.childNodes = [];
		this._text = '';
	}

	matchesOne(part) {
		const selector = String(part).trim();
		if (!selector) return false;
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

	querySelector(selector) {
		if (selector.startsWith(':scope > ')) {
			const childSelector = selector.slice(':scope > '.length);
			return this.childNodes.find((child) => child instanceof FakeElement && child.matches(childSelector)) || null;
		}
		for (const child of this.descendants()) {
			if (child.matches(selector)) return child;
		}
		return null;
	}

	querySelectorAll(selector) {
		if (selector === 'a[href]') {
			return Array.from(this.descendants()).filter(
				(child) => child.tagName === 'A' && child.getAttribute('href')
			);
		}
		return Array.from(this.descendants()).filter((child) => child.matches(selector));
	}
}

class FakeAnchor extends FakeElement {
	constructor() {
		super('a');
	}
}

function createTextNode(value) {
	return { nodeType: 3, nodeValue: String(value), textContent: String(value), parentElement: null };
}

function loadWordGlowHelpers() {
	const document = {
		createElement(tag) {
			return tag === 'a' ? new FakeAnchor() : new FakeElement(tag);
		},
		createTextNode,
	};

	const sandbox = {
		String,
		Boolean,
		Array,
		Element: FakeElement,
		HTMLAnchorElement: FakeAnchor,
		document,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		const WORD_GLOW_MIN_PROSE_CHARS = 200;
		${extractFunction(componentsSource, 'isWordGlowProseBlock')}
		${extractFunction(componentsSource, 'shouldWrapLinkAsLineGlow')}
		${extractFunction(componentsSource, 'wrapLinkContentsInLineGlow')}
		${extractFunction(componentsSource, 'wrapAllEligibleLinksAsLineGlow')}
		${extractFunction(componentsSource, 'flattenLegacyKeepCardLabel')}
		this.__helpers = {
			isWordGlowProseBlock,
			shouldWrapLinkAsLineGlow,
			wrapLinkContentsInLineGlow,
			wrapAllEligibleLinksAsLineGlow,
			flattenLegacyKeepCardLabel,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'word-glow helpers should load');
	return sandbox.__helpers;
}

function makeAnchor({ href = 'https://example.com/post', text = 'Read more', className = '', parent = null } = {}) {
	const anchor = new FakeAnchor();
	if (href != null) anchor.setAttribute('href', href);
	anchor.className = className;
	if (text) anchor.textContent = text;
	if (parent) parent.appendChild(anchor);
	return anchor;
}

test('word-glow prose gate only accepts long p/li copy', () => {
	const { isWordGlowProseBlock } = loadWordGlowHelpers();
	const longCopy = 'word '.repeat(50).trim();
	assert.ok(longCopy.replace(/\s+/g, ' ').trim().length >= 200);

	const paragraph = new FakeElement('p');
	paragraph.textContent = longCopy;
	const nested = new FakeElement('em');
	paragraph.appendChild(nested);
	assert.equal(isWordGlowProseBlock(nested), true);

	const shortParagraph = new FakeElement('p');
	shortParagraph.textContent = 'Short nav-like copy.';
	assert.equal(isWordGlowProseBlock(shortParagraph), false);

	const heading = new FakeElement('h2');
	heading.textContent = longCopy;
	assert.equal(isWordGlowProseBlock(heading), false);

	const listItem = new FakeElement('li');
	listItem.textContent = `   ${longCopy}   \n\n`;
	assert.equal(isWordGlowProseBlock(listItem), true);
});

test('link line-glow skips chrome, empty hrefs, and image-only anchors', () => {
	const { shouldWrapLinkAsLineGlow } = loadWordGlowHelpers();

	assert.equal(shouldWrapLinkAsLineGlow({}), false);
	assert.equal(shouldWrapLinkAsLineGlow(makeAnchor({ href: '   ' })), false);
	assert.equal(shouldWrapLinkAsLineGlow(makeAnchor({ href: null, text: 'Missing href' })), false);

	const alreadyWrapped = makeAnchor();
	const existingGlow = new FakeElement('span');
	existingGlow.className = 'text-word-glow';
	alreadyWrapped.replaceChildren();
	alreadyWrapped.appendChild(existingGlow);
	assert.equal(shouldWrapLinkAsLineGlow(alreadyWrapped), false);

	const nested = makeAnchor({ text: 'outer' });
	nested.appendChild(makeAnchor({ href: 'https://example.com/inner', text: 'inner' }));
	assert.equal(shouldWrapLinkAsLineGlow(nested), false);

	assert.equal(shouldWrapLinkAsLineGlow(makeAnchor({ className: 'site-nav-link' })), false);
	assert.equal(shouldWrapLinkAsLineGlow(makeAnchor({ className: 'site-logo-link' })), false);
	assert.equal(shouldWrapLinkAsLineGlow(makeAnchor({ className: 'site-social-nav__link' })), false);
	assert.equal(shouldWrapLinkAsLineGlow(makeAnchor({ className: 'site-header-search-open' })), false);
	assert.equal(shouldWrapLinkAsLineGlow(makeAnchor({ className: 'donators-support-hero' })), false);
	assert.equal(shouldWrapLinkAsLineGlow(makeAnchor({ className: 'keep-card__cta' })), false);

	const inSocialNav = makeAnchor();
	const socialNav = new FakeElement('div');
	socialNav.className = 'site-social-nav';
	socialNav.appendChild(inSocialNav);
	assert.equal(shouldWrapLinkAsLineGlow(inSocialNav), false);

	const inPre = makeAnchor({ text: 'code link' });
	const pre = new FakeElement('pre');
	pre.appendChild(inPre);
	assert.equal(shouldWrapLinkAsLineGlow(inPre), false);

	const skipped = makeAnchor();
	const skipRoot = new FakeElement('div');
	skipRoot.setAttribute('data-no-word-glow', '');
	skipRoot.appendChild(skipped);
	assert.equal(shouldWrapLinkAsLineGlow(skipped), false);

	const imageOnly = makeAnchor({ text: '' });
	imageOnly.appendChild(new FakeElement('img'));
	imageOnly.appendChild(createTextNode('\u00a0'));
	assert.equal(shouldWrapLinkAsLineGlow(imageOnly), false);

	const eligible = makeAnchor({ href: '/QA/qa', text: 'Ask a question' });
	assert.equal(shouldWrapLinkAsLineGlow(eligible), true);
});

test('eligible links wrap contents once in a line-glow span', () => {
	const { wrapAllEligibleLinksAsLineGlow } = loadWordGlowHelpers();
	const root = new FakeElement('div');
	const eligible = makeAnchor({ href: 'https://example.com/a', text: 'Article' });
	const nav = makeAnchor({ href: '/', text: 'Home', className: 'site-nav-link' });
	root.appendChild(eligible);
	root.appendChild(nav);

	wrapAllEligibleLinksAsLineGlow(root);

	assert.equal(eligible.childNodes.length, 1);
	assert.equal(eligible.childNodes[0].className, 'text-word-glow text-word-glow--line');
	assert.equal(eligible.childNodes[0].textContent, 'Article');
	assert.equal(nav.querySelector('.text-word-glow'), null);
});

test('legacy keep-card labels flatten clipped marquee markup to plain text', () => {
	const { flattenLegacyKeepCardLabel } = loadWordGlowHelpers();
	const untouched = new FakeElement('p');
	untouched.className = 'keep-card__label keep-card__label--overflow';
	untouched.textContent = 'Monitor Arms';
	flattenLegacyKeepCardLabel(untouched);
	assert.equal(untouched.classList.contains('keep-card__label--overflow'), true);
	assert.equal(untouched.textContent, 'Monitor Arms');
	assert.ok(untouched.querySelector('.keep-card__label-clip') == null);

	const label = new FakeElement('p');
	label.className = 'keep-card__label keep-card__label--overflow';
	const clip = new FakeElement('span');
	clip.className = 'keep-card__label-clip';
	clip.textContent = '  Elgato Wave Mic Arm  ';
	label.appendChild(clip);

	flattenLegacyKeepCardLabel(label);

	assert.equal(label.classList.contains('keep-card__label--overflow'), false);
	assert.equal(label.querySelector('.keep-card__label-clip'), null);
	assert.equal(label.textContent, 'Elgato Wave Mic Arm');
});
