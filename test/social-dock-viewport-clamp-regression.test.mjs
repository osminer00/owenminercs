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
			if (depth === 0) return source.slice(start, i + 1);
		}
	}

	assert.fail(`${functionName} body should close`);
}

function makeDockWrap(size) {
	const wrap = {
		style: { left: '', top: '' },
		querySelector(selector) {
			return selector === '.site-social-nav__spin' ? probe : null;
		},
	};
	const probe = {
		getBoundingClientRect() {
			const left = Number.parseFloat(wrap.style.left);
			const top = Number.parseFloat(wrap.style.top);
			const x = Number.isFinite(left) ? left : 0;
			const y = Number.isFinite(top) ? top : 0;
			return {
				left: x,
				top: y,
				right: x + size.width,
				bottom: y + size.height,
				width: size.width,
				height: size.height,
			};
		},
	};
	return wrap;
}

function loadClampHelper(viewport = { innerWidth: 800, innerHeight: 600 }) {
	const sandbox = {
		Math,
		Number,
		window: {
			innerWidth: viewport.innerWidth,
			innerHeight: viewport.innerHeight,
		},
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(componentsSource, 'clampSocialDockToViewport')}
		this.__helpers = { clampSocialDockToViewport };
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('clampSocialDockToViewport leaves in-bounds default placement alone', () => {
	const { clampSocialDockToViewport } = loadClampHelper();
	const wrap = makeDockWrap({ width: 120, height: 40 });

	const result = clampSocialDockToViewport(wrap, 40, 80);
	assert.equal(result.left, 40);
	assert.equal(result.top, 80);
	assert.equal(wrap.style.left, '40px');
	assert.equal(wrap.style.top, '80px');
});

test('clampSocialDockToViewport pulls overflow back to a 2px viewport margin', () => {
	const { clampSocialDockToViewport } = loadClampHelper({
		innerWidth: 800,
		innerHeight: 600,
	});
	const wrap = makeDockWrap({ width: 100, height: 40 });

	const fromNegative = clampSocialDockToViewport(wrap, -50, -20);
	assert.equal(fromNegative.left, 2);
	assert.equal(fromNegative.top, 2);

	const fromRight = clampSocialDockToViewport(wrap, 750, 10);
	assert.equal(fromRight.left, 698);
	assert.equal(fromRight.top, 10);

	const fromBottom = clampSocialDockToViewport(wrap, 10, 590);
	assert.equal(fromBottom.left, 10);
	assert.equal(fromBottom.top, 558);
});

test('clampSocialDockToViewport uses transformed spin bounds instead of layout size', () => {
	const { clampSocialDockToViewport } = loadClampHelper({
		innerWidth: 800,
		innerHeight: 600,
	});
	const wrap = makeDockWrap({ width: 80, height: 300 });

	const result = clampSocialDockToViewport(wrap, 20, 400);
	assert.equal(result.left, 20);
	assert.equal(result.top, 298);
	assert.equal(wrap.style.top, '298px');
});
