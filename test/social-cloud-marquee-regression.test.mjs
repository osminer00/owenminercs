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

	remove(...names) {
		for (const name of names) this._set.delete(name);
	}

	toggle(name, force) {
		if (force === true) {
			this._set.add(name);
			return true;
		}
		if (force === false) {
			this._set.delete(name);
			return false;
		}
		if (this._set.has(name)) {
			this._set.delete(name);
			return false;
		}
		this._set.add(name);
		return true;
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
		this.dataset = {};
		this.attributes = {};
		this._textContent = '';
		this.clientWidth = 0;
		this.scrollWidth = 0;
		this.scrollLeft = 0;
		this.hidden = false;
		this.isConnected = false;
		this.listeners = {};
		this.style = {
			props: {},
			setProperty(name, value) {
				this.props[name] = String(value);
			},
		};
	}

	get className() {
		return this._className || this.classList.toArray().join(' ');
	}

	set className(value) {
		this._className = String(value);
		this.classList = new FakeClassList(String(value).trim().split(/\s+/).filter(Boolean));
	}

	get textContent() {
		return this._textContent;
	}

	set textContent(value) {
		this._textContent = String(value);
	}

	appendChild(child) {
		if (child.parent) {
			const siblings = child.parent.children;
			const idx = siblings.indexOf(child);
			if (idx >= 0) siblings.splice(idx, 1);
		}
		this.children.push(child);
		child.parent = this;
		child.isConnected = this.isConnected;
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

	addEventListener(type, fn) {
		this.listeners[type] = this.listeners[type] || [];
		this.listeners[type].push(fn);
	}

	scrollBy({ left = 0 } = {}) {
		this.scrollLeft += Number(left) || 0;
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

	matchesOne(selector) {
		let main = selector;
		let notClass = null;
		const notMatch = selector.match(/^(.*):not\(\.([^)]+)\)$/);
		if (notMatch) {
			main = notMatch[1];
			notClass = notMatch[2];
		}
		if (notClass && this.classList.contains(notClass)) return false;
		if (main.startsWith('.')) {
			return main
				.slice(1)
				.split('.')
				.filter(Boolean)
				.every((cls) => this.classList.contains(cls));
		}
		return this.tagName.toLowerCase() === main.toLowerCase();
	}

	matches(selector) {
		return String(selector)
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean)
			.some((part) => this.matchesOne(part));
	}

	querySelector(selector) {
		return this.descendants().find((el) => el.matches(selector)) || null;
	}

	closest(selector) {
		let node = this;
		while (node) {
			if (node.matches && node.matches(selector)) return node;
			node = node.parent;
		}
		return null;
	}
}

function loadMarqueeHelpers() {
	const document = {
		createElement(tag) {
			return new HTMLElement(tag);
		},
	};

	const sandbox = {
		String,
		Number,
		Math,
		Boolean,
		HTMLElement,
		document,
		window: {
			requestAnimationFrame(callback) {
				callback();
				return 1;
			},
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'buildMetaMarqueeRoot')}
		${extractFunction(socialCloudSource, 'refreshMetaMarquee')}
		${extractFunction(socialCloudSource, 'refreshTitleMarquee')}
		this.__helpers = {
			buildMetaMarqueeRoot,
			refreshMetaMarquee,
			refreshTitleMarquee,
		};
		`,
		sandbox
	);

	assert.ok(sandbox.__helpers, 'marquee helpers should load');
	return sandbox.__helpers;
}

function styleProp(el, name) {
	return el.style.props[name];
}

test('buildMetaMarqueeRoot builds date and stats tracks with an aria-hidden clone', () => {
	const { buildMetaMarqueeRoot } = loadMarqueeHelpers();

	const date = buildMetaMarqueeRoot('date');
	assert.ok(date.root instanceof HTMLElement);
	assert.ok(date.root.classList.contains('smc-meta-line-marquee'));
	assert.ok(date.root.classList.contains('smc-meta-line-marquee--date'));
	assert.ok(date.text.classList.contains('smc-meta-line-text'));
	assert.ok(date.text.classList.contains('smc-date'));
	assert.ok(date.clone.classList.contains('smc-meta-line-text-clone'));
	assert.ok(date.clone.classList.contains('smc-date'));
	assert.equal(date.clone.getAttribute('aria-hidden'), 'true');
	assert.equal(date.root.children[0].children[0], date.text);
	assert.equal(date.root.children[0].children[1], date.clone);

	const stats = buildMetaMarqueeRoot('stats');
	assert.ok(stats.root.classList.contains('smc-meta-line-marquee--stats'));
	assert.ok(stats.text.classList.contains('smc-stats'));
	assert.ok(!stats.text.classList.contains('smc-date'));
});

test('refreshMetaMarquee no-ops without a real HTMLElement and binds wheel scrolling once', () => {
	const { refreshMetaMarquee, buildMetaMarqueeRoot } = loadMarqueeHelpers();

	assert.equal(refreshMetaMarquee(null), undefined);
	assert.equal(refreshMetaMarquee({ classList: { contains() { return false; } } }), undefined);

	const { root, text } = buildMetaMarqueeRoot('date');
	text.textContent = 'Published 12 May 2024';
	root.clientWidth = 80;
	text.scrollWidth = 200;
	refreshMetaMarquee(root);
	assert.equal((root.listeners.wheel || []).length, 1);
	refreshMetaMarquee(root);
	assert.equal((root.listeners.wheel || []).length, 1);
	assert.equal(root.dataset.wheelScrollBound, '1');
});

test('refreshMetaMarquee marquees overflowing dates but never auto-scrolls the stats line', () => {
	const { refreshMetaMarquee, buildMetaMarqueeRoot } = loadMarqueeHelpers();

	const date = buildMetaMarqueeRoot('date');
	date.text.textContent = 'A long published date that should marquee';
	date.root.clientWidth = 120;
	date.text.scrollWidth = 400;
	refreshMetaMarquee(date.root);
	assert.equal(date.clone.textContent, date.text.textContent);
	assert.ok(date.root.classList.contains('is-overflow'));
	assert.equal(styleProp(date.root, '--smc-scroll-duration'), `${7 + Math.min(14, 400 / 55)}s`);
	assert.equal(styleProp(date.root, '--smc-scroll-distance'), '420px');

	date.root.clientWidth = 400;
	date.text.scrollWidth = 120;
	refreshMetaMarquee(date.root);
	assert.ok(!date.root.classList.contains('is-overflow'));
	assert.equal(styleProp(date.root, '--smc-scroll-duration'), '0s');
	assert.equal(styleProp(date.root, '--smc-scroll-distance'), '0px');

	const stats = buildMetaMarqueeRoot('stats');
	stats.text.textContent = '12.4k views · 880 likes';
	stats.clone.textContent = 'stale clone';
	stats.root.clientWidth = 80;
	stats.text.scrollWidth = 220;
	stats.root.scrollLeft = 18;
	refreshMetaMarquee(stats.root);
	assert.equal(stats.clone.textContent, '');
	assert.ok(stats.root.classList.contains('is-overflow'));
	assert.equal(styleProp(stats.root, '--smc-scroll-duration'), '0s');
	assert.equal(styleProp(stats.root, '--smc-scroll-distance'), '240px');
	assert.equal(stats.root.scrollLeft, 18);

	stats.root.clientWidth = 300;
	stats.text.scrollWidth = 80;
	refreshMetaMarquee(stats.root);
	assert.ok(!stats.root.classList.contains('is-overflow'));
	assert.equal(stats.root.scrollLeft, 0);
	assert.equal(styleProp(stats.root, '--smc-scroll-distance'), '0px');
});

test('refreshMetaMarquee wheel handler only scrolls overflowing chrome and prefers the larger axis', () => {
	const { refreshMetaMarquee, buildMetaMarqueeRoot } = loadMarqueeHelpers();
	const { root, text } = buildMetaMarqueeRoot('date');
	text.textContent = 'Date';
	root.clientWidth = 40;
	text.scrollWidth = 120;
	refreshMetaMarquee(root);
	const onWheel = root.listeners.wheel[0];

	let prevented = 0;
	onWheel({
		deltaX: 3,
		deltaY: 10,
		preventDefault() {
			prevented += 1;
		},
	});
	assert.equal(prevented, 1);
	assert.equal(root.scrollLeft, 10);

	root.classList.toggle('is-overflow', false);
	onWheel({
		deltaX: 8,
		deltaY: 1,
		preventDefault() {
			prevented += 1;
		},
	});
	assert.equal(prevented, 1);
	assert.equal(root.scrollLeft, 10);
});

test('refreshTitleMarquee ignores detached roots and clears overflow on a hidden heading', () => {
	const { refreshTitleMarquee } = loadMarqueeHelpers();

	const detached = new HTMLElement('span');
	detached.className = 'smc-title-marquee';
	detached.isConnected = false;
	assert.equal(refreshTitleMarquee(detached), undefined);

	const heading = new HTMLElement('h3');
	heading.className = 'smc-title';
	heading.hidden = true;
	heading.isConnected = true;
	const root = new HTMLElement('span');
	root.className = 'smc-title-marquee';
	root.isConnected = true;
	root.classList.add('is-overflow');
	const text = new HTMLElement('span');
	text.className = 'smc-title-text';
	text.textContent = 'Pinned title';
	const clone = new HTMLElement('span');
	clone.className = 'smc-title-text-clone';
	clone.textContent = 'stale';
	root.appendChild(text);
	root.appendChild(clone);
	heading.appendChild(root);

	refreshTitleMarquee(root);
	assert.equal(clone.textContent, '');
	assert.ok(!root.classList.contains('is-overflow'));
	assert.equal(styleProp(root, '--smc-scroll-duration'), '0s');
	assert.equal(styleProp(root, '--smc-scroll-distance'), '0px');

	heading.hidden = false;
	root.clientWidth = 90;
	text.scrollWidth = 260;
	refreshTitleMarquee(root);
	assert.equal(clone.textContent, 'Pinned title');
	assert.ok(root.classList.contains('is-overflow'));
	assert.equal(styleProp(root, '--smc-scroll-duration'), `${7 + Math.min(14, 260 / 55)}s`);
	assert.equal(styleProp(root, '--smc-scroll-distance'), '280px');
});
