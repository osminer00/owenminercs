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

function extractConstObject(source, constName) {
	const start = source.indexOf(`const ${constName} = `);
	assert.notEqual(start, -1, `${constName} should exist`);

	const braceStart = source.indexOf('{', start);
	assert.notEqual(braceStart, -1, `${constName} should have an object body`);

	let depth = 0;
	for (let i = braceStart; i < source.length; i += 1) {
		const char = source[i];
		if (char === '{') depth += 1;
		if (char === '}') {
			depth -= 1;
			if (depth === 0) {
				let end = i + 1;
				if (source[end] === ';') end += 1;
				return source.slice(start, end);
			}
		}
	}

	assert.fail(`${constName} object should close`);
}

function loadConfigHelpers() {
	const source = readWorkspaceFile('scripts/cs2-config-explainer.js');
	const sandbox = {
		String,
		Number,
		Set,
		Array,
		Math,
	};

	vm.runInNewContext(
		[
			extractFunction(source, 'numericRangeCheck'),
			extractFunction(source, 'boolCheck'),
			extractFunction(source, 'enumCheck'),
			extractConstObject(source, 'KNOWN_COMMANDS'),
			extractFunction(source, 'stripComment'),
			extractFunction(source, 'tokenize'),
			extractFunction(source, 'cleanToken'),
			extractFunction(source, 'analyzeLine'),
			`this.__helpers = {
				KNOWN_COMMANDS,
				stripComment,
				tokenize,
				cleanToken,
				analyzeLine,
			};`,
		].join('\n'),
		sandbox
	);

	assert.ok(sandbox.__helpers, 'CS2 config helpers should load');
	return sandbox.__helpers;
}

const helpers = loadConfigHelpers();

test('CS2 config tokenizer strips comments and preserves quoted arguments', () => {
	const { stripComment, tokenize, cleanToken } = helpers;

	assert.equal(stripComment('sensitivity 1.5 // hipfire'), 'sensitivity 1.5 ');
	assert.equal(stripComment('bind "f" "slot1"'), 'bind "f" "slot1"');
	assert.equal(stripComment('// whole line'), '');

	assert.deepEqual(Array.from(tokenize('bind "kp_end" "buy vest; buy vesthelm"')), [
		'bind',
		'"kp_end"',
		'"buy vest; buy vesthelm"',
	]);
	assert.deepEqual(Array.from(tokenize('sensitivity 1.25')), ['sensitivity', '1.25']);
	assert.deepEqual(Array.from(tokenize('   ')), []);

	assert.equal(cleanToken('"quoted value"'), 'quoted value');
	assert.equal(cleanToken('plain'), 'plain');
});

test('CS2 config analyzeLine explains known commands and flags risky values', () => {
	const { analyzeLine, KNOWN_COMMANDS } = helpers;

	assert.ok(KNOWN_COMMANDS.sensitivity, 'sensitivity rule should exist');
	assert.ok(KNOWN_COMMANDS.sv_cheats, 'sv_cheats rule should exist');

	assert.equal(analyzeLine('   // comment only', 1), null);
	assert.equal(analyzeLine('   ', 2), null);

	const okSensitivity = analyzeLine('sensitivity 1.2', 3);
	assert.equal(okSensitivity.command, 'sensitivity');
	assert.equal(okSensitivity.value, '1.2');
	assert.equal(okSensitivity.warning, '');
	assert.match(okSensitivity.explanation, /mouse sensitivity/i);

	const warnSensitivity = analyzeLine('sensitivity 99', 4);
	assert.match(warnSensitivity.warning, /0\.4 to 3\.0/);

	const nonNumeric = analyzeLine('fps_max abc', 5);
	assert.equal(nonNumeric.warning, 'Expected a numeric value.');

	const cheats = analyzeLine('sv_cheats 1', 6);
	assert.match(cheats.warning, /enables cheats/i);
	assert.equal(analyzeLine('sv_cheats 0', 7).warning, '');

	const boolBad = analyzeLine('m_rawinput 2', 8);
	assert.equal(boolBad.warning, 'Expected 0 or 1.');

	const bind = analyzeLine('bind "f" "+lookatweapon"', 9);
	assert.equal(bind.command, 'bind');
	assert.equal(bind.value, 'f +lookatweapon');
	assert.equal(bind.warning, '');

	const unknown = analyzeLine('my_custom_alias 1', 10);
	assert.equal(unknown.command, 'my_custom_alias');
	assert.match(unknown.explanation, /Custom or less common command/);
	assert.equal(unknown.warning, '');

	const legacy = analyzeLine('cl_interp 0.015625', 11);
	assert.match(legacy.warning, /legacy/i);
});
