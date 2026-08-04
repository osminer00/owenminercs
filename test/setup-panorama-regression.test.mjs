import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function readWorkspaceFile(relativePath) {
	return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

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

function loadPanoramaHelpers() {
	const source = readWorkspaceFile('scripts/setup-panorama.js');
	const sandbox = {
		Math,
	};

	vm.runInNewContext(
		[
			'var panX = 0.25;',
			'var panY = 0.75;',
			extractFunction(source, 'clamp'),
			extractFunction(source, 'txTyFromPan'),
			extractFunction(source, 'panFromTxTy'),
			extractFunction(source, 'triangleWave'),
			`this.__helpers = {
				clamp,
				txTyFromPan,
				panFromTxTy,
				triangleWave,
				getPan: function () { return { panX: panX, panY: panY }; },
				setPan: function (x, y) { panX = x; panY = y; },
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'setup-panorama helpers should load');
	return sandbox.__helpers;
}

const helpers = loadPanoramaHelpers();

test('setup-panorama clamp bounds values inclusively', () => {
	const { clamp } = helpers;

	assert.equal(clamp(0.5, 0, 1), 0.5);
	assert.equal(clamp(-2, 0, 1), 0);
	assert.equal(clamp(3, 0, 1), 1);
});

test('setup-panorama triangleWave produces a 0-1-0 cycle', () => {
	const { triangleWave } = helpers;

	assert.equal(triangleWave(0), 0);
	assert.equal(triangleWave(0.25), 0.5);
	assert.equal(triangleWave(0.5), 1);
	assert.equal(triangleWave(0.75), 0.5);
	assert.equal(triangleWave(1), 0);
	assert.equal(triangleWave(1.25), 0.5);
});

test('setup-panorama txTyFromPan centers when image fits and pans when overflowed', () => {
	const { txTyFromPan, setPan } = helpers;

	setPan(0.25, 0.75);

	const fitted = txTyFromPan(400, 300, 200, 150, 1);
	assert.equal(fitted.rangeX, 200);
	assert.equal(fitted.rangeY, 150);
	assert.equal(fitted.tx, 100);
	assert.equal(fitted.ty, 75);

	const overflowed = txTyFromPan(400, 300, 800, 600, 1);
	assert.equal(overflowed.rangeX, -400);
	assert.equal(overflowed.rangeY, -300);
	assert.equal(overflowed.tx, -100);
	assert.equal(overflowed.ty, -225);
});

test('setup-panorama panFromTxTy normalizes transforms and clamps overflow pans', () => {
	const { panFromTxTy, getPan, setPan } = helpers;

	setPan(0, 0);
	panFromTxTy(50, 40, 100, 80);
	let pan = getPan();
	assert.equal(pan.panX, 0.5);
	assert.equal(pan.panY, 0.5);

	panFromTxTy(-50, -20, -200, -100);
	pan = getPan();
	assert.equal(pan.panX, 0.25);
	assert.equal(pan.panY, 0.2);

	panFromTxTy(20, -200, -100, -100);
	pan = getPan();
	assert.equal(pan.panX, 0);
	assert.equal(pan.panY, 1);
});
