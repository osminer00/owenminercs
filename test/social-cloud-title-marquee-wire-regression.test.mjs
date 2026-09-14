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

class FakeClassList {
	constructor(initial = []) {
		this._set = new Set(initial);
	}

	contains(name) {
		return this._set.has(name);
	}

	add(name) {
		this._set.add(name);
	}

	toArray() {
		return Array.from(this._set);
	}
}

class HTMLElement {
	constructor(tagName = 'SPAN') {
		this.tagName = String(tagName).toUpperCase();
		this.children = [];
		this.parent = null;
		this._className = '';
		this.classList = new FakeClassList();
		this.attributes = {};
	}

	get className() {
		return this._className || this.classList.toArray().join(' ');
	}

	set className(value) {
		this._className = String(value);
		this.classList = new FakeClassList(String(value).trim().split(/\s+/).filter(Boolean));
	}

	appendChild(child) {
		if (child.parent) {
			const siblings = child.parent.children;
			const idx = siblings.indexOf(child);
			if (idx >= 0) siblings.splice(idx, 1);
		}
		this.children.push(child);
		child.parent = this;
		return child;
	}

	setAttribute(name, value) {
		this.attributes[name] = String(value);
	}

	getAttribute(name) {
		return Object.prototype.hasOwnProperty.call(this.attributes, name)
			? this.attributes[name]
			: null;
	}

	querySelector(selector) {
		return this.descendants().find((el) => el.matches(selector)) || null;
	}

	matches(selector) {
		if (!selector.startsWith('.')) return false;
		return selector
			.slice(1)
			.split('.')
			.filter(Boolean)
			.every((cls) => this.classList.contains(cls));
	}

	descendants() {
		const out = [];
		const walk = (node) => {
			for (const child of node.children) {
				out.push(child);
				walk(child);
			}
		};
		walk(this);
		return out;
	}
}

function loadWireHelper() {
	const document = {
		createElement(tag) {
			return new HTMLElement(tag);
		},
	};
	const sandbox = { document, HTMLElement };
	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'wireTitleMarqueeHeading')}
		this.__helpers = { wireTitleMarqueeHeading };
		`,
		sandbox
	);
	assert.ok(sandbox.__helpers, 'title marquee wire helper should load');
	return sandbox.__helpers;
}

test('wireTitleMarqueeHeading mounts the title track, live text, and aria-hidden clone', () => {
	const { wireTitleMarqueeHeading } = loadWireHelper();
	const heading = new HTMLElement('H3');
	heading.className = 'smc-title';

	wireTitleMarqueeHeading(heading);

	assert.equal(heading.children.length, 1);
	const root = heading.children[0];
	assert.equal(root.className, 'smc-title-marquee');

	const track = root.children[0];
	assert.equal(track.className, 'smc-title-track');
	assert.equal(track.children.length, 2);

	const text = heading.querySelector('.smc-title-text');
	const clone = heading.querySelector('.smc-title-text-clone');
	assert.ok(text);
	assert.ok(clone);
	assert.equal(text.className, 'smc-title-text');
	assert.equal(clone.className, 'smc-title-text-clone');
	assert.equal(clone.getAttribute('aria-hidden'), 'true');
	assert.equal(text.parent, track);
	assert.equal(clone.parent, track);
});
