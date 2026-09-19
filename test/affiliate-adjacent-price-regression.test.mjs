import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function extractClassMethod(source, methodName) {
	const needle = `\n\t${methodName}(`;
	const start = source.indexOf(needle);
	assert.notEqual(start, -1, `${methodName} should exist as a class method`);

	const paramsStart = source.indexOf('(', start);
	assert.notEqual(paramsStart, -1, `${methodName} should have parameters`);

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
	assert.notEqual(paramsEnd, -1, `${methodName} parameter list should close`);

	const braceStart = source.indexOf('{', paramsEnd);
	assert.notEqual(braceStart, -1, `${methodName} should have a body`);

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) {
				const signatureAndBody = source.slice(start + 1, i + 1).trimStart();
				return `function ${signatureAndBody}`;
			}
		}
	}

	assert.fail(`${methodName} body should close`);
}

function relinkSiblings(parent) {
	for (let i = 0; i < parent.children.length; i += 1) {
		parent.children[i].previousElementSibling = i > 0 ? parent.children[i - 1] : null;
	}
}

class FakeElement {
	constructor(tagName = 'div') {
		this.tagName = String(tagName).toUpperCase();
		this.children = [];
		this.parentNode = null;
		this.previousElementSibling = null;
		this.attrs = {};
		this._classSet = new Set();
		this.textContent = '';
		this._innerHTML = '';
		const el = this;
		this.classList = {
			contains(name) {
				return el._classSet.has(name);
			},
			add(name) {
				el._classSet.add(name);
			},
			remove(name) {
				el._classSet.delete(name);
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

	hasAttribute(name) {
		return Object.prototype.hasOwnProperty.call(this.attrs, name);
	}

	setAttribute(name, value = '') {
		this.attrs[name] = String(value);
	}

	matchesClass(sel) {
		if (!sel.startsWith('.')) return false;
		return this._classSet.has(sel.slice(1));
	}

	querySelector(sel) {
		for (const child of this.children) {
			if (child.matchesClass(sel)) return child;
			const nested = child.querySelector(sel);
			if (nested) return nested;
		}
		return null;
	}

	querySelectorAll(sel) {
		const out = [];
		const walk = (node) => {
			for (const child of node.children) {
				if (child.matchesClass(sel)) out.push(child);
				walk(child);
			}
		};
		walk(this);
		return out;
	}

	appendChild(child) {
		if (child.parentNode) child.parentNode.removeChild(child);
		child.parentNode = this;
		this.children.push(child);
		relinkSiblings(this);
		return child;
	}

	insertBefore(node, ref) {
		if (node.parentNode) node.parentNode.removeChild(node);
		node.parentNode = this;
		const idx = this.children.indexOf(ref);
		if (idx === -1) this.children.push(node);
		else this.children.splice(idx, 0, node);
		relinkSiblings(this);
		return node;
	}

	removeChild(child) {
		const idx = this.children.indexOf(child);
		if (idx !== -1) this.children.splice(idx, 1);
		child.parentNode = null;
		child.previousElementSibling = null;
		relinkSiblings(this);
		return child;
	}

	remove() {
		if (this.parentNode) this.parentNode.removeChild(this);
	}

	set innerHTML(value) {
		this._innerHTML = String(value);
		if (value === '') {
			for (const child of [...this.children]) this.removeChild(child);
		}
	}

	get innerHTML() {
		return this._innerHTML;
	}
}

function loadAffiliatePriceHelpers() {
	const source = readWorkspaceFile('scripts/affiliate-links.js');
	const sandbox = {
		URL,
		String,
		encodeURIComponent,
		Boolean,
		document: {
			createElement(tagName) {
				return new FakeElement(tagName);
			},
		},
		window: { location: { origin: 'https://owenminercs.com' } },
	};

	const methodNames = [
		'getPriceModel',
		'buildInlinePriceText',
		'findAdjacentPriceHost',
		'syncAdjacentPriceLabel',
		'alignCompactButtonsWithPrice',
	];

	vm.runInNewContext(
		[
			...methodNames.map((name) => extractClassMethod(source, name)),
			'const api = {};',
			...methodNames.map((name) => `api.${name} = ${name}.bind(api);`),
			'this.__helpers = api;',
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'affiliate price helpers should load');
	return sandbox.__helpers;
}

function makeSpan(className, text = '') {
	return {
		className,
		textContent: text,
		innerHTML: text,
	};
}

function makeSibling(span) {
	return {
		querySelector(selector) {
			if (selector === '.b_w_link' && span) return span;
			return null;
		},
		previousElementSibling: null,
	};
}

test('findAdjacentPriceHost returns the nearest previous sibling that contains .b_w_link', () => {
	const { findAdjacentPriceHost } = loadAffiliatePriceHelpers();
	const farther = makeSibling(makeSpan('b_w_link', '| $9'));
	const closerWithoutPrice = makeSibling(null);
	closerWithoutPrice.previousElementSibling = farther;
	const skipped = { previousElementSibling: closerWithoutPrice };
	const container = { previousElementSibling: skipped };

	assert.equal(findAdjacentPriceHost(container), farther);
	assert.equal(findAdjacentPriceHost(null), null);
	assert.equal(findAdjacentPriceHost({ previousElementSibling: null }), null);
});

test('syncAdjacentPriceLabel writes live then paid prices as textContent on the first .b_w_link', () => {
	const { syncAdjacentPriceLabel } = loadAffiliatePriceHelpers();
	const span = makeSpan('b_w_link', '| stale');
	const skipped = makeSibling(null);
	const host = makeSibling(span);
	skipped.previousElementSibling = host;
	const container = { previousElementSibling: skipped };

	syncAdjacentPriceLabel(container, {
		current_price: '$42.00',
		paid_price: '$30.00',
	});
	assert.equal(span.textContent, ' | Now $42.00');
	assert.equal(span.innerHTML, '| stale');

	syncAdjacentPriceLabel(container, {
		paid_price: '$18.50',
	});
	assert.equal(span.textContent, ' | $18.50');

	syncAdjacentPriceLabel(container, {
		price: '$12',
	});
	assert.equal(span.textContent, ' | $12');
});

test('syncAdjacentPriceLabel no-ops without a product, host, or price and never assigns HTML markup', () => {
	const { syncAdjacentPriceLabel } = loadAffiliatePriceHelpers();
	const span = makeSpan('b_w_link', '| keep');
	const host = makeSibling(span);
	const container = { previousElementSibling: host };

	syncAdjacentPriceLabel(null, { current_price: '$1' });
	syncAdjacentPriceLabel(container, null);
	syncAdjacentPriceLabel(container, { name: 'Lamp' });
	assert.equal(span.textContent, '| keep');

	syncAdjacentPriceLabel(container, {
		current_price: '<img src=x onerror=alert(1)>',
	});
	assert.equal(span.textContent, ' | Now <img src=x onerror=alert(1)>');
	assert.equal(span.innerHTML, '| keep');
});

test('alignCompactButtonsWithPrice wraps the price host and moves compact affiliate buttons onto that row', () => {
	const { alignCompactButtonsWithPrice } = loadAffiliatePriceHelpers();
	const parent = new FakeElement('div');
	const host = new FakeElement('p');
	const priceSpan = new FakeElement('span');
	priceSpan.className = 'b_w_link';
	priceSpan.textContent = '| $99';
	host.appendChild(priceSpan);

	const container = new FakeElement('div');
	container.setAttribute('data-affiliate-compact');
	const group = new FakeElement('div');
	group.className = 'product-links-group';
	const button = new FakeElement('a');
	button.className = 'affiliate-button';
	group.appendChild(button);
	container.appendChild(group);

	parent.appendChild(host);
	parent.appendChild(container);

	alignCompactButtonsWithPrice(container);

	assert.equal(parent.children.length, 2);
	const row = parent.children[0];
	assert.equal(row.className, 'affiliate-price-row');
	assert.ok(host.classList.contains('affiliate-price-host'));
	assert.equal(host.parentNode, row);
	assert.ok(group.classList.contains('affiliate-price-actions'));
	assert.equal(group.parentNode, row);
	assert.equal(container.children.length, 0);
	assert.equal(container.innerHTML, '');
	assert.equal(row.children[0], host);
	assert.equal(row.children[1], group);
});

test('alignCompactButtonsWithPrice no-ops unless compact, then reuses an existing row and drops stale actions', () => {
	const { alignCompactButtonsWithPrice } = loadAffiliatePriceHelpers();
	const parent = new FakeElement('div');
	const row = new FakeElement('div');
	row.className = 'affiliate-price-row';
	const host = new FakeElement('p');
	host.classList.add('affiliate-price-host');
	const priceSpan = new FakeElement('span');
	priceSpan.className = 'b_w_link';
	host.appendChild(priceSpan);
	row.appendChild(host);

	const stale = new FakeElement('div');
	stale.className = 'affiliate-price-actions';
	row.appendChild(stale);

	const container = new FakeElement('div');
	const group = new FakeElement('div');
	group.className = 'product-links-group';
	const button = new FakeElement('a');
	button.className = 'affiliate-button';
	group.appendChild(button);
	container.appendChild(group);

	parent.appendChild(row);
	parent.appendChild(container);

	alignCompactButtonsWithPrice(container);
	assert.equal(group.parentNode, container);
	assert.equal(stale.parentNode, row);

	container.setAttribute('data-affiliate-compact');
	alignCompactButtonsWithPrice(container);

	assert.equal(parent.children[0], row);
	assert.equal(stale.parentNode, null);
	assert.equal(group.parentNode, row);
	assert.ok(group.classList.contains('affiliate-price-actions'));
	assert.equal(container.children.length, 0);
});
