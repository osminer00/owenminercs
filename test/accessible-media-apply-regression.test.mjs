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

class FakeNode {
	constructor(tagName = 'div') {
		this.tagName = String(tagName).toUpperCase();
		this.children = [];
		this.parentNode = null;
		this.nextElementSibling = null;
		this.attrs = {};
		this._classSet = new Set();
		this.textContent = '';
		this.style = {};
		const el = this;
		this.classList = {
			contains(name) {
				return el._classSet.has(name);
			},
			add(name) {
				el._classSet.add(name);
			},
		};
	}

	get className() {
		return [...this._classSet].join(' ');
	}

	set className(value) {
		this._classSet = new Set(
			String(value || '')
				.split(/\s+/)
				.filter(Boolean)
		);
	}

	getAttribute(name) {
		return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
	}

	setAttribute(name, value = '') {
		this.attrs[name] = String(value);
	}

	appendChild(child) {
		if (child.parentNode) child.parentNode.removeChild(child);
		child.parentNode = this;
		this.children.push(child);
		relink(this);
		return child;
	}

	removeChild(child) {
		const idx = this.children.indexOf(child);
		if (idx !== -1) this.children.splice(idx, 1);
		child.parentNode = null;
		child.nextElementSibling = null;
		relink(this);
		return child;
	}

	insertAdjacentElement(position, node) {
		if (position !== 'afterend' || !this.parentNode) return node;
		const siblings = this.parentNode.children;
		const idx = siblings.indexOf(this);
		if (node.parentNode) node.parentNode.removeChild(node);
		node.parentNode = this.parentNode;
		siblings.splice(idx + 1, 0, node);
		relink(this.parentNode);
		return node;
	}

	closest(sel) {
		const selectors = String(sel)
			.split(',')
			.map((part) => part.trim());
		let node = this;
		while (node) {
			if (selectors.some((item) => node.matchesSimple(item))) return node;
			node = node.parentNode;
		}
		return null;
	}

	matchesSimple(sel) {
		if (!sel) return false;
		let rest = sel;
		let role = null;
		const attrStart = rest.indexOf('[');
		if (attrStart !== -1) {
			const attr = rest.slice(attrStart);
			rest = rest.slice(0, attrStart);
			const roleMatch = attr.match(/\[role="([^"]+)"\]/);
			if (!roleMatch) return false;
			role = roleMatch[1];
		}
		if (role && this.attrs.role !== role) return false;
		if (rest.startsWith('.')) return this._classSet.has(rest.slice(1));
		if (rest.includes('.')) {
			const [tag, className] = rest.split('.');
			return this.tagName === tag.toUpperCase() && this._classSet.has(className);
		}
		return this.tagName === rest.toUpperCase();
	}

	querySelector(sel) {
		const selectors = String(sel)
			.split(',')
			.map((part) => part.trim());
		const stack = [...this.children];
		while (stack.length) {
			const node = stack.shift();
			if (selectors.some((item) => node.matchesSimple(item))) return node;
			stack.unshift(...node.children);
		}
		return null;
	}

	querySelectorAll(sel) {
		if (sel.includes(',')) {
			const groups = sel.split(',').map((part) => part.trim());
			const out = [];
			for (const group of groups) {
				out.push(...this.querySelectorAll(group));
			}
			return out;
		}
		if (sel.includes(' ')) {
			const [ancestorSel, childSel] = sel.split(/\s+/);
			const out = [];
			const visit = (node) => {
				if (node !== this && node.matchesSimple(ancestorSel)) {
					out.push(...collectMatching(node, childSel));
				}
				for (const child of node.children) visit(child);
			};
			visit(this);
			return out;
		}
		return collectMatching(this, sel);
	}
}

function collectMatching(root, sel) {
	const out = [];
	const visit = (node) => {
		for (const child of node.children) {
			if (child.matchesSimple(sel)) out.push(child);
			visit(child);
		}
	};
	visit(root);
	return out;
}

function relink(parent) {
	for (let i = 0; i < parent.children.length; i += 1) {
		parent.children[i].nextElementSibling = parent.children[i + 1] || null;
	}
}

function loadAccessibleMediaApply() {
	const source = readWorkspaceFile('scripts/accessible-media.js');
	const sandbox = {
		String,
		Array,
		Boolean,
		document: {
			createElement(tagName) {
				return new FakeNode(tagName);
			},
		},
	};

	vm.runInNewContext(
		[
			extractFunction(source, 'cleanText'),
			extractFunction(source, 'clipText'),
			extractFunction(source, 'pathToWords'),
			extractFunction(source, 'isWeakAlt'),
			extractFunction(source, 'closestHeadingText'),
			extractFunction(source, 'buildAltText'),
			extractFunction(source, 'buildCaption'),
			extractFunction(source, 'ensureCaptionElement'),
			extractFunction(source, 'applySetupCards'),
			extractFunction(source, 'applyLegacySetupImages'),
			extractFunction(source, 'describePhoto'),
			extractFunction(source, 'captionPhoto'),
			`this.__helpers = {
				ensureCaptionElement,
				applySetupCards,
				applyLegacySetupImages,
				describePhoto,
				captionPhoto,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'accessible-media apply helpers should load');
	return sandbox.__helpers;
}

test('applySetupCards writes keep-card alt and Open aria-labels without clobbering existing names', () => {
	const { applySetupCards } = loadAccessibleMediaApply();

	const labeled = new FakeNode('article');
	labeled.className = 'keep-card';
	const label = new FakeNode('div');
	label.className = 'keep-card__label';
	label.textContent = 'Monitor';
	const thumb = new FakeNode('img');
	thumb.className = 'keep-card__thumb';
	thumb.setAttribute('alt', 'photo');
	thumb.setAttribute('src', 'images/monitor.png');
	labeled.appendChild(label);
	labeled.appendChild(thumb);

	const named = new FakeNode('article');
	named.className = 'keep-card';
	named.setAttribute('aria-label', 'Custom card name');
	const namedThumb = new FakeNode('img');
	namedThumb.className = 'keep-card__thumb';
	namedThumb.setAttribute('alt', 'Dedicated monitor shot');
	named.appendChild(namedThumb);

	const empty = new FakeNode('article');
	empty.className = 'keep-card';
	const emptyLabel = new FakeNode('div');
	emptyLabel.className = 'keep-card__label';
	emptyLabel.textContent = 'Keyboard';
	const emptyThumb = new FakeNode('div');
	emptyThumb.className = 'keep-card__thumb--empty';
	emptyThumb.setAttribute('role', 'img');
	empty.appendChild(emptyLabel);
	empty.appendChild(emptyThumb);

	const unlabeledEmpty = new FakeNode('article');
	unlabeledEmpty.className = 'keep-card';
	const unlabeledThumb = new FakeNode('div');
	unlabeledThumb.className = 'keep-card__thumb--empty';
	unlabeledThumb.setAttribute('role', 'img');
	unlabeledEmpty.appendChild(unlabeledThumb);

	const root = new FakeNode('main');
	root.appendChild(labeled);
	root.appendChild(named);
	root.appendChild(empty);
	root.appendChild(unlabeledEmpty);

	applySetupCards(root);

	assert.equal(thumb.getAttribute('alt'), 'Monitor in Owen Miner setup');
	assert.equal(labeled.getAttribute('aria-label'), 'Open Monitor');
	assert.equal(named.getAttribute('aria-label'), 'Custom card name');
	assert.equal(namedThumb.getAttribute('alt'), 'Dedicated monitor shot');
	assert.equal(emptyThumb.getAttribute('aria-label'), 'Keyboard photo coming soon');
	assert.equal(unlabeledThumb.getAttribute('aria-label'), 'Product photo coming soon');
});

test('applyLegacySetupImages captions standalone setup photos but not keep-card or photography tiles', () => {
	const { applyLegacySetupImages } = loadAccessibleMediaApply();

	const page = new FakeNode('main');

	const panorama = new FakeNode('div');
	panorama.className = 'setup-panorama';
	const heading = new FakeNode('h2');
	heading.textContent = 'Desk cable pass';
	const panoramaImg = new FakeNode('img');
	panoramaImg.setAttribute('alt', 'img');
	panoramaImg.setAttribute('src', 'images/desk-cables.png');
	panorama.appendChild(heading);
	panorama.appendChild(panoramaImg);
	page.appendChild(panorama);

	const keepCard = new FakeNode('article');
	keepCard.className = 'keep-card';
	const column = new FakeNode('div');
	column.className = 'column';
	const keepImg = new FakeNode('img');
	keepImg.setAttribute('alt', 'picture');
	keepImg.setAttribute('src', 'images/keep.png');
	column.appendChild(keepImg);
	keepCard.appendChild(column);
	page.appendChild(keepCard);

	const tile = new FakeNode('div');
	tile.className = 'photography-tile';
	const bd4 = new FakeNode('div');
	bd4.className = 'bd4';
	const tileImg = new FakeNode('img');
	tileImg.setAttribute('alt', 'Existing photography alt text');
	tileImg.setAttribute('src', 'images/photo.jpg');
	bd4.appendChild(tileImg);
	tile.appendChild(bd4);
	page.appendChild(tile);

	applyLegacySetupImages(page);

	assert.equal(panoramaImg.getAttribute('alt'), 'Desk cable pass');
	assert.equal(panoramaImg.nextElementSibling.className, 'auto-media-caption');
	assert.equal(panoramaImg.nextElementSibling.textContent, 'Desk cable pass');
	assert.equal(keepImg.nextElementSibling, null, 'keep-card images do not get extra captions');
	assert.equal(tileImg.nextElementSibling, null, 'photography tiles keep their own captions');
	assert.equal(tileImg.getAttribute('alt'), 'Existing photography alt text');
});

test('ensureCaptionElement fills empty captions and describePhoto/captionPhoto stay null-safe', () => {
	const { ensureCaptionElement, describePhoto, captionPhoto } = loadAccessibleMediaApply();

	assert.doesNotThrow(() => ensureCaptionElement(null, 'Caption'));

	const parent = new FakeNode('div');
	const img = new FakeNode('img');
	parent.appendChild(img);
	const existing = new FakeNode('p');
	existing.className = 'auto-media-caption';
	existing.textContent = '';
	parent.appendChild(existing);

	ensureCaptionElement(img, 'Filled from helper');
	assert.equal(existing.textContent, 'Filled from helper');
	assert.equal(parent.children.length, 2, 'existing caption node is reused');

	existing.textContent = 'Keep this';
	ensureCaptionElement(img, 'Should not replace');
	assert.equal(existing.textContent, 'Keep this');

	assert.equal(describePhoto(null), 'Owen Miner photo');
	assert.equal(describePhoto({ title: 'Trail' }, 2024), 'Trail in Owen Miner photo from 2024');
	assert.equal(
		describePhoto({ alt: 'A clear shot of the desk from the doorway' }),
		'A clear shot of the desk from the doorway'
	);
	assert.equal(captionPhoto(null), 'Setup photo');
	assert.equal(captionPhoto({ caption: '  Signed print  ', title: 'ignored' }), 'Signed print');
	assert.equal(captionPhoto({ title: 'Studio lamp' }), 'Studio lamp');
});
