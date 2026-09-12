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
}

function makeWrap(options = {}) {
	return {
		classList: new FakeClassList(options.classes || []),
		style: {
			left: options.left ?? '',
			top: options.top ?? '',
		},
	};
}

function loadDockRoundHelpers() {
	const sandbox = {
		Math,
		Number,
		String,
	};

	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(componentsSource, 'socialDockCoordsRounded')}
		${extractFunction(componentsSource, 'clampPlacedSocialDockInViewport')}
		this.__helpers = {
			socialDockCoordsRounded,
			clampPlacedSocialDockInViewport,
		};
		`,
		sandbox
	);

	return sandbox.__helpers;
}

test('socialDockCoordsRounded stores integer left/top without clamping to the viewport', () => {
	const { socialDockCoordsRounded } = loadDockRoundHelpers();

	const nearOrigin = socialDockCoordsRounded(12.4, 8.6);
	assert.equal(nearOrigin.left, 12);
	assert.equal(nearOrigin.top, 9);

	const offscreen = socialDockCoordsRounded(-40.4, -3.2);
	assert.equal(offscreen.left, -40);
	assert.equal(offscreen.top, -3);

	const zeros = socialDockCoordsRounded(0, 0);
	assert.equal(zeros.left, 0);
	assert.equal(zeros.top, 0);
});

test('clampPlacedSocialDockInViewport only rounds placed docks and leaves unplaced or invalid coords alone', () => {
	const { clampPlacedSocialDockInViewport } = loadDockRoundHelpers();

	const unplaced = makeWrap({ left: '12.4px', top: '8.6px' });
	assert.equal(clampPlacedSocialDockInViewport(unplaced), undefined);
	assert.equal(unplaced.style.left, '12.4px');
	assert.equal(unplaced.style.top, '8.6px');

	const missingCoords = makeWrap({
		classes: ['site-support-dock--placed'],
		left: '',
		top: '',
	});
	clampPlacedSocialDockInViewport(missingCoords);
	assert.equal(missingCoords.style.left, '');
	assert.equal(missingCoords.style.top, '');

	const placed = makeWrap({
		classes: ['site-support-dock--placed'],
		left: '12.4px',
		top: '8.6px',
	});
	clampPlacedSocialDockInViewport(placed);
	assert.equal(placed.style.left, '12px');
	assert.equal(placed.style.top, '9px');

	const offscreen = makeWrap({
		classes: ['site-support-dock--placed'],
		left: '-40.4px',
		top: '1800.2px',
	});
	clampPlacedSocialDockInViewport(offscreen);
	assert.equal(offscreen.style.left, '-40px');
	assert.equal(offscreen.style.top, '1800px');
});
