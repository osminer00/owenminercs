import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const socialCloudSource = readFileSync(
	new URL('../Socials/scripts/social-cloud.js', import.meta.url),
	'utf8'
);

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

function loadAngleHelpers() {
	const sandbox = {};
	vm.createContext(sandbox);
	vm.runInContext(
		`
		${extractFunction(socialCloudSource, 'normalizeAngleDelta')}
		this.__helpers = { normalizeAngleDelta };
		`,
		sandbox
	);
	assert.ok(sandbox.__helpers, 'angle helpers should load');
	return sandbox.__helpers;
}

test('normalizeAngleDelta keeps values inside (-180, 180]', () => {
	const { normalizeAngleDelta } = loadAngleHelpers();

	assert.equal(normalizeAngleDelta(0), 0);
	assert.equal(normalizeAngleDelta(180), 180);
	assert.equal(normalizeAngleDelta(-180), -180);
	assert.equal(normalizeAngleDelta(90), 90);
	assert.equal(normalizeAngleDelta(-90), -90);
});

test('normalizeAngleDelta unwraps atan2 wraparound so rotate drags do not jump a full turn', () => {
	const { normalizeAngleDelta } = loadAngleHelpers();

	// Crossing the ±180 discontinuity by 1 degree must take the short arc.
	assert.equal(normalizeAngleDelta(181), -179);
	assert.equal(normalizeAngleDelta(-181), 179);
	assert.equal(normalizeAngleDelta(179.5 - -179.5), -1);

	assert.equal(normalizeAngleDelta(360), 0);
	assert.equal(normalizeAngleDelta(-360), 0);
	assert.equal(normalizeAngleDelta(540), 180);
	assert.equal(normalizeAngleDelta(-540), -180);
	assert.equal(normalizeAngleDelta(720), 0);
	assert.equal(normalizeAngleDelta(-721), -1);
});
