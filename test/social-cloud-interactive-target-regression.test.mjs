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

class Element {
	constructor(tagName = 'div', className = '') {
		this.tagName = String(tagName).toUpperCase();
		this.parent = null;
		this.className = className;
		this.classList = {
			contains: (name) =>
				String(this.className)
					.split(/\s+/)
					.filter(Boolean)
					.includes(name),
		};
	}

	matches(selector) {
		return String(selector)
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean)
			.some((part) => {
				if (part.startsWith('.')) {
					return this.classList.contains(part.slice(1));
				}
				return this.tagName.toLowerCase() === part.toLowerCase();
			});
	}

	closest(selector) {
		let node = this;
		while (node) {
			if (node.matches(selector)) return node;
			node = node.parent;
		}
		return null;
	}
}

function loadInteractiveHelper() {
	const sandbox = {
		Element,
		Boolean,
		String,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'isInteractiveCardTarget')}
		this.__helpers = { isInteractiveCardTarget };
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'interactive helper should load');
	return sandbox.__helpers.isInteractiveCardTarget;
}

function nest(parent, child) {
	child.parent = parent;
	return child;
}

test('isInteractiveCardTarget rejects non-elements and ordinary card chrome', () => {
	const isInteractiveCardTarget = loadInteractiveHelper();

	assert.equal(isInteractiveCardTarget(null), false);
	assert.equal(isInteractiveCardTarget(undefined), false);
	assert.equal(isInteractiveCardTarget('button'), false);
	assert.equal(isInteractiveCardTarget({ tagName: 'A' }), false);

	const card = new Element('article', 'smc-card');
	const media = nest(card, new Element('div', 'smc-player'));
	const title = nest(card, new Element('span', 'smc-title-text'));
	assert.equal(isInteractiveCardTarget(card), false);
	assert.equal(isInteractiveCardTarget(media), false);
	assert.equal(isInteractiveCardTarget(title), false);
});

test('isInteractiveCardTarget treats resize, description, embed, and inline-link targets as interactive', () => {
	const isInteractiveCardTarget = loadInteractiveHelper();

	const handle = new Element('div', 'smc-resize-handle');
	const handleGrip = nest(handle, new Element('span', 'grip'));
	assert.equal(isInteractiveCardTarget(handle), true);
	assert.equal(isInteractiveCardTarget(handleGrip), true);

	const toggle = new Element('button', 'smc-desc-toggle');
	const toggleLabel = nest(toggle, new Element('span', 'label'));
	assert.equal(isInteractiveCardTarget(toggle), true);
	assert.equal(isInteractiveCardTarget(toggleLabel), true);

	const iframe = new Element('iframe', 'smc-embed');
	const iframeInner = nest(iframe, new Element('div', 'poster'));
	assert.equal(isInteractiveCardTarget(iframe), true);
	assert.equal(isInteractiveCardTarget(iframeInner), true);

	const blurb = new Element('a', 'smc-inline-link');
	const blurbText = nest(blurb, new Element('span', 'caption'));
	assert.equal(isInteractiveCardTarget(blurb), true);
	assert.equal(isInteractiveCardTarget(blurbText), true);
});

test('isInteractiveCardTarget treats native controls as interactive even without special classes', () => {
	const isInteractiveCardTarget = loadInteractiveHelper();

	for (const tag of ['a', 'button', 'input', 'textarea', 'select']) {
		assert.equal(isInteractiveCardTarget(new Element(tag)), true, `${tag} should be interactive`);
	}

	assert.equal(isInteractiveCardTarget(new Element('p')), false);
	assert.equal(isInteractiveCardTarget(new Element('img', 'smc-thumb')), false);
	assert.equal(isInteractiveCardTarget(new Element('h3', 'smc-title')), false);
});
